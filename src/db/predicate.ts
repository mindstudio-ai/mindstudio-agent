/**
 * Predicate compiler — converts JS arrow functions to SQL WHERE clauses.
 *
 * This is the core complexity of the `db` namespace. When users write:
 *
 * ```ts
 * orders.filter(o => o.status === 'active' && o.amount > 5000)
 * ```
 *
 * ...the compiler parses the function's source code and produces:
 *
 * ```sql
 * WHERE status = 'active' AND amount > 5000
 * ```
 *
 * ## How it works
 *
 * 1. **Extract source**: Call `fn.toString()` to get the arrow function source
 * 2. **Identify parameter**: Parse the arrow function parameter name (`o` in `o => ...`)
 * 3. **Tokenize**: Break the body into tokens (identifiers, strings, numbers, operators)
 * 4. **Parse**: Recursive descent parser builds a small AST
 * 5. **Compile**: Walk the AST and emit SQL fragments
 *
 * ## Supported patterns (v1)
 *
 * - Field comparisons: `o.field === 'value'`, `!==`, `<`, `>`, `<=`, `>=`
 * - Null checks: `o.field === null`, `o.field != null`, `o.field === undefined`
 * - Logical operators: `&&` (AND), `||` (OR), `!expr` (NOT)
 * - Boolean fields: `o.active` (truthy), `!o.deleted` (falsy)
 * - Array.includes for IN: `['a','b'].includes(o.field)` → `field IN ('a','b')`
 * - Field.includes for LIKE: `o.field.includes('text')` → `field LIKE '%text%'`
 * - Closure variables: values captured from the enclosing scope
 *
 * ## Fallback strategy
 *
 * If the compiler encounters ANY pattern it doesn't recognize, it returns
 * `null` instead of a SQL string. The caller (Query/Table) then fetches
 * all rows and runs the original JS function as a filter. This means
 * filter() always works — there are no runtime errors from unsupported
 * expressions. The SQL path is a transparent performance optimization.
 *
 * A warning is logged on fallback so developers know they're on the slow path.
 *
 * ## Closure variable resolution
 *
 * When the predicate references a variable that isn't the parameter name
 * (e.g. `o => o.userId === currentUserId`), we need to resolve `currentUserId`
 * to its actual value. We do this by calling the original function with a
 * Proxy that records property accesses, then comparing against known patterns.
 * If resolution fails, we fall back to JS.
 */

import { escapeValue } from './sql.js';
import type { CompiledPredicate, Predicate } from './types.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Attempt to compile a predicate function to a SQL WHERE clause.
 *
 * @param fn - The predicate function (e.g. `o => o.status === 'active'`)
 * @returns A CompiledPredicate: either `{ type: 'sql', where }` or `{ type: 'js', fn }`
 *
 * @example
 * ```ts
 * const result = compilePredicate(o => o.status === 'active');
 * // { type: 'sql', where: "status = 'active'" }
 *
 * const result = compilePredicate(o => o.name.startsWith('A'));
 * // { type: 'js', fn: [original function] }
 * ```
 */
export function compilePredicate<T>(fn: Predicate<T>): CompiledPredicate<T> {
  try {
    const source = fn.toString();
    const paramName = extractParamName(source);
    if (!paramName) return { type: 'js', fn, reason: 'could not extract parameter name' };

    const body = extractBody(source);
    if (!body) return { type: 'js', fn, reason: 'could not extract function body' };

    const tokens = tokenize(body);
    if (tokens.length === 0) return { type: 'js', fn, reason: 'empty token stream' };

    // Parse into an AST and compile to SQL
    const parser = new Parser(tokens, paramName, fn);
    const ast = parser.parseExpression();
    if (!ast) return { type: 'js', fn, reason: 'could not parse expression' };

    // Make sure we consumed all tokens (no trailing garbage)
    if (parser.pos < tokens.length) return { type: 'js', fn, reason: 'unexpected tokens after expression' };

    const where = compileNode(ast);
    if (!where) return { type: 'js', fn, reason: 'could not compile to SQL' };

    return { type: 'sql', where };
  } catch (err) {
    return { type: 'js', fn, reason: `compilation error: ${(err as Error)?.message || 'unknown'}` };
  }
}

// ---------------------------------------------------------------------------
// Source extraction — get the parameter name and body from fn.toString()
// ---------------------------------------------------------------------------

/**
 * Extract the parameter name from an arrow function source.
 *
 * Handles:
 * - `x => ...`
 * - `(x) => ...`
 * - `(x: Type) => ...` (TypeScript — toString() may include types)
 *
 * Returns null if the pattern doesn't match (e.g. regular function,
 * destructured params, multiple params).
 */
function extractParamName(source: string): string | null {
  // Match: `paramName =>` or `(paramName) =>` or `(paramName: type) =>`
  const match = source.match(
    /^\s*(?:\(?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?::[^)]*?)?\)?\s*=>)/,
  );
  return match?.[1] ?? null;
}

/**
 * Extract the expression body from an arrow function source.
 *
 * Handles:
 * - `x => expr` (concise body)
 * - `x => { return expr; }` (block body with single return)
 * - `(x) => expr`
 *
 * Returns null for block bodies with multiple statements.
 */
function extractBody(source: string): string | null {
  // Find the `=>` and take everything after it
  const arrowIdx = source.indexOf('=>');
  if (arrowIdx === -1) return null;

  let body = source.slice(arrowIdx + 2).trim();

  // Block body: `{ return expr; }` → extract the expression
  if (body.startsWith('{')) {
    const match = body.match(/^\{\s*return\s+([\s\S]+?)\s*;?\s*\}$/);
    if (!match) return null; // Multiple statements or no return
    body = match[1];
  }

  return body.trim() || null;
}

// ---------------------------------------------------------------------------
// Tokenizer — breaks the expression body into typed tokens
// ---------------------------------------------------------------------------

/** Token types produced by the tokenizer. */
type TokenType =
  | 'identifier'   // variable names, keywords (true, false, null, undefined)
  | 'number'       // numeric literals
  | 'string'       // string literals (single or double quoted)
  | 'operator'     // ===, !==, ==, !=, <, >, <=, >=, &&, ||, !
  | 'dot'          // .
  | 'lparen'       // (
  | 'rparen'       // )
  | 'lbracket'     // [
  | 'rbracket'     // ]
  | 'comma';       // ,

interface Token {
  type: TokenType;
  value: string;
}

/**
 * Tokenize an expression string into a flat array of typed tokens.
 *
 * This is intentionally simple — it handles the subset of JavaScript
 * that appears in common filter predicates. Unknown characters cause
 * the tokenizer to return an empty array (triggering JS fallback).
 */
function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // String literals (single or double quoted)
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let str = '';
      i++; // skip opening quote
      while (i < expr.length && expr[i] !== quote) {
        if (expr[i] === '\\') {
          // Handle escape sequences
          i++;
          if (i < expr.length) str += expr[i];
        } else {
          str += expr[i];
        }
        i++;
      }
      if (i >= expr.length) return []; // Unterminated string
      i++; // skip closing quote
      tokens.push({ type: 'string', value: str });
      continue;
    }

    // Template literals — we can't reliably parse these, fall back
    if (ch === '`') return [];

    // Numbers (integers and decimals)
    if (/[0-9]/.test(ch) || (ch === '-' && i + 1 < expr.length && /[0-9]/.test(expr[i + 1]))) {
      let num = ch;
      i++;
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i];
        i++;
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // Multi-character operators (must check before single-character)
    if (expr.slice(i, i + 3) === '===' || expr.slice(i, i + 3) === '!==') {
      tokens.push({ type: 'operator', value: expr.slice(i, i + 3) });
      i += 3;
      continue;
    }
    if (expr.slice(i, i + 2) === '==' || expr.slice(i, i + 2) === '!=' ||
        expr.slice(i, i + 2) === '<=' || expr.slice(i, i + 2) === '>=' ||
        expr.slice(i, i + 2) === '&&' || expr.slice(i, i + 2) === '||') {
      tokens.push({ type: 'operator', value: expr.slice(i, i + 2) });
      i += 2;
      continue;
    }

    // Single-character operators and punctuation
    if (ch === '!' || ch === '<' || ch === '>') {
      tokens.push({ type: 'operator', value: ch });
      i++;
      continue;
    }
    if (ch === '.') { tokens.push({ type: 'dot', value: '.' }); i++; continue; }
    if (ch === '(') { tokens.push({ type: 'lparen', value: '(' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'rparen', value: ')' }); i++; continue; }
    if (ch === '[') { tokens.push({ type: 'lbracket', value: '[' }); i++; continue; }
    if (ch === ']') { tokens.push({ type: 'rbracket', value: ']' }); i++; continue; }
    if (ch === ',') { tokens.push({ type: 'comma', value: ',' }); i++; continue; }

    // Identifiers (variable names, keywords)
    if (/[a-zA-Z_$]/.test(ch)) {
      let ident = ch;
      i++;
      while (i < expr.length && /[a-zA-Z0-9_$]/.test(expr[i])) {
        ident += expr[i];
        i++;
      }
      tokens.push({ type: 'identifier', value: ident });
      continue;
    }

    // Unknown character — bail out to JS fallback
    return [];
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// AST node types — the small tree the parser builds
// ---------------------------------------------------------------------------

/** A comparison like `field === 'value'` or `field > 5`. */
interface ComparisonNode {
  kind: 'comparison';
  field: string;       // SQL column name (may include json_extract for nested)
  operator: string;    // SQL operator: =, !=, <, >, <=, >=, IS, IS NOT
  value: unknown;      // The literal value to compare against
}

/** A logical AND or OR combining two expressions. */
interface LogicalNode {
  kind: 'logical';
  operator: 'AND' | 'OR';
  left: AstNode;
  right: AstNode;
}

/** A NOT wrapping an expression. */
interface NotNode {
  kind: 'not';
  operand: AstNode;
}

/** A field IS NULL or IS NOT NULL check. */
interface NullCheckNode {
  kind: 'nullCheck';
  field: string;
  isNull: boolean;     // true = IS NULL, false = IS NOT NULL
}

/** A field IN ('a', 'b', 'c') expression (from ['a','b'].includes(o.field)). */
interface InNode {
  kind: 'in';
  field: string;
  values: unknown[];
}

/** A field LIKE '%text%' expression (from o.field.includes('text')). */
interface LikeNode {
  kind: 'like';
  field: string;
  pattern: string;     // The LIKE pattern with % wildcards
}

/** A boolean field check: `o.active` (truthy) compiles to `active = 1`. */
interface BooleanFieldNode {
  kind: 'booleanField';
  field: string;
  negated: boolean;    // true for `!o.active`
}

type AstNode =
  | ComparisonNode
  | LogicalNode
  | NotNode
  | NullCheckNode
  | InNode
  | LikeNode
  | BooleanFieldNode;

// ---------------------------------------------------------------------------
// Parser — recursive descent over the token stream
// ---------------------------------------------------------------------------

/**
 * Recursive descent parser that builds an AST from the token stream.
 *
 * Grammar (simplified):
 *
 *   expression  → or_expr
 *   or_expr     → and_expr ( '||' and_expr )*
 *   and_expr    → not_expr ( '&&' not_expr )*
 *   not_expr    → '!' not_expr | primary
 *   primary     → comparison | null_check | includes | boolean_field | '(' expression ')'
 *
 * The parser is deliberately conservative — it returns null for anything
 * it doesn't confidently understand, which triggers the JS fallback.
 */
class Parser {
  pos = 0;

  constructor(
    private tokens: Token[],
    private paramName: string,
    private originalFn: Function,
  ) {}

  /** Peek at the current token without consuming it. */
  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  /** Consume the current token and advance. */
  private advance(): Token {
    return this.tokens[this.pos++];
  }

  /** Check if the current token matches an expected type and value. */
  private match(type: TokenType, value?: string): boolean {
    const t = this.peek();
    if (!t) return false;
    if (t.type !== type) return false;
    if (value !== undefined && t.value !== value) return false;
    return true;
  }

  /** Consume a token if it matches, otherwise return false. */
  private eat(type: TokenType, value?: string): boolean {
    if (this.match(type, value)) {
      this.advance();
      return true;
    }
    return false;
  }

  // --- Grammar rules ---

  /** Entry point: parse a full expression. */
  parseExpression(): AstNode | null {
    return this.parseOr();
  }

  /** or_expr → and_expr ( '||' and_expr )* */
  private parseOr(): AstNode | null {
    let left = this.parseAnd();
    if (!left) return null;

    while (this.match('operator', '||')) {
      this.advance();
      const right = this.parseAnd();
      if (!right) return null;
      left = { kind: 'logical', operator: 'OR', left, right };
    }

    return left;
  }

  /** and_expr → not_expr ( '&&' not_expr )* */
  private parseAnd(): AstNode | null {
    let left = this.parseNot();
    if (!left) return null;

    while (this.match('operator', '&&')) {
      this.advance();
      const right = this.parseNot();
      if (!right) return null;
      left = { kind: 'logical', operator: 'AND', left, right };
    }

    return left;
  }

  /** not_expr → '!' not_expr | primary */
  private parseNot(): AstNode | null {
    if (this.match('operator', '!')) {
      this.advance();

      // Check for `!(expr)` — parenthesized negation
      if (this.match('lparen')) {
        this.advance();
        const inner = this.parseExpression();
        if (!inner) return null;
        if (!this.eat('rparen')) return null;
        return { kind: 'not', operand: inner };
      }

      // Check for `!o.field` — negated boolean field
      const inner = this.parsePrimary();
      if (!inner) return null;

      // If it's a boolean field, just flip the negation
      if (inner.kind === 'booleanField') {
        return { ...inner, negated: !inner.negated };
      }

      return { kind: 'not', operand: inner };
    }

    return this.parsePrimary();
  }

  /**
   * primary → field_comparison | null_check | includes_expr | paren_expr | boolean_field
   *
   * This is the workhorse — handles the different patterns that can appear
   * as atomic expressions within a larger &&/|| combination.
   */
  private parsePrimary(): AstNode | null {
    // Parenthesized expression: `(expr)`
    if (this.match('lparen')) {
      this.advance();
      const inner = this.parseExpression();
      if (!inner) return null;
      if (!this.eat('rparen')) return null;
      return inner;
    }

    // Array literal: `['a', 'b'].includes(o.field)` → IN expression
    if (this.match('lbracket')) {
      return this.parseArrayIncludes();
    }

    // Starts with the parameter name: field access pattern
    if (this.match('identifier', this.paramName)) {
      return this.parseFieldExpression();
    }

    // Starts with a different identifier — could be a closure variable
    // or a keyword (true, false, null, undefined)
    if (this.match('identifier')) {
      return this.parseNonParamExpression();
    }

    // Literal value on the left side of a comparison (unusual but valid)
    // e.g. `null !== o.field` — too complex for v1, fall back
    return null;
  }

  /**
   * Parse an expression that starts with the parameter name (e.g. `o.field`).
   *
   * Could be:
   * - `o.field === value` (comparison)
   * - `o.field != null` (null check)
   * - `o.field.includes('text')` (LIKE)
   * - `o.field` alone (boolean field check)
   */
  private parseFieldExpression(): AstNode | null {
    this.advance(); // consume param name

    // Read the field path: o.field or o.nested.field
    const field = this.parseFieldPath();
    if (!field) return null;

    // Check what follows the field access
    const next = this.peek();

    // Field.includes('text') → LIKE
    if (next?.type === 'dot' && this.lookAheadForIncludes()) {
      return this.parseFieldIncludes(field);
    }

    // Comparison operator: ===, !==, ==, !=, <, >, <=, >=
    if (next?.type === 'operator' && isComparisonOp(next.value)) {
      return this.parseComparison(field);
    }

    // No operator follows — this is a boolean field check: `o.active`
    return { kind: 'booleanField', field, negated: false };
  }

  /**
   * Parse a dot-separated field path after the parameter name.
   * `o.status` → `"status"`, `o.address.city` → `"json_extract(address, '$.city')"`.
   */
  private parseFieldPath(): string | null {
    if (!this.eat('dot')) return null;

    if (!this.match('identifier')) return null;
    const parts: string[] = [this.advance().value];

    // Check for nested access: o.a.b.c
    while (this.match('dot') && this.tokens[this.pos + 1]?.type === 'identifier') {
      this.advance(); // consume dot
      parts.push(this.advance().value);
    }

    if (parts.length === 1) {
      return parts[0];
    }

    // Nested access: use json_extract for SQLite JSON columns
    // o.address.city → json_extract(address, '$.city')
    const root = parts[0];
    const jsonPath = '$.' + parts.slice(1).join('.');
    return `json_extract(${root}, '${jsonPath}')`;
  }

  /**
   * Parse a comparison: `field OP value`.
   * The field has already been parsed; we need the operator and right-hand value.
   */
  private parseComparison(field: string): AstNode | null {
    const opToken = this.advance(); // consume operator
    const jsOp = opToken.value;

    // Parse the right-hand side value
    const value = this.parseValue();
    if (value === PARSE_FAILED) return null;

    // Null comparisons get special SQL syntax (IS NULL / IS NOT NULL)
    if (value === null || value === undefined) {
      if (jsOp === '===' || jsOp === '==') {
        return { kind: 'nullCheck', field, isNull: true };
      }
      if (jsOp === '!==' || jsOp === '!=') {
        return { kind: 'nullCheck', field, isNull: false };
      }
      return null; // < null, > null, etc. — nonsensical, fall back
    }

    // Map JS operators to SQL operators
    const sqlOp = JS_TO_SQL_OP[jsOp];
    if (!sqlOp) return null;

    return { kind: 'comparison', field, operator: sqlOp, value };
  }

  /**
   * Parse `o.field.includes('text')` → LIKE expression.
   * The field name has already been parsed.
   */
  private parseFieldIncludes(field: string): AstNode | null {
    this.advance(); // consume dot
    this.advance(); // consume 'includes'
    if (!this.eat('lparen')) return null;

    const value = this.parseValue();
    if (value === PARSE_FAILED || typeof value !== 'string') return null;

    if (!this.eat('rparen')) return null;

    // Escape % and _ in the search string (they're LIKE wildcards)
    const escaped = value.replace(/%/g, '\\%').replace(/_/g, '\\_');
    return { kind: 'like', field, pattern: `%${escaped}%` };
  }

  /**
   * Parse `['a', 'b', 'c'].includes(o.field)` → IN expression.
   * The opening bracket has been peeked but not consumed.
   */
  private parseArrayIncludes(): AstNode | null {
    this.advance(); // consume [

    // Parse array literal values
    const values: unknown[] = [];
    while (!this.match('rbracket')) {
      if (values.length > 0) {
        if (!this.eat('comma')) return null;
      }
      const val = this.parseValue();
      if (val === PARSE_FAILED) return null;
      values.push(val);
    }
    this.advance(); // consume ]

    // Expect .includes(o.field)
    if (!this.eat('dot')) return null;
    if (!this.match('identifier', 'includes')) return null;
    this.advance(); // consume 'includes'
    if (!this.eat('lparen')) return null;

    // The argument should be a field access: o.field
    if (!this.match('identifier', this.paramName)) return null;
    this.advance(); // consume param name
    const field = this.parseFieldPath();
    if (!field) return null;

    if (!this.eat('rparen')) return null;

    return { kind: 'in', field, values };
  }

  /**
   * Parse an expression that starts with an identifier that is NOT the
   * parameter name. This could be:
   * - A keyword literal: `true`, `false`, `null`, `undefined`
   * - A closure variable used in a comparison (handled by backtracking)
   */
  private parseNonParamExpression(): AstNode | null {
    const ident = this.peek()!.value;

    // Keyword literals on their own aren't useful as filter expressions
    // They'd only appear as `true` or `false` which is a constant predicate —
    // not worth optimizing. Fall back to JS.
    if (ident === 'true' || ident === 'false') return null;

    // This could be a closure variable in a reversed comparison:
    // `someVar === o.field` — we don't support LHS-variable comparisons in v1
    // Fall back to JS.
    return null;
  }

  /**
   * Parse a literal value or closure variable reference.
   *
   * Returns the parsed value, or PARSE_FAILED if parsing fails.
   * Returns `null` or `undefined` for those keyword literals.
   */
  private parseValue(): unknown {
    const t = this.peek();
    if (!t) return PARSE_FAILED;

    // String literal
    if (t.type === 'string') {
      this.advance();
      return t.value;
    }

    // Number literal
    if (t.type === 'number') {
      this.advance();
      return Number(t.value);
    }

    // Keyword literals
    if (t.type === 'identifier') {
      if (t.value === 'true') { this.advance(); return true; }
      if (t.value === 'false') { this.advance(); return false; }
      if (t.value === 'null') { this.advance(); return null; }
      if (t.value === 'undefined') { this.advance(); return undefined; }

      // Closure variable — try to resolve its value by calling the
      // original function with a Proxy. We build a proxy that records
      // which fields are accessed, then inspect the comparison.
      return this.resolveClosureVariable();
    }

    // Negative number: -42
    if (t.type === 'operator' && t.value === '-') {
      this.advance();
      const next = this.peek();
      if (next?.type === 'number') {
        this.advance();
        return -Number(next.value);
      }
      return PARSE_FAILED;
    }

    return PARSE_FAILED;
  }

  /**
   * Attempt to resolve a closure variable's value.
   *
   * This handles the common pattern:
   * ```ts
   * const userId = auth.userId;
   * orders.filter(o => o.requestedBy === userId)
   * ```
   *
   * Closure variable resolution is fundamentally limited in JavaScript —
   * we can't access another function's closure scope from outside without
   * `eval`. The `===` operator can't be overridden via Proxy or
   * Symbol.toPrimitive, so we can't intercept comparisons.
   *
   * For now, this falls back to JS execution. The predicate still works
   * correctly — it just scans all rows instead of generating SQL.
   * This is the most common reason for JS fallback in practice, since
   * almost every real-world filter references a variable like `userId`.
   *
   * A future improvement could accept an explicit `vars` argument:
   * ```ts
   * orders.filter(o => o.requestedBy === $userId, { $userId: auth.userId })
   * ```
   */
  private resolveClosureVariable(): unknown {
    // Consume the identifier (and any dotted access like closureVar.prop)
    this.advance();
    while (this.match('dot') && this.tokens[this.pos + 1]?.type === 'identifier') {
      this.advance();
      this.advance();
    }

    return PARSE_FAILED;
  }

  /**
   * Look ahead to check if the next tokens form `.includes(`.
   * Used to disambiguate `o.field.includes(...)` from `o.field.nested`.
   */
  private lookAheadForIncludes(): boolean {
    // We need: dot + 'includes' + lparen
    return (
      this.tokens[this.pos]?.type === 'dot' &&
      this.tokens[this.pos + 1]?.type === 'identifier' &&
      this.tokens[this.pos + 1]?.value === 'includes' &&
      this.tokens[this.pos + 2]?.type === 'lparen'
    );
  }
}

// ---------------------------------------------------------------------------
// AST → SQL compilation
// ---------------------------------------------------------------------------

/**
 * Compile an AST node to a SQL WHERE clause fragment.
 * Returns null if any node can't be compiled.
 */
function compileNode(node: AstNode): string | null {
  switch (node.kind) {
    case 'comparison':
      return `${node.field} ${node.operator} ${escapeValue(node.value)}`;

    case 'nullCheck':
      return `${node.field} ${node.isNull ? 'IS NULL' : 'IS NOT NULL'}`;

    case 'in': {
      if (node.values.length === 0) return '0'; // empty IN → always false
      const vals = node.values.map(escapeValue).join(', ');
      return `${node.field} IN (${vals})`;
    }

    case 'like':
      return `${node.field} LIKE ${escapeValue(node.pattern)}`;

    case 'booleanField':
      // `o.active` → `active = 1`, `!o.active` → `active = 0`
      return node.negated ? `${node.field} = 0` : `${node.field} = 1`;

    case 'logical': {
      const left = compileNode(node.left);
      const right = compileNode(node.right);
      if (!left || !right) return null;
      return `(${left} ${node.operator} ${right})`;
    }

    case 'not': {
      const inner = compileNode(node.operand);
      if (!inner) return null;
      return `NOT (${inner})`;
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Constants and helpers
// ---------------------------------------------------------------------------

/**
 * Mapping from JavaScript comparison operators to SQL equivalents.
 * Strict and loose equality both map to `=` (SQL has no strict equality).
 */
const JS_TO_SQL_OP: Record<string, string> = {
  '===': '=',
  '==': '=',
  '!==': '!=',
  '!=': '!=',
  '<': '<',
  '>': '>',
  '<=': '<=',
  '>=': '>=',
};

/** Sentinel value indicating a parse failure (distinct from `undefined`). */
const PARSE_FAILED = Symbol('PARSE_FAILED');

/** Check if a token value is a comparison operator. */
function isComparisonOp(value: string): boolean {
  return value in JS_TO_SQL_OP;
}

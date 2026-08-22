/**
 * JSON Schema support for task-agent structured output.
 *
 * The dialect is a deliberately bounded subset of JSON Schema — the shape
 * used for Anthropic tool `input_schema` / OpenAI function parameters:
 * `type` (including type arrays for nullability), `properties`, `required`,
 * `additionalProperties`, `items`, `enum`, `const`. Everything in this file
 * covers exactly that subset and nothing more, on both levels:
 *
 * - {@link FromSchema} maps a schema *value* to the TypeScript type it
 *   describes (compile time).
 * - {@link validateAgainstSchema} checks a runtime value against the same
 *   constructs (runtime).
 *
 * Keeping the two in one module is the point: what the type infers is what
 * the validator enforces. Schemas using keywords outside the subset are
 * rejected loudly by {@link assertSupportedSchema} rather than silently
 * half-enforced.
 */

import { MindStudioError } from '../errors.js';

//////////////////////////////////////////////////////////////////////////////
// The dialect
//////////////////////////////////////////////////////////////////////////////

export type JsonSchemaTypeName =
  | 'object'
  | 'array'
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'null';

/**
 * A schema in the supported dialect. Every position is readonly so inline
 * literals inferred via `const` type parameters (which produce readonly
 * tuples/objects) are assignable.
 */
export interface JsonSchema {
  readonly type?: JsonSchemaTypeName | readonly JsonSchemaTypeName[];
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly items?: JsonSchema;
  readonly enum?: readonly (string | number | boolean | null)[];
  readonly const?: string | number | boolean | null;
  readonly description?: string;
}

/**
 * The root schema for task output must be an object schema. The literal
 * `type: 'object'` requirement also anchors overload resolution on
 * `runTask` — without it, nearly any object type would satisfy the schema
 * overload's constraint (every `JsonSchema` property is optional).
 */
export interface JsonObjectSchema extends JsonSchema {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, JsonSchema>>;
}

//////////////////////////////////////////////////////////////////////////////
// Type-level mapping: schema value → TypeScript type
//////////////////////////////////////////////////////////////////////////////

/**
 * Infers the TypeScript type described by a schema literal.
 *
 * ```ts
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     action: { enum: ['approve', 'reject'] },
 *     note: { type: ['string', 'null'] },
 *   },
 *   required: ['action'],
 * } as const satisfies JsonObjectSchema;
 *
 * type Out = FromSchema<typeof schema>;
 * // { action: 'approve' | 'reject'; note?: string | null }
 * ```
 */
export type FromSchema<S> = S extends { const: infer C }
  ? C
  : S extends { enum: readonly (infer E)[] }
    ? E
    : S extends { type: readonly (infer TN extends JsonSchemaTypeName)[] }
      ? FromTypeName<TN, S>
      : S extends { type: infer TN extends JsonSchemaTypeName }
        ? FromTypeName<TN, S>
        : unknown;

/** Distributes over union type names, so `['string','null']` → `string | null`. */
type FromTypeName<TN extends JsonSchemaTypeName, S> =
  | (TN extends 'string' ? string : never)
  | (TN extends 'number' | 'integer' ? number : never)
  | (TN extends 'boolean' ? boolean : never)
  | (TN extends 'null' ? null : never)
  | (TN extends 'array'
      ? S extends { items: infer I }
        ? FromSchema<I>[]
        : unknown[]
      : never)
  | (TN extends 'object' ? FromObjectSchema<S> : never);

type RequiredKeys<S> = S extends {
  required: readonly (infer R extends string)[];
}
  ? R
  : never;

type FromObjectSchema<S> = S extends { properties: infer P }
  ? Prettify<
      { [K in Extract<keyof P, RequiredKeys<S>>]: FromSchema<P[K]> } & {
        [K in Exclude<keyof P, RequiredKeys<S>>]?: FromSchema<P[K]>;
      }
    >
  : Record<string, unknown>;

/** Collapses the required/optional intersection into one readable object type. */
type Prettify<T> = { [K in keyof T]: T[K] } & {};

//////////////////////////////////////////////////////////////////////////////
// Runtime validation
//////////////////////////////////////////////////////////////////////////////

export interface SchemaValidationError {
  /** JSONPath-style location, e.g. `$.items[2].severity`. */
  path: string;
  /** Human-readable problem, e.g. `expected one of "low" | "high", got "critical"`. */
  message: string;
}

/** Render a value for error messages — short, JSON-flavored. */
function describe(value: unknown): string {
  if (value === undefined) return 'undefined';
  const json = JSON.stringify(value);
  if (json === undefined) return String(value);
  return json.length > 60 ? `${json.slice(0, 57)}...` : json;
}

function matchesTypeName(value: unknown, name: JsonSchemaTypeName): boolean {
  switch (name) {
    case 'null':
      return value === null;
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return (
        typeof value === 'object' && value !== null && !Array.isArray(value)
      );
  }
}

/**
 * Validate a value against a schema in the supported dialect. Returns a flat
 * list of every violation (empty = valid). Checks exactly the constructs
 * {@link FromSchema} maps: type (including type arrays), enum, const,
 * required, properties, items, and `additionalProperties: false`. Extra
 * properties are allowed unless `additionalProperties` is explicitly false,
 * matching JSON Schema semantics.
 */
export function validateAgainstSchema(
  value: unknown,
  schema: JsonSchema,
): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];
  walk(value, schema, '$', errors);
  return errors;
}

function walk(
  value: unknown,
  schema: JsonSchema,
  path: string,
  errors: SchemaValidationError[],
): void {
  if (schema.const !== undefined) {
    if (value !== schema.const) {
      errors.push({
        path,
        message: `expected the constant ${describe(schema.const)}, got ${describe(value)}`,
      });
    }
    return;
  }

  if (schema.enum !== undefined) {
    if (!schema.enum.includes(value as string | number | boolean | null)) {
      errors.push({
        path,
        message: `expected one of ${schema.enum.map(describe).join(' | ')}, got ${describe(value)}`,
      });
    }
    return;
  }

  if (schema.type !== undefined) {
    const names = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!names.some((name) => matchesTypeName(value, name))) {
      errors.push({
        path,
        message: `expected type ${names.join(' | ')}, got ${describe(value)}`,
      });
      return; // structural checks are meaningless on the wrong type
    }
  }

  if (matchesTypeName(value, 'object')) {
    const record = value as Record<string, unknown>;

    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in record) || record[key] === undefined) {
          errors.push({
            path,
            message: `missing required property "${key}"`,
          });
        }
      }
    }

    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in record && record[key] !== undefined) {
          walk(record[key], propSchema, `${path}.${key}`, errors);
        }
      }

      if (schema.additionalProperties === false) {
        for (const key of Object.keys(record)) {
          if (!(key in schema.properties)) {
            errors.push({
              path,
              message: `unexpected property "${key}" (additionalProperties is false)`,
            });
          }
        }
      }
    }
  }

  if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => {
      walk(item, schema.items!, `${path}[${index}]`, errors);
    });
  }
}

/** Bulleted list for the repair message sent back to the model. */
export function formatValidationErrors(
  errors: SchemaValidationError[],
): string {
  return errors.map((e) => `- at ${e.path}: ${e.message}`).join('\n');
}

//////////////////////////////////////////////////////////////////////////////
// Dialect enforcement
//////////////////////////////////////////////////////////////////////////////

const SUPPORTED_KEYWORDS = new Set([
  'type',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'enum',
  'const',
  // Harmless annotations — ignored by the validator, allowed to pass through.
  'description',
  'title',
  'examples',
  'default',
]);

/**
 * Reject schemas that use keywords outside the supported dialect. Without
 * this, an `oneOf` or `$ref` would be silently unenforced (the validator
 * skips what it doesn't know) while still shaping the model's output —
 * exactly the kind of quiet half-contract this feature exists to eliminate.
 * Throws `task_output_schema_unsupported`.
 */
export function assertSupportedSchema(schema: JsonObjectSchema): void {
  assertSupportedNode(schema, '$');
}

function assertSupportedNode(schema: JsonSchema, path: string): void {
  for (const key of Object.keys(schema)) {
    if (SUPPORTED_KEYWORDS.has(key)) continue;
    const hint =
      key === 'nullable'
        ? ' Use a type array instead: type: ["string", "null"].'
        : key === 'oneOf' || key === 'anyOf' || key === 'allOf'
          ? ' Model alternatives with an enum, a type array, or a discriminating property instead.'
          : '';
    throw new MindStudioError(
      `[task] Unsupported JSON Schema keyword "${key}" at ${path} in outputSchema. ` +
        `Supported: type, properties, required, additionalProperties, items, enum, const.${hint}`,
      'task_output_schema_unsupported',
      400,
    );
  }
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      assertSupportedNode(propSchema, `${path}.${key}`);
    }
  }
  if (schema.items) {
    assertSupportedNode(schema.items, `${path}[]`);
  }
}

//////////////////////////////////////////////////////////////////////////////
// Legacy-path support
//////////////////////////////////////////////////////////////////////////////

/**
 * Build a skeleton example object from a schema, for the legacy whole-task
 * route (`POST /developer/v2/task`), which requires a
 * `structuredOutputExample` and composes its own prompt server-side.
 */
export function buildExampleFromSchema(schema: JsonSchema): unknown {
  if (schema.const !== undefined) return schema.const;
  if (schema.enum !== undefined && schema.enum.length > 0)
    return schema.enum[0];

  const names = Array.isArray(schema.type)
    ? schema.type
    : schema.type
      ? [schema.type]
      : [];
  const name = names.find((n) => n !== 'null') ?? names[0];

  switch (name) {
    case 'object': {
      const example: Record<string, unknown> = {};
      // Include optional properties too — the example exists to show the
      // model the full shape it may produce.
      for (const [key, propSchema] of Object.entries(
        schema.properties ?? {},
      )) {
        example[key] = buildExampleFromSchema(propSchema);
      }
      return example;
    }
    case 'array':
      return schema.items ? [buildExampleFromSchema(schema.items)] : [];
    case 'string':
      return '...';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return true;
    case 'null':
      return null;
    default:
      return null;
  }
}

//////////////////////////////////////////////////////////////////////////////
// Output text handling
//////////////////////////////////////////////////////////////////////////////

/**
 * Strip a wrapping markdown code fence (```json ... ```) from model output.
 * Used only in schema mode — the example path keeps its historical behavior.
 */
export function stripCodeFences(text: string): string {
  const match = /^```[a-zA-Z]*[ \t]*\r?\n([\s\S]*?)\r?\n?```$/.exec(
    text.trim(),
  );
  return match ? match[1] : text;
}

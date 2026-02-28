#!/usr/bin/env tsx
/**
 * Code generator for @mindstudio-ai/agent
 *
 * Fetches the OpenAPI spec from the MindStudio API and generates:
 *   - src/generated/types.ts   — TypeScript interfaces for every step's input & output
 *   - src/generated/steps.ts   — Module augmentation adding typed methods to MindStudioAgent
 *   - src/generated/helpers.ts — Module augmentation adding helper methods (models, connectors)
 *
 * Usage:
 *   npm run codegen                                         # uses MINDSTUDIO_BASE_URL or localhost
 *   npm run codegen -- --url http://localhost:3129           # explicit URL
 *   npm run codegen -- --file /path/to/openapi.json         # from file
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = resolve(__dirname, '../src/generated');

const HEADER = `// AUTO-GENERATED — DO NOT EDIT
// Run \`npm run codegen\` to regenerate from the OpenAPI spec.
// Generated: ${new Date().toISOString()}
`;

// ---------------------------------------------------------------------------
// Method aliases — maps a public alias to the internal step type name.
// When a step has an alias, only the alias is exposed; the original name
// is hidden from the public API (StepMethods, stepSnippets).
// ---------------------------------------------------------------------------

const METHOD_ALIASES: Record<string, string> = {
  generateText: 'userMessage',
  generateAsset: 'generatePdf',
};

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(): { specUrl?: string; specFile?: string } {
  const args = process.argv.slice(2);
  let specUrl: string | undefined;
  let specFile: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) specUrl = args[++i];
    if (args[i] === '--file' && args[i + 1]) specFile = args[++i];
  }

  return { specUrl, specFile };
}

// ---------------------------------------------------------------------------
// Fetch spec
// ---------------------------------------------------------------------------

interface OpenAPISpec {
  paths: Record<string, Record<string, OperationObject>>;
  definitions?: Record<string, SchemaObject>;
}

interface OperationObject {
  operationId: string;
  summary: string;
  description?: string;
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    schema?: SchemaObject;
  }>;
  requestBody?: {
    content: {
      'application/json': { schema: SchemaObject };
    };
  };
  responses: Record<
    string,
    {
      description?: string;
      content?: { 'application/json': { schema: SchemaObject } };
    }
  >;
}

interface SchemaObject {
  type?: string | string[];
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  enum?: Array<string | number | boolean>;
  anyOf?: SchemaObject[];
  description?: string;
  additionalProperties?: boolean | SchemaObject;
  $ref?: string;
}

async function fetchSpec(
  specUrl?: string,
  specFile?: string,
): Promise<OpenAPISpec> {
  if (specFile) {
    console.log(`Reading spec from file: ${specFile}`);
    return JSON.parse(readFileSync(specFile, 'utf-8'));
  }

  const baseUrl =
    specUrl ??
    process.env.MINDSTUDIO_BASE_URL ??
    'https://v1.mindstudio-api.com';

  const url = `${baseUrl}/developer/v2/steps/openapi.json`;
  console.log(`Fetching spec from: ${url}`);

  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Failed to fetch spec: ${res.status} ${res.statusText}`);
  return res.json() as Promise<OpenAPISpec>;
}

// ---------------------------------------------------------------------------
// JSON Schema → TypeScript
// ---------------------------------------------------------------------------

const PRIMITIVE_MAP: Record<string, string> = {
  string: 'string',
  number: 'number',
  integer: 'number',
  boolean: 'boolean',
  null: 'null',
};

function schemaToTs(
  schema: SchemaObject | undefined,
  indent: string = '',
  definitions?: Record<string, SchemaObject>,
): string {
  if (!schema) return 'unknown';

  // $ref
  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop()!;
    if (definitions?.[refName]) {
      return schemaToTs(definitions[refName], indent, definitions);
    }
    return 'unknown';
  }

  // anyOf → union
  if (schema.anyOf) {
    const members = schema.anyOf.map((s) => schemaToTs(s, indent, definitions));
    // Deduplicate
    const unique = [...new Set(members)];
    return unique.length === 1 ? unique[0] : unique.join(' | ');
  }

  // enum
  if (schema.enum) {
    return schema.enum.map((v) => JSON.stringify(v)).join(' | ');
  }

  // type array like ["string", "null"]
  if (Array.isArray(schema.type)) {
    const types = schema.type.map((t) => {
      if (t === 'null') return 'null';
      // Build a sub-schema for each type variant
      return schemaToTs({ ...schema, type: t }, indent, definitions);
    });
    const unique = [...new Set(types)];
    return unique.length === 1 ? unique[0] : unique.join(' | ');
  }

  // array
  if (schema.type === 'array') {
    const itemType = schemaToTs(schema.items, indent, definitions);
    // Wrap complex union types in parens
    const needsParens = itemType.includes(' | ');
    return needsParens ? `(${itemType})[]` : `${itemType}[]`;
  }

  // object with properties
  if (schema.type === 'object' && schema.properties) {
    const required = new Set(schema.required ?? []);
    const lines: string[] = [];
    for (const [key, prop] of Object.entries(schema.properties)) {
      const opt = required.has(key) ? '' : '?';
      const doc = buildPropertyDoc(key, prop);
      if (doc) lines.push(`${indent}  ${doc}`);
      const safeName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
        ? key
        : JSON.stringify(key);
      lines.push(
        `${indent}  ${safeName}${opt}: ${schemaToTs(prop, indent + '  ', definitions)};`,
      );
    }
    return `{\n${lines.join('\n')}\n${indent}}`;
  }

  // object without properties
  if (schema.type === 'object') {
    return 'Record<string, unknown>';
  }

  // primitives
  if (typeof schema.type === 'string' && PRIMITIVE_MAP[schema.type]) {
    return PRIMITIVE_MAP[schema.type];
  }

  return 'unknown';
}

/**
 * Emit a type declaration. Uses `interface` when the TS string is an object
 * literal (starts with `{`), otherwise `type X = ...`.
 */
function emitTypeDeclaration(name: string, tsType: string): string {
  if (tsType.startsWith('{')) {
    return `export interface ${name} ${tsType}`;
  }
  return `export type ${name} = ${tsType};`;
}

// ---------------------------------------------------------------------------
// JSDoc generation
// ---------------------------------------------------------------------------

function buildPropertyDoc(key: string, schema: SchemaObject): string | null {
  const parts: string[] = [];

  if (schema.description) {
    parts.push(schema.description);
  }

  if (schema.enum) {
    // Don't repeat enum info if description already covers it
    if (!schema.description) {
      parts.push(`One of: ${schema.enum.map((v) => `\`${v}\``).join(', ')}.`);
    }
  }

  if (parts.length === 0) return null;
  const text = parts.join(' ');
  if (!text.includes('\n')) {
    return `/** ${text} */`;
  }
  return `/**\n * ${text.split('\n').join('\n * ')}\n */`;
}

function buildMethodDoc(op: OperationObject): string {
  const lines: string[] = ['/**'];

  // Summary as the main line
  if (op.summary) {
    lines.push(` * ${op.summary}`);
  }

  // Description as detail block
  if (op.description) {
    lines.push(` *`);
    for (const line of op.description.split('\n')) {
      lines.push(` * ${line}`);
    }
  }

  lines.push(' */');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

interface StepInfo {
  stepType: string;
  methodName: string;
  inputTypeName: string;
  outputTypeName: string;
  inputSchema: SchemaObject;
  outputSchema: SchemaObject | null;
  operation: OperationObject;
}

function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function extractSteps(spec: OpenAPISpec): StepInfo[] {
  const steps: StepInfo[] = [];

  for (const [path, methods] of Object.entries(spec.paths)) {
    const match = path.match(/\/developer\/v2\/steps\/([^/]+)\/execute$/);
    if (!match) continue;

    const stepType = match[1];
    const op = methods.post;
    if (!op) continue;

    const bodySchema = op.requestBody?.content?.['application/json']?.schema;
    const inputSchema = bodySchema?.properties?.step ?? {};

    const respSchema =
      op.responses?.['200']?.content?.['application/json']?.schema;
    const outputSchema = respSchema?.properties?.output ?? null;

    const pascal = toPascalCase(stepType);

    steps.push({
      stepType,
      methodName: stepType,
      inputTypeName: `${pascal}StepInput`,
      outputTypeName: `${pascal}StepOutput`,
      inputSchema,
      outputSchema,
      operation: op,
    });
  }

  // Sort alphabetically for stable output
  steps.sort((a, b) => a.stepType.localeCompare(b.stepType));
  return steps;
}

// ---------------------------------------------------------------------------
// Generate src/generated/types.ts
// ---------------------------------------------------------------------------

function generateTypes(
  steps: StepInfo[],
  definitions?: Record<string, SchemaObject>,
): string {
  const chunks: string[] = [HEADER, ''];

  for (const step of steps) {
    // Input type
    const inputTs = schemaToTs(step.inputSchema, '', definitions);
    chunks.push(emitTypeDeclaration(step.inputTypeName, inputTs));
    chunks.push('');

    // Output type
    if (step.outputSchema) {
      const outputTs = schemaToTs(step.outputSchema, '', definitions);
      chunks.push(emitTypeDeclaration(step.outputTypeName, outputTs));
    } else {
      chunks.push(
        `export type ${step.outputTypeName} = Record<string, unknown>;`,
      );
    }
    chunks.push('');
  }

  // Type aliases
  const reverseAliases = new Map<string, string[]>();
  for (const [alias, stepType] of Object.entries(METHOD_ALIASES)) {
    if (!reverseAliases.has(stepType)) reverseAliases.set(stepType, []);
    reverseAliases.get(stepType)!.push(alias);
  }
  for (const step of steps) {
    const aliases = reverseAliases.get(step.stepType);
    if (!aliases) continue;
    for (const alias of aliases) {
      const aliasPascal = toPascalCase(alias);
      chunks.push(
        `export type ${aliasPascal}StepInput = ${step.inputTypeName};`,
      );
      chunks.push(
        `export type ${aliasPascal}StepOutput = ${step.outputTypeName};`,
      );
      chunks.push('');
    }
  }

  // StepName union type for discoverability
  chunks.push('/** Union of all available step type names. */');
  chunks.push(
    `export type StepName =\n  | ${steps.map((s) => `"${s.stepType}"`).join('\n  | ')};`,
  );
  chunks.push('');

  // Step input/output map for generic use
  chunks.push('/** Maps step names to their input types. */');
  chunks.push('export interface StepInputMap {');
  for (const step of steps) {
    chunks.push(`  ${step.stepType}: ${step.inputTypeName};`);
  }
  chunks.push('}');
  chunks.push('');

  chunks.push('/** Maps step names to their output types. */');
  chunks.push('export interface StepOutputMap {');
  for (const step of steps) {
    chunks.push(`  ${step.stepType}: ${step.outputTypeName};`);
  }
  chunks.push('}');
  chunks.push('');

  return chunks.join('\n');
}

// ---------------------------------------------------------------------------
// Generate src/generated/steps.ts
// ---------------------------------------------------------------------------

function generateSteps(steps: StepInfo[]): string {
  const chunks: string[] = [HEADER, ''];

  // Imports
  const inputTypes = steps.map((s) => s.inputTypeName).join(',\n  ');
  const outputTypes = steps.map((s) => s.outputTypeName).join(',\n  ');
  chunks.push(
    `import type {\n  ${inputTypes},\n  ${outputTypes},\n} from "./types.js";`,
  );
  chunks.push('');
  chunks.push(
    `import type { StepExecutionOptions, StepExecutionResult } from "../types.js";`,
  );
  chunks.push('');

  // Build reverse alias map: stepType -> alias names
  const reverseAliases = new Map<string, string[]>();
  for (const [alias, stepType] of Object.entries(METHOD_ALIASES)) {
    if (!reverseAliases.has(stepType)) reverseAliases.set(stepType, []);
    reverseAliases.get(stepType)!.push(alias);
  }

  // Set of step types that have been renamed — skip original names
  const renamedStepTypes = new Set(Object.values(METHOD_ALIASES));

  // Interface with all typed step methods
  chunks.push('export interface StepMethods {');

  for (const step of steps) {
    const aliases = reverseAliases.get(step.stepType);
    const doc = buildMethodDoc(step.operation);
    const indentedDoc = doc
      .split('\n')
      .map((l) => `  ${l}`)
      .join('\n');

    if (aliases) {
      // Renamed: only emit under the alias name(s)
      for (const alias of aliases) {
        chunks.push(indentedDoc);
        chunks.push(
          `  ${alias}(` +
            `step: ${step.inputTypeName}, ` +
            `options?: StepExecutionOptions` +
            `): Promise<StepExecutionResult<${step.outputTypeName}>>;`,
        );
        chunks.push('');
      }
    } else {
      // No alias: emit under the original name
      chunks.push(indentedDoc);
      chunks.push(
        `  ${step.methodName}(` +
          `step: ${step.inputTypeName}, ` +
          `options?: StepExecutionOptions` +
          `): Promise<StepExecutionResult<${step.outputTypeName}>>;`,
      );
      chunks.push('');
    }
  }

  chunks.push('}');
  chunks.push('');

  // Runtime method attachment
  chunks.push(
    '/** @internal Attaches typed step methods to the MindStudioAgent prototype. */',
  );
  chunks.push(
    'export function applyStepMethods(AgentClass: new (...args: any[]) => any): void {',
  );
  chunks.push('  const proto = AgentClass.prototype;');
  chunks.push('');

  for (const step of steps) {
    const aliases = reverseAliases.get(step.stepType);
    // Use alias name(s) if renamed, otherwise original name
    const methodNames = aliases ?? [step.methodName];

    for (const name of methodNames) {
      chunks.push(
        `  proto.${name} = function (` +
          `step: ${step.inputTypeName}, ` +
          `options?: StepExecutionOptions` +
          `) {`,
      );
      chunks.push(
        `    return this.executeStep("${step.stepType}", step as unknown as Record<string, unknown>, options);`,
      );
      chunks.push('  };');
      chunks.push('');
    }
  }

  chunks.push('}');
  chunks.push('');

  return chunks.join('\n');
}

// ---------------------------------------------------------------------------
// Generate src/generated/helpers.ts
// ---------------------------------------------------------------------------

function generateHelpers(spec: OpenAPISpec): string {
  const chunks: string[] = [HEADER, ''];

  // Model type (from the models endpoint response schema)
  const modelsOp = spec.paths['/developer/v2/helpers/models']?.get;
  if (modelsOp) {
    const modelSchema =
      modelsOp.responses['200']?.content?.['application/json']?.schema
        ?.properties?.models?.items;

    if (modelSchema) {
      chunks.push('/** An AI model available on MindStudio. */');
      chunks.push(
        `export interface MindStudioModel ${schemaToTs(modelSchema, '')}`,
      );
      chunks.push('');
    }
  }

  // Model type enum
  chunks.push('/** Supported model type categories for filtering. */');
  chunks.push(
    `export type ModelType = "llm_chat" | "image_generation" | "video_generation" | "video_analysis" | "text_to_speech" | "vision" | "transcription";`,
  );
  chunks.push('');

  // Interface with all helper methods
  chunks.push('export interface HelperMethods {');
  chunks.push('  /**');
  chunks.push('   * List all available AI models.');
  chunks.push('   *');
  chunks.push(
    '   * Returns models across all categories (chat, image generation, video, etc.).',
  );
  chunks.push('   * Use `listModelsByType()` to filter by category.');
  chunks.push('   */');
  chunks.push('  listModels(): Promise<{ models: MindStudioModel[] }>;');
  chunks.push('');
  chunks.push('  /**');
  chunks.push('   * List AI models filtered by type.');
  chunks.push('   *');
  chunks.push(
    '   * @param modelType - The category to filter by (e.g. "llm_chat", "image_generation").',
  );
  chunks.push('   */');
  chunks.push(
    '  listModelsByType(modelType: ModelType): Promise<{ models: MindStudioModel[] }>;',
  );
  chunks.push('');
  chunks.push('  /**');
  chunks.push(
    '   * List all available connector services (Slack, Google, HubSpot, etc.).',
  );
  chunks.push('   */');
  chunks.push(
    '  listConnectors(): Promise<{ services: Array<{ service: Record<string, unknown>; actions: Record<string, unknown>[] }> }>;',
  );
  chunks.push('');
  chunks.push('  /**');
  chunks.push('   * Get details for a single connector service.');
  chunks.push('   *');
  chunks.push('   * @param serviceId - The connector service ID.');
  chunks.push('   */');
  chunks.push(
    '  getConnector(serviceId: string): Promise<{ service: Record<string, unknown> }>;',
  );
  chunks.push('}');
  chunks.push('');

  // Runtime method attachment
  chunks.push(
    '/** @internal Attaches helper methods to the MindStudioAgent prototype. */',
  );
  chunks.push(
    'export function applyHelperMethods(AgentClass: new (...args: any[]) => any): void {',
  );
  chunks.push('  const proto = AgentClass.prototype;');
  chunks.push('');
  chunks.push('  proto.listModels = function () {');
  chunks.push(
    '    return this._request("GET", "/helpers/models").then((r: any) => r.data);',
  );
  chunks.push('  };');
  chunks.push('');
  chunks.push('  proto.listModelsByType = function (modelType: string) {');
  chunks.push(
    '    return this._request("GET", `/helpers/models/${modelType}`).then((r: any) => r.data);',
  );
  chunks.push('  };');
  chunks.push('');
  chunks.push('  proto.listConnectors = function () {');
  chunks.push(
    '    return this._request("GET", "/helpers/connectors").then((r: any) => r.data);',
  );
  chunks.push('  };');
  chunks.push('');
  chunks.push('  proto.getConnector = function (serviceId: string) {');
  chunks.push(
    '    return this._request("GET", `/helpers/connectors/${serviceId}`).then((r: any) => r.data);',
  );
  chunks.push('  };');
  chunks.push('}');
  chunks.push('');

  return chunks.join('\n');
}

// ---------------------------------------------------------------------------
// Generate src/generated/snippets.ts
// ---------------------------------------------------------------------------

function schemaDefault(schema: SchemaObject | undefined): string {
  if (!schema) return '``';

  if (schema.enum) return JSON.stringify(schema.enum[0]);

  if (Array.isArray(schema.type)) {
    const nonNull = schema.type.filter((t) => t !== 'null');
    if (nonNull.length > 0) {
      return schemaDefault({ ...schema, type: nonNull[0] });
    }
    return '``';
  }

  switch (schema.type) {
    case 'string':
      return '``';
    case 'number':
    case 'integer':
      return '0';
    case 'boolean':
      return 'false';
    case 'array':
      return '[]';
    case 'object':
      return '{}';
    default:
      return '``';
  }
}

function generateSnippets(steps: StepInfo[]): string {
  const chunks: string[] = [HEADER, ''];

  chunks.push('export interface StepSnippet {');
  chunks.push('  method: string;');
  chunks.push('  snippet: string;');
  chunks.push('  outputKeys: string[];');
  chunks.push('}');
  chunks.push('');

  chunks.push('export const stepSnippets: Record<string, StepSnippet> = {');

  const renamedStepTypes = new Set(Object.values(METHOD_ALIASES));
  const reverseAliases = new Map<string, string[]>();
  for (const [alias, stepType] of Object.entries(METHOD_ALIASES)) {
    if (!reverseAliases.has(stepType)) reverseAliases.set(stepType, []);
    reverseAliases.get(stepType)!.push(alias);
  }

  const allMethods: Array<{
    method: string;
    useMethodName?: string;
    stepType: string;
    schema: SchemaObject;
    outputSchema: SchemaObject | null;
  }> = [];

  for (const step of steps) {
    const aliases = reverseAliases.get(step.stepType);
    if (aliases) {
      // Renamed: emit alias entries + original pointing to the alias
      for (const alias of aliases) {
        allMethods.push({
          method: alias,
          stepType: step.stepType,
          schema: step.inputSchema,
          outputSchema: step.outputSchema,
        });
        // Original name points to the renamed method
        allMethods.push({
          method: step.methodName,
          useMethodName: alias,
          stepType: step.stepType,
          schema: step.inputSchema,
          outputSchema: step.outputSchema,
        });
      }
    } else {
      allMethods.push({
        method: step.methodName,
        stepType: step.stepType,
        schema: step.inputSchema,
        outputSchema: step.outputSchema,
      });
    }
  }

  allMethods.sort((a, b) => a.method.localeCompare(b.method));

  for (const { method, useMethodName, schema, outputSchema } of allMethods) {
    const displayMethod = useMethodName ?? method;
    const required = new Set(schema.required ?? []);
    const props = schema.properties ?? {};

    // Build the params: only required fields
    const paramLines: string[] = [];
    for (const [key, propSchema] of Object.entries(props)) {
      if (!required.has(key)) continue;
      paramLines.push(`  ${key}: ${schemaDefault(propSchema)},`);
    }

    let snippet: string;
    if (paramLines.length === 0) {
      snippet = '{}';
    } else {
      snippet = `{\n${paramLines.join('\n')}\n}`;
    }

    // Required output keys
    const outputRequired = new Set(outputSchema?.required ?? []);
    const outputKeys = Object.keys(outputSchema?.properties ?? {}).filter((k) =>
      outputRequired.has(k),
    );

    chunks.push(`  ${JSON.stringify(method)}: {`);
    chunks.push(`    method: ${JSON.stringify(displayMethod)},`);
    chunks.push(`    snippet: ${JSON.stringify(snippet)},`);
    chunks.push(`    outputKeys: ${JSON.stringify(outputKeys)},`);
    chunks.push('  },');
  }

  chunks.push('};');
  chunks.push('');

  return chunks.join('\n');
}

// ---------------------------------------------------------------------------
// Generate llms.txt
// ---------------------------------------------------------------------------

/**
 * Compact inline type string for llms.txt.
 * Produces things like: `{ query: string, exportType: "text" | "json", limit?: number }`
 */
function schemaToInline(
  schema: SchemaObject | undefined,
  definitions?: Record<string, SchemaObject>,
): string {
  if (!schema) return 'unknown';

  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop()!;
    if (definitions?.[refName]) {
      return schemaToInline(definitions[refName], definitions);
    }
    return 'unknown';
  }

  if (schema.anyOf) {
    const members = schema.anyOf.map((s) => schemaToInline(s, definitions));
    const unique = [...new Set(members)];
    return unique.join(' | ');
  }

  if (schema.enum) {
    return schema.enum.map((v) => JSON.stringify(v)).join(' | ');
  }

  if (Array.isArray(schema.type)) {
    const types = schema.type.map((t) => {
      if (t === 'null') return 'null';
      return schemaToInline({ ...schema, type: t }, definitions);
    });
    const unique = [...new Set(types)];
    return unique.join(' | ');
  }

  if (schema.type === 'array') {
    const items = schemaToInline(schema.items, definitions);
    const needsParens = items.includes(' | ');
    return needsParens ? `(${items})[]` : `${items}[]`;
  }

  if (schema.type === 'object' && schema.properties) {
    const required = new Set(schema.required ?? []);
    const parts: string[] = [];
    for (const [key, prop] of Object.entries(schema.properties)) {
      const opt = required.has(key) ? '' : '?';
      const type = schemaToInline(prop, definitions);
      parts.push(`${key}${opt}: ${type}`);
    }
    return `{ ${parts.join(', ')} }`;
  }

  if (schema.type === 'object') return 'object';

  const map: Record<string, string> = {
    string: 'string',
    number: 'number',
    integer: 'number',
    boolean: 'boolean',
    null: 'null',
  };
  if (typeof schema.type === 'string' && map[schema.type])
    return map[schema.type];

  return 'unknown';
}

function generateLlmsTxt(steps: StepInfo[]): string {
  const reverseAliases = new Map<string, string[]>();
  for (const [alias, stepType] of Object.entries(METHOD_ALIASES)) {
    if (!reverseAliases.has(stepType)) reverseAliases.set(stepType, []);
    reverseAliases.get(stepType)!.push(alias);
  }

  const lines: string[] = [];

  lines.push('# @mindstudio-ai/agent');
  lines.push('');
  lines.push(
    'TypeScript SDK for executing MindStudio workflow steps. Each method calls a specific AI/automation action and returns typed results.',
  );
  lines.push('');

  // --- Setup ---
  lines.push('## Setup');
  lines.push('');
  lines.push('```typescript');
  lines.push("import { MindStudioAgent } from '@mindstudio-ai/agent';");
  lines.push('');
  lines.push('// With API key');
  lines.push("const agent = new MindStudioAgent({ apiKey: 'your-key' });");
  lines.push('');
  lines.push(
    '// Or via environment variables (MINDSTUDIO_API_KEY or CALLBACK_TOKEN)',
  );
  lines.push('const agent = new MindStudioAgent();');
  lines.push('```');
  lines.push('');

  // --- Pattern ---
  lines.push('## Usage pattern');
  lines.push('');
  lines.push(
    'Every method returns the output fields directly, plus `$appId`, `$threadId`, and `$rateLimitRemaining` metadata:',
  );
  lines.push('');
  lines.push('```typescript');
  lines.push(
    "const { content } = await agent.generateText({ message: 'Hello' });",
  );
  lines.push('');
  lines.push(
    '// Thread persistence — pass $appId/$threadId to maintain state across calls:',
  );
  lines.push(
    "const r1 = await agent.generateText({ message: 'My name is Alice' });",
  );
  lines.push('const r2 = await agent.generateText(');
  lines.push("  { message: 'What is my name?' },");
  lines.push('  { threadId: r1.$threadId, appId: r1.$appId },');
  lines.push(');');
  lines.push('```');
  lines.push('');

  // --- Error handling ---
  lines.push('## Error handling');
  lines.push('');
  lines.push('```typescript');
  lines.push("import { MindStudioError } from '@mindstudio-ai/agent';");
  lines.push('// Throws MindStudioError with .code, .status, .details');
  lines.push('// 429 errors are retried automatically (3 retries by default)');
  lines.push('```');
  lines.push('');

  // --- Method catalog ---
  lines.push('## Methods');
  lines.push('');

  // Group by category based on summary prefix
  interface MethodEntry {
    method: string;
    summary: string;
    description?: string;
    inputSchema: SchemaObject;
    outputSchema: SchemaObject | null;
  }

  const categories = new Map<string, MethodEntry[]>();

  for (const step of steps) {
    const aliases = reverseAliases.get(step.stepType);
    const methodNames = aliases ?? [step.methodName];
    const summary = step.operation.summary ?? '';
    const description = step.operation.description;

    const categoryMatch = summary.match(/^\[([^\]]+)\]\s*/);
    const category = categoryMatch ? categoryMatch[1] : 'General';
    const cleanSummary = categoryMatch
      ? summary.slice(categoryMatch[0].length)
      : summary;

    for (const method of methodNames) {
      if (!categories.has(category)) categories.set(category, []);
      categories.get(category)!.push({
        method,
        summary: cleanSummary,
        description,
        inputSchema: step.inputSchema,
        outputSchema: step.outputSchema,
      });
    }
  }

  // Sort categories: General first, then alphabetical
  const sortedCategories = [...categories.entries()].sort((a, b) => {
    if (a[0] === 'General') return -1;
    if (b[0] === 'General') return 1;
    return a[0].localeCompare(b[0]);
  });

  for (const [category, methods] of sortedCategories) {
    lines.push(`### ${category}`);
    lines.push('');
    for (const m of methods.sort((a, b) => a.method.localeCompare(b.method))) {
      lines.push(`#### ${m.method}`);
      lines.push(`${m.summary}.`);

      const inputInline = schemaToInline(m.inputSchema);
      const outputInline = m.outputSchema
        ? schemaToInline(m.outputSchema)
        : 'void';

      lines.push(`- Input: \`${inputInline}\``);
      lines.push(`- Output: \`${outputInline}\``);
      lines.push('');
    }
  }

  // --- Helpers ---
  lines.push('### Helpers');
  lines.push('');
  lines.push('#### listModels');
  lines.push('List all available AI models.');
  lines.push('- Input: none');
  lines.push('- Output: `{ models: MindStudioModel[] }`');
  lines.push('');
  lines.push('#### listModelsByType');
  lines.push('List AI models filtered by type.');
  lines.push(
    '- Input: `modelType: "llm_chat" | "image_generation" | "video_generation" | "video_analysis" | "text_to_speech" | "vision" | "transcription"`',
  );
  lines.push('- Output: `{ models: MindStudioModel[] }`');
  lines.push('');
  lines.push('#### listConnectors');
  lines.push('List available connector services.');
  lines.push('- Input: none');
  lines.push(
    '- Output: `{ services: Array<{ service: object, actions: object[] }> }`',
  );
  lines.push('');
  lines.push('#### getConnector');
  lines.push('Get details for a single connector service.');
  lines.push('- Input: `serviceId: string`');
  lines.push('- Output: `{ service: object }`');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { specUrl, specFile } = parseArgs();
  const spec = await fetchSpec(specUrl, specFile);

  const steps = extractSteps(spec);
  console.log(`Found ${steps.length} step types`);

  // Generate files
  const typesContent = generateTypes(steps, spec.definitions);
  const stepsContent = generateSteps(steps);
  const helpersContent = generateHelpers(spec);
  const snippetsContent = generateSnippets(steps);
  const llmsTxtContent = generateLlmsTxt(steps);

  writeFileSync(resolve(GENERATED_DIR, 'types.ts'), typesContent);
  console.log(`Wrote src/generated/types.ts`);

  writeFileSync(resolve(GENERATED_DIR, 'steps.ts'), stepsContent);
  console.log(`Wrote src/generated/steps.ts`);

  writeFileSync(resolve(GENERATED_DIR, 'helpers.ts'), helpersContent);
  console.log(`Wrote src/generated/helpers.ts`);

  writeFileSync(resolve(GENERATED_DIR, 'snippets.ts'), snippetsContent);
  console.log(`Wrote src/generated/snippets.ts`);

  writeFileSync(resolve(__dirname, '../llms.txt'), llmsTxtContent);
  console.log(`Wrote llms.txt`);

  console.log('Done!');
}

main().catch((err) => {
  console.error('Codegen failed:', err);
  process.exit(1);
});

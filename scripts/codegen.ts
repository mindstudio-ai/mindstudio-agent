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

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = resolve(__dirname, '../src/generated');
mkdirSync(GENERATED_DIR, { recursive: true });

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
  'x-usage-notes'?: string;
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

function buildMethodDoc(
  op: OperationObject,
  methodName: string,
  snippet?: string,
): string {
  const lines: string[] = ['/**'];

  // Description as the main line
  if (op.description) {
    lines.push(` * ${op.description}`);
  }

  // Usage notes as @remarks
  const usageNotes = op['x-usage-notes'];
  if (usageNotes) {
    lines.push(` *`);
    lines.push(` * @remarks`);
    for (const line of usageNotes.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        lines.push(` * ${trimmed}`);
      }
    }
  }

  // Snippet as @example
  if (snippet) {
    lines.push(` *`);
    lines.push(` * @example`);
    lines.push(` * \`\`\`typescript`);
    const call = `const result = await agent.${methodName}(${snippet});`;
    for (const cl of call.split('\n')) {
      lines.push(` * ${cl}`);
    }
    lines.push(` * \`\`\``);
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
// Snippet generation (shared by steps.ts JSDoc and snippets.ts)
// ---------------------------------------------------------------------------

function buildSnippet(schema: SchemaObject): string {
  const required = new Set(schema.required ?? []);
  const props = schema.properties ?? {};

  const paramLines: string[] = [];
  for (const [key, propSchema] of Object.entries(props)) {
    if (!required.has(key)) continue;
    paramLines.push(`  ${key}: ${schemaDefault(propSchema)},`);
  }

  if (paramLines.length === 0) return '{}';
  return `{\n${paramLines.join('\n')}\n}`;
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
    const snippet = buildSnippet(step.inputSchema);

    if (aliases) {
      // Renamed: only emit under the alias name(s)
      for (const alias of aliases) {
        const doc = buildMethodDoc(step.operation, alias, snippet);
        const indentedDoc = doc
          .split('\n')
          .map((l) => `  ${l}`)
          .join('\n');
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
      const doc = buildMethodDoc(step.operation, step.methodName, snippet);
      const indentedDoc = doc
        .split('\n')
        .map((l) => `  ${l}`)
        .join('\n');
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

  // Model summary type (from models-summary endpoint)
  const modelsSummaryOp =
    spec.paths['/developer/v2/helpers/models-summary']?.get;
  if (modelsSummaryOp) {
    const summarySchema =
      modelsSummaryOp.responses['200']?.content?.['application/json']?.schema
        ?.properties?.models?.items;

    if (summarySchema) {
      chunks.push('/** A lightweight AI model summary. */');
      chunks.push(
        `export interface MindStudioModelSummary ${schemaToTs(summarySchema, '')}`,
      );
      chunks.push('');
    }
  }

  // Connector service type (from connectors endpoint)
  const connectorsOp = spec.paths['/developer/v2/helpers/connectors']?.get;
  if (connectorsOp) {
    const serviceSchema =
      connectorsOp.responses['200']?.content?.['application/json']?.schema
        ?.properties?.services?.items;

    if (serviceSchema) {
      chunks.push('/** A connector service with its available actions. */');
      chunks.push(
        `export interface ConnectorService ${schemaToTs(serviceSchema, '')}`,
      );
      chunks.push('');
    }
  }

  // Connector action detail type (from connectors/{serviceId}/{actionId} endpoint)
  const connectorActionOp =
    spec.paths['/developer/v2/helpers/connectors/{serviceId}/{actionId}']?.get;
  if (connectorActionOp) {
    const actionSchema =
      connectorActionOp.responses['200']?.content?.['application/json']?.schema
        ?.properties?.action;

    if (actionSchema) {
      chunks.push(
        '/** Full configuration details for a connector action. */',
      );
      chunks.push(
        `export interface ConnectorActionDetail ${schemaToTs(actionSchema, '')}`,
      );
      chunks.push('');
    }
  }

  // Connection type (from connections endpoint)
  const connectionsOp = spec.paths['/developer/v2/helpers/connections']?.get;
  if (connectionsOp) {
    const connectionSchema =
      connectionsOp.responses['200']?.content?.['application/json']?.schema
        ?.properties?.connections?.items;

    if (connectionSchema) {
      chunks.push(
        '/** An OAuth connection to a third-party service. */',
      );
      chunks.push(
        `export interface Connection ${schemaToTs(connectionSchema, '')}`,
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
    '   * List all available AI models (summary). Returns only id, name, type, and tags.',
  );
  chunks.push('   *');
  chunks.push(
    '   * Suitable for display or consumption inside a model context window.',
  );
  chunks.push('   */');
  chunks.push(
    '  listModelsSummary(): Promise<{ models: MindStudioModelSummary[] }>;',
  );
  chunks.push('');
  chunks.push('  /**');
  chunks.push('   * List AI models (summary) filtered by type.');
  chunks.push('   *');
  chunks.push(
    '   * @param modelType - The category to filter by (e.g. "llm_chat", "image_generation").',
  );
  chunks.push('   */');
  chunks.push(
    '  listModelsSummaryByType(modelType: ModelType): Promise<{ models: MindStudioModelSummary[] }>;',
  );
  chunks.push('');
  chunks.push('  /**');
  chunks.push(
    '   * List all available connector services (Slack, Google, HubSpot, etc.).',
  );
  chunks.push('   */');
  chunks.push(
    '  listConnectors(): Promise<{ services: ConnectorService[] }>;',
  );
  chunks.push('');
  chunks.push('  /**');
  chunks.push('   * Get details for a single connector service.');
  chunks.push('   *');
  chunks.push('   * @param serviceId - The connector service ID.');
  chunks.push('   */');
  chunks.push(
    '  getConnector(serviceId: string): Promise<{ service: ConnectorService }>;',
  );
  chunks.push('');
  chunks.push('  /**');
  chunks.push(
    '   * Get the full configuration for a connector action, including input fields.',
  );
  chunks.push('   *');
  chunks.push('   * @param serviceId - The connector service ID.');
  chunks.push(
    '   * @param actionId - The full action ID including service prefix (e.g. "slack/send-message").',
  );
  chunks.push('   */');
  chunks.push(
    '  getConnectorAction(serviceId: string, actionId: string): Promise<{ action: ConnectorActionDetail }>;',
  );
  chunks.push('');
  chunks.push('  /**');
  chunks.push(
    '   * List OAuth connections for the organization.',
  );
  chunks.push('   *');
  chunks.push(
    '   * Returns the third-party services the caller\'s organization has OAuth connections for.',
  );
  chunks.push(
    '   * Use the returned connection IDs when calling connector actions.',
  );
  chunks.push('   */');
  chunks.push(
    '  listConnections(): Promise<{ connections: Connection[] }>;',
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
  chunks.push('  proto.listModelsSummary = function () {');
  chunks.push(
    '    return this._request("GET", "/helpers/models-summary").then((r: any) => r.data);',
  );
  chunks.push('  };');
  chunks.push('');
  chunks.push(
    '  proto.listModelsSummaryByType = function (modelType: string) {',
  );
  chunks.push(
    '    return this._request("GET", `/helpers/models-summary/${modelType}`).then((r: any) => r.data);',
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
  chunks.push('');
  chunks.push(
    '  proto.getConnectorAction = function (serviceId: string, actionId: string) {',
  );
  chunks.push(
    '    return this._request("GET", `/helpers/connectors/${serviceId}/${actionId}`).then((r: any) => r.data);',
  );
  chunks.push('  };');
  chunks.push('');
  chunks.push('  proto.listConnections = function () {');
  chunks.push(
    '    return this._request("GET", "/helpers/connections").then((r: any) => r.data);',
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

  chunks.push(
    "export type MonacoSnippetFieldType = 'string' | 'number' | 'boolean' | 'array' | 'object' | string[];",
  );
  chunks.push('export type MonacoSnippetField = [name: string, type: MonacoSnippetFieldType];');
  chunks.push('');
  chunks.push('export interface MonacoSnippet {');
  chunks.push('  fields: MonacoSnippetField[];');
  chunks.push('  outputKeys: string[];');
  chunks.push('}');
  chunks.push('');

  const reverseAliases = new Map<string, string[]>();
  for (const [alias, stepType] of Object.entries(METHOD_ALIASES)) {
    if (!reverseAliases.has(stepType)) reverseAliases.set(stepType, []);
    reverseAliases.get(stepType)!.push(alias);
  }

  const allMethods: Array<{
    method: string;
    stepType: string;
    schema: SchemaObject;
    outputSchema: SchemaObject | null;
  }> = [];

  for (const step of steps) {
    const aliases = reverseAliases.get(step.stepType);
    if (aliases) {
      for (const alias of aliases) {
        // Alias entry (the public method name)
        allMethods.push({
          method: alias,
          stepType: step.stepType,
          schema: step.inputSchema,
          outputSchema: step.outputSchema,
        });
        // Original step type name as duplicate entry
        allMethods.push({
          method: step.methodName,
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

  chunks.push(
    'export const monacoSnippets: Record<string, MonacoSnippet> = {',
  );

  for (const { method, schema, outputSchema } of allMethods) {
    const required = new Set(schema.required ?? []);
    const props = schema.properties ?? {};

    const fields: string[] = [];
    for (const [key, propSchema] of Object.entries(props)) {
      if (!required.has(key)) continue;
      fields.push(`[${JSON.stringify(key)}, ${monacoFieldType(propSchema)}]`);
    }

    const outputRequired = new Set(outputSchema?.required ?? []);
    const outputKeys = Object.keys(outputSchema?.properties ?? {}).filter((k) =>
      outputRequired.has(k),
    );

    chunks.push(
      `  ${JSON.stringify(method)}: { fields: [${fields.join(', ')}], outputKeys: ${JSON.stringify(outputKeys)} },`,
    );
  }

  chunks.push('};');
  chunks.push('');

  // Block-type aliases: maps public method name → original step type name.
  // For the 2 renamed steps, consumers can use this to reverse-map.
  const aliasEntries = Object.entries(METHOD_ALIASES).map(
    ([stepType, alias]) => `  ${JSON.stringify(alias)}: ${JSON.stringify(stepType)},`,
  );
  chunks.push(
    'export const blockTypeAliases: Record<string, string> = {',
  );
  for (const entry of aliasEntries) {
    chunks.push(entry);
  }
  chunks.push('};');
  chunks.push('');

  return chunks.join('\n');
}

function monacoFieldType(schema: SchemaObject): string {
  if (schema.enum) {
    return `[${schema.enum.map((v) => JSON.stringify(v)).join(', ')}]`;
  }

  if (Array.isArray(schema.type)) {
    const nonNull = schema.type.filter((t) => t !== 'null');
    if (nonNull.length > 0) {
      return monacoFieldType({ ...schema, type: nonNull[0] });
    }
  }

  switch (schema.type) {
    case 'string':
      return "'string'";
    case 'number':
    case 'integer':
      return "'number'";
    case 'boolean':
      return "'boolean'";
    case 'array':
      return "'array'";
    case 'object':
      return "'object'";
    default:
      return "'string'";
  }
}

// ---------------------------------------------------------------------------
// Generate src/generated/metadata.ts
// ---------------------------------------------------------------------------

/**
 * Converts an OpenAPI SchemaObject into a clean JSON Schema object
 * suitable for MCP tool definitions and CLI validation.
 */
function schemaToJsonSchema(
  schema: SchemaObject | undefined,
  definitions?: Record<string, SchemaObject>,
): Record<string, unknown> | null {
  if (!schema) return null;

  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop()!;
    if (definitions?.[refName]) {
      return schemaToJsonSchema(definitions[refName], definitions);
    }
    return { type: 'string' };
  }

  if (schema.anyOf) {
    const resolved = schema.anyOf.map((s) => schemaToJsonSchema(s, definitions)).filter(Boolean);
    if (resolved.length === 1) return resolved[0];
    return { anyOf: resolved };
  }

  if (schema.enum) {
    const base: Record<string, unknown> = { enum: schema.enum };
    if (schema.type) base.type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
    if (schema.description) base.description = schema.description;
    return base;
  }

  if (Array.isArray(schema.type)) {
    const nonNull = schema.type.filter((t) => t !== 'null');
    if (nonNull.length === 1) {
      return schemaToJsonSchema({ ...schema, type: nonNull[0] }, definitions);
    }
    return { type: schema.type };
  }

  if (schema.type === 'object' && schema.properties) {
    const props: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      props[key] = schemaToJsonSchema(prop, definitions);
    }
    const result: Record<string, unknown> = {
      type: 'object',
      properties: props,
    };
    if (schema.required?.length) result.required = schema.required;
    if (schema.description) result.description = schema.description;
    return result;
  }

  if (schema.type === 'object') {
    const result: Record<string, unknown> = { type: 'object' };
    if (schema.description) result.description = schema.description;
    return result;
  }

  if (schema.type === 'array') {
    const result: Record<string, unknown> = { type: 'array' };
    if (schema.items) result.items = schemaToJsonSchema(schema.items, definitions);
    if (schema.description) result.description = schema.description;
    return result;
  }

  // Primitive types
  const result: Record<string, unknown> = {};
  if (schema.type) result.type = schema.type === 'integer' ? 'number' : schema.type;
  if (schema.description) result.description = schema.description;
  return result;
}

function generateMetadata(
  steps: StepInfo[],
  definitions?: Record<string, SchemaObject>,
): string {
  const chunks: string[] = [HEADER, ''];

  chunks.push('export interface StepMetadata {');
  chunks.push('  stepType: string;');
  chunks.push('  description: string;');
  chunks.push('  usageNotes: string;');
  chunks.push('  inputSchema: Record<string, unknown>;');
  chunks.push('  outputSchema: Record<string, unknown> | null;');
  chunks.push('}');
  chunks.push('');

  const reverseAliases = new Map<string, string[]>();
  for (const [alias, stepType] of Object.entries(METHOD_ALIASES)) {
    if (!reverseAliases.has(stepType)) reverseAliases.set(stepType, []);
    reverseAliases.get(stepType)!.push(alias);
  }

  const entries: Array<{
    methodName: string;
    stepType: string;
    step: StepInfo;
  }> = [];

  for (const step of steps) {
    const aliases = reverseAliases.get(step.stepType);
    if (aliases) {
      for (const alias of aliases) {
        entries.push({ methodName: alias, stepType: step.stepType, step });
        entries.push({ methodName: step.methodName, stepType: step.stepType, step });
      }
    } else {
      entries.push({ methodName: step.methodName, stepType: step.stepType, step });
    }
  }

  entries.sort((a, b) => a.methodName.localeCompare(b.methodName));

  chunks.push('export const stepMetadata: Record<string, StepMetadata> = {');

  for (const { methodName, stepType, step } of entries) {
    const description = step.operation.description ?? '';
    const usageNotes = step.operation['x-usage-notes'] ?? '';

    const inputJsonSchema = schemaToJsonSchema(step.inputSchema, definitions) ?? {
      type: 'object',
      properties: {},
    };
    const outputJsonSchema = schemaToJsonSchema(step.outputSchema ?? undefined, definitions);

    chunks.push(`  ${JSON.stringify(methodName)}: {`);
    chunks.push(`    stepType: ${JSON.stringify(stepType)},`);
    chunks.push(`    description: ${JSON.stringify(description)},`);
    chunks.push(`    usageNotes: ${JSON.stringify(usageNotes)},`);
    chunks.push(`    inputSchema: ${JSON.stringify(inputJsonSchema)},`);
    chunks.push(`    outputSchema: ${outputJsonSchema ? JSON.stringify(outputJsonSchema) : 'null'},`);
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

/**
 * Renders a schema as a multi-line indented block for llms.txt.
 * More readable than the single-line inline format for complex objects.
 */
function schemaToBlock(
  schema: SchemaObject | undefined,
  indent: string = '  ',
  definitions?: Record<string, SchemaObject>,
): string {
  if (!schema) return `${indent}unknown`;

  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop()!;
    if (definitions?.[refName]) {
      return schemaToBlock(definitions[refName], indent, definitions);
    }
    return `${indent}unknown`;
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
    const propLines: string[] = [];
    for (const [key, prop] of Object.entries(schema.properties)) {
      const opt = required.has(key) ? '' : '?';
      const desc = prop.description ? `  // ${prop.description}` : '';

      // Use inline for nested types to keep it compact
      const type = schemaToInline(prop, definitions);
      propLines.push(`${indent}${key}${opt}: ${type};${desc}`);
    }
    return `{\n${propLines.join('\n')}\n${indent.slice(2)}}`;
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
    'TypeScript SDK, CLI, and MCP server for MindStudio. One API key gives you access to 200+ AI models (OpenAI, Anthropic, Google, Meta, xAI, DeepSeek, etc.) and 1,000+ integrations including 850+ third-party connectors from the open-source MindStudio Connector Registry (https://github.com/mindstudio-ai/mscr). No separate provider API keys required.',
  );
  lines.push('');
  lines.push(
    'This file is the complete API reference. No other documentation is needed to use the SDK.',
  );
  lines.push('');

  // --- Install ---
  lines.push('## Install');
  lines.push('');
  lines.push('```bash');
  lines.push('npm install @mindstudio-ai/agent');
  lines.push('```');
  lines.push('');
  lines.push('Requires Node.js >= 18.');
  lines.push('');

  // --- CLI ---
  lines.push('## CLI');
  lines.push('');
  lines.push(
    'The package includes a CLI for executing steps from the command line or scripts:',
  );
  lines.push('');
  lines.push('```bash');
  lines.push('# Execute with named flags (kebab-case)');
  lines.push(
    'mindstudio generate-image --prompt "A mountain landscape"',
  );
  lines.push('');
  lines.push('# Execute with JSON input (JSON5-tolerant)');
  lines.push(
    "mindstudio generate-image '{prompt: \"A mountain landscape\"}'",
  );
  lines.push('');
  lines.push('# Extract a single output field');
  lines.push(
    'mindstudio generate-image --prompt "A sunset" --output-key imageUrl',
  );
  lines.push('');
  lines.push('# List all available methods');
  lines.push('mindstudio list');
  lines.push('');
  lines.push('# Show method details (params, types, output)');
  lines.push('mindstudio info generate-image');
  lines.push('');
  lines.push('# Run via npx without installing');
  lines.push(
    'npx @mindstudio-ai/agent generate-text --message "Hello"',
  );
  lines.push('```');
  lines.push('');
  lines.push(
    'Auth: run `mindstudio login`, set `MINDSTUDIO_API_KEY` env var, or pass `--api-key <key>`.',
  );
  lines.push(
    'Method names are kebab-case on the CLI (camelCase also accepted). Flags are kebab-case (`--video-url` for `videoUrl`).',
  );
  lines.push(
    'Use `--output-key <key>` to extract a single field, `--no-meta` to strip $-prefixed metadata.',
  );
  lines.push('');

  // --- Authentication ---
  lines.push('### Authentication');
  lines.push('');
  lines.push('```bash');
  lines.push('# Interactive login (opens browser, saves key to ~/.mindstudio/config.json)');
  lines.push('mindstudio login');
  lines.push('');
  lines.push('# Check current auth status');
  lines.push('mindstudio whoami');
  lines.push('');
  lines.push('# Clear stored credentials');
  lines.push('mindstudio logout');
  lines.push('```');
  lines.push('');
  lines.push(
    'Auth resolution order: `--api-key` flag > `MINDSTUDIO_API_KEY` env > `~/.mindstudio/config.json` > `CALLBACK_TOKEN` env.',
  );
  lines.push('');

  // --- MCP ---
  lines.push('## MCP server');
  lines.push('');
  lines.push(
    'The package includes an MCP server exposing all methods as tools:',
  );
  lines.push('');
  lines.push('```bash');
  lines.push('mindstudio mcp');
  lines.push('```');
  lines.push('');
  lines.push('MCP client config:');
  lines.push('```json');
  lines.push('{');
  lines.push('  "mcpServers": {');
  lines.push('    "mindstudio": {');
  lines.push('      "command": "npx",');
  lines.push('      "args": ["-y", "@mindstudio-ai/agent", "mcp"],');
  lines.push('      "env": { "MINDSTUDIO_API_KEY": "your-api-key" }');
  lines.push('    }');
  lines.push('  }');
  lines.push('}');
  lines.push('```');
  lines.push('');

  // --- Setup ---
  lines.push('## Setup');
  lines.push('');
  lines.push('```typescript');
  lines.push("import { MindStudioAgent } from '@mindstudio-ai/agent';");
  lines.push('');
  lines.push('// With API key (or set MINDSTUDIO_API_KEY env var)');
  lines.push("const agent = new MindStudioAgent({ apiKey: 'your-key' });");
  lines.push('```');
  lines.push('');
  lines.push(
    'Your MindStudio API key authenticates all requests. MindStudio routes to the correct AI provider (OpenAI, Google, Anthropic, etc.) server-side — you do NOT need separate provider API keys.',
  );
  lines.push('');
  lines.push('Constructor options:');
  lines.push('```typescript');
  lines.push('new MindStudioAgent({');
  lines.push(
    '  apiKey?: string,     // Auth token. Falls back to MINDSTUDIO_API_KEY env var.',
  );
  lines.push(
    '  baseUrl?: string,    // API base URL. Defaults to "https://v1.mindstudio-api.com".',
  );
  lines.push(
    '  maxRetries?: number, // Retries on 429 rate limit (default: 3). Uses Retry-After header for delay.',
  );
  lines.push('})');
  lines.push('```');
  lines.push('');

  // --- Models ---
  lines.push('## Models');
  lines.push('');
  lines.push(
    'Direct access to 200+ AI models from every major provider — all through a single API key, billed at cost with no markups.',
  );
  lines.push('');
  lines.push(
    'Use `listModels()` or `listModelsByType()` for full model details, or `listModelsSummary()` / `listModelsSummaryByType()` for a lightweight list (id, name, type, tags) suitable for LLM context windows. Pass a model ID to `modelOverride.model` in methods like `generateText` to select a specific model:',
  );
  lines.push('');
  lines.push('```typescript');
  lines.push(
    "const { models } = await agent.listModelsByType('llm_chat');",
  );
  lines.push('const model = models.find(m => m.name.includes("Gemini"));');
  lines.push('');
  lines.push('const { content } = await agent.generateText({');
  lines.push("  message: 'Hello',");
  lines.push('  modelOverride: {');
  lines.push('    model: model.id,');
  lines.push('    temperature: 0.7,');
  lines.push('    maxResponseTokens: 1024,');
  lines.push('  },');
  lines.push('});');
  lines.push('```');
  lines.push('');

  // --- Calling convention ---
  lines.push('## Calling convention');
  lines.push('');
  lines.push('Every method has the signature:');
  lines.push('```typescript');
  lines.push(
    'agent.methodName(input: InputType, options?: { appId?: string, threadId?: string }): Promise<OutputType & StepExecutionMeta>',
  );
  lines.push('```');
  lines.push('');
  lines.push(
    'The first argument is the step-specific input object. The optional second argument controls thread/app context.',
  );
  lines.push('');
  lines.push(
    '**Results are returned flat** — output fields are spread at the top level alongside metadata:',
  );
  lines.push('');
  lines.push('```typescript');
  lines.push(
    "const { content } = await agent.generateText({ message: 'Hello' });",
  );
  lines.push('');
  lines.push('// Full result shape for any method:');
  lines.push('const result = await agent.generateText({ message: `Hello` });');
  lines.push('result.content;              // step-specific output field');
  lines.push(
    'result.$appId;               // string — app ID for this execution',
  );
  lines.push(
    'result.$threadId;            // string — thread ID for this execution',
  );
  lines.push(
    'result.$rateLimitRemaining;  // number | undefined — API calls remaining in rate limit window',
  );
  lines.push(
    'result.$billingCost;         // number | undefined — cost in credits for this call',
  );
  lines.push(
    'result.$billingEvents;       // object[] | undefined — itemized billing events',
  );
  lines.push('```');
  lines.push('');

  // --- Thread persistence ---
  lines.push('## Thread persistence');
  lines.push('');
  lines.push(
    'Pass `$appId`/`$threadId` from a previous result to maintain conversation state, variable state, or other context across calls:',
  );
  lines.push('');
  lines.push('```typescript');
  lines.push(
    "const r1 = await agent.generateText({ message: 'My name is Alice' });",
  );
  lines.push('const r2 = await agent.generateText(');
  lines.push("  { message: 'What is my name?' },");
  lines.push('  { threadId: r1.$threadId, appId: r1.$appId },');
  lines.push(');');
  lines.push('// r2.content => "Your name is Alice"');
  lines.push('```');
  lines.push('');

  // --- Error handling ---
  lines.push('## Error handling');
  lines.push('');
  lines.push('All errors throw `MindStudioError`:');
  lines.push('```typescript');
  lines.push("import { MindStudioError } from '@mindstudio-ai/agent';");
  lines.push('');
  lines.push('try {');
  lines.push("  await agent.generateImage({ prompt: '...' });");
  lines.push('} catch (err) {');
  lines.push('  if (err instanceof MindStudioError) {');
  lines.push('    err.message; // Human-readable error message');
  lines.push(
    '    err.code;    // Machine-readable code: "invalid_step_config", "api_error", "call_cap_exceeded", "output_fetch_error"',
  );
  lines.push('    err.status;  // HTTP status code (400, 401, 429, etc.)');
  lines.push('    err.details; // Raw error body from the API');
  lines.push('  }');
  lines.push('}');
  lines.push('```');
  lines.push('');
  lines.push(
    '429 rate limit errors are retried automatically (configurable via `maxRetries`).',
  );
  lines.push('');

  // --- Low-level access ---
  lines.push('## Low-level access');
  lines.push('');
  lines.push('For step types not covered by generated methods:');
  lines.push('```typescript');
  lines.push(
    "const result = await agent.executeStep('stepType', { ...params });",
  );
  lines.push('```');
  lines.push('');

  // --- Method catalog ---
  lines.push('## Methods');
  lines.push('');
  lines.push(
    'All methods below are called on a `MindStudioAgent` instance (`agent.methodName(...)`).',
  );
  lines.push(
    'Input shows the first argument object. Output shows the fields available on the returned result.',
  );
  lines.push('');

  // Group by category based on summary prefix
  interface MethodEntry {
    method: string;
    description?: string;
    usageNotes?: string;
    inputSchema: SchemaObject;
    outputSchema: SchemaObject | null;
  }

  const categories = new Map<string, MethodEntry[]>();

  for (const step of steps) {
    const aliases = reverseAliases.get(step.stepType);
    const methodNames = aliases ?? [step.methodName];
    const summary = step.operation.summary ?? '';

    const categoryMatch = summary.match(/^\[([^\]]+)\]\s*/);
    const category = categoryMatch ? categoryMatch[1] : 'General';

    for (const method of methodNames) {
      if (!categories.has(category)) categories.set(category, []);
      categories.get(category)!.push({
        method,
        description: step.operation.description,
        usageNotes: step.operation['x-usage-notes'],
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
      const inputInline = schemaToInline(m.inputSchema);
      const outputInline = m.outputSchema
        ? schemaToInline(m.outputSchema)
        : 'void';

      lines.push(`#### ${m.method}`);

      if (m.description) {
        lines.push(m.description);
      }

      if (m.usageNotes) {
        for (const line of m.usageNotes.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) lines.push(trimmed);
        }
      }

      lines.push(`- Input: \`${inputInline}\``);
      lines.push(`- Output: \`${outputInline}\``);
      lines.push('');
    }
  }

  // --- Helpers ---
  lines.push('### Helpers');
  lines.push('');
  lines.push('#### `listModels()`');
  lines.push('List all available AI models across all categories.');
  lines.push('');
  lines.push('Output:');
  lines.push('```typescript');
  lines.push('{');
  lines.push('  models: {');
  lines.push('    id: string;');
  lines.push('    name: string;            // Display name');
  lines.push(
    '    type: "llm_chat" | "image_generation" | "video_generation" | "video_analysis" | "text_to_speech" | "vision" | "transcription";',
  );
  lines.push('    maxTemperature: number;');
  lines.push('    maxResponseSize: number;');
  lines.push('    inputs: object[];        // Accepted input types');
  lines.push('  }[]');
  lines.push('}');
  lines.push('```');
  lines.push('');
  lines.push('#### `listModelsByType(modelType)`');
  lines.push('List AI models filtered by type.');
  lines.push(
    '- `modelType`: `"llm_chat"` | `"image_generation"` | `"video_generation"` | `"video_analysis"` | `"text_to_speech"` | `"vision"` | `"transcription"`',
  );
  lines.push('- Output: same as `listModels()`');
  lines.push('');
  lines.push('#### `listModelsSummary()`');
  lines.push(
    'List all available AI models (summary). Returns only id, name, type, and tags. Suitable for display or consumption inside a model context window.',
  );
  lines.push('');
  lines.push('Output:');
  lines.push('```typescript');
  lines.push('{');
  lines.push('  models: {');
  lines.push('    id: string;');
  lines.push('    name: string;');
  lines.push(
    '    type: "llm_chat" | "image_generation" | "video_generation" | "video_analysis" | "text_to_speech" | "vision" | "transcription";',
  );
  lines.push('    tags: string;            // Comma-separated tags');
  lines.push('  }[]');
  lines.push('}');
  lines.push('```');
  lines.push('');
  lines.push('#### `listModelsSummaryByType(modelType)`');
  lines.push('List AI models (summary) filtered by type.');
  lines.push(
    '- `modelType`: `"llm_chat"` | `"image_generation"` | `"video_generation"` | `"video_analysis"` | `"text_to_speech"` | `"vision"` | `"transcription"`',
  );
  lines.push('- Output: same as `listModelsSummary()`');
  lines.push('');
  lines.push('#### `listConnectors()`');
  lines.push(
    'List available connector services (Slack, Google, HubSpot, etc.) and their actions.',
  );
  lines.push('');
  lines.push('Output:');
  lines.push('```typescript');
  lines.push('{');
  lines.push('  services: {');
  lines.push('    id: string;');
  lines.push('    name: string;');
  lines.push('    icon: string;');
  lines.push('    actions: { id: string; name: string }[];');
  lines.push('  }[]');
  lines.push('}');
  lines.push('```');
  lines.push('');
  lines.push('#### `getConnector(serviceId)`');
  lines.push('Get details for a single connector service by ID.');
  lines.push('');
  lines.push('Output:');
  lines.push('```typescript');
  lines.push('{');
  lines.push('  service: {');
  lines.push('    id: string;');
  lines.push('    name: string;');
  lines.push('    icon: string;');
  lines.push('    actions: { id: string; name: string }[];');
  lines.push('  }');
  lines.push('}');
  lines.push('```');
  lines.push('');
  lines.push('#### `getConnectorAction(serviceId, actionId)`');
  lines.push(
    'Get the full configuration for a connector action, including all input fields needed to call it via `runFromConnectorRegistry`. Connectors are sourced from the open-source MindStudio Connector Registry (MSCR) with 850+ third-party service integrations.',
  );
  lines.push('');
  lines.push('Output:');
  lines.push('```typescript');
  lines.push('{');
  lines.push('  action: {');
  lines.push('    id: string;');
  lines.push('    name: string;');
  lines.push('    description: string;');
  lines.push('    quickHelp: string;');
  lines.push(
    '    configuration: { title: string; items: { label: string; helpText: string; variable: string; type: string; defaultValue: string; placeholder: string; selectOptions?: object }[] }[];',
  );
  lines.push('  }');
  lines.push('}');
  lines.push('```');
  lines.push('');
  lines.push('#### `listConnections()`');
  lines.push(
    'List OAuth connections for the organization. Use the returned connection IDs when calling connector actions. Connectors require the user to connect to the third-party service in MindStudio before they can be used.',
  );
  lines.push('');
  lines.push('Output:');
  lines.push('```typescript');
  lines.push('{');
  lines.push('  connections: {');
  lines.push('    id: string;       // Connection ID to pass to connector actions');
  lines.push('    provider: string; // Integration provider (e.g. slack, google)');
  lines.push('    name: string;     // Display name or account identifier');
  lines.push('  }[]');
  lines.push('}');
  lines.push('```');
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
  const metadataContent = generateMetadata(steps, spec.definitions);
  const llmsTxtContent = generateLlmsTxt(steps);

  writeFileSync(resolve(GENERATED_DIR, 'types.ts'), typesContent);
  console.log(`Wrote src/generated/types.ts`);

  writeFileSync(resolve(GENERATED_DIR, 'steps.ts'), stepsContent);
  console.log(`Wrote src/generated/steps.ts`);

  writeFileSync(resolve(GENERATED_DIR, 'helpers.ts'), helpersContent);
  console.log(`Wrote src/generated/helpers.ts`);

  writeFileSync(resolve(GENERATED_DIR, 'snippets.ts'), snippetsContent);
  console.log(`Wrote src/generated/snippets.ts`);

  writeFileSync(resolve(GENERATED_DIR, 'metadata.ts'), metadataContent);
  console.log(`Wrote src/generated/metadata.ts`);

  writeFileSync(resolve(__dirname, '../llms.txt'), llmsTxtContent);
  console.log(`Wrote llms.txt`);

  console.log('Done!');
}

main().catch((err) => {
  console.error('Codegen failed:', err);
  process.exit(1);
});

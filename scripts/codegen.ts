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

import { writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = resolve(__dirname, "../src/generated");

const HEADER = `// AUTO-GENERATED — DO NOT EDIT
// Run \`npm run codegen\` to regenerate from the OpenAPI spec.
// Generated: ${new Date().toISOString()}
`;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(): { specUrl?: string; specFile?: string } {
  const args = process.argv.slice(2);
  let specUrl: string | undefined;
  let specFile: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) specUrl = args[++i];
    if (args[i] === "--file" && args[i + 1]) specFile = args[++i];
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
      "application/json": { schema: SchemaObject };
    };
  };
  responses: Record<
    string,
    {
      description?: string;
      content?: { "application/json": { schema: SchemaObject } };
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
    return JSON.parse(readFileSync(specFile, "utf-8"));
  }

  const baseUrl =
    specUrl ??
    process.env.MINDSTUDIO_BASE_URL ??
    "https://v1.mindstudio-api.com";

  const url = `${baseUrl}/developer/v2/steps/openapi.json`;
  console.log(`Fetching spec from: ${url}`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch spec: ${res.status} ${res.statusText}`);
  return res.json() as Promise<OpenAPISpec>;
}

// ---------------------------------------------------------------------------
// JSON Schema → TypeScript
// ---------------------------------------------------------------------------

const PRIMITIVE_MAP: Record<string, string> = {
  string: "string",
  number: "number",
  integer: "number",
  boolean: "boolean",
  null: "null",
};

function schemaToTs(
  schema: SchemaObject | undefined,
  indent: string = "",
  definitions?: Record<string, SchemaObject>,
): string {
  if (!schema) return "unknown";

  // $ref
  if (schema.$ref) {
    const refName = schema.$ref.split("/").pop()!;
    if (definitions?.[refName]) {
      return schemaToTs(definitions[refName], indent, definitions);
    }
    return "unknown";
  }

  // anyOf → union
  if (schema.anyOf) {
    const members = schema.anyOf.map((s) => schemaToTs(s, indent, definitions));
    // Deduplicate
    const unique = [...new Set(members)];
    return unique.length === 1 ? unique[0] : unique.join(" | ");
  }

  // enum
  if (schema.enum) {
    return schema.enum.map((v) => JSON.stringify(v)).join(" | ");
  }

  // type array like ["string", "null"]
  if (Array.isArray(schema.type)) {
    const types = schema.type.map((t) => {
      if (t === "null") return "null";
      // Build a sub-schema for each type variant
      return schemaToTs({ ...schema, type: t }, indent, definitions);
    });
    const unique = [...new Set(types)];
    return unique.length === 1 ? unique[0] : unique.join(" | ");
  }

  // array
  if (schema.type === "array") {
    const itemType = schemaToTs(schema.items, indent, definitions);
    // Wrap complex union types in parens
    const needsParens = itemType.includes(" | ");
    return needsParens ? `(${itemType})[]` : `${itemType}[]`;
  }

  // object with properties
  if (schema.type === "object" && schema.properties) {
    const required = new Set(schema.required ?? []);
    const lines: string[] = [];
    for (const [key, prop] of Object.entries(schema.properties)) {
      const opt = required.has(key) ? "" : "?";
      const doc = buildPropertyDoc(key, prop);
      if (doc) lines.push(`${indent}  ${doc}`);
      const safeName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
      lines.push(
        `${indent}  ${safeName}${opt}: ${schemaToTs(prop, indent + "  ", definitions)};`,
      );
    }
    return `{\n${lines.join("\n")}\n${indent}}`;
  }

  // object without properties
  if (schema.type === "object") {
    return "Record<string, unknown>";
  }

  // primitives
  if (typeof schema.type === "string" && PRIMITIVE_MAP[schema.type]) {
    return PRIMITIVE_MAP[schema.type];
  }

  return "unknown";
}

/**
 * Emit a type declaration. Uses `interface` when the TS string is an object
 * literal (starts with `{`), otherwise `type X = ...`.
 */
function emitTypeDeclaration(name: string, tsType: string): string {
  if (tsType.startsWith("{")) {
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
      parts.push(`One of: ${schema.enum.map((v) => `\`${v}\``).join(", ")}.`);
    }
  }

  if (parts.length === 0) return null;
  const text = parts.join(" ");
  if (!text.includes("\n")) {
    return `/** ${text} */`;
  }
  return `/**\n * ${text.split("\n").join("\n * ")}\n */`;
}

function buildMethodDoc(op: OperationObject): string {
  const lines: string[] = ["/**"];

  // Summary as the main line
  if (op.summary) {
    lines.push(` * ${op.summary}`);
  }

  // Description as detail block
  if (op.description) {
    lines.push(` *`);
    for (const line of op.description.split("\n")) {
      lines.push(` * ${line}`);
    }
  }

  lines.push(" */");
  return lines.join("\n");
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

    const bodySchema =
      op.requestBody?.content?.["application/json"]?.schema;
    const inputSchema = bodySchema?.properties?.step ?? {};

    const respSchema =
      op.responses?.["200"]?.content?.["application/json"]?.schema;
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
  const chunks: string[] = [HEADER, ""];

  for (const step of steps) {
    // Input type
    const inputTs = schemaToTs(step.inputSchema, "", definitions);
    chunks.push(emitTypeDeclaration(step.inputTypeName, inputTs));
    chunks.push("");

    // Output type
    if (step.outputSchema) {
      const outputTs = schemaToTs(step.outputSchema, "", definitions);
      chunks.push(emitTypeDeclaration(step.outputTypeName, outputTs));
    } else {
      chunks.push(
        `export type ${step.outputTypeName} = Record<string, unknown>;`,
      );
    }
    chunks.push("");
  }

  // StepName union type for discoverability
  chunks.push("/** Union of all available step type names. */");
  chunks.push(
    `export type StepName =\n  | ${steps.map((s) => `"${s.stepType}"`).join("\n  | ")};`,
  );
  chunks.push("");

  // Step input/output map for generic use
  chunks.push("/** Maps step names to their input types. */");
  chunks.push("export interface StepInputMap {");
  for (const step of steps) {
    chunks.push(`  ${step.stepType}: ${step.inputTypeName};`);
  }
  chunks.push("}");
  chunks.push("");

  chunks.push("/** Maps step names to their output types. */");
  chunks.push("export interface StepOutputMap {");
  for (const step of steps) {
    chunks.push(`  ${step.stepType}: ${step.outputTypeName};`);
  }
  chunks.push("}");
  chunks.push("");

  return chunks.join("\n");
}

// ---------------------------------------------------------------------------
// Generate src/generated/steps.ts
// ---------------------------------------------------------------------------

function generateSteps(steps: StepInfo[]): string {
  const chunks: string[] = [HEADER, ""];

  // Imports
  const inputTypes = steps.map((s) => s.inputTypeName).join(",\n  ");
  const outputTypes = steps.map((s) => s.outputTypeName).join(",\n  ");
  chunks.push(`import type {\n  ${inputTypes},\n  ${outputTypes},\n} from "./types.js";`);
  chunks.push("");
  chunks.push(
    `import type { StepExecutionOptions, StepExecutionResult } from "../types.js";`,
  );
  chunks.push("");

  // Module augmentation
  chunks.push('declare module "../client.js" {');
  chunks.push("  interface MindStudioAgent {");

  for (const step of steps) {
    const doc = buildMethodDoc(step.operation);
    // Indent the doc
    const indentedDoc = doc
      .split("\n")
      .map((l) => `    ${l}`)
      .join("\n");
    chunks.push(indentedDoc);
    chunks.push(
      `    ${step.methodName}(` +
        `step: ${step.inputTypeName}, ` +
        `options?: StepExecutionOptions` +
        `): Promise<StepExecutionResult<${step.outputTypeName}>>;`,
    );
    chunks.push("");
  }

  chunks.push("  }");
  chunks.push("}");
  chunks.push("");

  // Runtime method attachment
  chunks.push(
    "/** @internal Attaches typed step methods to the MindStudioAgent prototype. */",
  );
  chunks.push(
    "export function applyStepMethods(AgentClass: new (...args: any[]) => any): void {",
  );
  chunks.push("  const proto = AgentClass.prototype;");
  chunks.push("");

  for (const step of steps) {
    chunks.push(
      `  proto.${step.methodName} = function (` +
        `step: ${step.inputTypeName}, ` +
        `options?: StepExecutionOptions` +
        `) {`,
    );
    chunks.push(
      `    return this.executeStep("${step.stepType}", step as unknown as Record<string, unknown>, options);`,
    );
    chunks.push("  };");
    chunks.push("");
  }

  chunks.push("}");
  chunks.push("");

  return chunks.join("\n");
}

// ---------------------------------------------------------------------------
// Generate src/generated/helpers.ts
// ---------------------------------------------------------------------------

function generateHelpers(spec: OpenAPISpec): string {
  const chunks: string[] = [HEADER, ""];


  // Model type (from the models endpoint response schema)
  const modelsOp = spec.paths["/developer/v2/helpers/models"]?.get;
  if (modelsOp) {
    const modelSchema =
      modelsOp.responses["200"]?.content?.["application/json"]?.schema
        ?.properties?.models?.items;

    if (modelSchema) {
      chunks.push("/** An AI model available on MindStudio. */");
      chunks.push(
        `export interface MindStudioModel ${schemaToTs(modelSchema, "")}`,
      );
      chunks.push("");
    }
  }

  // Model type enum
  chunks.push("/** Supported model type categories for filtering. */");
  chunks.push(
    `export type ModelType = "llm_chat" | "image_generation" | "video_generation" | "video_analysis" | "text_to_speech" | "vision" | "transcription";`,
  );
  chunks.push("");

  // Module augmentation for helper methods
  chunks.push('declare module "../client.js" {');
  chunks.push("  interface MindStudioAgent {");
  chunks.push("    /**");
  chunks.push("     * List all available AI models.");
  chunks.push("     *");
  chunks.push(
    "     * Returns models across all categories (chat, image generation, video, etc.).",
  );
  chunks.push("     * Use `listModelsByType()` to filter by category.");
  chunks.push("     */");
  chunks.push(
    "    listModels(): Promise<{ models: MindStudioModel[] }>;",
  );
  chunks.push("");
  chunks.push("    /**");
  chunks.push("     * List AI models filtered by type.");
  chunks.push("     *");
  chunks.push(
    '     * @param modelType - The category to filter by (e.g. "llm_chat", "image_generation").',
  );
  chunks.push("     */");
  chunks.push(
    "    listModelsByType(modelType: ModelType): Promise<{ models: MindStudioModel[] }>;",
  );
  chunks.push("");
  chunks.push("    /**");
  chunks.push(
    "     * List all available connector services (Slack, Google, HubSpot, etc.).",
  );
  chunks.push("     */");
  chunks.push(
    "    listConnectors(): Promise<{ services: Array<{ service: Record<string, unknown>; actions: Record<string, unknown>[] }> }>;",
  );
  chunks.push("");
  chunks.push("    /**");
  chunks.push("     * Get details for a single connector service.");
  chunks.push("     *");
  chunks.push("     * @param serviceId - The connector service ID.");
  chunks.push("     */");
  chunks.push(
    "    getConnector(serviceId: string): Promise<{ service: Record<string, unknown> }>;",
  );
  chunks.push("  }");
  chunks.push("}");
  chunks.push("");

  // Runtime method attachment
  chunks.push(
    "/** @internal Attaches helper methods to the MindStudioAgent prototype. */",
  );
  chunks.push(
    "export function applyHelperMethods(AgentClass: new (...args: any[]) => any): void {",
  );
  chunks.push("  const proto = AgentClass.prototype;");
  chunks.push("");
  chunks.push("  proto.listModels = function () {");
  chunks.push(
    '    return this._request("GET", "/helpers/models").then((r: any) => r.data);',
  );
  chunks.push("  };");
  chunks.push("");
  chunks.push("  proto.listModelsByType = function (modelType: string) {");
  chunks.push(
    '    return this._request("GET", `/helpers/models/${modelType}`).then((r: any) => r.data);',
  );
  chunks.push("  };");
  chunks.push("");
  chunks.push("  proto.listConnectors = function () {");
  chunks.push(
    '    return this._request("GET", "/helpers/connectors").then((r: any) => r.data);',
  );
  chunks.push("  };");
  chunks.push("");
  chunks.push("  proto.getConnector = function (serviceId: string) {");
  chunks.push(
    '    return this._request("GET", `/helpers/connectors/${serviceId}`).then((r: any) => r.data);',
  );
  chunks.push("  };");
  chunks.push("}");
  chunks.push("");

  return chunks.join("\n");
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

  writeFileSync(resolve(GENERATED_DIR, "types.ts"), typesContent);
  console.log(`Wrote src/generated/types.ts`);

  writeFileSync(resolve(GENERATED_DIR, "steps.ts"), stepsContent);
  console.log(`Wrote src/generated/steps.ts`);

  writeFileSync(resolve(GENERATED_DIR, "helpers.ts"), helpersContent);
  console.log(`Wrote src/generated/helpers.ts`);

  console.log("Done!");
}

main().catch((err) => {
  console.error("Codegen failed:", err);
  process.exit(1);
});

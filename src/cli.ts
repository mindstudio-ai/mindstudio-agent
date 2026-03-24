import { parseArgs } from 'node:util';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const HELP = `Usage: mindstudio <command> [options]

Ask:
  ask "<question>"                     Ask about actions, models, connectors
                                       Returns working code with real model IDs

Run actions:
  <action> [json | --flags]            Run an action directly
  run <action> [json | --flags]        Run an action (explicit form)
  estimate-cost <action> [json]        Estimate cost before running

Discover:
  list-actions [--json] [--summary]    List all available actions
  info <action>                        Show action details and parameters
  list-models [--type <t>] [--summary] List available AI models

Batch:
  batch [json]                         Execute multiple actions in parallel

Pre-built agents:
  agents [--json]                      List agents in your organization
  run-agent <appId> [json | --flags]   Run an agent and wait for result

Account:
  login                                Authenticate with MindStudio
  logout                               Clear stored credentials
  whoami                               Show current user and organization
  change-name <name>                   Update your display name
  change-profile-picture <url>         Update your profile picture
  upload <filepath>                    Upload a file to the MindStudio CDN
  update                               Update to the latest version

OAuth integrations:
  list-connectors [<id> [<actionId>]]  Browse OAuth connector services
  list-connections                     List your OAuth connections

Other:
  mcp                                  Start MCP server (JSON-RPC over stdio)

Options:
  --api-key <key>    API key (or set MINDSTUDIO_API_KEY env var)
  --base-url <url>   API base URL override
  --app-id <id>      App ID for thread context
  --thread-id <id>   Thread ID for state persistence
  --output-key <key> Extract a single field from the result
  --no-meta          Strip $-prefixed metadata from output
  --json-logs        Stream debug logs as JSONL to stderr
  --workflow <name>  Workflow to execute (run-agent only)
  --version <ver>    App version, e.g. "draft" (run-agent only)
  --json             Output as JSON
  --summary          Compact output (list-actions, list-models)
  --type <type>      Filter by model type (list-models)
  --help             Show this help

Examples:
  mindstudio ask "generate an image with FLUX"
  mindstudio ask "what models support vision?"
  mindstudio generate-image --prompt "a sunset"
  mindstudio generate-text --message "hello" --no-meta
  mindstudio generate-image '{"prompt":"a sunset"}' --output-key imageUrl
  echo '{"query":"test"}' | mindstudio search-google
  mindstudio estimate-cost generate-image --prompt "a sunset"
  mindstudio list-actions --summary
  mindstudio info generate-image
  mindstudio list-models --type image_generation
  mindstudio batch '[{"stepType":"generateImage","step":{"prompt":"a cat"}}]'
  mindstudio run-agent <appId> --query "hello"
  mindstudio agents
  mindstudio mcp
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

function kebabToCamel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Lightweight JSON5 preprocessor — normalizes forgiving JSON to strict JSON.
 * Supports: unquoted keys, single-quoted strings, trailing commas, comments.
 */
function parseJson5(input: string): unknown {
  let s = input;
  s = s.replace(/\/\/.*$/gm, '');
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
  s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
  s = s.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(s);
}

/** Try to coerce a string value to its natural JS type. */
function coerce(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value !== '' && !isNaN(Number(value))) return Number(value);
  if (
    (value.startsWith('{') && value.endsWith('}')) ||
    (value.startsWith('[') && value.endsWith(']'))
  ) {
    try {
      return JSON.parse(value);
    } catch {
      /* keep as string */
    }
  }
  return value;
}

/** Levenshtein distance between two strings. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function printHelp(): void {
  process.stderr.write(HELP);
}

function fatal(message: string): never {
  process.stderr.write(JSON.stringify({ error: { message } }) + '\n');
  process.exit(1);
}

function usageBlock(lines: string[]): never {
  process.stderr.write('\n' + lines.map((l) => '  ' + l).join('\n') + '\n\n');
  process.exit(1);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8').trim();
}

const BUILTIN_COMMANDS = new Set([
  'run',
  'list-actions',
  'info',
  'mcp',
  'agents',
  'run-agent',
  'upload',
  'login',
  'logout',
  'whoami',
  'list-models',
  'list-models-by-type',
  'list-models-summary',
  'list-models-summary-by-type',
  'list-connectors',
  'get-connector',
  'get-connector-action',
  'list-connections',
  'estimate-cost',
  'change-name',
  'change-profile-picture',
  'ask',
]);

/**
 * Resolve a method name from user input.
 * Accepts both kebab-case and camelCase, returns the camelCase key.
 * On failure, suggests the closest match.
 */
function resolveMethodOrFail(name: string, metadataKeys: Set<string>): string {
  if (metadataKeys.has(name)) return name;
  const camel = kebabToCamel(name);
  if (metadataKeys.has(camel)) return camel;

  // Find closest match for suggestion
  const kebab = name.includes('-') ? name : camelToKebab(name);
  let bestDist = Infinity;
  let bestMatch = '';
  for (const key of metadataKeys) {
    const d = levenshtein(kebab, camelToKebab(key));
    if (d < bestDist) {
      bestDist = d;
      bestMatch = camelToKebab(key);
    }
  }

  const suggestion = bestDist <= 3 ? ` Did you mean '${bestMatch}'?` : '';
  fatal(
    `Unknown action: ${name}.${suggestion} Run 'mindstudio list-actions' to see available actions.`,
  );
}

async function getAllMethodKeys(): Promise<Set<string>> {
  const { stepMetadata } = await import('./generated/metadata.js');
  return new Set(Object.keys(stepMetadata));
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function buildSummary(
  stepMetadata: Record<string, { description: string }>,
): Record<string, string> {
  const summary: Record<string, string> = {};
  for (const [name, meta] of Object.entries(stepMetadata)) {
    summary[name] = meta.description;
  }
  return summary;
}

async function cmdList(asJson: boolean, asSummary: boolean): Promise<void> {
  const { stepMetadata } = await import('./generated/metadata.js');

  if (asSummary) {
    process.stdout.write(JSON.stringify(buildSummary(stepMetadata)) + '\n');
  } else if (asJson) {
    const entries = Object.entries(stepMetadata).map(([name, meta]) => ({
      method: camelToKebab(name),
      description: meta.description,
      stepType: meta.stepType,
      inputSchema: meta.inputSchema,
      outputSchema: meta.outputSchema,
    }));
    process.stdout.write(JSON.stringify(entries, null, 2) + '\n');
  } else {
    const entries = Object.entries(stepMetadata);
    const kebabEntries = entries.map(
      ([name, meta]) => [camelToKebab(name), meta] as const,
    );
    const maxLen = Math.min(
      35,
      kebabEntries.reduce((m, [k]) => Math.max(m, k.length), 0),
    );
    for (const [name, meta] of kebabEntries) {
      const desc = meta.description || '(no description)';
      process.stdout.write(`${name.padEnd(maxLen)}  ${desc}\n`);
    }
  }
}

async function cmdInfo(rawMethod: string): Promise<void> {
  const allKeys = await getAllMethodKeys();
  const method = resolveMethodOrFail(rawMethod, allKeys);

  const { stepMetadata } = await import('./generated/metadata.js');
  const meta = stepMetadata[method];

  const out: string[] = [];
  out.push('');
  out.push(`  ${camelToKebab(method)}`);
  out.push('');
  if (meta.description) out.push(`  ${meta.description}`);
  if (meta.usageNotes) {
    out.push('');
    for (const line of meta.usageNotes.split('\n')) {
      const trimmed = line.trim();
      if (trimmed) out.push(`  ${trimmed}`);
    }
  }

  // Input params
  const schema = meta.inputSchema as {
    type?: string;
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
  };
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  if (Object.keys(props).length > 0) {
    out.push('');
    out.push('  Parameters:');
    for (const [key, prop] of Object.entries(props)) {
      const req = required.has(key) ? ' (required)' : '';
      const type = formatPropType(prop);
      const desc = prop.description ? `  ${prop.description}` : '';
      out.push(`    --${camelToKebab(key)}  ${type}${req}${desc}`);
    }
  }

  // Output keys
  const outSchema = meta.outputSchema as {
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
  } | null;
  if (outSchema?.properties) {
    out.push('');
    out.push('  Output keys:');
    const outRequired = new Set(outSchema.required ?? []);
    for (const [key, prop] of Object.entries(outSchema.properties)) {
      const type = formatPropType(prop);
      const opt = outRequired.has(key) ? '' : ' (optional)';
      out.push(`    ${key}  ${type}${opt}`);
    }
  }

  out.push('');
  process.stderr.write(out.join('\n') + '\n');
}

function formatPropType(prop: Record<string, unknown>): string {
  if (prop.enum)
    return (prop.enum as unknown[]).map((v) => JSON.stringify(v)).join(' | ');
  if (prop.type === 'array') return 'array';
  if (prop.type === 'object') return 'object';
  if (typeof prop.type === 'string')
    return prop.type === 'integer' ? 'number' : prop.type;
  return 'string';
}

async function cmdExec(
  method: string,
  input: Record<string, unknown>,
  options: {
    apiKey?: string;
    baseUrl?: string;
    appId?: string;
    threadId?: string;
    outputKey?: string;
    noMeta?: boolean;
    jsonLogs?: boolean;
  },
): Promise<void> {
  const { MindStudioAgent } = await import('./client.js');
  await import('./generated/steps.js').then((m) =>
    m.applyStepMethods(MindStudioAgent),
  );

  const agent = new MindStudioAgent({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
  }) as any;

  const { stepMetadata } = await import('./generated/metadata.js');
  const meta = stepMetadata[method];
  if (!meta) {
    fatal(
      `Unknown action: ${method}. Run 'mindstudio list-actions' to see available actions.`,
    );
  }

  // Determine log handler:
  // --json-logs: structured JSONL to stderr (for AI agents), always streams
  // TTY: pretty-printed logs to stderr
  // Piped: no streaming
  let onLog: ((log: { value: string; tag: string; ts: number }) => void) | undefined;
  if (options.jsonLogs) {
    onLog = (log) => {
      process.stderr.write(
        JSON.stringify({ type: 'log', value: log.value, tag: log.tag, ts: log.ts }) + '\n',
      );
    };
  } else if (process.stderr.isTTY) {
    onLog = (log) => {
      process.stderr.write(
        `  ${ansi.cyan('⟡')} ${ansi.gray(log.value)}\n`,
      );
    };
  }

  const result = await agent.executeStep(meta.stepType, input, {
    appId: options.appId,
    threadId: options.threadId,
    onLog,
  });

  // Apply output options
  if (options.outputKey) {
    const val = (result as Record<string, unknown>)[options.outputKey];
    if (typeof val === 'string') {
      process.stdout.write(val + '\n');
    } else {
      process.stdout.write(JSON.stringify(val, null, 2) + '\n');
    }
  } else if (options.noMeta) {
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(result as Record<string, unknown>)) {
      if (!k.startsWith('$')) filtered[k] = v;
    }
    process.stdout.write(JSON.stringify(filtered, null, 2) + '\n');
  } else {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }
}

async function cmdAgents(
  asJson: boolean,
  options: { apiKey?: string; baseUrl?: string },
): Promise<void> {
  const { MindStudioAgent } = await import('./client.js');
  const agent = new MindStudioAgent({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
  });

  const result = await agent.listAgents();

  if (asJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stderr.write(`\n  ${result.orgName} (${result.orgId})\n\n`);
    if (result.apps.length === 0) {
      process.stderr.write('  No agents found.\n\n');
      return;
    }
    const maxLen = Math.min(
      35,
      result.apps.reduce((m, a) => Math.max(m, a.name.length), 0),
    );
    for (const app of result.apps) {
      const desc = app.description || '(no description)';
      process.stdout.write(`${app.name.padEnd(maxLen)}  ${app.id}  ${desc}\n`);
    }
  }
}

function createAgent(options: { apiKey?: string; baseUrl?: string }) {
  // Lazy import to avoid loading client for help/login
  return import('./client.js').then(
    ({ MindStudioAgent }) =>
      new MindStudioAgent({
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
      }),
  );
}

function jsonOut(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

async function cmdListModels(options: {
  apiKey?: string;
  baseUrl?: string;
  type?: string;
  summary?: boolean;
}): Promise<void> {
  const agent = await createAgent(options);
  if (options.summary) {
    const result = options.type
      ? await agent.listModelsSummaryByType(options.type as any)
      : await agent.listModelsSummary();
    jsonOut(result);
  } else {
    const result = options.type
      ? await agent.listModelsByType(options.type as any)
      : await agent.listModels();
    jsonOut(result);
  }
}

async function cmdListConnectors(
  args: string[],
  options: { apiKey?: string; baseUrl?: string },
): Promise<void> {
  const agent = await createAgent(options);
  if (args.length >= 2) {
    const result = await agent.getConnectorAction(args[0], args[1]);
    jsonOut(result);
  } else if (args.length === 1) {
    const result = await agent.getConnector(args[0]);
    jsonOut(result);
  } else {
    const result = await agent.listConnectors();
    jsonOut(result);
  }
}

async function cmdListConnections(options: {
  apiKey?: string;
  baseUrl?: string;
}): Promise<void> {
  const agent = await createAgent(options);
  const result = await agent.listConnections();
  jsonOut(result);
}

async function cmdEstimateStepCost(
  method: string,
  input: Record<string, unknown>,
  options: { apiKey?: string; baseUrl?: string },
): Promise<void> {
  const agent = await createAgent(options);
  const result = await agent.estimateStepCost(method, input);
  jsonOut(result);
}

async function cmdChangeName(
  name: string,
  options: { apiKey?: string; baseUrl?: string },
): Promise<void> {
  const agent = await createAgent(options);
  await agent.changeName(name);
  process.stderr.write(`  Display name updated to: ${name}\n`);
}

async function cmdChangeProfilePicture(
  url: string,
  options: { apiKey?: string; baseUrl?: string },
): Promise<void> {
  const agent = await createAgent(options);
  await agent.changeProfilePicture(url);
  process.stderr.write(`  Profile picture updated.\n`);
}

async function cmdRun(
  appId: string,
  variables: Record<string, unknown>,
  options: {
    apiKey?: string;
    baseUrl?: string;
    workflow?: string;
    version?: string;
    outputKey?: string;
    noMeta?: boolean;
  },
): Promise<void> {
  const { MindStudioAgent } = await import('./client.js');
  const agent = new MindStudioAgent({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
  });

  const result = await agent.runAgent({
    appId,
    variables: Object.keys(variables).length > 0 ? variables : undefined,
    workflow: options.workflow,
    version: options.version,
  });

  const obj = result as unknown as Record<string, unknown>;

  if (options.outputKey) {
    const val = obj[options.outputKey];
    if (typeof val === 'string') {
      process.stdout.write(val + '\n');
    } else {
      process.stdout.write(JSON.stringify(val, null, 2) + '\n');
    }
  } else if (options.noMeta) {
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!k.startsWith('$')) filtered[k] = v;
    }
    process.stdout.write(JSON.stringify(filtered, null, 2) + '\n');
  } else {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }
}

async function cmdBatch(
  input: unknown,
  options: {
    apiKey?: string;
    baseUrl?: string;
    appId?: string;
    threadId?: string;
    noMeta?: boolean;
  },
): Promise<void> {
  // Validate input shape
  if (!Array.isArray(input)) {
    fatal(
      'Batch input must be a JSON array of { stepType, step } objects.\n' +
        'Example: mindstudio batch \'[{"stepType":"generateImage","step":{"prompt":"a cat"}}]\'',
    );
  }

  for (let i = 0; i < input.length; i++) {
    const item = input[i] as Record<string, unknown>;
    if (!item || typeof item !== 'object' || !item.stepType || !item.step) {
      fatal(
        `Invalid step at index ${i}: each entry must have "stepType" and "step" fields.`,
      );
    }
  }

  // Resolve method aliases so users can use the friendly names
  const { stepMetadata } = await import('./generated/metadata.js');
  const metaByName = new Map(
    Object.entries(stepMetadata).map(([name, m]) => [name, m]),
  );

  const steps = (input as Array<{ stepType: string; step: Record<string, unknown> }>).map(
    (item, i) => {
      // Try exact match first, then kebab→camel
      let meta = metaByName.get(item.stepType);
      if (!meta) {
        const camel = item.stepType.replace(/-([a-z])/g, (_, c: string) =>
          c.toUpperCase(),
        );
        meta = metaByName.get(camel);
      }
      if (meta) {
        return { stepType: meta.stepType, step: item.step };
      }
      // Fall through — let the API validate unknown step types
      return { stepType: item.stepType, step: item.step };
    },
  );

  const agent = await createAgent(options);
  const result = await agent.executeStepBatch(steps, {
    appId: options.appId,
    threadId: options.threadId,
  });

  if (options.noMeta) {
    process.stdout.write(JSON.stringify(result.results, null, 2) + '\n');
  } else {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }
}

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  pdf: 'application/pdf',
  json: 'application/json',
  txt: 'text/plain',
  csv: 'text/csv',
};

async function cmdUpload(
  filePath: string,
  options: { apiKey?: string; baseUrl?: string },
): Promise<void> {
  const ext = extname(filePath).slice(1).toLowerCase();
  if (!ext) fatal('Cannot determine file extension. Please provide a file with an extension.');

  const content = readFileSync(filePath);
  const mimeType = MIME_TYPES[ext];

  const { MindStudioAgent } = await import('./client.js');

  const agent = new MindStudioAgent({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
  }) as any;

  const { url } = await agent.uploadFile(content, {
    extension: ext,
    ...(mimeType && { type: mimeType }),
  });

  process.stdout.write(url + '\n');
}

// ---------------------------------------------------------------------------
// Auth commands
// ---------------------------------------------------------------------------

// ANSI helpers (zero-dep chalk alternative)
const ansi = {
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  cyanBright: (s: string) => `\x1b[96m${s}\x1b[0m`,
  cyanBold: (s: string) => `\x1b[96;1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  greenBold: (s: string) => `\x1b[32;1m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

// ---------------------------------------------------------------------------
// Update checker
// ---------------------------------------------------------------------------

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

function isNewerVersion(current: string, latest: string): boolean {
  const c = current.split('.').map(Number);
  const l = latest.split('.').map(Number);
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] ?? 0;
    const lv = l[i] ?? 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

/**
 * Check for a newer version on npm. Uses a cached result from
 * ~/.mindstudio/config.json to avoid hitting the registry on every call.
 * Returns the latest version string if an update is available, null otherwise.
 * Never throws — network/parse failures are silently ignored.
 */
async function checkForUpdate(): Promise<string | null> {
  const currentVersion = process.env.PACKAGE_VERSION;
  if (!currentVersion) return null;

  try {
    const { loadConfig, saveConfig } = await import('./config.js');
    const config = loadConfig();

    // Use cached result if fresh enough
    if (config._updateCheck) {
      const age = Date.now() - config._updateCheck.checkedAt;
      if (age < UPDATE_CHECK_INTERVAL) {
        return isNewerVersion(currentVersion, config._updateCheck.latestVersion)
          ? config._updateCheck.latestVersion
          : null;
      }
    }

    // Fetch latest version from npm
    const res = await fetch(
      'https://registry.npmjs.org/@mindstudio-ai/agent/latest',
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    const latestVersion = data.version;
    if (!latestVersion) return null;

    // Cache the result
    saveConfig({
      ...config,
      _updateCheck: { latestVersion, checkedAt: Date.now() },
    });

    return isNewerVersion(currentVersion, latestVersion) ? latestVersion : null;
  } catch {
    return null;
  }
}

function printUpdateNotice(latestVersion: string): void {
  const currentVersion = process.env.PACKAGE_VERSION ?? '?';
  process.stderr.write(
    `\n  ${ansi.cyanBright('Update available')} ${ansi.gray(currentVersion + ' \u2192')} ${ansi.cyanBold(latestVersion)}\n` +
      `  ${ansi.gray('Run')} mindstudio update ${ansi.gray('to update')}\n`,
  );
}

// ---------------------------------------------------------------------------
// Self-update
// ---------------------------------------------------------------------------

/**
 * Detect whether the current process is a standalone binary install
 * (i.e. NOT running from inside node_modules).
 */
function isStandaloneBinary(): boolean {
  const argv1 = process.argv[1] ?? '';
  return !argv1.includes('node_modules');
}

async function cmdUpdate(): Promise<void> {
  const currentVersion = process.env.PACKAGE_VERSION ?? 'unknown';
  process.stderr.write(
    `  ${ansi.gray('Current version:')} ${currentVersion}\n`,
  );
  process.stderr.write(`  ${ansi.gray('Checking for updates...')}\n`);

  // Fetch latest version (bypass cache)
  let latestVersion: string;
  try {
    const res = await fetch(
      'https://registry.npmjs.org/@mindstudio-ai/agent/latest',
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) {
      fatal('Failed to check for updates. Please try again later.');
    }
    const data = (await res.json()) as { version?: string };
    latestVersion = data.version ?? '';
    if (!latestVersion) {
      fatal('Failed to check for updates. Please try again later.');
    }
  } catch {
    fatal(
      'Failed to check for updates. Please check your internet connection.',
    );
  }

  if (!isNewerVersion(currentVersion, latestVersion!)) {
    process.stderr.write(
      `  ${ansi.greenBold('Already up to date!')} ${ansi.gray('(' + currentVersion + ')')}\n`,
    );
    return;
  }

  process.stderr.write(
    `  ${ansi.cyanBright('Updating')} ${ansi.gray(currentVersion + ' →')} ${ansi.cyanBold(latestVersion!)}\n`,
  );

  if (isStandaloneBinary()) {
    // Standalone binary — re-run the install script
    const platform = process.platform;
    try {
      if (platform === 'win32') {
        execSync(
          'powershell -Command "irm https://msagent.ai/install.ps1 | iex"',
          { stdio: 'inherit' },
        );
      } else {
        execSync('curl -fsSL https://msagent.ai/install.sh | bash', {
          stdio: 'inherit',
        });
      }
      process.stderr.write(
        `\n  ${ansi.greenBold('Updated to ' + latestVersion!)}\n`,
      );
    } catch {
      fatal('Update failed. Try running the install command manually.');
    }
  } else {
    // npm install — tell the user to use npm
    process.stderr.write(
      `\n  ${ansi.gray('Run the following command to update:')}\n\n` +
        `  npm install -g @mindstudio-ai/agent@latest\n`,
    );
  }
}

// ---------------------------------------------------------------------------
// Login flow
// ---------------------------------------------------------------------------

const LOGO = `       .=+-.     :++.
      *@@@@@+  :%@@@@%:
    .%@@@@@@#..@@@@@@@=
  .*@@@@@@@--@@@@@@@#.**.
  *@@@@@@@.-@@@@@@@@.#@@*
.#@@@@@@@-.@@@@@@@* #@@@@%.
=@@@@@@@-.@@@@@@@#.-@@@@@@+
:@@@@@@:  +@@@@@#. .@@@@@@:
  .++:     .-*-.     .++:`;

function printLogo(): void {
  const lines = LOGO.split('\n');
  for (const line of lines) {
    const colored = line.replace(/[^\s]/g, (ch) =>
      ch === '.' || ch === ':' || ch === '-' || ch === '+' || ch === '='
        ? `\x1b[36m${ch}\x1b[0m`
        : `\x1b[96;1m${ch}\x1b[0m`,
    );
    process.stderr.write(`  ${colored}\n`);
  }
}

function openBrowser(url: string): void {
  try {
    if (process.platform === 'darwin') execSync(`open "${url}"`);
    else if (process.platform === 'win32') execSync(`start "" "${url}"`);
    else execSync(`xdg-open "${url}"`);
  } catch {
    // Silently fail — URL is printed as fallback
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForKeypress(): Promise<void> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve();
      return;
    }
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve();
    });
  });
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

const DEFAULT_BASE_URL = 'https://v1.mindstudio-api.com';

const SPINNER_FRAMES = [
  '\u28FE',
  '\u28FD',
  '\u28FB',
  '\u28BF',
  '\u287F',
  '\u28DF',
  '\u28EF',
  '\u28F7',
];

async function cmdLogin(options: { baseUrl?: string }): Promise<void> {
  const baseUrl =
    options.baseUrl ??
    process.env.MINDSTUDIO_BASE_URL ??
    process.env.REMOTE_HOSTNAME ??
    DEFAULT_BASE_URL;

  // Clear the screen to avoid duplicate output from install/prepare scripts
  process.stderr.write('\x1b[2J\x1b[H');
  process.stderr.write('\n');
  printLogo();
  process.stderr.write('\n');
  const ver = process.env.PACKAGE_VERSION ?? '';
  process.stderr.write(
    `  ${ansi.bold('MindStudio Agent')} ${ver ? ' ' + ansi.gray('v' + ver) : ''}\n`,
  );
  process.stderr.write(
    `  ${ansi.gray('Connect your MindStudio account to get started.')}\n\n`,
  );
  process.stderr.write(
    `  ${ansi.cyanBright('Press any key to open the browser...')}\n\n\n\n`,
  );
  await waitForKeypress();
  // Move up 4 lines and clear from cursor down
  process.stderr.write('\x1b[4A\r\x1b[J');
  process.stderr.write(`  ${ansi.gray('Requesting authorization...')}\n`);

  const authRes = await fetch(
    `${baseUrl}/developer/v2/request-auth-url?agent=true`,
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': '@mindstudio-ai/agent',
      },
    },
  );

  if (!authRes.ok) {
    fatal(
      `Failed to request auth URL: ${authRes.status} ${authRes.statusText}`,
    );
  }

  const { url, token } = (await authRes.json()) as {
    url: string;
    token: string;
  };

  openBrowser(url);
  process.stderr.write(
    `  ${ansi.cyanBright('Opening browser to authenticate...')}\n\n` +
      `  ${ansi.gray("If the browser didn't open, visit:")}\n` +
      `  ${ansi.cyan(url)}\n\n`,
  );

  const POLL_INTERVAL = 2000;
  const MAX_ATTEMPTS = 60;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL);

    const frame = SPINNER_FRAMES[attempt % SPINNER_FRAMES.length];
    const remaining = Math.ceil(
      (MAX_ATTEMPTS * POLL_INTERVAL) / 1000 -
        ((attempt + 1) * POLL_INTERVAL) / 1000,
    );
    process.stderr.write(
      `\r  ${ansi.cyan(frame)} Waiting for browser authorization... ${ansi.gray(`(${remaining}s)`)}`,
    );

    const pollRes = await fetch(`${baseUrl}/developer/v2/poll-auth-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': '@mindstudio-ai/agent',
      },
      body: JSON.stringify({ token }),
    });

    if (!pollRes.ok) {
      process.stderr.write('\n');
      fatal(`Poll request failed: ${pollRes.status} ${pollRes.statusText}`);
    }

    const result = (await pollRes.json()) as {
      status: 'pending' | 'completed' | 'expired';
      apiKey: string | null;
      userId: string | null;
    };

    if (result.status === 'completed' && result.apiKey) {
      process.stderr.write('\r\x1b[K');
      const { saveConfig, getConfigPath } = await import('./config.js');
      const config: { apiKey: string; baseUrl?: string } = {
        apiKey: result.apiKey,
      };
      if (baseUrl !== DEFAULT_BASE_URL) {
        config.baseUrl = baseUrl;
      }
      saveConfig(config);
      process.stderr.write(
        `  ${ansi.greenBold('\u2714')} Authenticated successfully!\n` +
          `  ${ansi.gray('Credentials saved to')} ${getConfigPath()}\n\n` +
          `  ${ansi.bold('Using with Claude Code?')} Run once to enable the MCP server:\n` +
          `  ${ansi.cyan('claude mcp add mindstudio -- mindstudio mcp')}\n\n` +
          `  ${ansi.bold('Need help?')} Ask the SDK anything:\n` +
          `  ${ansi.cyan('mindstudio ask "how do I generate an image?"')}\n\n`,
      );
      return;
    }

    if (result.status === 'expired') {
      process.stderr.write('\r\x1b[K');
      fatal('Authorization expired. Please try again.');
    }
  }

  process.stderr.write('\r\x1b[K');
  fatal('Authorization timed out. Please try again.');
}

async function cmdLogout(): Promise<void> {
  const { loadConfig, clearConfig, getConfigPath } =
    await import('./config.js');
  const config = loadConfig();
  if (!config.apiKey) {
    process.stderr.write(`  ${ansi.gray('Not currently logged in.')}\n`);
    return;
  }
  clearConfig();
  process.stderr.write(
    `  ${ansi.greenBold('\u2714')} Logged out. Credentials removed from ${ansi.gray(getConfigPath())}\n`,
  );
}

async function cmdWhoami(options: {
  apiKey?: string;
  baseUrl?: string;
}): Promise<void> {
  let source: string;
  let detail: string[] = [];

  if (options.apiKey) {
    source = `${ansi.bold('--api-key flag')} ${ansi.gray('(CLI argument)')}`;
  } else if (process.env.MINDSTUDIO_API_KEY) {
    source = `${ansi.bold('MINDSTUDIO_API_KEY')} ${ansi.gray('(environment variable)')}`;
    detail.push(
      `  ${ansi.gray('Key:')}  ${maskKey(process.env.MINDSTUDIO_API_KEY)}`,
    );
  } else {
    const { loadConfig, getConfigPath } = await import('./config.js');
    const config = loadConfig();
    if (config.apiKey) {
      source = `${ansi.bold('config file')} ${ansi.gray('(mindstudio login)')}`;
      detail.push(`  ${ansi.gray('File:')} ${getConfigPath()}`);
      detail.push(`  ${ansi.gray('Key:')}  ${maskKey(config.apiKey)}`);
      if (config.baseUrl) {
        detail.push(`  ${ansi.gray('URL:')}  ${config.baseUrl}`);
      }
    } else if (process.env.CALLBACK_TOKEN) {
      source = `${ansi.bold('CALLBACK_TOKEN')} ${ansi.gray('(managed/internal mode)')}`;
    } else {
      process.stderr.write(
        `  ${ansi.gray('\u25CB')} Not authenticated. Run ${ansi.cyan('mindstudio login')} to get started.\n`,
      );
      return;
    }
  }

  process.stderr.write(`  ${ansi.gray('Auth:')} ${source!}\n`);
  for (const line of detail) process.stderr.write(line + '\n');

  // Verify the key works by calling getUserInfo
  process.stderr.write(`  ${ansi.gray('Verifying...')} `);
  try {
    const { MindStudioAgent } = await import('./client.js');
    const agent = new MindStudioAgent({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
    });
    const info = await agent.getUserInfo();
    process.stderr.write(
      `\r\x1b[K  ${ansi.greenBold('\u25CF')} ${ansi.green('Connected')}\n\n`,
    );

    // User info
    process.stderr.write(`  ${ansi.bold('User')}\n`);
    process.stderr.write(
      `  ${ansi.gray('Name:')}  ${info.displayName}\n`,
    );
    process.stderr.write(
      `  ${ansi.gray('ID:')}    ${ansi.gray(info.userId)}\n`,
    );

    // Organization info
    process.stderr.write(`\n  ${ansi.bold('Organization')}\n`);
    process.stderr.write(
      `  ${ansi.gray('Name:')}  ${info.organizationName}\n`,
    );
    process.stderr.write(
      `  ${ansi.gray('ID:')}    ${ansi.gray(info.organizationId)}\n`,
    );

    // Members table
    if (info.members && info.members.length > 0) {
      process.stderr.write(`\n  ${ansi.bold('Members')}\n`);
      const nameWidth = Math.max(
        4,
        ...info.members.map((m) => m.displayName.length),
      );
      const roleWidth = Math.max(
        4,
        ...info.members.map((m) => m.role.length),
      );
      process.stderr.write(
        `  ${ansi.gray('Name'.padEnd(nameWidth))}  ${ansi.gray('Role'.padEnd(roleWidth))}  ${ansi.gray('Type')}\n`,
      );
      process.stderr.write(
        `  ${ansi.gray('\u2500'.repeat(nameWidth))}  ${ansi.gray('\u2500'.repeat(roleWidth))}  ${ansi.gray('\u2500'.repeat(5))}\n`,
      );
      for (const member of info.members) {
        const type = member.isAgent ? ansi.cyan('agent') : 'user';
        process.stderr.write(
          `  ${member.displayName.padEnd(nameWidth)}  ${ansi.gray(member.role.padEnd(roleWidth))}  ${type}\n`,
        );
      }
    }
    process.stderr.write('\n');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `\r\x1b[K  ${ansi.dim('\u25CF')} ${ansi.dim('Not connected')} ${ansi.gray('\u2014')} ${message}\n`,
    );
  }
}

// ---------------------------------------------------------------------------
// Argv parsing
// ---------------------------------------------------------------------------

/**
 * Manually parse `--key value` pairs from a raw argv slice.
 * Every `--key` consumes the next arg as its string value.
 */
function parseStepFlags(argv: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--') && i + 1 < argv.length) {
      const key = arg.slice(2);
      result[kebabToCamel(key)] = coerce(argv[++i]);
    }
  }
  return result;
}

const GLOBAL_STRING_FLAGS = new Set([
  '--api-key',
  '--base-url',
  '--app-id',
  '--thread-id',
  '--output-key',
  '--workflow',
  '--version',
]);

/**
 * Find the method name and its step-specific args in the raw argv.
 * Handles both `exec <method> ...` and `<method> ...` forms.
 */
function findMethodSplit(argv: string[]): {
  rawMethod: string;
  stepArgv: string[];
} | null {
  // Determine if the first positional is `run` or a direct method name.
  // Walk argv skipping global flags to find the first positional.
  let startIdx = 0;
  let hasRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith('--')) {
      if (GLOBAL_STRING_FLAGS.has(arg)) i++; // skip value
      continue;
    }

    // First positional
    if (arg === 'run') {
      hasRun = true;
      startIdx = i + 1;
    } else {
      // Direct method name (no run prefix)
      startIdx = i;
    }
    break;
  }

  // Now find the method name from startIdx onward
  for (let i = startIdx; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith('--')) {
      if (GLOBAL_STRING_FLAGS.has(arg)) i++;
      continue;
    }

    // This positional is the method name (or the method itself if no run)
    if (hasRun || i === startIdx) {
      return { rawMethod: arg, stepArgv: argv.slice(i + 1) };
    }
    break;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    strict: false,
    options: {
      'api-key': { type: 'string' },
      'base-url': { type: 'string' },
      'app-id': { type: 'string' },
      'thread-id': { type: 'string' },
      'output-key': { type: 'string' },
      'no-meta': { type: 'boolean', default: false },
      'json-logs': { type: 'boolean', default: false },
      workflow: { type: 'string' },
      version: { type: 'string' },
      type: { type: 'string' },
      json: { type: 'boolean', default: false },
      summary: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  if (positionals.length === 0) {
    // If not authenticated, prompt login instead of showing help
    const hasAuth =
      values['api-key'] ||
      process.env.MINDSTUDIO_API_KEY ||
      process.env.CALLBACK_TOKEN;

    if (!hasAuth) {
      const { loadConfig } = await import('./config.js');
      const config = loadConfig();
      if (!config.apiKey) {
        await cmdLogin({
          baseUrl: values['base-url'] as string | undefined,
        });
        return;
      }
    }

    printHelp();
    process.exit(1);
  }

  const command = positionals[0];

  // Fire off update check in background (non-blocking).
  // Skip for mcp (long-running) and login (has its own flow).
  const updatePromise =
    command !== 'mcp' && command !== 'login' && command !== 'update'
      ? checkForUpdate()
      : Promise.resolve(null);

  try {
    if (command === 'version' || command === '-v') {
      process.stdout.write(
        (process.env.PACKAGE_VERSION ?? 'unknown') + '\n',
      );
      return;
    }

    if (command === 'login') {
      await cmdLogin({
        baseUrl: values['base-url'] as string | undefined,
      });
      return;
    }

    if (command === 'logout') {
      await cmdLogout();
      return;
    }

    if (command === 'whoami') {
      await cmdWhoami({
        apiKey: values['api-key'] as string | undefined,
        baseUrl: values['base-url'] as string | undefined,
      });
      return;
    }

    if (command === 'update') {
      await cmdUpdate();
      return;
    }

    if (command === 'ask') {
      let question = positionals.slice(1).join(' ');
      if (!question && !process.stdin.isTTY) {
        question = (await readStdin()).trim();
      }
      if (!question) {
        usageBlock([
          'ask — Built-in SDK assistant',
          '',
          'Returns working code with real model IDs, config options,',
          'and correct types. Knows every action, model, and connector.',
          '',
          'Usage:',
          '  mindstudio ask "your question here"',
          '  echo "your question" | mindstudio ask',
          '',
          'Examples:',
          '  mindstudio ask "generate an image with FLUX"',
          '  mindstudio ask "what models support vision?"',
          '  mindstudio ask "how do I send a Slack message with an attachment?"',
          '  mindstudio ask "what connectors could I configure?"',
          '  mindstudio ask "what are the config options for flux-max-2?"',
          '  mindstudio ask "give me code to transcribe an audio file"',
          '  mindstudio ask "what\'s the difference between generateText and userMessage?"',
        ]);
      }
      const { cmdAsk } = await import('./ask/index.js');
      await cmdAsk(question, {
        apiKey: values['api-key'] as string | undefined,
        baseUrl: values['base-url'] as string | undefined,
      });
      return;
    }

    if (command === 'list-actions') {
      await cmdList(values.json as boolean, values.summary as boolean);
      return;
    }

    if (command === 'agents') {
      await cmdAgents(values.json as boolean, {
        apiKey: values['api-key'] as string | undefined,
        baseUrl: values['base-url'] as string | undefined,
      });
      return;
    }

    if (command === 'batch') {
      // Input: JSON array as arg, or stdin
      let input: unknown;
      const firstArg = positionals[1];

      if (firstArg && firstArg.startsWith('[')) {
        try {
          input = parseJson5(firstArg);
        } catch {
          fatal(`Invalid JSON input: ${firstArg}`);
        }
      } else if (!process.stdin.isTTY) {
        const raw = (await readStdin()).trim();
        if (raw) {
          try {
            input = parseJson5(raw);
          } catch {
            fatal(`Invalid JSON on stdin: ${raw}`);
          }
        }
      }

      if (input === undefined) {
        usageBlock([
          'batch — Execute multiple actions in parallel',
          '',
          'Usage:',
          '  mindstudio batch \'[{ "stepType": "<action>", "step": { ... } }, ...]\'',
          '  cat steps.json | mindstudio batch',
          '',
          'Each entry needs "stepType" (action name) and "step" (input object).',
          'Maximum 50 steps per batch. Results come back in the same order.',
          'Individual failures don\'t affect other steps.',
          '',
          'Options:',
          '  --app-id <id>      App ID for thread context',
          '  --thread-id <id>   Thread ID for state persistence',
          '  --no-meta          Strip top-level metadata from output',
          '',
          'Examples:',
          '  mindstudio batch \'[',
          '    { "stepType": "generateImage", "step": { "prompt": "a sunset" } },',
          '    { "stepType": "textToSpeech", "step": { "text": "hello world" } }',
          '  ]\'',
          '',
          '  echo \'[{"stepType":"searchGoogle","step":{"query":"cats"}}]\' | mindstudio batch',
        ]);
      }

      await cmdBatch(input, {
        apiKey: values['api-key'] as string | undefined,
        baseUrl: values['base-url'] as string | undefined,
        appId: values['app-id'] as string | undefined,
        threadId: values['thread-id'] as string | undefined,
        noMeta: values['no-meta'] as boolean | undefined,
      });
      return;
    }

    if (command === 'run-agent') {
      const appId = positionals[1];
      if (!appId)
        usageBlock([
          'run-agent — Run a pre-built agent and wait for the result',
          '',
          'Usage:',
          '  mindstudio run-agent <appId> [json | --flags]',
          '',
          'Options:',
          '  --workflow <name>  Workflow to execute (default: app default)',
          '  --version <ver>    App version, e.g. "draft" (default: "live")',
          '  --output-key <key> Extract a single field from the result',
          '  --no-meta          Strip metadata from output',
          '',
          'Examples:',
          '  mindstudio run-agent abc123 --query "hello"',
          '  mindstudio run-agent abc123 \'{"query": "hello"}\'',
          '  mindstudio run-agent abc123 --workflow summarize --version draft',
          '',
          'Tip: run "mindstudio agents" to list available agent IDs.',
        ]);

      // Parse input from remaining args
      const runArgv = process.argv.slice(process.argv.indexOf('run-agent') + 2);
      // Filter out global flags from runArgv
      const stepArgs: string[] = [];
      for (let i = 0; i < runArgv.length; i++) {
        const arg = runArgv[i];
        if (
          GLOBAL_STRING_FLAGS.has(arg) ||
          arg === '--workflow' ||
          arg === '--version'
        ) {
          i++; // skip value
        } else if (
          arg === '--no-meta' ||
          arg === '--json' ||
          arg === '--help'
        ) {
          // skip boolean global flags
        } else if (arg === appId) {
          // skip the appId positional
        } else {
          stepArgs.push(arg);
        }
      }

      let variables: Record<string, unknown>;
      const firstArg = stepArgs[0];
      if (firstArg && firstArg.startsWith('{')) {
        try {
          variables = parseJson5(firstArg) as Record<string, unknown>;
        } catch {
          fatal(`Invalid JSON input: ${firstArg}`);
        }
      } else {
        const flagInput = parseStepFlags(stepArgs);
        if (Object.keys(flagInput).length > 0) {
          variables = flagInput;
        } else if (!process.stdin.isTTY) {
          const raw = await readStdin();
          try {
            variables = parseJson5(raw) as Record<string, unknown>;
          } catch {
            fatal(`Invalid JSON on stdin: ${raw}`);
          }
        } else {
          variables = {};
        }
      }

      await cmdRun(appId, variables, {
        apiKey: values['api-key'] as string | undefined,
        baseUrl: values['base-url'] as string | undefined,
        workflow: values.workflow as string | undefined,
        version: values.version as string | undefined,
        outputKey: values['output-key'] as string | undefined,
        noMeta: values['no-meta'] as boolean | undefined,
      });
      return;
    }

    if (command === 'upload') {
      const filePath = positionals[1];
      if (!filePath)
        usageBlock([
          'upload — Upload a file to the MindStudio CDN',
          '',
          'Usage:',
          '  mindstudio upload <filepath>',
          '',
          'Returns the permanent public URL for the uploaded file.',
          '',
          'Examples:',
          '  mindstudio upload photo.png',
          '  mindstudio upload /path/to/document.pdf',
        ]);
      await cmdUpload(filePath, {
        apiKey: values['api-key'] as string | undefined,
        baseUrl: values['base-url'] as string | undefined,
      });
      return;
    }

    if (
      command === 'list-models' ||
      command === 'list-models-by-type' ||
      command === 'list-models-summary' ||
      command === 'list-models-summary-by-type'
    ) {
      const authOpts = {
        apiKey: values['api-key'] as string | undefined,
        baseUrl: values['base-url'] as string | undefined,
      };
      // Normalize: list-models --type x, list-models --summary, or the explicit variants
      let type: string | undefined;
      let summary = false;
      if (command === 'list-models-by-type' || command === 'list-models-summary-by-type') {
        type = positionals[1];
        if (!type)
          usageBlock([
            `${command} — List AI models filtered by type`,
            '',
            'Usage:',
            `  mindstudio ${command} <type>`,
            '',
            'Types:',
            '  llm_chat, image_generation, video_generation,',
            '  video_analysis, text_to_speech, vision, transcription',
            '',
            'Examples:',
            `  mindstudio ${command} image_generation`,
            `  mindstudio ${command} llm_chat`,
          ]);
      }
      if (command === 'list-models-summary' || command === 'list-models-summary-by-type') {
        summary = true;
      }
      // Also allow --type and --summary on the base command
      if (command === 'list-models') {
        const typeFlag = values.type as string | undefined;
        if (typeFlag) type = typeFlag;
        if (values.summary) summary = true;
      }
      await cmdListModels({ ...authOpts, type, summary });
      return;
    }

    if (command === 'list-connectors') {
      await cmdListConnectors(positionals.slice(1), {
        apiKey: values['api-key'] as string | undefined,
        baseUrl: values['base-url'] as string | undefined,
      });
      return;
    }

    if (command === 'list-connections') {
      await cmdListConnections({
        apiKey: values['api-key'] as string | undefined,
        baseUrl: values['base-url'] as string | undefined,
      });
      return;
    }

    if (command === 'estimate-cost') {
      const stepMethod = positionals[1];
      if (!stepMethod)
        usageBlock([
          'estimate-cost — Estimate the cost of an action before running it',
          '',
          'Usage:',
          '  mindstudio estimate-cost <action> [json | --flags]',
          '',
          'Examples:',
          '  mindstudio estimate-cost generate-image --prompt "a sunset"',
          '  mindstudio estimate-cost generate-text \'{"message": "hello"}\'',
          '',
          'Tip: run "mindstudio list-actions" to see available actions.',
        ]);
      const allKeys = await getAllMethodKeys();
      const resolvedMethod = resolveMethodOrFail(stepMethod, allKeys);
      const { stepMetadata } = await import('./generated/metadata.js');
      const meta = stepMetadata[resolvedMethod];
      const costArgv = positionals.slice(2);
      let costInput: Record<string, unknown>;
      const firstArg = costArgv[0];
      if (firstArg && firstArg.startsWith('{')) {
        try {
          costInput = parseJson5(firstArg) as Record<string, unknown>;
        } catch {
          fatal(`Invalid JSON input: ${firstArg}`);
        }
      } else {
        costInput = parseStepFlags(costArgv);
      }
      await cmdEstimateStepCost(meta.stepType, costInput, {
        apiKey: values['api-key'] as string | undefined,
        baseUrl: values['base-url'] as string | undefined,
      });
      return;
    }

    if (command === 'change-name') {
      const name = positionals[1];
      if (!name)
        usageBlock([
          'change-name — Update your display name',
          '',
          'Usage:',
          '  mindstudio change-name <name>',
          '',
          'Examples:',
          '  mindstudio change-name "My Agent"',
        ]);
      await cmdChangeName(name, {
        apiKey: values['api-key'] as string | undefined,
        baseUrl: values['base-url'] as string | undefined,
      });
      return;
    }

    if (command === 'change-profile-picture') {
      const url = positionals[1];
      if (!url)
        usageBlock([
          'change-profile-picture — Update your profile picture',
          '',
          'Usage:',
          '  mindstudio change-profile-picture <url>',
          '',
          'Examples:',
          '  mindstudio change-profile-picture https://example.com/avatar.png',
          '',
          'Tip: use "mindstudio upload" to host an image first.',
        ]);
      await cmdChangeProfilePicture(url, {
        apiKey: values['api-key'] as string | undefined,
        baseUrl: values['base-url'] as string | undefined,
      });
      return;
    }

    if (command === 'mcp') {
      const { startMcpServer } = await import('./mcp.js');
      await startMcpServer({
        apiKey: values['api-key'] as string | undefined,
        baseUrl: values['base-url'] as string | undefined,
      });
      return;
    }

    if (command === 'info') {
      const rawMethod = positionals[1];
      if (!rawMethod)
        usageBlock([
          'info — Show action details and parameters',
          '',
          'Usage:',
          '  mindstudio info <action>',
          '',
          'Shows the description, input parameters (with types and',
          'defaults), and output fields for an action.',
          '',
          'Examples:',
          '  mindstudio info generate-image',
          '  mindstudio info search-google',
          '',
          'Tip: run "mindstudio list-actions" to see available actions.',
        ]);
      await cmdInfo(rawMethod);
      return;
    }

    // run (explicit or implicit — any unknown command is treated as a method)
    const split = findMethodSplit(process.argv.slice(2));
    if (!split)
      usageBlock([
        'Run an action directly',
        '',
        'Usage:',
        '  mindstudio <action> [json | --flags]',
        '  mindstudio run <action> [json | --flags]',
        '',
        'Input can be inline JSON, --flags, or piped via stdin.',
        '',
        'Options:',
        '  --app-id <id>      App ID for thread context',
        '  --thread-id <id>   Thread ID for state persistence',
        '  --output-key <key> Extract a single field from the result',
        '  --no-meta          Strip $-prefixed metadata from output',
        '',
        'Examples:',
        '  mindstudio generate-image --prompt "a sunset"',
        '  mindstudio search-google \'{"query": "cats"}\'',
        '  echo \'{"message":"hello"}\' | mindstudio generate-text',
        '',
        'Tip: run "mindstudio list-actions" to see available actions.',
      ]);

    const { rawMethod, stepArgv } = split;
    const allKeys = await getAllMethodKeys();
    const method = resolveMethodOrFail(rawMethod, allKeys);

    // Determine input from step args: JSON string, named flags, or stdin
    let input: Record<string, unknown>;
    const firstStepArg = stepArgv[0];

    if (firstStepArg && firstStepArg.startsWith('{')) {
      try {
        input = parseJson5(firstStepArg) as Record<string, unknown>;
      } catch {
        fatal(`Invalid JSON input: ${firstStepArg}`);
      }
    } else {
      const flagInput = parseStepFlags(stepArgv);

      if (Object.keys(flagInput).length > 0) {
        input = flagInput;
      } else if (!process.stdin.isTTY) {
        const raw = await readStdin();
        try {
          input = parseJson5(raw) as Record<string, unknown>;
        } catch {
          fatal(`Invalid JSON on stdin: ${raw}`);
        }
      } else {
        input = {};
      }
    }

    await cmdExec(method, input, {
      apiKey: values['api-key'] as string | undefined,
      baseUrl: values['base-url'] as string | undefined,
      appId: values['app-id'] as string | undefined,
      threadId: values['thread-id'] as string | undefined,
      outputKey: values['output-key'] as string | undefined,
      noMeta: values['no-meta'] as boolean | undefined,
      jsonLogs: values['json-logs'] as boolean | undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    fatal(message);
  } finally {
    const latestVersion = await updatePromise;
    if (latestVersion) printUpdateNotice(latestVersion);
  }
}

main();

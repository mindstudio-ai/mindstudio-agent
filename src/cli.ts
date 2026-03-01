import { parseArgs } from 'node:util';

const HELP = `Usage: mindstudio <command | method> [options]

Commands:
  <method> [json | --flags]   Execute a step method (shorthand for exec)
  exec <method> [json | --flags]   Execute a step method
  list [--json]               List available methods
  info <method>               Show method details (params, types, output)
  agents [--json]             List pre-built agents in your organization
  run <appId> [json | --flags]  Run a pre-built agent and wait for result
  mcp                         Start MCP server (JSON-RPC over stdio)

Options:
  --api-key <key>          API key (or set MINDSTUDIO_API_KEY env)
  --base-url <url>         API base URL
  --app-id <id>            App ID for thread context
  --thread-id <id>         Thread ID for state persistence
  --output-key <key>       Extract a single field from the result
  --no-meta                Strip $-prefixed metadata from output
  --workflow <name>        Workflow to execute (run command)
  --version <ver>          App version override, e.g. "draft" (run command)
  --json                   Output as JSON (list/agents only)
  --help                   Show this help

Examples:
  mindstudio generate-image --prompt "a sunset"
  mindstudio generate-image --prompt "a sunset" --output-key imageUrl
  mindstudio generate-text --message "hello" --no-meta
  mindstudio generate-image '{"prompt":"a sunset"}'
  echo '{"query":"test"}' | mindstudio search-google
  mindstudio info generate-image
  mindstudio list --json
  mindstudio agents
  mindstudio run <appId> --query "hello"
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

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8').trim();
}

const HELPER_NAMES = new Set([
  'listModels',
  'listModelsByType',
  'listConnectors',
  'getConnector',
]);

const BUILTIN_COMMANDS = new Set(['exec', 'list', 'info', 'mcp', 'agents', 'run']);

/**
 * Resolve a method name from user input.
 * Accepts both kebab-case and camelCase, returns the camelCase key.
 * On failure, suggests the closest match.
 */
function resolveMethodOrFail(
  name: string,
  metadataKeys: Set<string>,
): string {
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

  const suggestion =
    bestDist <= 3 ? ` Did you mean '${bestMatch}'?` : '';
  fatal(
    `Unknown method: ${name}.${suggestion} Run 'mindstudio list' to see available methods.`,
  );
}

async function getAllMethodKeys(): Promise<Set<string>> {
  const { stepMetadata } = await import('./generated/metadata.js');
  return new Set([...Object.keys(stepMetadata), ...HELPER_NAMES]);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdList(asJson: boolean): Promise<void> {
  const { stepMetadata } = await import('./generated/metadata.js');

  if (asJson) {
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

  // Helpers — show hardcoded info
  if (HELPER_NAMES.has(method)) {
    const helpers: Record<string, { desc: string; input: string; output: string }> = {
      listModels: { desc: 'List all available AI models.', input: '(none)', output: '{ models: MindStudioModel[] }' },
      listModelsByType: { desc: 'List AI models filtered by type.', input: 'modelType: string (required)', output: '{ models: MindStudioModel[] }' },
      listConnectors: { desc: 'List available connector services.', input: '(none)', output: '{ services: Array }' },
      getConnector: { desc: 'Get details for a connector service.', input: 'serviceId: string (required)', output: '{ service: object }' },
    };
    const h = helpers[method];
    process.stderr.write(`\n  ${camelToKebab(method)}\n\n`);
    process.stderr.write(`  ${h.desc}\n\n`);
    process.stderr.write(`  Input:  ${h.input}\n`);
    process.stderr.write(`  Output: ${h.output}\n\n`);
    return;
  }

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
  if (prop.enum) return (prop.enum as unknown[]).map((v) => JSON.stringify(v)).join(' | ');
  if (prop.type === 'array') return 'array';
  if (prop.type === 'object') return 'object';
  if (typeof prop.type === 'string') return prop.type === 'integer' ? 'number' : prop.type;
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
  },
): Promise<void> {
  const { MindStudioAgent } = await import('./client.js');
  await import('./generated/steps.js').then((m) =>
    m.applyStepMethods(MindStudioAgent),
  );
  await import('./generated/helpers.js').then((m) =>
    m.applyHelperMethods(MindStudioAgent),
  );

  const agent = new MindStudioAgent({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
  }) as any;

  let result: unknown;

  if (method === 'listModels') {
    result = await agent.listModels();
  } else if (method === 'listModelsByType') {
    result = await agent.listModelsByType(input.modelType as string);
  } else if (method === 'listConnectors') {
    result = await agent.listConnectors();
  } else if (method === 'getConnector') {
    result = await agent.getConnector(input.serviceId as string);
  } else {
    const { stepMetadata } = await import('./generated/metadata.js');
    const meta = stepMetadata[method];
    if (!meta) {
      fatal(
        `Unknown method: ${method}. Run 'mindstudio list' to see available methods.`,
      );
    }

    result = await agent.executeStep(meta.stepType, input, {
      appId: options.appId,
      threadId: options.threadId,
    });
  }

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
      process.stdout.write(
        `${app.name.padEnd(maxLen)}  ${app.id}  ${desc}\n`,
      );
    }
  }
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
  // Determine if the first positional is `exec` or a direct method name.
  // Walk argv skipping global flags to find the first positional.
  let startIdx = 0;
  let hasExec = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith('--')) {
      if (GLOBAL_STRING_FLAGS.has(arg)) i++; // skip value
      continue;
    }

    // First positional
    if (arg === 'exec') {
      hasExec = true;
      startIdx = i + 1;
    } else {
      // Direct method name (no exec prefix)
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

    // This positional is the method name (or the method itself if no exec)
    if (hasExec || i === startIdx) {
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
      workflow: { type: 'string' },
      version: { type: 'string' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });

  if (values.help || positionals.length === 0) {
    printHelp();
    process.exit(positionals.length === 0 ? 1 : 0);
  }

  const command = positionals[0];

  try {
    if (command === 'list') {
      await cmdList(values.json as boolean);
      return;
    }

    if (command === 'agents') {
      await cmdAgents(values.json as boolean, {
        apiKey: values['api-key'] as string | undefined,
        baseUrl: values['base-url'] as string | undefined,
      });
      return;
    }

    if (command === 'run') {
      const appId = positionals[1];
      if (!appId)
        fatal('Missing app ID. Usage: mindstudio run <appId> [json | --flags]');

      // Parse input from remaining args
      const runArgv = process.argv.slice(
        process.argv.indexOf('run') + 2,
      );
      // Filter out global flags from runArgv
      const stepArgs: string[] = [];
      for (let i = 0; i < runArgv.length; i++) {
        const arg = runArgv[i];
        if (GLOBAL_STRING_FLAGS.has(arg) || arg === '--workflow' || arg === '--version') {
          i++; // skip value
        } else if (arg === '--no-meta' || arg === '--json' || arg === '--help') {
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
        fatal('Missing method name. Usage: mindstudio info <method>');
      await cmdInfo(rawMethod);
      return;
    }

    // exec (explicit or implicit — any unknown command is treated as a method)
    const split = findMethodSplit(process.argv.slice(2));
    if (!split)
      fatal(
        'Missing method name. Usage: mindstudio <method> [json | --flags]',
      );

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
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    fatal(message);
  }
}

main();

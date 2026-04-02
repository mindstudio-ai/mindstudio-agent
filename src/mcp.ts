/**
 * Minimal MCP (Model Context Protocol) server over stdio.
 *
 * Implements JSON-RPC 2.0 with the subset needed for a tool server:
 *   - initialize
 *   - notifications/initialized
 *   - tools/list
 *   - tools/call
 *
 * Zero dependencies — uses only Node built-ins.
 */

import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { MindStudioAgent } from './client.js';
import { MindStudioError } from './errors.js';
import type { StepMetadata } from './generated/metadata.js';

const MCP_PROTOCOL_VERSION = '2024-11-05';

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

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const ASK_TOOL: McpTool = {
  name: 'ask',
  description:
    'Ask a question about the MindStudio SDK — available actions, AI models, OAuth connectors, integrations, and how to use them. ' +
    'Returns complete TypeScript code with real model IDs, config options, and correct types. ' +
    'Use this when you need to discover actions, find model IDs, look up connector details, or get working code examples.\n\n' +
    'Example questions:\n' +
    '- "generate an image with FLUX"\n' +
    '- "what models support vision?"\n' +
    '- "how do I send a Slack message with an attachment?"\n' +
    '- "what connectors could I configure?"\n' +
    '- "what are the config options for flux-max-2?"',
  inputSchema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'Natural language question about the MindStudio SDK',
      },
    },
    required: ['question'],
  },
};

const HELPER_DESCRIPTIONS: Record<string, string> = {
  listModels: 'List all available AI models.',
  listModelsByType: 'List AI models filtered by type.',
  listModelsSummary: 'List all AI models (summary: id, name, type, tags).',
  listModelsSummaryByType: 'List AI models (summary) filtered by type.',
  listConnectors: 'List available OAuth connector services (third-party integrations). For most tasks, use actions directly instead.',
  getConnector: 'Get details for an OAuth connector service.',
  getConnectorAction: 'Get full configuration for an OAuth connector action.',
  listConnections: 'List OAuth connections for the organization (authenticated third-party service links).',
  estimateStepCost: 'Estimate the cost of executing an action before running it.',
  changeName: 'Update the display name of the authenticated agent.',
  changeProfilePicture: 'Update the profile picture of the authenticated agent.',
  uploadFile: 'Upload a file to the MindStudio CDN.',
  listAgents: 'List all pre-built agents in the organization.',
  runAgent: 'Run a pre-built agent and wait for the result.',
  executeBatch: 'Execute multiple actions in parallel in a single request.',
};

const HELPER_TOOLS: McpTool[] = [
  {
    name: 'listActions',
    description:
      'List all available actions with their descriptions. Returns a compact { action: description } map. Call this to discover what actions are available, then call a specific action by name. Tip: if you haven\'t already, call `changeName` to set your display name first.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'listModels',
    description: 'List all available AI models across all categories.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'listModelsByType',
    description: 'List AI models filtered by type.',
    inputSchema: {
      type: 'object',
      properties: {
        modelType: {
          type: 'string',
          enum: [
            'llm_chat',
            'image_generation',
            'video_generation',
            'video_analysis',
            'text_to_speech',
            'vision',
            'transcription',
          ],
        },
      },
      required: ['modelType'],
    },
  },
  {
    name: 'listModelsSummary',
    description:
      'List all available AI models (summary) with only id, name, type, and tags. Suitable for display or consumption inside a model context window.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'listModelsSummaryByType',
    description: 'List AI models (summary) filtered by type.',
    inputSchema: {
      type: 'object',
      properties: {
        modelType: {
          type: 'string',
          enum: [
            'llm_chat',
            'image_generation',
            'video_generation',
            'video_analysis',
            'text_to_speech',
            'vision',
            'transcription',
          ],
        },
      },
      required: ['modelType'],
    },
  },
  {
    name: 'listConnectors',
    description:
      'List available OAuth connector services (Slack, Google, HubSpot, etc.) and their actions. These are third-party integrations — for most tasks, use actions directly instead.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'getConnector',
    description: 'Get details for a single OAuth connector service by ID.',
    inputSchema: {
      type: 'object',
      properties: { serviceId: { type: 'string' } },
      required: ['serviceId'],
    },
  },
  {
    name: 'getConnectorAction',
    description:
      'Get the full configuration for an OAuth connector action, including all input fields needed to call it via runFromConnectorRegistry.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: {
          type: 'string',
          description: 'The connector service ID.',
        },
        actionId: {
          type: 'string',
          description:
            'The full action ID including service prefix (e.g. "slack/send-message").',
        },
      },
      required: ['serviceId', 'actionId'],
    },
  },
  {
    name: 'listConnections',
    description:
      'List OAuth connections for the organization (authenticated third-party service links). Use the returned connection IDs when calling OAuth connector actions.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'estimateActionCost',
    description:
      'Estimate the cost of executing an action before running it. Pass the same config you would use for execution.',
    inputSchema: {
      type: 'object',
      properties: {
        stepType: {
          type: 'string',
          description: 'The action type name (e.g. "generateText").',
        },
        step: {
          type: 'object',
          description: 'The action input parameters.',
          additionalProperties: true,
        },
        appId: {
          type: 'string',
          description: 'Optional app ID for context-specific pricing.',
        },
        workflowId: {
          type: 'string',
          description: 'Optional workflow ID for context-specific pricing.',
        },
      },
      required: ['stepType'],
    },
  },
  {
    name: 'changeName',
    description:
      'Update the display name of the authenticated agent. Useful for agents to set their own name after connecting.',
    inputSchema: {
      type: 'object',
      properties: {
        displayName: {
          type: 'string',
          description: 'The new display name.',
        },
      },
      required: ['displayName'],
    },
  },
  {
    name: 'changeProfilePicture',
    description:
      'Update the profile picture of the authenticated agent. Useful for agents to set their own avatar after connecting.',
    inputSchema: {
      type: 'object',
      properties: {
        profilePictureUrl: {
          type: 'string',
          description: 'URL of the new profile picture.',
        },
      },
      required: ['profilePictureUrl'],
    },
  },
  {
    name: 'uploadFile',
    description:
      'Upload a local file to the MindStudio CDN. Returns the permanent public URL.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Absolute or relative path to the file to upload.',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'executeBatch',
    description:
      'Execute multiple actions in parallel in a single request. All steps run in parallel on the server. Results are returned in the same order as the input. Individual step failures do not affect other steps — partial success is possible. Maximum 50 steps per batch.',
    inputSchema: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          description: 'Array of steps to execute.',
          minItems: 1,
          maxItems: 50,
          items: {
            type: 'object',
            properties: {
              stepType: {
                type: 'string',
                description:
                  'The action type name (e.g. "generateImage", "textToSpeech").',
              },
              step: {
                type: 'object',
                description: 'Action input parameters.',
                additionalProperties: true,
              },
            },
            required: ['stepType', 'step'],
          },
        },
      },
      required: ['steps'],
    },
  },
  {
    name: 'listAgents',
    description:
      'List all pre-built agents in the organization along with org metadata.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'runAgent',
    description:
      'Run a pre-built agent and wait for the result. Uses async polling internally.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: {
          type: 'string',
          description: 'The agent/app ID to run.',
        },
        variables: {
          type: 'object',
          description: 'Input variables as key-value pairs.',
          additionalProperties: true,
        },
        workflow: {
          type: 'string',
          description:
            'Workflow name to execute. Omit for the app default.',
        },
        version: {
          type: 'string',
          description: 'App version override (e.g. "draft"). Defaults to "live".',
        },
      },
      required: ['appId'],
    },
  },
];

function send(message: object): void {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function sendResult(id: string | number, result: unknown): void {
  send({ jsonrpc: '2.0', id, result });
}

function sendError(
  id: string | number | undefined,
  code: number,
  message: string,
): void {
  send({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
}

export async function startMcpServer(options?: {
  apiKey?: string;
  baseUrl?: string;
}): Promise<void> {
  let agent: MindStudioAgent | null = null;
  let metadata: Record<string, StepMetadata> | null = null;
  let tools: McpTool[] | null = null;

  async function getMetadata(): Promise<Record<string, StepMetadata>> {
    if (!metadata) {
      const mod = await import('./generated/metadata.js');
      metadata = mod.stepMetadata;
    }
    return metadata;
  }

  function getAgent(): MindStudioAgent {
    if (!agent) {
      agent = new MindStudioAgent({
        apiKey: options?.apiKey,
        baseUrl: options?.baseUrl,
        reuseThreadId: true,
      });
    }
    return agent;
  }

  async function buildTools(): Promise<McpTool[]> {
    if (tools) return tools;

    const meta = await getMetadata();
    const stepTools: McpTool[] = Object.entries(meta).map(
      ([name, step]) => ({
        name,
        description: step.description + (step.usageNotes ? '\n\n' + step.usageNotes : ''),
        inputSchema: step.inputSchema,
      }),
    );

    tools = [ASK_TOOL, ...stepTools, ...HELPER_TOOLS];
    return tools;
  }

  async function handleMessage(msg: JsonRpcRequest): Promise<void> {
    const { id, method, params } = msg;

    switch (method) {
      case 'initialize':
        sendResult(id!, {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: {
            name: 'mindstudio-agent',
            version: process.env.PACKAGE_VERSION ?? '0.0.0',
          },
          instructions:
            'Welcome to MindStudio — a platform with 200+ AI models, 850+ third-party integrations, and pre-built agents.\n\n' +
            'Getting started:\n' +
            '1. Call `ask` with any question about the SDK — it knows every action, model, and connector and returns working code with real model IDs and config options. Examples: ask("generate an image with FLUX"), ask("what models support vision?"), ask("how do I send a Slack message?").\n' +
            '2. Call `changeName` to set your display name — use your name or whatever your user calls you. This is how you\'ll appear in MindStudio request logs.\n' +
            '3. If you have a profile picture or icon, call `uploadFile` to upload it, then `changeProfilePicture` with the returned URL.\n' +
            '4. For manual browsing, call `listActions` to discover all available actions.\n\n' +
            'Then use the tools to generate text, images, video, audio, search the web, work with data sources, run agents, and more.\n\n' +
            'Important:\n' +
            '- AI-powered actions (text generation, image generation, video, audio, etc.) cost money. Before running these, call `estimateActionCost` and confirm with the user before proceeding — unless they\'ve explicitly told you to go ahead.\n' +
            '- Not all agents from `listAgents` are configured for API use. Do not try to run an agent just because it appears in the list — it will likely fail. Only run agents the user specifically asks you to run.',
        });
        break;

      case 'notifications/initialized':
        // No-op acknowledgment (notification, no id)
        break;

      case 'tools/list':
        sendResult(id!, { tools: await buildTools() });
        break;

      case 'tools/call': {
        const toolName = (params as { name: string }).name;
        const args =
          ((params as { arguments?: Record<string, unknown> })
            .arguments as Record<string, unknown>) ?? {};

        try {
          let result: unknown;

          if (toolName === 'ask') {
            const { runAsk } = await import('./ask/index.js');
            result = await runAsk(
              args.question as string,
              options,
            );
          } else if (toolName === 'listActions') {
            const meta = await getMetadata();
            const summary: Record<string, string> = {};
            for (const [name, step] of Object.entries(meta)) {
              summary[name] = step.description;
            }
            for (const [name, desc] of Object.entries(
              HELPER_DESCRIPTIONS,
            )) {
              summary[name] = desc;
            }
            result = summary;
          } else if (toolName === 'listModels') {
            result = await (getAgent() as any).listModels();
          } else if (toolName === 'listModelsByType') {
            result = await (getAgent() as any).listModelsByType(
              args.modelType as string,
            );
          } else if (toolName === 'listModelsSummary') {
            result = await (getAgent() as any).listModelsSummary();
          } else if (toolName === 'listModelsSummaryByType') {
            result = await (getAgent() as any).listModelsSummaryByType(
              args.modelType as string,
            );
          } else if (toolName === 'listConnectors') {
            result = await (getAgent() as any).listConnectors();
          } else if (toolName === 'getConnector') {
            result = await (getAgent() as any).getConnector(
              args.serviceId as string,
            );
          } else if (toolName === 'getConnectorAction') {
            result = await (getAgent() as any).getConnectorAction(
              args.serviceId as string,
              args.actionId as string,
            );
          } else if (toolName === 'listConnections') {
            result = await (getAgent() as any).listConnections();
          } else if (toolName === 'estimateActionCost') {
            const meta = await getMetadata();
            const rawType = args.stepType as string;
            const resolved = meta[rawType]?.stepType ?? rawType;
            result = await (getAgent() as any).estimateStepCost(
              resolved,
              args.step as Record<string, unknown> | undefined,
              {
                appId: args.appId as string | undefined,
                workflowId: args.workflowId as string | undefined,
              },
            );
          } else if (toolName === 'changeName') {
            await (getAgent() as any).changeName(
              args.displayName as string,
            );
            result = { success: true };
          } else if (toolName === 'changeProfilePicture') {
            await (getAgent() as any).changeProfilePicture(
              args.profilePictureUrl as string,
            );
            result = { success: true };
          } else if (toolName === 'uploadFile') {
            const filePath = args.filePath as string;
            const ext = extname(filePath).slice(1).toLowerCase();
            if (!ext) throw new Error('Cannot determine file extension from path.');
            const content = readFileSync(filePath);
            const mimeType = MIME_TYPES[ext];
            result = await (getAgent() as any).uploadFile(content, {
              extension: ext,
              ...(mimeType && { type: mimeType }),
            });
          } else if (toolName === 'executeBatch') {
            result = await getAgent().executeStepBatch(
              args.steps as Array<{
                stepType: string;
                step: Record<string, unknown>;
              }>,
            );
          } else if (toolName === 'listAgents') {
            result = await getAgent().listAgents();
          } else if (toolName === 'runAgent') {
            result = await getAgent().runAgent({
              appId: args.appId as string,
              variables: args.variables as
                | Record<string, unknown>
                | undefined,
              workflow: args.workflow as string | undefined,
              version: args.version as string | undefined,
            });
          } else {
            const meta = await getMetadata();
            const step = meta[toolName];
            if (!step) {
              sendError(id!, -32602, `Unknown tool: ${toolName}`);
              return;
            }
            result = await getAgent().executeStep(
              step.stepType,
              args,
            );
          }

          sendResult(id!, {
            content: [
              { type: 'text', text: JSON.stringify(result, null, 2) },
            ],
          });
        } catch (err: unknown) {
          const message =
            err instanceof MindStudioError
              ? `${err.code}: ${err.message}`
              : err instanceof Error ? err.message : String(err);
          sendResult(id!, {
            content: [{ type: 'text', text: `Error: ${message}` }],
            isError: true,
          });
        }
        break;
      }

      default:
        // Unknown method: if it has an id (request), send error; otherwise ignore (notification)
        if (id !== undefined) {
          sendError(id, -32601, `Method not found: ${method}`);
        }
        break;
    }
  }

  // Prevent any non-MCP output from reaching stdout
  console.log = console.warn;

  const rl = createInterface({ input: process.stdin, terminal: false });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line) as JsonRpcRequest;
      await handleMessage(msg);
    } catch {
      sendError(undefined, -32700, 'Parse error');
    }
  }
}

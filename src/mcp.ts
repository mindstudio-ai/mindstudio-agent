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
import { MindStudioAgent } from './client.js';
import type { StepMetadata } from './generated/metadata.js';

const MCP_PROTOCOL_VERSION = '2024-11-05';

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

const HELPER_TOOLS: McpTool[] = [
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
      'List available connector services (Slack, Google, HubSpot, etc.) and their actions.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'getConnector',
    description: 'Get details for a single connector service by ID.',
    inputSchema: {
      type: 'object',
      properties: { serviceId: { type: 'string' } },
      required: ['serviceId'],
    },
  },
  {
    name: 'getConnectorAction',
    description:
      'Get the full configuration for a connector action, including all input fields needed to call it via runFromConnectorRegistry.',
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
      'List OAuth connections for the organization. Use the returned connection IDs when calling connector actions.',
    inputSchema: { type: 'object', properties: {} },
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

    tools = [...stepTools, ...HELPER_TOOLS];
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

          if (toolName === 'listModels') {
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
            err instanceof Error ? err.message : String(err);
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

/**
 * Tool definitions and executor for the `mindstudio ask` agent.
 *
 * Four tools for drill-down when the system prompt context isn't enough:
 * - getActionDetails: full JSON schema for a specific action (local, no API)
 * - listModels: model catalog, optionally filtered by type (API call)
 * - getModelDetails: full config for a specific model (API call)
 * - getConnectorDetails: drill into a connector service's actions (API call)
 */

import type { MindStudioAgent } from '../client.js';
import type { ToolDefinition } from './types.js';

export const ASK_TOOLS: ToolDefinition[] = [
  {
    name: 'getActionDetails',
    description:
      'Get the full definition for a specific SDK action — JSON schema for inputs and outputs, usage notes, and description. Use this when you need exact parameter types, enum values, or optional fields to build correct code.',
    inputSchema: {
      type: 'object',
      properties: {
        actionName: {
          type: 'string',
          description:
            'The action name in camelCase or kebab-case (e.g. "generateImage" or "generate-image")',
        },
      },
      required: ['actionName'],
    },
  },
  {
    name: 'listModels',
    description:
      'List available AI models, optionally filtered by type. By default returns a compact summary (id, name, type, tags). With details=true, returns full model objects including the `inputs` array that defines config options (width, height, seed, etc.) — use this when you need to check model capabilities or build code with config options. You can filter the full list yourself instead of calling this multiple times.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description:
            'Filter by model type: "llm_chat", "image_generation", "video_generation", "video_analysis", "text_to_speech", "vision", "transcription"',
        },
        details: {
          type: 'boolean',
          description:
            'If true, returns full model objects with inputs/config arrays. Use this when you need to check supported inputs, config options, or model capabilities.',
        },
      },
    },
  },
  {
    name: 'getConnectorDetails',
    description:
      'Drill into an OAuth connector service. With just serviceId, returns the list of available actions. With serviceId + actionId, returns the full action config including all input fields needed to call it via runFromConnectorRegistry.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: {
          type: 'string',
          description:
            'The connector service ID (e.g. "hubspot", "slack", "google-drive")',
        },
        actionId: {
          type: 'string',
          description:
            'Optional action ID within the service. If provided, returns full action config with input fields.',
        },
      },
      required: ['serviceId'],
    },
  },
];

function kebabToCamel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

async function toolGetActionDetails(
  input: Record<string, any>,
): Promise<string> {
  const { stepMetadata } = await import('../generated/metadata.js');

  const raw = input.actionName as string;
  const camel = raw.includes('-') ? kebabToCamel(raw) : raw;

  const meta = stepMetadata[camel] ?? stepMetadata[raw];
  if (!meta) {
    // Try fuzzy match
    const keys = Object.keys(stepMetadata);
    const lower = camel.toLowerCase();
    const match = keys.find((k) => k.toLowerCase() === lower);
    if (match) {
      return JSON.stringify(stepMetadata[match], null, 2);
    }
    return JSON.stringify({
      error: `Unknown action: ${raw}. Available actions: ${keys.slice(0, 20).join(', ')}...`,
    });
  }

  return JSON.stringify(meta, null, 2);
}

async function toolListModels(
  agent: MindStudioAgent,
  input: Record<string, any>,
): Promise<string> {
  const type = input.type as string | undefined;
  const details = input.details as boolean | undefined;

  if (details) {
    const result = type
      ? await agent.listModelsByType(type as any)
      : await agent.listModels();
    return JSON.stringify(result, null, 2);
  }

  const result = type
    ? await agent.listModelsSummaryByType(type as any)
    : await agent.listModelsSummary();
  return JSON.stringify(result, null, 2);
}

async function toolGetConnectorDetails(
  agent: MindStudioAgent,
  input: Record<string, any>,
): Promise<string> {
  const serviceId = input.serviceId as string;
  const actionId = input.actionId as string | undefined;

  if (actionId) {
    const result = await agent.getConnectorAction(serviceId, actionId);
    return JSON.stringify(result, null, 2);
  }

  const result = await agent.getConnector(serviceId);
  return JSON.stringify(result, null, 2);
}

export async function executeTool(
  agent: MindStudioAgent,
  name: string,
  input: Record<string, any>,
): Promise<{ result: string; isError: boolean }> {
  try {
    let result: string;
    switch (name) {
      case 'getActionDetails':
        result = await toolGetActionDetails(input);
        break;
      case 'listModels':
        result = await toolListModels(agent, input);
        break;
      case 'getConnectorDetails':
        result = await toolGetConnectorDetails(agent, input);
        break;
      default:
        result = JSON.stringify({ error: `Unknown tool: ${name}` });
    }
    return { result, isError: result.includes('"error"') };
  } catch (err: any) {
    return { result: `Error: ${err.message}`, isError: true };
  }
}

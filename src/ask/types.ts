/**
 * Types for the `mindstudio ask` agent loop.
 *
 * Matches the normalized message format used by the platform's
 * `/_internal/v2/agent/chat` endpoint (vendor-agnostic).
 */

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  isToolError?: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type StreamEvent =
  | { type: 'text'; text: string }
  | {
      type: 'tool_use';
      id: string;
      name: string;
      input: Record<string, any>;
    }
  | { type: 'done'; stopReason: string }
  | { type: 'error'; error: string };

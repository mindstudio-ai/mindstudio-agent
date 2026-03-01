import { MindStudioAgent as _MindStudioAgent } from './client.js';
import type { StepMethods } from './generated/steps.js';
import type { HelperMethods } from './generated/helpers.js';
import type { AgentOptions } from './types.js';

/** MindStudioAgent with all generated step and helper methods. */
export type MindStudioAgent = _MindStudioAgent & StepMethods & HelperMethods;

/** {@inheritDoc MindStudioAgent} */
export const MindStudioAgent = _MindStudioAgent as unknown as {
  new (options?: AgentOptions): MindStudioAgent;
};

export { MindStudioError } from './errors.js';
export type {
  AgentOptions,
  StepExecutionOptions,
  StepExecutionResult,
  StepExecutionMeta,
} from './types.js';

// Re-export all generated types
export * from './generated/types.js';
export type { StepMethods } from './generated/steps.js';
export type { HelperMethods, MindStudioModel, ModelType } from './generated/helpers.js';
export {
  monacoSnippets,
  blockTypeAliases,
  type MonacoSnippet,
  type MonacoSnippetField,
  type MonacoSnippetFieldType,
} from './generated/snippets.js';

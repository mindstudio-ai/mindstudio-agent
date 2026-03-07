import { MindStudioAgent as _MindStudioAgent } from './client.js';
import type { StepMethods } from './generated/steps.js';
import type { AgentOptions } from './types.js';

/** MindStudioAgent with all generated step methods. */
export type MindStudioAgent = _MindStudioAgent & StepMethods;

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
  AgentInfo,
  ListAgentsResult,
  UserInfoResult,
  RunAgentOptions,
  RunAgentResult,
  MindStudioModel,
  MindStudioModelSummary,
  ModelType,
  ConnectorService,
  ConnectorActionDetail,
  Connection,
  StepCostEstimateEntry,
  UploadFileResult,
  BatchStepInput,
  BatchStepResult,
  ExecuteStepBatchOptions,
  ExecuteStepBatchResult,
} from './types.js';

// Re-export all generated types
export * from './generated/types.js';
export type { StepMethods } from './generated/steps.js';
export {
  monacoSnippets,
  blockTypeAliases,
  type MonacoSnippet,
  type MonacoSnippetField,
  type MonacoSnippetFieldType,
} from './generated/snippets.js';
export {
  stepMetadata,
  type StepMetadata,
} from './generated/metadata.js';

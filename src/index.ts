export { MindStudioAgent } from './client.js';
export { MindStudioError } from './errors.js';
export type {
  AgentOptions,
  StepExecutionOptions,
  StepExecutionResult,
} from './types.js';

// Generated types and methods — these augment MindStudioAgent with typed step methods
export * from './generated/types.js';
export * from './generated/steps.js';
export * from './generated/helpers.js';

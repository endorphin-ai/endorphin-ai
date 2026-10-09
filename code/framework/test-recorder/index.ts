/**
 * Test Recorder Module
 * Provides interactive and session recording capabilities
 */

export { runInteractiveRecorder } from './interactive-recorder.js';
export { TestRecorder } from './session-recorder.js';
export type { RecorderSessionState } from './session-recorder.js';
export { RecorderAPI } from './recorder-api.js';
export { RecorderCLI } from './recorder-cli.js';
export type {
  PageState,
  ErrorDetails,
  CreateSessionParams,
  CreateSessionResult,
  AddStepParams,
  AddStepResult,
  GenerateTestParams,
  GenerateTestResult,
  SessionStatusInfo,
  ListSessionsResult,
} from './recorder-api.js';


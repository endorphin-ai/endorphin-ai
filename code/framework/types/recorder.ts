/**
 * Test recorder types
 */

import type { ToolParams } from './agent.js';

export interface RecorderSession {
  id: string;
  testId: string;
  commands: RecorderCommand[];
  startTime: Date;
  endTime?: Date;
}

export interface RecorderCommand {
  type: 'click' | 'fill' | 'navigate' | 'screenshot' | 'wait';
  params: ToolParams;
  timestamp: Date;
  description: string;
}

// Re-export RecorderAPI types
export type {
  CreateSessionParams,
  CreateSessionResult,
  AddStepParams,
  AddStepResult,
  GenerateTestParams,
  GenerateTestResult,
  SessionStatusInfo,
  ListSessionsResult,
} from '../test-recorder/recorder-api.js';

// Re-export RecorderSessionState
export type { RecorderSessionState } from '../test-recorder/session-recorder.js';

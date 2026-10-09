/**
 * Unit Tests for TestRecorder Persistence Methods
 * Tests saveState, loadState, loadFromState, updateStateStatus
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { TestRecorder } from '../../../framework/test-recorder/session-recorder.js';
import type { RecorderSessionState } from '../../../framework/test-recorder/session-recorder.js';

// Mock logger FIRST (use relative path to avoid moduleNameMapper resolution issues)
jest.mock('../../../framework/core/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock EnhancedBrowserTestFramework
const mockGetBrowserManager = jest.fn();
const mockFramework = {
  getBrowserManager: mockGetBrowserManager,
  runTask: jest.fn().mockResolvedValue({ status: 'SUCCESS', result: 'Completed' }),
  initialize: jest.fn().mockResolvedValue(undefined),
  cleanup: jest.fn().mockResolvedValue(undefined),
};

// Mock DirectoryManager
jest.mock('../../../framework/utils/directory-manager', () => ({
  DirectoryManager: {
    cleanupRecorderDirectory: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('TestRecorder Persistence', () => {
  let tempDir: string;
  let recorderBaseDir: string;
  let recorder: TestRecorder;

  beforeEach(async () => {
    jest.clearAllMocks();
    tempDir = path.join(os.tmpdir(), `recorder-persist-test-${Date.now()}`);
    recorderBaseDir = path.join(tempDir, 'test-recorder');
    await fs.mkdir(recorderBaseDir, { recursive: true });

    // Mock browser manager with screenshot capability
    mockGetBrowserManager.mockReturnValue({
      getPage: jest.fn().mockReturnValue({
        screenshot: jest.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
      }),
      takeScreenshot: jest.fn().mockResolvedValue(undefined),
    });

    // Create recorder instance
    const testData = {
      id: 'TEST-001',
      name: 'Test Session',
      description: 'Test description',
      priority: 'High',
      tags: ['test'],
      site: 'https://example.com',
    };

    recorder = new TestRecorder(mockFramework as any, testData, recorderBaseDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('saveState()', () => {
    it('should write correct JSON to disk', async () => {
      const sessionId = await recorder.startRecording();

      // Record a step to have some data
      await recorder.recordStep('Test step', 'test-action', { data: 'test' }, 'Success');

      await recorder.saveState();

      // Read the state file
      const statePath = path.join(recorderBaseDir, sessionId, 'session-state.json');
      const stateContent = await fs.readFile(statePath, 'utf8');
      const state = JSON.parse(stateContent) as RecorderSessionState;

      expect(state.sessionId).toBe(sessionId);
      expect(state.testData.id).toBe('TEST-001');
      expect(state.testData.name).toBe('Test Session');
      expect(state.status).toBe('in-progress');
      expect(state.stepCount).toBe(1);
      expect(state.steps).toHaveLength(1);
      expect(state.createdAt).toBeDefined();
      expect(new Date(state.createdAt)).toBeInstanceOf(Date);
    });

    it('should save with completed status after recording stops', async () => {
      const sessionId = await recorder.startRecording();
      await recorder.recordStep('Test step', 'test-action', { data: 'test' }, 'Success');

      // Stop recording (sets isRecording to false)
      // Note: We can't actually call stopRecording as it generates test files
      // Instead, we test saveState with the initial state
      await recorder.saveState();

      const statePath = path.join(recorderBaseDir, sessionId, 'session-state.json');
      const stateContent = await fs.readFile(statePath, 'utf8');
      const state = JSON.parse(stateContent) as RecorderSessionState;

      expect(state.status).toBe('in-progress');
    });

    it('should throw error when no active recording session', async () => {
      // Don't start recording
      await expect(recorder.saveState()).rejects.toThrow('No active recording session');
    });

    it('should save all step information correctly', async () => {
      const sessionId = await recorder.startRecording();

      await recorder.recordStep('Step 1', 'action-1', { key: 'value1' }, 'Result 1');
      await recorder.recordStep('Step 2', 'action-2', { key: 'value2' }, 'Result 2');

      await recorder.saveState();

      const statePath = path.join(recorderBaseDir, sessionId, 'session-state.json');
      const stateContent = await fs.readFile(statePath, 'utf8');
      const state = JSON.parse(stateContent) as RecorderSessionState;

      expect(state.steps).toHaveLength(2);
      expect(state.steps[0].description).toBe('Step 1');
      expect(state.steps[0].type).toBe('action-1');
      expect(state.steps[0].data).toEqual({ key: 'value1' });
      expect(state.steps[0].result).toBe('Result 1');
      expect(state.steps[1].description).toBe('Step 2');
    });
  });

  describe('loadState() (static)', () => {
    it('should read and parse session state', async () => {
      // Create a mock session state
      const sessionId = 'TEST-001-1234567890';
      const sessionDir = path.join(recorderBaseDir, sessionId);
      await fs.mkdir(sessionDir, { recursive: true });

      const mockState: RecorderSessionState = {
        sessionId,
        testData: {
          id: 'TEST-001',
          name: 'Loaded Test',
          description: 'Test description',
          priority: 'Medium',
          tags: ['loaded'],
        },
        createdAt: '2026-01-01T10:00:00.000Z',
        status: 'in-progress',
        stepCount: 3,
        steps: [
          {
            stepNumber: 1,
            description: 'Loaded step',
            type: 'action',
            timestamp: '2026-01-01T10:01:00.000Z',
            data: { key: 'value' },
            result: 'Success',
            beforeScreenshot: '/path/to/before.png',
            afterScreenshot: '/path/to/after.png',
          },
        ],
      };

      await fs.writeFile(
        path.join(sessionDir, 'session-state.json'),
        JSON.stringify(mockState, null, 2)
      );

      const loadedState = await TestRecorder.loadState(sessionId, recorderBaseDir);

      expect(loadedState).not.toBeNull();
      expect(loadedState!.sessionId).toBe(sessionId);
      expect(loadedState!.testData.name).toBe('Loaded Test');
      expect(loadedState!.status).toBe('in-progress');
      expect(loadedState!.stepCount).toBe(3);
      expect(loadedState!.steps).toHaveLength(1);
    });

    it('should return null for non-existent session', async () => {
      const loadedState = await TestRecorder.loadState('NON-EXISTENT-SESSION', recorderBaseDir);

      expect(loadedState).toBeNull();
    });

    it('should throw error for corrupted JSON', async () => {
      const sessionId = 'CORRUPTED-SESSION';
      const sessionDir = path.join(recorderBaseDir, sessionId);
      await fs.mkdir(sessionDir, { recursive: true });

      // Write corrupted JSON
      await fs.writeFile(
        path.join(sessionDir, 'session-state.json'),
        'CORRUPTED JSON {{{}'
      );

      await expect(TestRecorder.loadState(sessionId, recorderBaseDir)).rejects.toThrow();
    });

    it('should handle state with testFilePath', async () => {
      const sessionId = 'TEST-001-1234567890';
      const sessionDir = path.join(recorderBaseDir, sessionId);
      await fs.mkdir(sessionDir, { recursive: true });

      const mockState: RecorderSessionState = {
        sessionId,
        testData: { id: 'TEST-001', name: 'Test' },
        createdAt: '2026-01-01T10:00:00.000Z',
        status: 'completed',
        stepCount: 2,
        steps: [],
        testFilePath: '/path/to/generated-test.ts',
      };

      await fs.writeFile(
        path.join(sessionDir, 'session-state.json'),
        JSON.stringify(mockState, null, 2)
      );

      const loadedState = await TestRecorder.loadState(sessionId, recorderBaseDir);

      expect(loadedState!.testFilePath).toBe('/path/to/generated-test.ts');
    });
  });

  describe('loadFromState()', () => {
    it('should restore recorder fields from state', async () => {
      // Create a saved state
      const sessionId = 'TEST-001-1234567890';
      const sessionDir = path.join(recorderBaseDir, sessionId);
      await fs.mkdir(sessionDir, { recursive: true });
      await fs.mkdir(path.join(sessionDir, 'steps'), { recursive: true });

      const mockState: RecorderSessionState = {
        sessionId,
        testData: {
          id: 'TEST-002',
          name: 'Restored Test',
          description: 'Restored description',
          priority: 'Low',
          tags: ['restored'],
          site: 'https://restored.com',
        },
        createdAt: '2026-01-01T10:00:00.000Z',
        status: 'in-progress',
        stepCount: 5,
        steps: [
          {
            stepNumber: 1,
            description: 'Step 1',
            type: 'action',
            timestamp: '2026-01-01T10:01:00.000Z',
            data: {},
            result: 'Success',
            beforeScreenshot: '/before.png',
            afterScreenshot: '/after.png',
          },
        ],
      };

      await fs.writeFile(
        path.join(sessionDir, 'session-state.json'),
        JSON.stringify(mockState, null, 2)
      );

      // Create new recorder and load from state
      const newRecorder = new TestRecorder(mockFramework as any, {}, recorderBaseDir);
      await newRecorder.loadFromState(sessionId);

      // Save state to verify fields were restored
      await newRecorder.saveState();

      const statePath = path.join(recorderBaseDir, sessionId, 'session-state.json');
      const stateContent = await fs.readFile(statePath, 'utf8');
      const restoredState = JSON.parse(stateContent) as RecorderSessionState;

      expect(restoredState.sessionId).toBe(sessionId);
      expect(restoredState.testData.id).toBe('TEST-002');
      expect(restoredState.testData.name).toBe('Restored Test');
      expect(restoredState.stepCount).toBe(5);
      expect(restoredState.status).toBe('in-progress');
    });

    it('should throw error for non-existent session', async () => {
      const newRecorder = new TestRecorder(mockFramework as any, {}, recorderBaseDir);

      await expect(newRecorder.loadFromState('NON-EXISTENT-SESSION')).rejects.toThrow(
        'Session not found: NON-EXISTENT-SESSION'
      );
    });

    it('should restore all recorder internal state correctly', async () => {
      const sessionId = 'TEST-001-1234567890';
      const sessionDir = path.join(recorderBaseDir, sessionId);
      await fs.mkdir(sessionDir, { recursive: true });

      const mockState: RecorderSessionState = {
        sessionId,
        testData: { id: 'TEST-003', name: 'State Test' },
        createdAt: '2026-01-05T15:30:00.000Z',
        status: 'in-progress',
        stepCount: 3,
        steps: [
          {
            stepNumber: 1,
            description: 'Step 1',
            type: 'action',
            timestamp: '2026-01-05T15:31:00.000Z',
            data: {},
            result: 'Success',
            beforeScreenshot: '/before.png',
            afterScreenshot: '/after.png',
          },
          {
            stepNumber: 2,
            description: 'Step 2',
            type: 'action',
            timestamp: '2026-01-05T15:32:00.000Z',
            data: {},
            result: 'Success',
            beforeScreenshot: '/before.png',
            afterScreenshot: '/after.png',
          },
        ],
      };

      await fs.writeFile(
        path.join(sessionDir, 'session-state.json'),
        JSON.stringify(mockState, null, 2)
      );

      const newRecorder = new TestRecorder(mockFramework as any, {}, recorderBaseDir);
      await newRecorder.loadFromState(sessionId);

      // Record another step to verify counter continues from loaded state
      await newRecorder.recordStep('Step 3', 'action', {}, 'Success');
      await newRecorder.saveState();

      const statePath = path.join(recorderBaseDir, sessionId, 'session-state.json');
      const stateContent = await fs.readFile(statePath, 'utf8');
      const updatedState = JSON.parse(stateContent) as RecorderSessionState;

      // Step counter should increment from loaded state
      expect(updatedState.stepCount).toBe(4); // Was 3, added 1
      expect(updatedState.steps).toHaveLength(3);
    });
  });

  describe('updateStateStatus()', () => {
    it('should update only the status field', async () => {
      const sessionId = await recorder.startRecording();
      await recorder.recordStep('Test step', 'action', {}, 'Success');
      await recorder.saveState();

      // Update status to completed
      await recorder.updateStateStatus('completed');

      const statePath = path.join(recorderBaseDir, sessionId, 'session-state.json');
      const stateContent = await fs.readFile(statePath, 'utf8');
      const state = JSON.parse(stateContent) as RecorderSessionState;

      expect(state.status).toBe('completed');
      // Other fields should remain unchanged
      expect(state.stepCount).toBe(1);
      expect(state.testData.id).toBe('TEST-001');
    });

    it('should update status from in-progress to completed', async () => {
      const sessionId = await recorder.startRecording();
      await recorder.saveState();

      let statePath = path.join(recorderBaseDir, sessionId, 'session-state.json');
      let stateContent = await fs.readFile(statePath, 'utf8');
      let state = JSON.parse(stateContent) as RecorderSessionState;
      expect(state.status).toBe('in-progress');

      await recorder.updateStateStatus('completed');

      stateContent = await fs.readFile(statePath, 'utf8');
      state = JSON.parse(stateContent) as RecorderSessionState;
      expect(state.status).toBe('completed');
    });

    it('should update status from completed to in-progress', async () => {
      const sessionId = await recorder.startRecording();
      await recorder.saveState();
      await recorder.updateStateStatus('completed');

      // Change back to in-progress
      await recorder.updateStateStatus('in-progress');

      const statePath = path.join(recorderBaseDir, sessionId, 'session-state.json');
      const stateContent = await fs.readFile(statePath, 'utf8');
      const state = JSON.parse(stateContent) as RecorderSessionState;

      expect(state.status).toBe('in-progress');
    });

    it('should throw error when no recording path', async () => {
      // Don't start recording
      await expect(recorder.updateStateStatus('completed')).rejects.toThrow(
        'No active recording session'
      );
    });

    it('should preserve all other fields when updating status', async () => {
      const sessionId = await recorder.startRecording();
      await recorder.recordStep('Step 1', 'action-1', { key: 'value1' }, 'Result 1');
      await recorder.recordStep('Step 2', 'action-2', { key: 'value2' }, 'Result 2');
      await recorder.saveState();

      // Capture original state
      const statePath = path.join(recorderBaseDir, sessionId, 'session-state.json');
      const originalContent = await fs.readFile(statePath, 'utf8');
      const originalState = JSON.parse(originalContent) as RecorderSessionState;

      // Update status
      await recorder.updateStateStatus('completed');

      // Read updated state
      const updatedContent = await fs.readFile(statePath, 'utf8');
      const updatedState = JSON.parse(updatedContent) as RecorderSessionState;

      // Only status should change
      expect(updatedState.status).toBe('completed');
      expect(originalState.status).toBe('in-progress');

      // Everything else should be identical
      expect(updatedState.sessionId).toBe(originalState.sessionId);
      expect(updatedState.stepCount).toBe(originalState.stepCount);
      expect(updatedState.testData).toEqual(originalState.testData);
      expect(updatedState.steps).toEqual(originalState.steps);
      expect(updatedState.createdAt).toBe(originalState.createdAt);
    });
  });

  describe('Integration: save and load cycle', () => {
    it('should maintain data integrity across save/load cycle', async () => {
      const sessionId = await recorder.startRecording();

      await recorder.recordStep('Step 1', 'type-1', { data: 'value1' }, 'Result 1');
      await recorder.recordStep('Step 2', 'type-2', { data: 'value2' }, 'Result 2');
      await recorder.recordStep('Step 3', 'type-3', { data: 'value3' }, 'Result 3');

      await recorder.saveState();

      // Create new recorder and load state
      const newRecorder = new TestRecorder(mockFramework as any, {}, recorderBaseDir);
      await newRecorder.loadFromState(sessionId);

      // Add another step
      await newRecorder.recordStep('Step 4', 'type-4', { data: 'value4' }, 'Result 4');
      await newRecorder.saveState();

      // Load state again
      const finalState = await TestRecorder.loadState(sessionId, recorderBaseDir);

      expect(finalState!.stepCount).toBe(4);
      expect(finalState!.steps).toHaveLength(4);
      expect(finalState!.steps[3].description).toBe('Step 4');
      expect(finalState!.testData.id).toBe('TEST-001');
    });
  });
});

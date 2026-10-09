/**
 * Tests for SessionManager setup and data generation functionality
 */

import { existsSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';
import { SessionManager } from '../../../framework/core/session-manager';
import type { DataGenerationResult, TestSetupResult } from '../../../framework/types/index';

describe('SessionManager Setup and Data Generation', () => {
  let sessionManager: SessionManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = resolve(__dirname, '../../../tmp/session-setup-tests');

    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    sessionManager = new SessionManager({
      resultBaseDir: testDir,
      recorderBaseDir: testDir,
      enableRecorderCopy: false,
    });

    await sessionManager.initialize();
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('updateSessionSetup', () => {
    it('should update session with successful setup result', async () => {
      // Create a session
      await sessionManager.createSession('Test Session', 'TEST-001');

      const setupResult: TestSetupResult = {
        success: true,
        data: { apiKey: 'test-key', environment: 'test' },
        executionTime: 150,
      };

      await sessionManager.updateSessionSetup(setupResult);

      const currentSession = sessionManager.getCurrentSession();
      expect(currentSession).toBeTruthy();
      expect(currentSession!.setupResult).toEqual(setupResult);
    });

    it('should update session with failed setup result', async () => {
      await sessionManager.createSession('Test Session', 'TEST-002');

      const setupResult: TestSetupResult = {
        success: false,
        error: new Error('Setup failed'),
        executionTime: 75,
      };

      await sessionManager.updateSessionSetup(setupResult);

      const currentSession = sessionManager.getCurrentSession();
      expect(currentSession!.setupResult).toEqual(setupResult);
    });

    it('should throw error when no active session', async () => {
      const setupResult: TestSetupResult = {
        success: true,
        executionTime: 100,
      };

      expect(() => sessionManager.updateSessionSetup(setupResult)).toThrow(
        'No active test session'
      );
    });
  });

  describe('updateSessionDataGeneration', () => {
    it('should update session with successful data generation result', async () => {
      await sessionManager.createSession('Test Session', 'TEST-003');

      const dataResult: DataGenerationResult = {
        success: true,
        data: { users: [{ name: 'John', email: 'john@test.com' }] },
        executionTime: 2500,
        tokenUsage: {
          promptTokens: 150,
          responseTokens: 75,
          totalTokens: 225,
          cost: 0.0045,
          model: 'gpt-4o',
        },
      };

      await sessionManager.updateSessionDataGeneration(dataResult);

      const currentSession = sessionManager.getCurrentSession();
      expect(currentSession!.dataGenerationResult).toEqual(dataResult);
    });

    it('should update session with failed data generation result', async () => {
      await sessionManager.createSession('Test Session', 'TEST-004');

      const dataResult: DataGenerationResult = {
        success: false,
        error: new Error('Data generation failed'),
        executionTime: 1000,
      };

      await sessionManager.updateSessionDataGeneration(dataResult);

      const currentSession = sessionManager.getCurrentSession();
      expect(currentSession!.dataGenerationResult).toEqual(dataResult);
    });

    it('should throw error when no active session', async () => {
      const dataResult: DataGenerationResult = {
        success: true,
        executionTime: 1500,
      };

      expect(() => sessionManager.updateSessionDataGeneration(dataResult)).toThrow(
        'No active test session'
      );
    });
  });

  describe('session persistence', () => {
    it('should persist setup and data results when saving session', async () => {
      await sessionManager.createSession('Test Session', 'TEST-005');

      const setupResult: TestSetupResult = {
        success: true,
        data: { config: 'test' },
        executionTime: 200,
      };

      const dataResult: DataGenerationResult = {
        success: true,
        data: { generated: 'data' },
        executionTime: 1800,
        tokenUsage: {
          promptTokens: 100,
          responseTokens: 50,
          totalTokens: 150,
          cost: 0.003,
          model: 'gpt-4o',
        },
      };

      await sessionManager.updateSessionSetup(setupResult);
      await sessionManager.updateSessionDataGeneration(dataResult);
      await sessionManager.saveSession();

      // Verify session has both results
      const currentSession = sessionManager.getCurrentSession();
      expect(currentSession!.setupResult).toEqual(setupResult);
      expect(currentSession!.dataGenerationResult).toEqual(dataResult);
    });
  });
});

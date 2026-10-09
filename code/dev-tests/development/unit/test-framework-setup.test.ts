/**
 * Tests for TestFramework setup and data generation functionality
 */

import { existsSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';
import { TestFramework } from '../../../framework/core/test-framework.js';
import type { TestConfig } from '../../../framework/types/index';

// Mock dependencies
jest.mock('../../../framework/automation/browser/browser-manager', () => ({
  BrowserManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('../../../framework/core/tool-manager', () => ({
  ToolManager: jest.fn().mockImplementation(() => ({
    setupTools: jest.fn().mockResolvedValue([]),
    getTools: jest.fn().mockReturnValue([]),
    getToolStats: jest.fn().mockReturnValue({ total: 0, builtIn: 0, custom: 0, toolNames: [] }),
    getCustomToolDiscovery: jest.fn().mockReturnValue(null),
  })),
}));

jest.mock('../../../framework/core/test-manager', () => ({
  TestManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    executeTest: jest.fn().mockResolvedValue({ success: true }),
    cleanup: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../framework/core/config-manager', () => ({
  ConfigManager: jest.fn().mockImplementation(() => ({
    loadConfig: jest.fn().mockResolvedValue({}),
    getConfig: jest.fn().mockReturnValue({}),
    getBrowserConfig: jest.fn().mockReturnValue({
      headless: true,
      browser: 'chromium',
      timeout: 30000,
    }),
    getAIConfig: jest.fn().mockReturnValue({
      provider: 'openai',
      model: 'gpt-4o',
      openai: {
        modelName: 'gpt-4o',
        apiKey: 'test-key',
      },
    }),
    getFrameworkConfig: jest.fn().mockReturnValue({}),
    getDirectories: jest.fn().mockReturnValue({
      results: 'test-results',
      screenshots: 'screenshots',
      reports: 'reports',
    }),
  })),
}));

describe('TestFramework Setup and Data Generation', () => {
  let framework: TestFramework;
  let testDir: string;

  beforeEach(async () => {
    testDir = resolve(__dirname, '../../../tmp/framework-setup-tests');

    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    framework = new TestFramework({
      resultBaseDir: testDir,
      recorderBaseDir: testDir,
      enableRecorderCopy: false,
    });

    await framework.initialize();
  });

  afterEach(async () => {
    await framework.cleanup();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('executeTestSetup', () => {
    it('should execute successful test setup function', async () => {
      const testConfig: TestConfig = {
        id: 'TEST-SETUP-001',
        name: 'Test with Setup',
        description: 'Test with setup functionality',
        priority: 'Medium',
        tags: ['setup'],
        task: 'Test task',
        setup: async () => {
          return { initialized: true, timestamp: Date.now() };
        },
      };

      const session = await framework
        .getSessionManager()
        .createSession('Test Session', testConfig.id);

      // Use reflection to access private method
      const executeTestSetup = (framework as any).executeTestSetup;
      await executeTestSetup.call(framework, testConfig, session);

      const currentSession = framework.getSessionManager().getCurrentSession();
      expect(currentSession).toBeTruthy();
      expect(currentSession!.setupResult).toBeTruthy();
      expect(currentSession!.setupResult!.success).toBe(true);
      expect(currentSession!.setupResult!.data).toEqual({
        initialized: true,
        timestamp: expect.any(Number),
      });
      expect(currentSession!.setupResult!.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle setup function errors', async () => {
      const testConfig: TestConfig = {
        id: 'TEST-SETUP-002',
        name: 'Test with Failing Setup',
        description: 'Test with failing setup functionality',
        priority: 'High',
        tags: ['setup', 'error'],
        task: 'Test task',
        setup: async () => {
          throw new Error('Setup failed');
        },
      };

      const session = await framework
        .getSessionManager()
        .createSession('Test Session', testConfig.id);

      const executeTestSetup = (framework as any).executeTestSetup;
      
      // executeTestSetup throws an error, but also stores the result
      await expect(executeTestSetup.call(framework, testConfig, session)).rejects.toThrow('Test setup failed: Setup failed');

      const currentSession = framework.getSessionManager().getCurrentSession();
      expect(currentSession!.setupResult).toBeTruthy();
      expect(currentSession!.setupResult!.success).toBe(false);
      expect(currentSession!.setupResult!.error).toBeInstanceOf(Error);
      expect(currentSession!.setupResult!.error!.message).toBe('Setup failed');
    });

    it('should skip setup when not provided', async () => {
      const testConfig: TestConfig = {
        id: 'TEST-SETUP-003',
        name: 'Test without Setup',
        description: 'Test without setup functionality',
        priority: 'Low',
        tags: ['basic'],
        task: 'Test task',
      };

      const session = await framework
        .getSessionManager()
        .createSession('Test Session', testConfig.id);

      const executeTestSetup = (framework as any).executeTestSetup;
      await executeTestSetup.call(framework, testConfig, session);

      const currentSession = framework.getSessionManager().getCurrentSession();
      expect(currentSession!.setupResult).toBeUndefined();
    });
  });

  describe('executeDataGeneration', () => {
    it('should execute successful data generation function', async () => {
      const testConfig: TestConfig = {
        id: 'TEST-DATA-001',
        name: 'Test with Data Generation',
        description: 'Test with data generation functionality',
        priority: 'Medium',
        tags: ['data'],
        task: 'Test task',
        data: async () => {
          return { users: [{ name: 'John', email: 'john@test.com' }] };
        },
      };

      const session = await framework
        .getSessionManager()
        .createSession('Test Session', testConfig.id);

      const executeDataGeneration = (framework as any).executeDataGeneration;
      await executeDataGeneration.call(framework, testConfig, session);

      const currentSession = framework.getSessionManager().getCurrentSession();
      expect(currentSession).toBeTruthy();
      expect(currentSession!.dataGenerationResult).toBeTruthy();
      expect(currentSession!.dataGenerationResult!.success).toBe(true);
      expect(currentSession!.dataGenerationResult!.data).toEqual({
        users: [{ name: 'John', email: 'john@test.com' }],
      });
      expect(currentSession!.dataGenerationResult!.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle data generation errors', async () => {
      const testConfig: TestConfig = {
        id: 'TEST-DATA-002',
        name: 'Test with Failing Data Generation',
        description: 'Test with failing data generation functionality',
        priority: 'High',
        tags: ['data', 'error'],
        task: 'Test task',
        data: async () => {
          throw new Error('Data generation failed');
        },
      };

      const session = await framework
        .getSessionManager()
        .createSession('Test Session', testConfig.id);

      const executeDataGeneration = (framework as any).executeDataGeneration;
      
      // executeDataGeneration throws an error, but also stores the result
      await expect(executeDataGeneration.call(framework, testConfig, session)).rejects.toThrow('Data generation failed: Data generation failed');

      const currentSession = framework.getSessionManager().getCurrentSession();
      expect(currentSession!.dataGenerationResult).toBeTruthy();
      expect(currentSession!.dataGenerationResult!.success).toBe(false);
      expect(currentSession!.dataGenerationResult!.error).toBeInstanceOf(Error);
      expect(currentSession!.dataGenerationResult!.error!.message).toBe('Data generation failed');
    });

    it('should skip data generation when not provided', async () => {
      const testConfig: TestConfig = {
        id: 'TEST-DATA-003',
        name: 'Test without Data Generation',
        description: 'Test without data generation functionality',
        priority: 'Low',
        tags: ['basic'],
        task: 'Test task',
      };

      const session = await framework
        .getSessionManager()
        .createSession('Test Session', testConfig.id);

      const executeDataGeneration = (framework as any).executeDataGeneration;
      await executeDataGeneration.call(framework, testConfig, session);

      const currentSession = framework.getSessionManager().getCurrentSession();
      expect(currentSession!.dataGenerationResult).toBeUndefined();
    });
  });

  describe('runSingleTest with setup and data generation', () => {
    it('should execute setup and data generation before test', async () => {
      const setupMock = jest.fn().mockResolvedValue({ ready: true });
      const dataMock = jest.fn().mockResolvedValue({ testData: 'generated' });

      const testConfig: TestConfig = {
        id: 'TEST-FULL-001',
        name: 'Test with Setup and Data',
        description: 'Test with setup and data generation',
        priority: 'Medium',
        tags: ['setup', 'data'],
        task: 'Test task with setup and data',
        setup: setupMock,
        data: dataMock,
      };

      await framework.runTest(testConfig);

      expect(setupMock).toHaveBeenCalled();
      expect(dataMock).toHaveBeenCalled();

      const session = framework.getSessionManager().getCurrentSession();
      expect(session!.setupResult).toBeTruthy();
      expect(session!.setupResult!.success).toBe(true);
      expect(session!.setupResult!.data).toEqual({ ready: true });

      expect(session!.dataGenerationResult).toBeTruthy();
      expect(session!.dataGenerationResult!.success).toBe(true);
      expect(session!.dataGenerationResult!.data).toEqual({ testData: 'generated' });
    });

    it('should continue test execution even if setup fails', async () => {
      const setupMock = jest.fn().mockRejectedValue(new Error('Setup failed'));

      const testConfig: TestConfig = {
        id: 'TEST-FULL-002',
        name: 'Test with Failing Setup',
        description: 'Test with failing setup functionality',
        priority: 'High',
        tags: ['setup', 'error'],
        task: 'Test task with failing setup',
        setup: setupMock,
      };

      await framework.runTest(testConfig);

      expect(setupMock).toHaveBeenCalled();

      const session = framework.getSessionManager().getCurrentSession();
      expect(session!.setupResult).toBeTruthy();
      expect(session!.setupResult!.success).toBe(false);
      expect(session!.setupResult!.error!.message).toBe('Setup failed');
    });

    it('should continue test execution even if data generation fails', async () => {
      const dataMock = jest.fn().mockRejectedValue(new Error('Data generation failed'));

      const testConfig: TestConfig = {
        id: 'TEST-FULL-003',
        name: 'Test with Failing Data Generation',
        description: 'Test with failing data generation functionality',
        priority: 'Low',
        tags: ['data', 'error'],
        task: 'Test task with failing data generation',
        data: dataMock,
      };

      await framework.runTest(testConfig);

      expect(dataMock).toHaveBeenCalled();

      const session = framework.getSessionManager().getCurrentSession();
      expect(session!.dataGenerationResult).toBeTruthy();
      expect(session!.dataGenerationResult!.success).toBe(false);
      expect(session!.dataGenerationResult!.error!.message).toBe('Data generation failed');
    });
  });
});

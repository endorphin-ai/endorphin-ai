/**
 * Tests for DebugManager functionality
 */

import { DebugManager, createDebugManager } from '../../../framework/core/debug-manager.js';
import type { TestFramework } from '../../../framework/core/test-framework.js';
import type { TestSession } from '../../../framework/types/index';

// Mock logger to avoid module resolution issues
jest.mock('../../../framework/core/logger', () => ({
  globalLogger: {
    createChild: jest.fn().mockReturnValue({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    })
  },
  logWithIcon: jest.fn(),
  LogLevel: {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    CRITICAL: 'CRITICAL'
  }
}));

// Mock framework dependencies
const mockFramework = {
  getConfigManager: jest.fn().mockReturnValue({
    getConfig: jest.fn().mockReturnValue({
      openAI: { apiKey: 'test-key' },
      browser: { headless: true }
    })
  }),
  getToolManager: jest.fn().mockReturnValue({
    getTools: jest.fn().mockReturnValue([
      { name: 'navigate', description: 'Navigate to URL', schema: {} },
      { name: 'click', description: 'Click element', schema: {} },
      { name: 'customTool', description: 'Custom tool', schema: {} }
    ]),
    getToolStats: jest.fn().mockReturnValue({
      total: 3,
      builtIn: 3, // All tools are now built-in
      toolNames: ['navigate', 'click', 'customTool']
    }),
    getCustomToolDiscovery: jest.fn().mockReturnValue({
      getLoadedTools: jest.fn().mockReturnValue([
        { name: 'customTool', description: 'Custom tool', schema: {} }
      ])
    }),
    getToolByName: jest.fn().mockImplementation((name: string) => {
      const tools = [
        { name: 'navigate', description: 'Navigate to URL', schema: {} },
        { name: 'click', description: 'Click element', schema: {} },
        { name: 'customTool', description: 'Custom tool', schema: {} }
      ];
      return tools.find(t => t.name === name);
    })
  }),
  getBrowserManager: jest.fn().mockReturnValue({
    isInitialized: jest.fn().mockReturnValue(true),
    getCurrentUrl: jest.fn().mockReturnValue('https://example.com')
  }),
  takeScreenshot: jest.fn().mockResolvedValue('screenshot-path.png'),
  getStatus: jest.fn().mockReturnValue({
    initialized: true,
    browserReady: true,
    toolsLoaded: 3
  })
} as unknown as TestFramework;

describe('DebugManager', () => {
  let debugManager: DebugManager;
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Clear global debug object
    delete (globalThis as any).endorphinDebug;
    
    // Store original environment
    originalEnv = process.env.ENDORPHIN_DEBUG;
    
    debugManager = new DebugManager(mockFramework);
  });

  afterEach(() => {
    // Restore environment
    if (originalEnv !== undefined) {
      process.env.ENDORPHIN_DEBUG = originalEnv;
    } else {
      delete process.env.ENDORPHIN_DEBUG;
    }
    
    // Clear global debug object
    delete (globalThis as any).endorphinDebug;
  });

  describe('initialization', () => {
    it('should not initialize when ENDORPHIN_DEBUG is not set', () => {
      delete process.env.ENDORPHIN_DEBUG;
      
      debugManager.initialize();
      
      expect(debugManager.isDebugMode()).toBe(false);
      expect((globalThis as any).endorphinDebug).toBeUndefined();
    });

    it('should not initialize when ENDORPHIN_DEBUG is false', () => {
      process.env.ENDORPHIN_DEBUG = 'false';
      
      debugManager.initialize();
      
      expect(debugManager.isDebugMode()).toBe(false);
      expect((globalThis as any).endorphinDebug).toBeUndefined();
    });

    it('should initialize when ENDORPHIN_DEBUG is true', () => {
      process.env.ENDORPHIN_DEBUG = 'true';
      
      debugManager.initialize();
      
      expect(debugManager.isDebugMode()).toBe(true);
      expect((globalThis as any).endorphinDebug).toBeDefined();
    });

    it('should create proper debug object structure', () => {
      process.env.ENDORPHIN_DEBUG = 'true';
      
      debugManager.initialize();
      
      const debugObj = (globalThis as any).endorphinDebug;
      expect(debugObj).toBeDefined();
      expect(debugObj.framework).toBe(mockFramework);
      expect(debugObj.session).toBeNull();
      expect(debugObj.config).toBeDefined();
      expect(debugObj.tools).toBeDefined();
      // customTools no longer exists since custom tools functionality was removed
      expect(debugObj.utils).toBeDefined();
      expect(debugObj.version).toBeDefined();
      expect(debugObj.isDebugMode).toBe(true);
    });
  });

  describe('session management', () => {
    beforeEach(() => {
      process.env.ENDORPHIN_DEBUG = 'true';
      debugManager.initialize();
    });

    it('should update session in debug object', () => {
      const mockSession: TestSession = {
        sessionId: 'test-session-001',
        testName: 'Test Session',
        testId: 'TEST-001',
        status: 'running',
        startTime: new Date(),
        steps: [],
        screenshotCounter: 0,
        duration: 0
      };

      debugManager.updateSession(mockSession);

      const debugObj = (globalThis as any).endorphinDebug;
      expect(debugObj.session).toBe(mockSession);
    });

    it('should clear session when null is passed', () => {
      const mockSession: TestSession = {
        sessionId: 'test-session-001',
        testName: 'Test Session',
        testId: 'TEST-001',
        status: 'running',
        startTime: new Date(),
        steps: [],
        screenshotCounter: 0,
        duration: 0
      };

      debugManager.updateSession(mockSession);
      debugManager.updateSession(null);

      const debugObj = (globalThis as any).endorphinDebug;
      expect(debugObj.session).toBeNull();
    });
  });

  describe('tools management', () => {
    beforeEach(() => {
      process.env.ENDORPHIN_DEBUG = 'true';
      debugManager.initialize();
    });

    it('should update tools in debug object', () => {
      const frameworkTools = [
        { name: 'navigate', description: 'Navigate to URL', schema: {} },
        { name: 'click', description: 'Click element', schema: {} },
        { name: 'customTool', description: 'Custom tool', schema: {} }
      ];
      // All tools are now framework tools
      debugManager.updateTools(frameworkTools, []);

      const debugObj = (globalThis as any).endorphinDebug;
      // All tools are now framework tools, custom tools functionality removed
      expect(debugObj.tools).toHaveLength(3); // navigate, click, customTool all treated as framework tools
      expect(debugObj.tools[0].name).toBe('navigate');
      // customTools property no longer exists
    });
  });

  describe('debug utilities', () => {
    beforeEach(() => {
      process.env.ENDORPHIN_DEBUG = 'true';
      debugManager.initialize();
    });

    it('should provide getSessionData utility', () => {
      const mockSession: TestSession = {
        sessionId: 'test-session-001',
        testName: 'Test Session',
        testId: 'TEST-001',
        status: 'completed',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:05:00Z'),
        steps: [{ id: 'step1' }, { id: 'step2' }] as any[],
        screenshotCounter: 3,
        duration: 300000,
        setupResult: {
          success: true,
          data: { initialized: true },
          executionTime: 100
        },
        dataGenerationResult: {
          success: true,
          data: { users: ['user1'] },
          executionTime: 200
        }
      };

      debugManager.updateSession(mockSession);

      const debugObj = (globalThis as any).endorphinDebug;
      const sessionData = debugObj.utils.getSessionData();

      expect(sessionData).toBeDefined();
      expect(sessionData.sessionId).toBe('test-session-001');
      expect(sessionData.testName).toBe('Test Session');
      expect(sessionData.status).toBe('completed');
      expect(sessionData.steps).toBe(2);
      expect(sessionData.screenshots).toBe(3);
      expect(sessionData.duration).toBe(300000);
      expect(sessionData.setupResult).toEqual(mockSession.setupResult);
      expect(sessionData.dataGenerationResult).toEqual(mockSession.dataGenerationResult);
    });

    it('should return null for getSessionData when no session', () => {
      const debugObj = (globalThis as any).endorphinDebug;
      const sessionData = debugObj.utils.getSessionData();

      expect(sessionData).toBeNull();
    });

    it('should provide getSetupResult utility', () => {
      const mockSession: TestSession = {
        sessionId: 'test-session-001',
        testName: 'Test Session',
        testId: 'TEST-001',
        status: 'running',
        startTime: new Date(),
        steps: [],
        screenshotCounter: 0,
        duration: 0,
        setupResult: {
          success: true,
          data: { initialized: true },
          executionTime: 100
        }
      };

      debugManager.updateSession(mockSession);

      const debugObj = (globalThis as any).endorphinDebug;
      const setupResult = debugObj.utils.getSetupResult();

      expect(setupResult).toEqual(mockSession.setupResult);
    });

    it('should provide getDataGenerationResult utility', () => {
      const mockSession: TestSession = {
        sessionId: 'test-session-001',
        testName: 'Test Session',
        testId: 'TEST-001',
        status: 'running',
        startTime: new Date(),
        steps: [],
        screenshotCounter: 0,
        duration: 0,
        dataGenerationResult: {
          success: true,
          data: { users: ['user1'] },
          executionTime: 200,
          tokenUsage: {
            promptTokens: 50,
            responseTokens: 25,
            totalTokens: 75,
            cost: 0.0015,
            model: 'gpt-4o'
          }
        }
      };

      debugManager.updateSession(mockSession);

      const debugObj = (globalThis as any).endorphinDebug;
      const dataResult = debugObj.utils.getDataGenerationResult();

      expect(dataResult).toEqual(mockSession.dataGenerationResult);
    });

    it('should provide inspectTools utility', () => {
      // First update tools to populate the debug object
      const frameworkTools = [
        { name: 'navigate', description: 'Navigate to URL', schema: {} },
        { name: 'click', description: 'Click element', schema: {} },
        { name: 'customTool', description: 'Custom tool', schema: {} }
      ];
      // All tools are now framework tools
      debugManager.updateTools(frameworkTools, []);

      const debugObj = (globalThis as any).endorphinDebug;
      const toolsInfo = debugObj.utils.inspectTools();

      expect(toolsInfo).toBeInstanceOf(Array);
      expect(toolsInfo.length).toBeGreaterThan(0);
      
      const frameworkTool = toolsInfo.find((t: any) => t.name === 'navigate');
      expect(frameworkTool).toBeDefined();
      expect(frameworkTool.type).toBe('framework');
      expect(frameworkTool.isLoaded).toBe(true);

      const customTool = toolsInfo.find((t: any) => t.name === 'customTool');
      expect(customTool).toBeDefined();
      expect(customTool.type).toBe('framework'); // All tools are now framework tools
      expect(customTool.isLoaded).toBe(true);
    });

    it('should provide clearSession utility', () => {
      const mockSession: TestSession = {
        sessionId: 'test-session-001',
        testName: 'Test Session',
        testId: 'TEST-001',
        status: 'running',
        startTime: new Date(),
        steps: [],
        screenshotCounter: 0,
        duration: 0
      };

      debugManager.updateSession(mockSession);

      const debugObj = (globalThis as any).endorphinDebug;
      debugObj.utils.clearSession();

      expect(debugObj.session).toBeNull();
    });

    it('should provide framework utilities', async () => {
      const debugObj = (globalThis as any).endorphinDebug;

      const status = debugObj.utils.getFrameworkStatus();
      expect(status).toBeDefined();
      expect(status.initialized).toBe(true);

      const url = debugObj.utils.getCurrentUrl();
      expect(url).toBe('https://example.com');

      const screenshot = await debugObj.utils.takeScreenshot();
      expect(screenshot).toBe('screenshot-path.png');

      const toolStats = debugObj.utils.getToolStats();
      expect(toolStats.total).toBe(3);
      expect(toolStats.builtIn).toBe(3); // All tools are now built-in tools
      // custom field no longer exists

      const tool = debugObj.utils.getToolByName('navigate');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('navigate');

      // Custom tools functionality was removed
      // All tools are now framework tools
    });
  });

  describe('createDebugManager factory', () => {
    it('should create and initialize debug manager', () => {
      process.env.ENDORPHIN_DEBUG = 'true';
      
      const manager = createDebugManager(mockFramework);
      
      expect(manager).toBeInstanceOf(DebugManager);
      expect(manager.isDebugMode()).toBe(true);
      expect((globalThis as any).endorphinDebug).toBeDefined();
    });
  });
});
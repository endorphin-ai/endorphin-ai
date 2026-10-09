/**
 * Unit Tests for Browser Persistence via CDP WebSocket
 *
 * Tests the browser persistence feature that keeps a Chromium browser alive
 * across separate CLI invocations by storing the CDP WebSocket endpoint in
 * the session state file. Covers BrowserManager, BrowserEngine,
 * EnhancedBrowserTestFramework, RecorderAPI, SessionRecorder, and RecorderCLI.
 *
 * The persistence mechanism works by:
 * 1. launchPersistent() spawns Chrome directly with --remote-debugging-port=0
 * 2. Parses the CDP WebSocket endpoint from Chrome's stderr
 * 3. Connects via chromium.connectOverCDP(cdpEndpoint)
 * 4. Saves the endpoint to session-state.json
 * 5. Subsequent CLI processes reconnect via connectOverCDP(savedEndpoint)
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { EventEmitter } from 'events';

// ── Mock logger (use relative path to avoid moduleNameMapper conflict) ──
jest.mock('../../../framework/core/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  globalLogger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    createChild: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    }),
  },
  logWithIcon: jest.fn(),
  logSuccess: jest.fn(),
  LogLevel: { INFO: 'info', DEBUG: 'debug', WARN: 'warn', ERROR: 'error' },
}));

// ── Mock CI performance monitor ──
jest.mock('../../../framework/core/ci-performance', () => ({
  ciPerformanceMonitor: {
    setCurrentPage: jest.fn(),
  },
}));

// ── Mock child_process.spawn ──
const CDP_ENDPOINT = 'ws://127.0.0.1:9222/devtools/browser/abc123';

function createMockChildProcess() {
  const proc = new EventEmitter() as any;
  proc.stderr = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stdin = null;
  proc.unref = jest.fn();
  proc.kill = jest.fn();
  proc.pid = 12345;
  // Emit the CDP endpoint after a microtask (simulate Chrome startup)
  setTimeout(() => {
    proc.stderr.emit('data', Buffer.from(`DevTools listening on ${CDP_ENDPOINT}\n`));
  }, 10);
  return proc;
}

jest.mock('child_process', () => ({
  spawn: jest.fn(() => createMockChildProcess()),
}));

// ── Mock Playwright ──
const mockPageOn = jest.fn();
const mockPageRemoveAllListeners = jest.fn();
const mockPageClose = jest.fn().mockResolvedValue(undefined);
const mockNewPage = jest.fn();
const mockContextPages = jest.fn();
const mockContextClose = jest.fn().mockResolvedValue(undefined);
const mockNewContext = jest.fn();
const mockBrowserContexts = jest.fn();
const mockBrowserClose = jest.fn().mockResolvedValue(undefined);

function createMockPage() {
  return {
    on: mockPageOn,
    removeAllListeners: mockPageRemoveAllListeners,
    close: mockPageClose,
    url: jest.fn().mockReturnValue('about:blank'),
    title: jest.fn().mockResolvedValue(''),
    screenshot: jest.fn().mockResolvedValue(Buffer.from('fake')),
  };
}

function createMockContext(pages: any[] = []) {
  mockContextPages.mockReturnValue(pages);
  return {
    newPage: mockNewPage,
    pages: mockContextPages,
    close: mockContextClose,
  };
}

function createMockBrowser(contexts: any[] = []) {
  mockBrowserContexts.mockReturnValue(contexts);
  return {
    newContext: mockNewContext,
    contexts: mockBrowserContexts,
    close: mockBrowserClose,
  };
}

jest.mock('playwright', () => {
  const mockLaunch = jest.fn();
  const mockConnectOverCDP = jest.fn();
  return {
    chromium: {
      launch: mockLaunch,
      connectOverCDP: mockConnectOverCDP,
      executablePath: jest.fn().mockReturnValue('/fake/chrome'),
    },
    firefox: { launch: mockLaunch },
    webkit: { launch: mockLaunch },
  };
});

// ── Import after mocks ──
import { BrowserManager } from '../../../framework/automation/browser/browser-manager.js';
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { TestRecorder } from '../../../framework/test-recorder/session-recorder.js';
import type { RecorderSessionState } from '../../../framework/test-recorder/session-recorder.js';

// ============================================================================
// SECTION 1: BrowserManager Persistence Methods
// ============================================================================
describe('BrowserManager — Browser Persistence', () => {
  let manager: BrowserManager;
  const defaultConfig = {
    browser: {
      type: 'chromium' as const,
      headless: false,
      viewport: { width: 1280, height: 720 },
      timeout: 30000,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new BrowserManager(defaultConfig);

    // Default: connectOverCDP returns a mock browser with context and page
    const mockPage = createMockPage();
    const mockCtx = createMockContext([mockPage]);
    const mockBrowser = createMockBrowser([mockCtx]);
    (chromium.connectOverCDP as jest.Mock).mockResolvedValue(mockBrowser);
  });

  // ---------- launchPersistent() ----------
  describe('launchPersistent()', () => {
    it('should spawn Chrome with --remote-debugging-port=0 and connect via CDP', async () => {
      const wsEndpoint = await manager.launchPersistent();

      // Should call spawn with Chrome executable
      expect(spawn).toHaveBeenCalledTimes(1);
      const spawnArgs = (spawn as jest.Mock).mock.calls[0];
      expect(spawnArgs[0]).toBe('/fake/chrome');
      expect(spawnArgs[1]).toContain('--remote-debugging-port=0');
      expect(spawnArgs[2].detached).toBe(true);

      // Should connect via CDP with parsed endpoint
      expect(chromium.connectOverCDP).toHaveBeenCalledWith(CDP_ENDPOINT);

      // Returns the CDP endpoint
      expect(wsEndpoint).toBe(CDP_ENDPOINT);
    });

    it('should include headless flag when config is headless', async () => {
      const headlessManager = new BrowserManager({
        browser: { ...defaultConfig.browser, headless: true },
      });

      await headlessManager.launchPersistent();

      const spawnArgs = (spawn as jest.Mock).mock.calls[0];
      expect(spawnArgs[1]).toContain('--headless=new');
    });

    it('should NOT include headless flag when config is not headless', async () => {
      await manager.launchPersistent();

      const spawnArgs = (spawn as jest.Mock).mock.calls[0];
      expect(spawnArgs[1]).not.toContain('--headless=new');
    });

    it('should skip launch if browser is already initialized', async () => {
      await manager.launchPersistent();
      const wsEndpoint = await manager.launchPersistent();

      expect(spawn).toHaveBeenCalledTimes(1);
      expect(wsEndpoint).toBe(CDP_ENDPOINT);
    });

    it('should initialize page and context from CDP connection', async () => {
      await manager.launchPersistent();

      expect(manager.isInitialized()).toBe(true);
    });

    it('should create new context if none exist on the browser', async () => {
      const mockPage = createMockPage();
      const mockCtx = createMockContext();
      const mockBrowser = createMockBrowser([]); // No existing contexts

      mockNewContext.mockResolvedValue(mockCtx);
      mockNewPage.mockResolvedValue(mockPage);
      (chromium.connectOverCDP as jest.Mock).mockResolvedValue(mockBrowser);

      await manager.launchPersistent();

      expect(mockNewContext).toHaveBeenCalledTimes(1);
      expect(mockNewPage).toHaveBeenCalledTimes(1);
    });

    it('should unref the Chrome process so Node.js can exit', async () => {
      await manager.launchPersistent();

      // The mock process should have been unref'd
      const mockProc = (spawn as jest.Mock).mock.results[0].value;
      expect(mockProc.unref).toHaveBeenCalled();
    });
  });

  // ---------- connectOverCDP() ----------
  describe('connectOverCDP()', () => {
    it('should connect to existing browser via chromium.connectOverCDP', async () => {
      const mockPage = createMockPage();
      const mockCtx = createMockContext([mockPage]);
      const mockBrowser = createMockBrowser([mockCtx]);

      (chromium.connectOverCDP as jest.Mock).mockResolvedValue(mockBrowser);

      const wsEndpoint = 'ws://127.0.0.1:9222/devtools/browser/abc123';
      await manager.connectOverCDP(wsEndpoint);

      expect(chromium.connectOverCDP).toHaveBeenCalledWith(wsEndpoint);
      expect(manager.isInitialized()).toBe(true);
    });

    it('should store the CDP endpoint for getWsEndpoint()', async () => {
      const mockPage = createMockPage();
      const mockCtx = createMockContext([mockPage]);
      const mockBrowser = createMockBrowser([mockCtx]);

      (chromium.connectOverCDP as jest.Mock).mockResolvedValue(mockBrowser);

      const endpoint = 'ws://127.0.0.1:9999/devtools/browser/stored';
      await manager.connectOverCDP(endpoint);

      expect(manager.getWsEndpoint()).toBe(endpoint);
    });

    it('should reuse existing context and page when available', async () => {
      const mockPage = createMockPage();
      const mockCtx = createMockContext([mockPage]);
      const mockBrowser = createMockBrowser([mockCtx]);

      (chromium.connectOverCDP as jest.Mock).mockResolvedValue(mockBrowser);

      await manager.connectOverCDP('ws://127.0.0.1:9222/test');

      expect(mockNewContext).not.toHaveBeenCalled();
      expect(mockNewPage).not.toHaveBeenCalled();
    });

    it('should create new context if none exist on the browser', async () => {
      const mockPage = createMockPage();
      const mockCtx = createMockContext();
      const mockBrowser = createMockBrowser([]); // No contexts

      mockNewContext.mockResolvedValue(mockCtx);
      mockNewPage.mockResolvedValue(mockPage);
      (chromium.connectOverCDP as jest.Mock).mockResolvedValue(mockBrowser);

      await manager.connectOverCDP('ws://127.0.0.1:9222/test');

      expect(mockNewContext).toHaveBeenCalledTimes(1);
      expect(mockNewPage).toHaveBeenCalledTimes(1);
    });

    it('should create new page if context exists but has no pages', async () => {
      const mockPage = createMockPage();
      const mockCtx = createMockContext([]); // Context with no pages
      const mockBrowser = createMockBrowser([mockCtx]);

      mockNewPage.mockResolvedValue(mockPage);
      (chromium.connectOverCDP as jest.Mock).mockResolvedValue(mockBrowser);

      await manager.connectOverCDP('ws://127.0.0.1:9222/test');

      expect(mockNewContext).not.toHaveBeenCalled();
      expect(mockCtx.newPage).toHaveBeenCalledTimes(1);
    });

    it('should reset state and rethrow on connection failure', async () => {
      (chromium.connectOverCDP as jest.Mock).mockRejectedValue(
        new Error('Connection refused')
      );

      await expect(
        manager.connectOverCDP('ws://127.0.0.1:9999/bad')
      ).rejects.toThrow('Connection refused');

      expect(manager.isInitialized()).toBe(false);
    });

    it('should skip reconnect if browser is already initialized', async () => {
      // First: initialize via launchPersistent
      await manager.launchPersistent();

      jest.clearAllMocks();

      // Second: connectOverCDP should be a no-op
      await manager.connectOverCDP('ws://127.0.0.1:9222/other');

      expect(chromium.connectOverCDP).not.toHaveBeenCalled();
    });
  });

  // ---------- getWsEndpoint() ----------
  describe('getWsEndpoint()', () => {
    it('should throw when no CDP endpoint is set', () => {
      expect(() => manager.getWsEndpoint()).toThrow(
        'No CDP endpoint available'
      );
    });

    it('should return the endpoint after launchPersistent', async () => {
      await manager.launchPersistent();

      const endpoint = manager.getWsEndpoint();
      expect(endpoint).toBe(CDP_ENDPOINT);
    });

    it('should return the endpoint after connectOverCDP', async () => {
      const mockPage = createMockPage();
      const mockCtx = createMockContext([mockPage]);
      const mockBrowser = createMockBrowser([mockCtx]);

      (chromium.connectOverCDP as jest.Mock).mockResolvedValue(mockBrowser);

      const endpoint = 'ws://127.0.0.1:8888/devtools/browser/xyz';
      await manager.connectOverCDP(endpoint);

      expect(manager.getWsEndpoint()).toBe(endpoint);
    });
  });

  // ---------- disconnect() ----------
  describe('disconnect()', () => {
    it('should call browser.close() for CDP-connected browsers (disconnects without killing Chrome)', async () => {
      await manager.launchPersistent();
      expect(manager.isInitialized()).toBe(true);

      await manager.disconnect();

      // browser.close() IS called for CDP — it disconnects the Playwright client
      expect(mockBrowserClose).toHaveBeenCalledTimes(1);
      expect(manager.isInitialized()).toBe(false);
    });

    it('should remove page event listeners before disconnecting', async () => {
      await manager.launchPersistent();
      await manager.disconnect();

      expect(mockPageRemoveAllListeners).toHaveBeenCalled();
    });

    it('should be safe to call when browser is not initialized', async () => {
      await expect(manager.disconnect()).resolves.not.toThrow();
    });
  });
});

// ============================================================================
// SECTION 2: SessionRecorder — browserWsEndpoint in state
// ============================================================================
describe('TestRecorder — browserWsEndpoint persistence', () => {
  let tempDir: string;
  let recorderBaseDir: string;
  let recorder: TestRecorder;

  const mockGetBrowserManager = jest.fn();
  const mockFramework = {
    getBrowserManager: mockGetBrowserManager,
    runTask: jest.fn().mockResolvedValue({ status: 'SUCCESS', result: 'OK' }),
    initialize: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
  };

  // Mock DirectoryManager
  jest.mock('../../../framework/utils/directory-manager', () => ({
    DirectoryManager: {
      cleanupRecorderDirectory: jest.fn().mockResolvedValue(undefined),
    },
  }));

  beforeEach(async () => {
    jest.clearAllMocks();
    tempDir = path.join(os.tmpdir(), `browser-persist-test-${Date.now()}`);
    recorderBaseDir = path.join(tempDir, 'test-recorder');
    await fs.mkdir(recorderBaseDir, { recursive: true });

    mockGetBrowserManager.mockReturnValue({
      getPage: jest.fn().mockReturnValue(null),
      takeScreenshot: jest.fn().mockResolvedValue(undefined),
    });

    recorder = new TestRecorder(
      mockFramework as any,
      { id: 'WS-TEST', name: 'WS Test', description: 'test' },
      recorderBaseDir,
    );
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should save browserWsEndpoint when provided to saveState()', async () => {
    const sessionId = await recorder.startRecording();
    await recorder.saveState('ws://127.0.0.1:9222/devtools/browser/test123');

    const statePath = path.join(recorderBaseDir, sessionId, 'session-state.json');
    const content = await fs.readFile(statePath, 'utf8');
    const state = JSON.parse(content) as RecorderSessionState;

    expect(state.browserWsEndpoint).toBe('ws://127.0.0.1:9222/devtools/browser/test123');
  });

  it('should NOT include browserWsEndpoint when not provided', async () => {
    const sessionId = await recorder.startRecording();
    await recorder.saveState(); // No argument

    const statePath = path.join(recorderBaseDir, sessionId, 'session-state.json');
    const content = await fs.readFile(statePath, 'utf8');
    const state = JSON.parse(content) as RecorderSessionState;

    expect(state.browserWsEndpoint).toBeUndefined();
  });

  it('should preserve browserWsEndpoint across loadState()', async () => {
    const sessionId = 'WS-TEST-1234567890';
    const sessionDir = path.join(recorderBaseDir, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });

    const mockState: RecorderSessionState = {
      sessionId,
      testData: { id: 'WS-TEST', name: 'WS Test' },
      createdAt: '2026-02-15T10:00:00.000Z',
      status: 'in-progress',
      stepCount: 0,
      steps: [],
      browserWsEndpoint: 'ws://127.0.0.1:9222/devtools/browser/persist',
    };

    await fs.writeFile(
      path.join(sessionDir, 'session-state.json'),
      JSON.stringify(mockState, null, 2)
    );

    const loaded = await TestRecorder.loadState(sessionId, recorderBaseDir);

    expect(loaded).not.toBeNull();
    expect(loaded!.browserWsEndpoint).toBe('ws://127.0.0.1:9222/devtools/browser/persist');
  });
});

// ============================================================================
// SECTION 3: RecorderAPI — createSession, addStep, closePersistentBrowser
// ============================================================================
describe('RecorderAPI — Browser Persistence Flow', () => {
  const mockCreateSession = jest.fn();
  const mockAddStep = jest.fn();
  const mockGenerateTest = jest.fn();
  const mockListSessions = jest.fn();
  const mockGetSessionStatus = jest.fn();
  const mockClosePersistentBrowser = jest.fn();

  jest.mock('../../../framework/test-recorder/recorder-api', () => ({
    RecorderAPI: jest.fn().mockImplementation(() => ({
      createSession: mockCreateSession,
      addStep: mockAddStep,
      generateTest: mockGenerateTest,
      listSessions: mockListSessions,
      getSessionStatus: mockGetSessionStatus,
      closePersistentBrowser: mockClosePersistentBrowser,
    })),
  }));

  let RecorderCLI: typeof import('../../../framework/test-recorder/recorder-cli.js').RecorderCLI;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import('../../../framework/test-recorder/recorder-cli.js');
    RecorderCLI = mod.RecorderCLI;
  });

  describe('createSession — persistence flow', () => {
    it('should return session data when session is created', async () => {
      mockCreateSession.mockResolvedValue({
        sessionId: 'WS-001-123',
        testId: 'WS-001',
        testName: 'Persistence Test',
        recordingPath: '/tmp/test-recorder/WS-001-123',
        pageState: {
          url: 'https://example.com',
          title: 'Example',
          accessibilityTree: '- WebArea "Example"',
        },
      });

      const cli = new RecorderCLI();
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await cli.handleCommand('create', ['--id', 'WS-001', '--name', 'Persistence Test']);

      expect(mockCreateSession).toHaveBeenCalledWith({
        testId: 'WS-001',
        testName: 'Persistence Test',
      });

      const output = logSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.sessionId).toBe('WS-001-123');
      expect(parsed.pageState).toBeDefined();

      logSpy.mockRestore();
      errSpy.mockRestore();
    });
  });

  describe('addStep — CDP reconnection', () => {
    it('should delegate to API addStep and output result', async () => {
      mockAddStep.mockResolvedValue({
        sessionId: 'WS-001-123',
        stepNumber: 2,
        description: 'Click submit button',
        success: true,
        result: 'Button clicked',
        beforeScreenshot: '/tmp/steps/002/before.png',
        afterScreenshot: '/tmp/steps/002/after.png',
        pageState: {
          url: 'https://example.com/dashboard',
          title: 'Dashboard',
          accessibilityTree: '- WebArea "Dashboard"',
        },
      });

      const cli = new RecorderCLI();
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await cli.handleCommand('add-step', [
        '--session', 'WS-001-123',
        '--step', 'Click submit button',
      ]);

      expect(mockAddStep).toHaveBeenCalledWith({
        sessionId: 'WS-001-123',
        stepDescription: 'Click submit button',
      });

      const output = logSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
      expect(parsed.stepNumber).toBe(2);

      logSpy.mockRestore();
      errSpy.mockRestore();
    });

    it('should include errorDetails when step fails', async () => {
      mockAddStep.mockResolvedValue({
        sessionId: 'WS-001-123',
        stepNumber: 3,
        description: 'Click missing button',
        success: false,
        result: 'Element not found',
        beforeScreenshot: '/tmp/steps/003/before.png',
        afterScreenshot: '/tmp/steps/003/after.png',
        errorDetails: {
          failedAction: 'click',
          reason: 'Element not found',
          availableElements: ["button 'Submit'", "link 'Home'"],
        },
      });

      const cli = new RecorderCLI();
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await cli.handleCommand('add-step', [
        '--session', 'WS-001-123',
        '--step', 'Click missing button',
      ]);

      const output = logSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(false);
      expect(parsed.errorDetails).toBeDefined();
      expect(parsed.errorDetails.failedAction).toBe('click');
      expect(parsed.errorDetails.availableElements).toHaveLength(2);

      logSpy.mockRestore();
      errSpy.mockRestore();
    });
  });

  describe('close-browser command', () => {
    it('should route to closePersistentBrowser and output result', async () => {
      mockClosePersistentBrowser.mockResolvedValue(undefined);

      const cli = new RecorderCLI();
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await cli.handleCommand('close-browser', ['--session', 'WS-001-123']);

      expect(mockClosePersistentBrowser).toHaveBeenCalledWith('WS-001-123');

      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('Closing persistent browser')
      );
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('Browser closed successfully')
      );

      const output = logSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.sessionId).toBe('WS-001-123');
      expect(parsed.browserClosed).toBe(true);

      logSpy.mockRestore();
      errSpy.mockRestore();
    });

    it('should require --session flag', async () => {
      const cli = new RecorderCLI();

      await expect(
        cli.handleCommand('close-browser', [])
      ).rejects.toThrow('Required flag: --session');
    });
  });
});

// ============================================================================
// SECTION 4: BrowserManager — disconnect vs cleanup distinction
// ============================================================================
describe('BrowserManager — disconnect vs cleanup', () => {
  let manager: BrowserManager;
  const defaultConfig = {
    browser: {
      type: 'chromium' as const,
      headless: false,
      viewport: { width: 1280, height: 720 },
      timeout: 30000,
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    manager = new BrowserManager(defaultConfig);

    const mockPage = createMockPage();
    const mockCtx = createMockContext([mockPage]);
    const mockBrowser = createMockBrowser([mockCtx]);
    (chromium.connectOverCDP as jest.Mock).mockResolvedValue(mockBrowser);

    await manager.launchPersistent();
  });

  it('disconnect() SHOULD call browser.close() for CDP (disconnect only, Chrome stays)', async () => {
    await manager.disconnect();

    // For CDP-connected browsers, browser.close() disconnects the Playwright
    // client without killing Chrome
    expect(mockBrowserClose).toHaveBeenCalledTimes(1);
    expect(manager.isInitialized()).toBe(false);
  });

  it('cleanup() SHOULD call browser.close()', async () => {
    await manager.cleanup();

    expect(mockBrowserClose).toHaveBeenCalledTimes(1);
    expect(manager.isInitialized()).toBe(false);
  });

  it('closeBrowser() SHOULD call browser.close()', async () => {
    await manager.closeBrowser();

    expect(mockBrowserClose).toHaveBeenCalledTimes(1);
    expect(manager.isInitialized()).toBe(false);
  });

  it('cleanup() should also kill the Chrome child process', async () => {
    await manager.cleanup();

    // The spawned process should be killed during cleanup
    const mockProc = (spawn as jest.Mock).mock.results[0].value;
    expect(mockProc.kill).toHaveBeenCalled();
  });
});

// ============================================================================
// SECTION 5: RecorderAPI — reconnectOrLaunch logic (state-level)
// ============================================================================
describe('RecorderAPI — reconnectOrLaunch behavior', () => {
  let tempDir: string;
  let recorderBaseDir: string;

  jest.mock('../../../framework/utils/directory-manager', () => ({
    DirectoryManager: {
      cleanupRecorderDirectory: jest.fn().mockResolvedValue(undefined),
    },
  }));

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `reconnect-test-${Date.now()}`);
    recorderBaseDir = path.join(tempDir, 'test-recorder');
    await fs.mkdir(recorderBaseDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('session state WITH browserWsEndpoint should be loadable', async () => {
    const sessionId = 'RECONNECT-001-123';
    const sessionDir = path.join(recorderBaseDir, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });

    const state: RecorderSessionState = {
      sessionId,
      testData: { id: 'RECONNECT-001', name: 'Reconnect Test' },
      createdAt: new Date().toISOString(),
      status: 'in-progress',
      stepCount: 1,
      steps: [],
      browserWsEndpoint: 'ws://127.0.0.1:9222/devtools/browser/reconnect',
    };

    await fs.writeFile(
      path.join(sessionDir, 'session-state.json'),
      JSON.stringify(state, null, 2)
    );

    const loaded = await TestRecorder.loadState(sessionId, recorderBaseDir);

    expect(loaded).not.toBeNull();
    expect(loaded!.browserWsEndpoint).toBe('ws://127.0.0.1:9222/devtools/browser/reconnect');
  });

  it('session state WITHOUT browserWsEndpoint should be loadable', async () => {
    const sessionId = 'RECONNECT-002-456';
    const sessionDir = path.join(recorderBaseDir, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });

    const state: RecorderSessionState = {
      sessionId,
      testData: { id: 'RECONNECT-002', name: 'No WS Test' },
      createdAt: new Date().toISOString(),
      status: 'in-progress',
      stepCount: 0,
      steps: [],
    };

    await fs.writeFile(
      path.join(sessionDir, 'session-state.json'),
      JSON.stringify(state, null, 2)
    );

    const loaded = await TestRecorder.loadState(sessionId, recorderBaseDir);

    expect(loaded).not.toBeNull();
    expect(loaded!.browserWsEndpoint).toBeUndefined();
  });

  it('should be able to update browserWsEndpoint in existing state file', async () => {
    const sessionId = 'RECONNECT-003-789';
    const sessionDir = path.join(recorderBaseDir, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });
    const statePath = path.join(sessionDir, 'session-state.json');

    const state: RecorderSessionState = {
      sessionId,
      testData: { id: 'RECONNECT-003', name: 'Update WS Test' },
      createdAt: new Date().toISOString(),
      status: 'in-progress',
      stepCount: 0,
      steps: [],
    };

    await fs.writeFile(statePath, JSON.stringify(state, null, 2));

    const content = await fs.readFile(statePath, 'utf8');
    const loaded = JSON.parse(content) as RecorderSessionState;
    loaded.browserWsEndpoint = 'ws://127.0.0.1:9222/devtools/browser/new-endpoint';
    await fs.writeFile(statePath, JSON.stringify(loaded, null, 2));

    const updated = await TestRecorder.loadState(sessionId, recorderBaseDir);
    expect(updated!.browserWsEndpoint).toBe('ws://127.0.0.1:9222/devtools/browser/new-endpoint');
  });

  it('should be able to clear browserWsEndpoint by writing empty string', async () => {
    const sessionId = 'RECONNECT-004-000';
    const sessionDir = path.join(recorderBaseDir, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });
    const statePath = path.join(sessionDir, 'session-state.json');

    const state: RecorderSessionState = {
      sessionId,
      testData: { id: 'RECONNECT-004', name: 'Clear WS Test' },
      createdAt: new Date().toISOString(),
      status: 'in-progress',
      stepCount: 0,
      steps: [],
      browserWsEndpoint: 'ws://127.0.0.1:9222/devtools/browser/to-clear',
    };

    await fs.writeFile(statePath, JSON.stringify(state, null, 2));

    const content = await fs.readFile(statePath, 'utf8');
    const loaded = JSON.parse(content) as RecorderSessionState;
    loaded.browserWsEndpoint = '';
    await fs.writeFile(statePath, JSON.stringify(loaded, null, 2));

    const updated = await TestRecorder.loadState(sessionId, recorderBaseDir);
    expect(updated!.browserWsEndpoint).toBe('');
  });
});

// ============================================================================
// SECTION 6: Edge cases
// ============================================================================
describe('BrowserManager — Edge cases for persistence', () => {
  let manager: BrowserManager;
  const defaultConfig = {
    browser: {
      type: 'chromium' as const,
      headless: false,
      viewport: { width: 1280, height: 720 },
      timeout: 30000,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new BrowserManager(defaultConfig);
  });

  it('getWsEndpoint() after disconnect should still return endpoint (CDP stays)', async () => {
    const mockPage = createMockPage();
    const mockCtx = createMockContext([mockPage]);
    const mockBrowser = createMockBrowser([mockCtx]);

    (chromium.connectOverCDP as jest.Mock).mockResolvedValue(mockBrowser);

    await manager.launchPersistent();
    await manager.disconnect();

    // After disconnect, the cdpEndpoint is preserved (Chrome is still running)
    expect(manager.getWsEndpoint()).toBe(CDP_ENDPOINT);
  });

  it('getPage() after disconnect should throw', async () => {
    const mockPage = createMockPage();
    const mockCtx = createMockContext([mockPage]);
    const mockBrowser = createMockBrowser([mockCtx]);

    (chromium.connectOverCDP as jest.Mock).mockResolvedValue(mockBrowser);

    await manager.launchPersistent();
    await manager.disconnect();

    expect(() => manager.getPage()).toThrow('Browser not initialized');
  });

  it('should be able to reconnect after disconnect', async () => {
    // 1. Launch persistent
    const mockPage1 = createMockPage();
    const mockCtx1 = createMockContext([mockPage1]);
    const mockBrowser1 = createMockBrowser([mockCtx1]);

    (chromium.connectOverCDP as jest.Mock).mockResolvedValue(mockBrowser1);

    await manager.launchPersistent();
    expect(manager.isInitialized()).toBe(true);

    // 2. Disconnect
    await manager.disconnect();
    expect(manager.isInitialized()).toBe(false);

    // 3. Reconnect via CDP
    const reconnectPage = createMockPage();
    const reconnectCtx = createMockContext([reconnectPage]);
    const reconnectBrowser = createMockBrowser([reconnectCtx]);

    (chromium.connectOverCDP as jest.Mock).mockResolvedValue(reconnectBrowser);

    await manager.connectOverCDP('ws://127.0.0.1:9222/devtools/browser/abc123');

    expect(manager.isInitialized()).toBe(true);
    expect(chromium.connectOverCDP).toHaveBeenCalledWith('ws://127.0.0.1:9222/devtools/browser/abc123');
  });

  it('getWsEndpoint() after cleanup should throw (endpoint cleared)', async () => {
    const mockPage = createMockPage();
    const mockCtx = createMockContext([mockPage]);
    const mockBrowser = createMockBrowser([mockCtx]);

    (chromium.connectOverCDP as jest.Mock).mockResolvedValue(mockBrowser);

    await manager.launchPersistent();
    await manager.cleanup();

    expect(() => manager.getWsEndpoint()).toThrow('No CDP endpoint available');
  });
});

/**
 * Recorder API - Programmatic interface for test recording
 * Used by CLI commands and Claude Code skills
 */

import path from 'path';
import fs from 'fs/promises';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { TestRecorder } from './session-recorder.js';
import type { RecorderSessionState } from './session-recorder.js';
import { EnhancedBrowserTestFramework } from '@automation/browser/browser-framework.js';
import type { FrameworkConfig } from '../types/config.js';
import { info, warn } from '@core/logger.js';
import { captureAccessibilityTree } from '@ai/context/accessibility-snapshot-capture.js';
import { serializeTree, extractInteractiveElements } from '@ai/context/accessibility-tree-serializer.js';
import { setupRecorderAgent } from '@ai/recorder-agent-setup.js';
import { createRecorderContext } from '../config/recorder-system-context.js';
import { createAllTools } from '@automation/tools/index.js';

/**
 * Page state captured after an action
 */
export interface PageState {
  url: string;
  title: string;
  accessibilityTree: string;
}

/**
 * Error details for a failed step
 */
export interface ErrorDetails {
  failedAction: string;
  reason: string;
  availableElements: string[];
}

/**
 * Session creation parameters
 */
export interface CreateSessionParams {
  testId: string;
  testName: string;
  testDescription?: string;
  priority?: 'High' | 'Medium' | 'Low';
  tags?: string[];
  url?: string;
  testData?: Record<string, any>;
}

/**
 * Session creation result
 */
export interface CreateSessionResult {
  sessionId: string;
  testId: string;
  testName: string;
  recordingPath: string;
  pageState?: PageState;
}

/**
 * Add step parameters
 */
export interface AddStepParams {
  sessionId: string;
  stepDescription: string;
}

/**
 * Add step result
 */
export interface AddStepResult {
  sessionId: string;
  stepNumber: number;
  description: string;
  success: boolean;
  result: string;
  beforeScreenshot: string;
  afterScreenshot: string;
  pageState?: PageState;
  errorDetails?: ErrorDetails;
}

/**
 * Generate test parameters
 */
export interface GenerateTestParams {
  sessionId: string;
  outputDir?: string;
}

/**
 * Generate test result
 */
export interface GenerateTestResult {
  sessionId: string;
  testFilePath: string;
  htmlReportPath: string;
  totalSteps: number;
  duration: number;
}

/**
 * Session status info
 */
export interface SessionStatusInfo {
  sessionId: string;
  testId: string;
  testName: string;
  createdAt: string;
  stepCount: number;
  status: 'in-progress' | 'completed';
  recordingPath: string;
  testFilePath?: string;
}

/**
 * List sessions result
 */
export interface ListSessionsResult {
  sessions: SessionStatusInfo[];
}

/**
 * Recorder API - Programmatic interface for test recording
 * Used by CLI commands and Claude Code skills
 *
 * Browser Persistence:
 * Each CLI command (create, add-step, generate) runs in a separate OS process.
 * To keep the browser alive across invocations, createSession() launches a
 * persistent browser (with signal handlers disabled) and saves its CDP WebSocket
 * endpoint to the session state file. Subsequent add-step calls reconnect to
 * the same browser via chromium.connectOverCDP(wsEndpoint). The browser is only
 * closed when generateTest() or cleanup() is called.
 */
export class RecorderAPI {
  private framework: EnhancedBrowserTestFramework | null = null;
  private recorder: TestRecorder | null = null;
  private recorderAgent: any = null;
  private recorderBaseDir: string;
  private configOverrides: Partial<FrameworkConfig>;

  /** Stale lock threshold — locks older than this are considered abandoned (5 minutes) */
  private static readonly LOCK_STALE_MS = 5 * 60 * 1000;

  constructor(recorderBaseDir?: string, configOverrides?: Partial<FrameworkConfig>) {
    this.recorderBaseDir = recorderBaseDir || path.join(process.cwd(), 'test-recorder');
    this.configOverrides = configOverrides || {};
  }

  /**
   * Acquire a file-based lock for a session directory.
   * Prevents concurrent CLI commands from corrupting session-state.json.
   * Uses atomic `wx` flag — fails if lock file already exists.
   * Stale locks (older than 5 minutes) are automatically cleaned up.
   */
  private async acquireSessionLock(sessionId: string): Promise<void> {
    const lockPath = path.join(this.recorderBaseDir, sessionId, 'session.lock');

    try {
      await fs.writeFile(lockPath, String(process.pid), { flag: 'wx' });
    } catch (error: any) {
      if (error.code === 'EEXIST') {
        // Check if lock is stale (e.g., process crashed without releasing)
        try {
          const stat = await fs.stat(lockPath);
          const lockAge = Date.now() - stat.mtimeMs;
          if (lockAge > RecorderAPI.LOCK_STALE_MS) {
            warn('Removing stale session lock', { sessionId, lockAgeMs: lockAge }, 'RecorderAPI');
            await fs.unlink(lockPath).catch(() => {});
            await fs.writeFile(lockPath, String(process.pid), { flag: 'wx' });
            return;
          }
        } catch {
          // stat failed — lock file disappeared between EEXIST and stat
        }
        throw new Error(`Session ${sessionId} is locked by another process. Please wait and try again.`);
      }
      // ENOENT means the session directory doesn't exist yet (e.g., createSession)
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Release the session lock file. Best-effort — ignores errors.
   */
  private async releaseSessionLock(sessionId: string): Promise<void> {
    const lockPath = path.join(this.recorderBaseDir, sessionId, 'session.lock');
    await fs.unlink(lockPath).catch(() => {});
  }

  /**
   * Create the lightweight recorder agent (lazily, once per session).
   * Uses the same 26 browser tools but a simple prompt — no test execution logic.
   */
  private async ensureRecorderAgent(): Promise<any> {
    if (this.recorderAgent) return this.recorderAgent;
    if (!this.framework) throw new Error('Framework not initialized');

    const tools = createAllTools(this.framework);
    this.recorderAgent = await setupRecorderAgent(tools, {
      getPage: () => {
        const bm = this.framework?.getBrowserManager();
        return bm ? bm.getPage() : null;
      },
    });
    return this.recorderAgent;
  }

  /**
   * Execute a command using the recorder's own lightweight agent.
   * Returns { status, result } matching the shape used by createSession/addStep.
   *
   * Uses SystemMessage (rules) + HumanMessage (command) pair so that Gemini
   * activates tool calling mode. Validates that at least one tool was called
   * before reporting SUCCESS — prevents false positives from narration.
   */
  private async executeRecorderCommand(command: string): Promise<{ status: 'SUCCESS' | 'FAILED'; result: string }> {
    const agent = await this.ensureRecorderAgent();
    const ctx = createRecorderContext(command);

    try {
      const finalState = await agent.invoke({
        messages: [
          new SystemMessage(ctx.systemPrompt),
          new HumanMessage(ctx.command),
        ],
      });

      const messages: BaseMessage[] = finalState.messages || [];
      const lastMessage = messages[messages.length - 1];
      const result = typeof lastMessage?.content === 'string'
        ? lastMessage.content
        : 'Command executed';

      // Validate that tools were actually called — prevents false SUCCESS
      // when models narrate actions in text instead of invoking tools
      const toolMessages = messages.filter(
        (m: BaseMessage) => m._getType() === 'tool'
      );
      const hasToolCalls = toolMessages.length > 0;

      if (!hasToolCalls) {
        warn(
          `[Recorder] No tools were called for command: "${command}". Agent response: "${result.substring(0, 120)}"`,
          { command },
          'RecorderAPI'
        );
        return {
          status: 'FAILED',
          result: `No tools were called — command was not executed. Agent response: ${result.substring(0, 200)}`,
        };
      }

      return { status: 'SUCCESS', result };
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      info(`Recorder command failed: ${message}`, { command, error: message }, 'RecorderAPI');
      return { status: 'FAILED', result: `Command failed: ${message}` };
    }
  }

  /**
   * Build framework config for recording, merging any overrides.
   * Browser defaults (type, viewport, timeout) can be overridden,
   * but headless is always forced to false for recording.
   * Browser type is always forced to 'chromium' for CDP support.
   */
  private buildRecorderConfig(): Partial<FrameworkConfig> {
    return {
      ...this.configOverrides,
      browser: {
        type: 'chromium', // CDP requires Chromium
        viewport: { width: 1280, height: 720 },
        timeout: 30000,
        ...this.configOverrides.browser,
        headless: false, // Always visible for recording
      },
    };
  }

  /**
   * Create a new recording session.
   * Launches a persistent browser that survives process exit and saves
   * the CDP WebSocket endpoint to the session state for reconnection.
   */
  async createSession(params: CreateSessionParams): Promise<CreateSessionResult> {
    const {
      testId,
      testName,
      testDescription = '',
      priority = 'Medium',
      tags = [],
      url = process.env.BASE_URL || 'https://qafromla.herokuapp.com/',
      testData = {},
    } = params;

    info('Creating recording session with persistent browser', { testId, testName }, 'RecorderAPI');

    // Initialize framework with persistent browser
    if (!this.framework) {
      this.framework = new EnhancedBrowserTestFramework(this.buildRecorderConfig());
    }

    const wsEndpoint = await this.framework.initializePersistent({ skipAgent: true });
    info('Persistent browser launched', { wsEndpoint }, 'RecorderAPI');

    // Create test recorder
    const testDataObj = {
      id: testId,
      name: testName,
      description: testDescription,
      priority,
      tags,
      site: url,
      testData,
    };

    this.recorder = new TestRecorder(this.framework, testDataObj, this.recorderBaseDir);

    // Start recording
    const sessionId = await this.recorder.startRecording();

    // Navigate to URL using the recorder's own lightweight agent
    const navResult = await this.executeRecorderCommand(`Navigate to ${url}`);

    // Record navigation step
    await this.recorder.recordStep(
      `Navigate to ${url}`,
      'navigate',
      { url },
      navResult.result || 'Navigation completed'
    );

    // Save initial state with browser WebSocket endpoint for reconnection
    await this.recorder.saveState(wsEndpoint);

    const recordingPath = path.join(this.recorderBaseDir, sessionId);

    // Capture page state after navigation
    const pageState = await this.capturePageState();

    info('Recording session created with persistent browser', { sessionId, recordingPath, wsEndpoint }, 'RecorderAPI');

    // Disconnect from the browser without closing it — browser stays alive
    await this.framework.disconnect();
    this.framework = null;
    this.recorderAgent = null;

    return {
      sessionId,
      testId,
      testName,
      recordingPath,
      ...(pageState ? { pageState } : {}),
    };
  }

  /**
   * Add a step to an existing recording session.
   * Reconnects to the persistent browser via CDP WebSocket endpoint
   * stored in the session state. Falls back to a fresh browser if
   * the persistent browser has crashed.
   */
  async addStep(params: AddStepParams): Promise<AddStepResult> {
    const { sessionId, stepDescription } = params;

    info('Adding step to session', { sessionId, stepDescription }, 'RecorderAPI');

    // Acquire session lock — prevents concurrent CLI commands from corrupting state
    await this.acquireSessionLock(sessionId);

    try {
      // Load session state
      const state = await TestRecorder.loadState(sessionId, this.recorderBaseDir);
      if (!state) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      if (state.status === 'completed') {
        throw new Error(`Session already completed: ${sessionId}`);
      }

      // Reconnect to persistent browser or fall back to fresh browser
      if (!this.framework) {
        this.framework = new EnhancedBrowserTestFramework(this.buildRecorderConfig());
        await this.reconnectOrLaunch(state);
      }

      if (!this.recorder) {
        this.recorder = new TestRecorder(this.framework, state.testData, this.recorderBaseDir);
        await this.recorder.loadFromState(sessionId);
      }

      // Execute step using the recorder's own lightweight agent
      const stepResult = await this.executeRecorderCommand(stepDescription);

      // Record step
      await this.recorder.recordStep(
        stepDescription,
        'recorder-agent',
        { command: stepDescription },
        stepResult.result || 'Step completed'
      );

      // Get current WS endpoint (may have changed if we launched a fresh browser)
      const currentWsEndpoint = this.getCurrentWsEndpoint();

      // Save updated state with current WS endpoint
      await this.recorder.saveState(currentWsEndpoint);

      const stepNumber = state.stepCount + 1;
      const stepFolderName = `${String(stepNumber).padStart(3, '0')}-${this.sanitizeFileName(stepDescription)}`;
      const stepPath = path.join(this.recorderBaseDir, sessionId, 'steps', stepFolderName);

      // Capture page state after step execution
      const pageState = await this.capturePageState();

      const success = stepResult.status === 'SUCCESS';

      // Build error details on failure
      let errorDetails: ErrorDetails | undefined;
      if (!success && pageState) {
        errorDetails = {
          failedAction: this.inferActionType(stepDescription),
          reason: stepResult.result || 'Step failed',
          availableElements: await this.getAvailableElements(),
        };
      }

      info('Step added successfully', { sessionId, stepNumber, success }, 'RecorderAPI');

      // Disconnect from the browser without closing it — browser stays alive
      await this.framework.disconnect();
      this.framework = null;
      this.recorder = null;
      this.recorderAgent = null;

      return {
        sessionId,
        stepNumber,
        description: stepDescription,
        success,
        result: stepResult.result || '',
        beforeScreenshot: path.join(stepPath, 'before.png'),
        afterScreenshot: path.join(stepPath, 'after.png'),
        ...(pageState ? { pageState } : {}),
        ...(errorDetails ? { errorDetails } : {}),
      };
    } finally {
      await this.releaseSessionLock(sessionId);
    }
  }

  /**
   * Generate test file from recording session.
   * Reconnects to the persistent browser, generates the test,
   * then closes the browser permanently.
   */
  async generateTest(params: GenerateTestParams): Promise<GenerateTestResult> {
    const { sessionId, outputDir = 'tests' } = params;

    info('Generating test from session', { sessionId, outputDir }, 'RecorderAPI');

    // Acquire session lock — prevents concurrent modifications
    await this.acquireSessionLock(sessionId);

    try {
      // Load session state
      const state = await TestRecorder.loadState(sessionId, this.recorderBaseDir);
      if (!state) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Initialize framework — reconnect to persistent browser or launch fresh
      if (!this.framework) {
        this.framework = new EnhancedBrowserTestFramework(this.buildRecorderConfig());
        await this.reconnectOrLaunch(state);
      }

      if (!this.recorder) {
        this.recorder = new TestRecorder(this.framework, state.testData, this.recorderBaseDir);
        await this.recorder.loadFromState(sessionId);
      }

      // Stop recording (generates files)
      const recordingResult = await this.recorder.stopRecording();

      if (!recordingResult) {
        throw new Error('Failed to generate recording result');
      }

      // Copy test file to output directory
      const outputDirPath = path.resolve(process.cwd(), outputDir);
      await fs.mkdir(outputDirPath, { recursive: true });

      const testFileName = `${state.testData.id!.toLowerCase()}-recorded-test.ts`;
      const sourcePath = recordingResult.testFilePath;
      const destPath = path.join(outputDirPath, testFileName);

      await fs.copyFile(sourcePath, destPath);

      // Update state to completed
      await this.recorder.updateStateStatus('completed');

      // Full cleanup — close the persistent browser
      await this.cleanup();

      info('Test generated successfully', { testFilePath: destPath }, 'RecorderAPI');

      return {
        sessionId,
        testFilePath: destPath,
        htmlReportPath: path.join(this.recorderBaseDir, sessionId, 'recording-report.html'),
        totalSteps: recordingResult.steps,
        duration: recordingResult.duration,
      };
    } finally {
      await this.releaseSessionLock(sessionId);
    }
  }

  /**
   * List all recording sessions
   */
  async listSessions(): Promise<ListSessionsResult> {
    info('Listing recording sessions', {}, 'RecorderAPI');

    const sessions: SessionStatusInfo[] = [];

    // Read all session directories
    try {
      const entries = await fs.readdir(this.recorderBaseDir, { withFileTypes: true });
      const sessionDirs = entries.filter((e) => e.isDirectory());

      for (const dir of sessionDirs) {
        const sessionId = dir.name;
        const statePath = path.join(this.recorderBaseDir, sessionId, 'session-state.json');

        try {
          const stateContent = await fs.readFile(statePath, 'utf8');
          const state = JSON.parse(stateContent) as RecorderSessionState;

          const statusInfo: SessionStatusInfo = {
            sessionId: state.sessionId,
            testId: state.testData.id || 'UNKNOWN',
            testName: state.testData.name || 'Unknown Test',
            createdAt: state.createdAt,
            stepCount: state.stepCount,
            status: state.status,
            recordingPath: path.join(this.recorderBaseDir, sessionId),
          };
          if (state.testFilePath) {
            statusInfo.testFilePath = state.testFilePath;
          }
          sessions.push(statusInfo);
        } catch {
          // Skip invalid session directories
          continue;
        }
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Directory doesn't exist yet
        return { sessions: [] };
      }
      throw error;
    }

    // Sort by creation time (newest first)
    sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    info('Found sessions', { count: sessions.length }, 'RecorderAPI');

    return { sessions };
  }

  /**
   * Get status of a specific session
   */
  async getSessionStatus(sessionId: string): Promise<SessionStatusInfo> {
    info('Getting session status', { sessionId }, 'RecorderAPI');

    const state = await TestRecorder.loadState(sessionId, this.recorderBaseDir);
    if (!state) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const statusInfo: SessionStatusInfo = {
      sessionId: state.sessionId,
      testId: state.testData.id || 'UNKNOWN',
      testName: state.testData.name || 'Unknown Test',
      createdAt: state.createdAt,
      stepCount: state.stepCount,
      status: state.status,
      recordingPath: path.join(this.recorderBaseDir, sessionId),
    };
    if (state.testFilePath) {
      statusInfo.testFilePath = state.testFilePath;
    }
    return statusInfo;
  }

  /**
   * Cleanup resources — closes the persistent browser.
   * Called by generateTest() or explicitly by the caller.
   */
  async cleanup(): Promise<void> {
    if (this.framework) {
      await this.framework.cleanup();
      this.framework = null;
    }
    this.recorder = null;
    this.recorderAgent = null;
  }

  /**
   * Close the persistent browser for a given session.
   * Used when a recording session is abandoned or needs manual cleanup.
   */
  async closePersistentBrowser(sessionId: string): Promise<void> {
    info('Closing persistent browser for session', { sessionId }, 'RecorderAPI');

    // Acquire session lock — prevents concurrent modifications
    await this.acquireSessionLock(sessionId);

    try {
      const state = await TestRecorder.loadState(sessionId, this.recorderBaseDir);
      if (!state) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      if (!state.browserWsEndpoint) {
        info('No persistent browser endpoint found for session', { sessionId }, 'RecorderAPI');
        return;
      }

      try {
        const framework = new EnhancedBrowserTestFramework(this.buildRecorderConfig());
        await framework.initializeWithCDP(state.browserWsEndpoint, { skipAgent: true });
        await framework.cleanup();
        info('Persistent browser closed for session', { sessionId }, 'RecorderAPI');
      } catch (error: any) {
        info('Browser may already be closed', { sessionId, error: error.message }, 'RecorderAPI');
      }

      // Clear the endpoint from session state
      await this.updateSessionWsEndpoint(sessionId, '');
    } finally {
      await this.releaseSessionLock(sessionId);
    }
  }

  /**
   * Reconnect to the persistent browser stored in session state,
   * or launch a fresh persistent browser if the stored browser is unreachable.
   * This handles the case where the browser crashes between CLI invocations.
   */
  private async reconnectOrLaunch(state: RecorderSessionState): Promise<void> {
    if (!this.framework) {
      throw new Error('Framework not initialized');
    }

    if (state.browserWsEndpoint) {
      try {
        info('Attempting CDP reconnection to persistent browser', { wsEndpoint: state.browserWsEndpoint }, 'RecorderAPI');
        await this.framework.initializeWithCDP(state.browserWsEndpoint, { skipAgent: true });
        info('Successfully reconnected to persistent browser', {}, 'RecorderAPI');
        return;
      } catch (error: any) {
        info('CDP reconnection failed, browser may have crashed. Launching fresh browser.', { error: error.message }, 'RecorderAPI');
        // Fall through to launch fresh browser
      }
    } else {
      info('No saved browser endpoint found. Launching fresh persistent browser.', {}, 'RecorderAPI');
    }

    // Launch a fresh persistent browser as fallback
    const wsEndpoint = await this.framework.initializePersistent({ skipAgent: true });
    info('Fresh persistent browser launched', { wsEndpoint }, 'RecorderAPI');

    // Update the session state with the new endpoint
    await this.updateSessionWsEndpoint(state.sessionId, wsEndpoint);
  }

  /**
   * Update the WebSocket endpoint in an existing session state file.
   */
  private async updateSessionWsEndpoint(sessionId: string, wsEndpoint: string): Promise<void> {
    const statePath = path.join(this.recorderBaseDir, sessionId, 'session-state.json');
    try {
      const stateContent = await fs.readFile(statePath, 'utf8');
      const state = JSON.parse(stateContent) as RecorderSessionState;
      state.browserWsEndpoint = wsEndpoint;
      await fs.writeFile(statePath, JSON.stringify(state, null, 2));
    } catch {
      // Non-critical — state will be updated on next saveState() call
      info('Could not update session state with new WS endpoint', { sessionId }, 'RecorderAPI');
    }
  }

  /**
   * Get the current browser's WebSocket endpoint, or undefined if unavailable.
   */
  private getCurrentWsEndpoint(): string | undefined {
    try {
      const browserManager = this.framework?.getBrowserManager();
      if (!browserManager) return undefined;
      return browserManager.getWsEndpoint();
    } catch {
      return undefined;
    }
  }

  /**
   * Capture current page state (URL, title, accessibility tree)
   */
  private async capturePageState(): Promise<PageState | null> {
    try {
      const browserManager = this.framework?.getBrowserManager();
      if (!browserManager) return null;

      const page = browserManager.getPage();
      if (!page) return null;

      const url = page.url();
      const title = await page.title();

      // Capture accessibility tree
      const tree = await captureAccessibilityTree(page);
      let accessibilityTree = '';

      if (tree) {
        const fullTree = serializeTree(tree);
        // Use full tree for small pages, interactive summary for large pages
        if (fullTree.length <= 3000) {
          accessibilityTree = fullTree;
        } else {
          // Extract interactive elements for compact representation
          const elements = extractInteractiveElements(tree);
          const lines: string[] = [`- WebArea "${title}"`];
          for (const el of elements) {
            let line = `  - ${el.role}`;
            if (el.name) line += ` "${el.name}"`;
            if (el.value !== undefined) line += ` (value: "${el.value}")`;
            if (el.disabled) line += ' [disabled]';
            if (el.checked === true) line += ' [checked]';
            lines.push(line);
          }
          accessibilityTree = lines.join('\n');
          // Hard cap at 2000 chars
          if (accessibilityTree.length > 2000) {
            accessibilityTree = `${accessibilityTree.substring(0, 1997)}...`;
          }
        }
      }

      return { url, title, accessibilityTree };
    } catch {
      return null;
    }
  }

  /**
   * Get available interactive elements as formatted strings
   */
  private async getAvailableElements(): Promise<string[]> {
    try {
      const browserManager = this.framework?.getBrowserManager();
      if (!browserManager) return [];

      const page = browserManager.getPage();
      if (!page) return [];

      const tree = await captureAccessibilityTree(page);
      if (!tree) return [];

      const elements = extractInteractiveElements(tree);
      return elements.map((el) => {
        let desc = `${el.role}`;
        if (el.name) desc += ` '${el.name}'`;
        if (el.value !== undefined) desc += ` (value: '${el.value}')`;
        return desc;
      });
    } catch {
      return [];
    }
  }

  /**
   * Infer the action type from a step description
   */
  private inferActionType(description: string): string {
    const lower = description.toLowerCase();
    if (lower.includes('click') || lower.includes('press') || lower.includes('tap')) return 'click';
    if (lower.includes('fill') || lower.includes('type') || lower.includes('enter') || lower.includes('input')) return 'fill';
    if (lower.includes('navigate') || lower.includes('go to') || lower.includes('open')) return 'navigate';
    if (lower.includes('verify') || lower.includes('check') || lower.includes('assert') || lower.includes('confirm')) return 'verify';
    if (lower.includes('select') || lower.includes('choose')) return 'select';
    if (lower.includes('hover')) return 'hover';
    if (lower.includes('scroll')) return 'scroll';
    if (lower.includes('wait')) return 'wait';
    if (lower.includes('drag')) return 'drag';
    if (lower.includes('upload')) return 'upload';
    return 'unknown';
  }

  /**
   * Sanitize filename for safe usage
   */
  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }
}

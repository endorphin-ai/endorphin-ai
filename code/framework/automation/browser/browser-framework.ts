/**
 * Enhanced Browser Test Framework - Core Framework Class (TypeScript)
 * Re-export and backward compatibility layer
 */

import { BrowserEngine } from '../engines/browser-engine.js';
import { FrameworkManager } from '../../managers/system/framework-manager.js';
import { info, logSuccess, logWithIcon, LogLevel } from '../../core/logger.js';
import type {
  FrameworkConfig,
  TaskResult,
  TestConfig,
  TestReport,
  TestSession,
} from '../../types/index.js';

/**
 * Enhanced Browser Test Framework - Core Framework Class
 * Provides backward compatibility while using the new modular architecture
 */
export class EnhancedBrowserTestFramework {
  private frameworkManager: FrameworkManager;
  private browserEngine: BrowserEngine | null = null;
  private _overridePage: import('playwright').Page | null = null;

  constructor(config: Partial<FrameworkConfig> = {}) {
    this.frameworkManager = new FrameworkManager(config);
  }

  /**
   * Initialize framework
   */
  async initialize(): Promise<void> {
    // Only initialize if not already initialized
    if (this.browserEngine) {
      info('Framework already initialized, reusing existing instance', {}, 'EnhancedBrowserTestFramework');
      return;
    }

    logWithIcon(LogLevel.INFO, 'rocket', 'Initializing Enhanced Browser Test Framework', {}, 'EnhancedBrowserTestFramework');

    // Create and initialize browser engine
    this.browserEngine = this.frameworkManager.createBrowserEngine(this);
    await this.browserEngine.initialize();

    logSuccess('Framework initialized successfully', {}, 'EnhancedBrowserTestFramework');
  }

  /**
   * Run a single task
   */
  async runTask(taskDescription: string, testName: string | null = null): Promise<TaskResult> {
    if (!this.browserEngine) {
      throw new Error('Framework not initialized. Call initialize() first.');
    }
    return await this.browserEngine.runTask(taskDescription, testName);
  }

  /**
   * Run multiple tasks
   */
  async runMultipleTasks(
    tasks: Array<{ name?: string; description: string }>
  ): Promise<TaskResult[]> {
    if (!this.browserEngine) {
      throw new Error('Framework not initialized. Call initialize() first.');
    }

    logWithIcon(LogLevel.INFO, 'rocket', `Running ${tasks.length} tasks sequentially`, { taskCount: tasks.length }, 'EnhancedBrowserTestFramework');

    const results: TaskResult[] = [];
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const taskName = task.name || `Task-${i + 1}`;

      const result = await this.browserEngine.runTask(task.description, taskName);
      results.push(result);

      // Add delay between tasks
      if (i < tasks.length - 1) {
        info('Waiting before next task', { currentTask: i + 1, totalTasks: tasks.length }, 'EnhancedBrowserTestFramework');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Run a single test
   */
  async runSingleTest(
    test: TestConfig
  ): Promise<{ success: boolean; session?: any; error?: string }> {
    if (!this.browserEngine) {
      throw new Error('Framework not initialized. Call initialize() first.');
    }
    return await this.browserEngine.runSingleTest(test);
  }

  /**
   * Run multiple tests
   */
  async runMultipleTests(tests: TestConfig[]): Promise<{
    results: Array<{
      testId: string;
      testName: string;
      success: boolean;
      error?: string;
      session?: any;
    }>;
    report: TestReport;
  }> {
    if (!this.browserEngine) {
      throw new Error('Framework not initialized. Call initialize() first.');
    }

    logWithIcon(LogLevel.INFO, 'target', `Running ${tests.length} tests with enhanced result tracking`, { testCount: tests.length }, 'EnhancedBrowserTestFramework');
    const results: Array<{
      testId: string;
      testName: string;
      success: boolean;
      error?: string;
      session?: any;
    }> = [];

    for (const test of tests) {
      const result = await this.browserEngine.runSingleTest(test);
      results.push({
        testId: test.id,
        testName: test.name,
        ...result,
      });

      // Brief pause between tests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Use framework manager for report generation only
    return await this.frameworkManager.generateTestReport(results);
  }

  /**
   * Enable interactive mode
   */
  async enableInteractiveMode(): Promise<void> {
    await this.frameworkManager.enableInteractiveMode();
    if (this.browserEngine) {
      await this.browserEngine.enableInteractiveMode();
    }
  }

  /**
   * Disable interactive mode
   */
  disableInteractiveMode(): void {
    this.frameworkManager.disableInteractiveMode();
    if (this.browserEngine) {
      this.browserEngine.disableInteractiveMode();
    }
  }

  /**
   * Set interactive mode
   */
  setInteractiveMode(interactive: boolean): void {
    this.frameworkManager.setInteractiveMode(interactive);
    if (this.browserEngine) {
      this.browserEngine.setInteractiveMode(interactive);
    }
  }

  /**
   * Cleanup framework resources
   */
  async cleanup(): Promise<void> {
    if (this.browserEngine) {
      await this.browserEngine.cleanup();
      this.browserEngine = null;
    }
  }

  /**
   * Initialize framework with a persistent browser (survives process exit).
   * Returns the CDP WebSocket endpoint for reconnection.
   * Used by the recorder flow only.
   *
   * @param options.skipAgent - If true, skip creating the test execution agent.
   *   The recorder has its own agent and doesn't need the test agent.
   */
  async initializePersistent(options?: { skipAgent?: boolean }): Promise<string> {
    if (this.browserEngine) {
      info('Framework already initialized, returning existing endpoint', {}, 'EnhancedBrowserTestFramework');
      const bm = this.browserEngine.getBrowserManager();
      return bm.getWsEndpoint();
    }

    logWithIcon(LogLevel.INFO, 'rocket', 'Initializing Framework with persistent browser', {}, 'EnhancedBrowserTestFramework');

    this.browserEngine = this.frameworkManager.createBrowserEngine(this);
    await this.browserEngine.initializePersistent(options);

    const wsEndpoint = this.browserEngine.getBrowserManager().getWsEndpoint();
    logSuccess('Framework initialized with persistent browser', { wsEndpoint }, 'EnhancedBrowserTestFramework');

    return wsEndpoint;
  }

  /**
   * Initialize framework by connecting to an existing browser via CDP.
   * Used by the recorder to reconnect across CLI invocations.
   *
   * @param wsEndpoint - CDP WebSocket endpoint to connect to
   * @param options.skipAgent - If true, skip creating the test execution agent.
   *   The recorder has its own agent and doesn't need the test agent.
   */
  async initializeWithCDP(wsEndpoint: string, options?: { skipAgent?: boolean }): Promise<void> {
    if (this.browserEngine) {
      info('Framework already initialized, skipping CDP reconnect', {}, 'EnhancedBrowserTestFramework');
      return;
    }

    logWithIcon(LogLevel.INFO, 'rocket', 'Initializing Framework with CDP connection', { wsEndpoint }, 'EnhancedBrowserTestFramework');

    this.browserEngine = this.frameworkManager.createBrowserEngine(this);
    await this.browserEngine.initializeWithCDP(wsEndpoint, options);

    logSuccess('Framework initialized with CDP connection', {}, 'EnhancedBrowserTestFramework');
  }

  /**
   * Disconnect from the browser without closing it.
   * The browser process continues running for future reconnection.
   * Used by the recorder between CLI invocations.
   */
  async disconnect(): Promise<void> {
    if (this.browserEngine) {
      await this.browserEngine.disconnect();
      this.browserEngine = null;
    }
  }

  // Getters for backward compatibility
  get currentPage() {
    return this._overridePage || this.browserEngine?.currentPage || null;
  }

  /**
   * Override the current page (used by tab management tool)
   * Pass null to clear the override and revert to the default page
   */
  setCurrentPage(page: import('playwright').Page | null): void {
    this._overridePage = page;
  }

  get currentBrowser() {
    return this.browserEngine?.currentBrowser || null;
  }

  get currentContext() {
    return this.browserEngine?.currentContext || null;
  }

  get activeTestSession(): TestSession | null {
    return this.browserEngine?.activeTestSession || null;
  }

  get frameworkConfig(): FrameworkConfig {
    return this.frameworkManager.getConfig();
  }

  getBrowserManager() {
    return this.browserEngine?.getBrowserManager() || null;
  }

  getSnapshotManager() {
    return this.browserEngine?.getSnapshotManager() || null;
  }

  // Framework manager methods
  getFrameworkManager(): FrameworkManager {
    return this.frameworkManager;
  }

  getBrowserEngine(): BrowserEngine | null {
    return this.browserEngine;
  }

  getConfig(): FrameworkConfig {
    return this.frameworkManager.getConfig();
  }

  updateConfig(updates: Partial<FrameworkConfig>): void {
    this.frameworkManager.updateConfig(updates);
  }

  validateConfig(): { isValid: boolean; errors: string[] } {
    return this.frameworkManager.validateConfig();
  }

  getStatistics() {
    return this.frameworkManager.getStatistics();
  }

  getDirectories() {
    return this.frameworkManager.getDirectories();
  }

  // Delegator methods for tools compatibility
  logTestStep(
    stepDescription: string,
    toolName: string | null = null,
    toolArgs: any = null,
    result: string | null = null,
    isSuccess: boolean = true,
    screenshots: string[] = []
  ): void {
    if (this.browserEngine) {
      this.browserEngine.logTestStep(stepDescription, toolName, toolArgs, result, isSuccess, screenshots);
    }
  }

  async takeStepScreenshot(description: string | null = null, fullPage: boolean = true): Promise<string | null> {
    if (this.browserEngine) {
      return await this.browserEngine.takeStepScreenshot(description, fullPage);
    }
    return null;
  }

  async createTestSession(testName: string, testId: string | null = null) {
    if (this.browserEngine) {
      return await this.browserEngine.createTestSession(testName, testId);
    }
    return null;
  }

  // 🤖 Failure Data Collection for AI Recommendations
  private failureData: Array<{
    type: string;
    selector?: string;
    state?: string;
    error: string;
    stepDescription?: string;
    pageSnapshot?: {
      url: string;
      title: string;
      html: string;
      visibleText: string;
    } | undefined;
    alternatives?: Array<{
      selector: string;
      element: string;
      text: string;
      confidence: number;
    }>;
    screenshot?: string;
    timestamp: string;
  }> = [];

  /**
   * Collect failure data for post-test AI analysis
   */
  collectFailureData(failureInfo: {
    type: string;
    selector?: string;
    state?: string;
    error: string;
    stepDescription?: string;
    pageSnapshot?: {
      url: string;
      title: string;
      html: string;
      visibleText: string;
    } | undefined;
    alternatives?: any[];
    screenshot?: string;
    timestamp: string;
  }): void {
    this.failureData.push(failureInfo);
  }

  /**
   * Capture current page snapshot for failure analysis
   */
  async capturePageSnapshot(): Promise<{
    url: string;
    title: string;
    html: string;
    visibleText: string;
  } | null> {
    if (!this.currentPage) {
      return null;
    }

    try {
      const url = this.currentPage.url();
      const title = await this.currentPage.title();
      
      // Get full HTML content
      const html = await this.currentPage.content();
      
      // Get visible text content
      const visibleText = await this.currentPage.evaluate(() => {
        return document.body.innerText || document.body.textContent || '';
      });

      return { url, title, html, visibleText };
    } catch {
      // Silent failure - don't disrupt test flow
      return null;
    }
  }

  /**
   * Get collected failure data for AI analysis
   */
  getFailureData(): Array<any> {
    return this.failureData;
  }

  /**
   * Clear failure data (called at start of new test)
   */
  clearFailureData(): void {
    this.failureData = [];
  }
}

// Re-export for backward compatibility
export { BrowserEngine } from '../engines/browser-engine.js';
export { FrameworkManager } from '../../managers/system/framework-manager.js';

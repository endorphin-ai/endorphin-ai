/**
 * Framework Manager
 * Manages framework configuration, initialization, and high-level operations
 */

import * as path from 'node:path';
import { BrowserEngine, type BrowserEngineConfig } from '../../automation/engines/browser-engine.js';
import { HtmlReporter } from '../../reporters/html-reporter.js';
import { TestResultsManager } from '../../results/test-results-manager.js';
import { info, logSuccess, logWithIcon, LogLevel } from '../../core/logger.js';
import type {
  BrowserConfig,
  ExecutionConfig,
  FrameworkConfig,
  TaskResult,
  TestConfig,
  TestReport,
} from '../../types/index.js';

/**
 * Framework Manager
 * High-level framework operations and configuration management
 */
export class FrameworkManager {
  private config: FrameworkConfig;
  private resultsManager: TestResultsManager;
  private resultBaseDir: string;
  private recorderBaseDir: string;
  private isInteractiveMode: boolean = false;

  constructor(config: Partial<FrameworkConfig> = {}) {
    // Initialize configuration with defaults - deep merge to prevent issues
    const defaultConfig: FrameworkConfig = {
      browser: {
        type: 'chromium',
        headless: true,
        viewport: {
          width: 1280,
          height: 720,
        },
        timeout: 30000,
        slowMo: 0,
        devtools: false,
        recordVideo: false,
        recordHar: false,
      } as BrowserConfig,
      ai: {
        openai: {
          apiKey: process.env.OPENAI_API_KEY || '',
          modelName: 'gpt-4o',
          temperature: 0.1,
          maxTokens: 8000,
        },
        agent: {
          recursionLimit: 10,
          stopPhrases: ['test completed', 'task finished', 'done'],
        },
      },
      execution: {
        timeout: 30000,
      } as ExecutionConfig,
      testsDirectory: 'tests',
      dataDirectory: 'test-data',
      resultsDirectory: 'test-results',
      environment: 'development' as const,
    };

    // Deep merge: defaults first, then user config for nested objects
    this.config = {
      ...defaultConfig,
      ...config,
      browser: {
        ...defaultConfig.browser,
        ...(config.browser || {}),
      },
      ai: {
        ...defaultConfig.ai,
        ...(config.ai || {}),
      },
      execution: {
        timeout: config.execution?.timeout ?? 30000,
      },
    };

    // Set result directory — allow explicit overrides (e.g. from tests)
    if (config.resultBaseDir) {
      this.resultBaseDir = path.resolve(config.resultBaseDir);
    } else {
      const resultsDir = this.config.results?.directory || './test-results';
      this.resultBaseDir = path.resolve(process.cwd(), resultsDir);
    }

    // Use current working directory (user project) for test-recorder, not framework root
    this.recorderBaseDir = config.recorderBaseDir
      ? path.resolve(config.recorderBaseDir)
      : path.join(process.cwd(), 'test-recorder');

    // Debug logging
    info('Results configuration', { config: this.config.results, resultBaseDir: this.resultBaseDir }, 'FrameworkManager');

    // Initialize results manager
    this.resultsManager = new TestResultsManager({
      resultsDir: this.resultBaseDir,
      recorderDir: this.recorderBaseDir,
      enableRecorderCopy: false, // Will be set to true in interactive mode
    });
  }

  /**
   * Create a browser engine instance
   */
  createBrowserEngine(frameworkInstance?: any): BrowserEngine {
    const engineConfig: BrowserEngineConfig = {
      framework: this.config,
      resultBaseDir: this.resultBaseDir,
      recorderBaseDir: this.recorderBaseDir,
      isInteractiveMode: this.isInteractiveMode,
      frameworkInstance,
    };

    return new BrowserEngine(engineConfig);
  }

  /**
   * Run a single task
   */
  async runTask(taskDescription: string, testName: string | null = null): Promise<TaskResult> {
    const engine = this.createBrowserEngine();

    try {
      await engine.initialize();
      return await engine.runTask(taskDescription, testName);
    } finally {
      await engine.cleanup();
    }
  }

  /**
   * Run multiple tasks sequentially
   */
  async runMultipleTasks(
    tasks: Array<{ name?: string; description: string }>
  ): Promise<TaskResult[]> {
    logWithIcon(LogLevel.INFO, 'rocket', `Running ${tasks.length} tasks sequentially`, { taskCount: tasks.length }, 'FrameworkManager');

    const results: TaskResult[] = [];
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const taskName = task.name || `Task-${i + 1}`;

      const result = await this.runTask(task.description, taskName);
      results.push(result);

      // Add delay between tasks
      if (i < tasks.length - 1) {
        info('Waiting before next task', { currentTask: i + 1, totalTasks: tasks.length }, 'FrameworkManager');
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
    const engine = this.createBrowserEngine();

    try {
      await engine.initialize();
      return await engine.runSingleTest(test);
    } finally {
      await engine.cleanup();
    }
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
    logWithIcon(LogLevel.INFO, 'target', `Running ${tests.length} tests with enhanced result tracking`, { testCount: tests.length }, 'FrameworkManager');
    const results: Array<{
      testId: string;
      testName: string;
      success: boolean;
      error?: string;
      session?: any;
    }> = [];

    for (const test of tests) {
      const result = await this.runSingleTest(test);
      results.push({
        testId: test.id,
        testName: test.name,
        ...result,
      });

      // Brief pause between tests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Generate final report using the shared method
    return await this.generateTestReport(results);
  }

  /**
   * Generate test report from results
   */
  async generateTestReport(results: Array<{
    testId: string;
    testName: string;
    success: boolean;
    error?: string;
    session?: any;
  }>): Promise<{
    results: Array<{
      testId: string;
      testName: string;
      success: boolean;
      error?: string;
      session?: any;
    }>;
    report: TestReport;
  }> {
    // Generate final report using HtmlReporter
    const htmlReporter = new HtmlReporter(this.resultBaseDir);
    const reportPath = await htmlReporter.generateReport();

    // Create TestReport object
    const passed = results.filter((r) => r.success).length;
    const failed = results.length - passed;
    const report: TestReport = {
      summary: {
        total: results.length,
        passed,
        failed,
        passRate: results.length > 0 ? `${((passed / results.length) * 100).toFixed(2)}%` : '0%',
        generatedAt: new Date().toISOString(),
      },
      results: results.map((result) => ({
        testId: result.testId,
        name: result.testName,
        status: result.success ? 'passed' : 'failed',
        duration: result.session?.duration || 0,
        error: result.error ?? '',
        screenshots:
          result.session?.steps?.flatMap(
            (step: any) => step.screenshots?.map((s: any) => s.filename) || []
          ) || [],
        logs: result.session?.steps?.map((step: any) => step.description) || [],
        timestamp: result.session?.startTime || new Date().toISOString(),
      })),
    };

    const passedCount = results.filter((r) => r.success).length;
    logSuccess('All tests completed', {
      total: results.length,
      passed: passedCount,
      failed: results.length - passedCount,
      reportPath
    }, 'FrameworkManager');

    return { results, report };
  }

  /**
   * Enable interactive mode
   */
  enableInteractiveMode(): void {
    this.isInteractiveMode = true;
    info('Interactive mode enabled - results will be recorded in test-recorder folder', { recorderBaseDir: this.recorderBaseDir }, 'FrameworkManager');

    // Update results manager to enable recorder copy
    this.resultsManager = new TestResultsManager({
      resultsDir: this.resultBaseDir,
      recorderDir: this.recorderBaseDir,
      enableRecorderCopy: false,
    });
  }

  /**
   * Disable interactive mode
   */
  disableInteractiveMode(): void {
    this.isInteractiveMode = false;

    // Update results manager to disable recorder copy
    this.resultsManager = new TestResultsManager({
      resultsDir: this.resultBaseDir,
      recorderDir: this.recorderBaseDir,
      enableRecorderCopy: false,
    });
  }

  /**
   * Set interactive mode
   */
  setInteractiveMode(interactive: boolean): void {
    if (interactive) {
      this.enableInteractiveMode();
    } else {
      this.disableInteractiveMode();
    }
  }

  /**
   * Get framework configuration
   */
  getConfig(): FrameworkConfig {
    return this.config;
  }

  /**
   * Update framework configuration
   */
  updateConfig(updates: Partial<FrameworkConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      browser: {
        ...this.config.browser,
        ...(updates.browser || {}),
      },
      ai: {
        ...this.config.ai,
        ...(updates.ai || {}),
      },
      execution: {
        timeout: this.config.execution?.timeout || 30000,
        ...this.config.execution,
        ...(updates.execution || {}),
      },
    };
  }

  /**
   * Get results manager
   */
  getResultsManager(): TestResultsManager {
    return this.resultsManager;
  }

  /**
   * Get result directories
   */
  getDirectories(): {
    results: string;
    recorder: string;
  } {
    return {
      results: this.resultBaseDir,
      recorder: this.recorderBaseDir,
    };
  }

  /**
   * Validate configuration
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check API key
    if (!this.config.ai?.openai?.apiKey) {
      errors.push('OpenAI API key is required');
    }

    // Check browser config
    if (!this.config.browser?.type) {
      errors.push('Browser type is required');
    }

    // Check timeout values
    if (this.config.execution?.timeout && this.config.execution.timeout < 1000) {
      errors.push('Execution timeout must be at least 1000ms');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get framework statistics
   */
  getStatistics(): {
    config: {
      browser: string;
      model: string;
      environment: string;
    };
    directories: {
      results: string;
      recorder: string;
    };
    features: {
      interactiveMode: boolean;
    };
  } {
    return {
      config: {
        browser: this.config.browser?.type || 'unknown',
        model: this.config.ai?.openai?.modelName || 'unknown',
        environment: this.config.environment || 'unknown',
      },
      directories: {
        results: this.resultBaseDir,
        recorder: this.recorderBaseDir,
      },
      features: {
        interactiveMode: this.isInteractiveMode,
      },
    };
  }
}

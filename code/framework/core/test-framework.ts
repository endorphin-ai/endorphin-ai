/**
 * Test Framework - Core Framework Class (TypeScript)
 * Orchestrates browser lifecycle, tool setup, and test session management
 */

import { AIMessage, HumanMessage } from '@langchain/core/messages';
import * as path from 'node:path';
import { setCurrentTestSession, setupAgent } from '../ai/agent-setup.js';
import { ValidationAgent } from '../ai/validation-agent.js';
import { PageSnapshotManager } from '../managers/content/snapshot-manager.js';
import { HtmlReporter } from '../reporters/html-reporter.js';
import { TestResultsManager } from '../results/test-results-manager.js';
import type {
  AgentInvokeParams,
  AgentResponse,
  LangChainAgent,
  LangChainTool,
} from '../types/agent.js';
import { TestTimeoutError } from '../types/errors.js';
import type {
  DataGenerationResult,
  FrameworkConfig,
  NaturalLanguageResult,
  TaskResult,
  TestConfig,
  TestSession,
  TestSetupResult,
} from '../types/index.js';
import { setBrowserManager } from '../utils/user-utils.js';
import { globalLogger, logWithIcon, LogLevel } from './logger.js';
import { ResourceManager, globalResourceManager } from './resource-manager.js';
import { TokenTracker } from './token-tracker.js';
import { ciPerformanceMonitor } from './ci-performance.js';

// Import the new service classes
import { BrowserManager } from '../automation/browser/browser-manager.js';
import { ConfigManager } from './config-manager.js';
import { DebugManager, createDebugManager } from './debug-manager.js';
import { GlobalSetupManager } from './global-setup-manager.js';
import { SessionManager } from './session-manager.js';
import { ToolManager } from './tool-manager.js';

/**
 * Test Framework - Core Framework Class
 * Orchestrates browser lifecycle, tool setup, and test session management using dedicated service managers
 */
export class TestFramework {
  // Service managers
  private configManager: ConfigManager;
  private browserManager: BrowserManager;
  private sessionManager: SessionManager;
  private toolManager: ToolManager;
  private globalSetupManager: GlobalSetupManager;
  private debugManager: DebugManager;

  // Core framework components
  private agent: LangChainAgent | null = null;
  private validationAgent: ValidationAgent;
  private resultsManager: TestResultsManager;
  private isInteractiveMode: boolean = false;
  private tokenTracker: TokenTracker;
  private snapshotManager: PageSnapshotManager;
  private resourceManager: ResourceManager;
  private logger = globalLogger.createChild('TestFramework');

  constructor(config: Partial<FrameworkConfig> = {}) {
    this.logger.info('Initializing Test Framework');

    // Initialize configuration manager
    this.configManager = new ConfigManager(config);
    const frameworkConfig = this.configManager.getConfig();

    // Initialize browser manager
    this.browserManager = new BrowserManager({
      browser: this.configManager.getBrowserConfig(),
    });

    // Setup result directories — allow explicit overrides (e.g. from tests)
    const directories = this.configManager.getDirectories();
    const resultBaseDir = config.resultBaseDir
      ? path.resolve(config.resultBaseDir)
      : path.resolve(process.cwd(), directories.results);
    const recorderBaseDir = config.recorderBaseDir
      ? path.resolve(config.recorderBaseDir)
      : path.join(process.cwd(), 'test-recorder');

    // Initialize session manager
    this.sessionManager = new SessionManager({
      resultBaseDir,
      recorderBaseDir,
      enableRecorderCopy: false, // Will be set to true in interactive mode
    });

    // Initialize tool manager
    this.toolManager = new ToolManager(frameworkConfig);

    // Initialize global setup manager
    this.globalSetupManager = new GlobalSetupManager();

    // Initialize debug manager
    this.debugManager = createDebugManager(this);

    // Initialize results manager
    this.resultsManager = new TestResultsManager({
      resultsDir: resultBaseDir,
      recorderDir: recorderBaseDir,
      enableRecorderCopy: false, // Will be set to true in interactive mode
    });

    // Initialize token tracker with custom pricing if provided
    this.tokenTracker = new TokenTracker(
      frameworkConfig.ai?.openai?.modelName || 'gpt-4o',
      frameworkConfig.pricing
    );

    // Initialize page snapshot manager
    this.snapshotManager = new PageSnapshotManager();

    // Initialize resource manager for memory leak prevention
    this.resourceManager = globalResourceManager;

    // Initialize validation agent with token tracker (init() called in initialize())
    this.validationAgent = new ValidationAgent(this.tokenTracker);

    this.logger.info('Test Framework initialized successfully');
  }

  /**
   * Initialize the framework
   */
  async initialize(): Promise<void> {
    this.logger.info('Starting framework initialization');

    // Load AI provider for validation agent
    await this.validationAgent.init();

    try {
      // Execute global setup first if configured
      await this.executeGlobalSetup();

      // Initialize session manager (directories, cleanup)
      await this.sessionManager.initialize();

      // Initialize browser
      await this.browserManager.initialize();

      // Set browser manager for user utilities
      setBrowserManager(this.browserManager);

      // Setup tools
      const tools = await this.toolManager.setupTools(this);

      // Update debug manager with tools
      this.debugManager.updateTools(tools);

      // Setup AI agent
      await this.setupAgent(tools);

      this.logger.info('Framework initialization completed successfully');
    } catch (error: any) {
      this.logger.error('Framework initialization failed', error);
      throw error;
    }
  }

  /**
   * Execute global setup if configured
   */
  private async executeGlobalSetup(): Promise<void> {
    const config = this.configManager.getConfig();

    if (!config.globalSetup) {
      logWithIcon(LogLevel.DEBUG, 'debug', 'No global setup configured, skipping', {}, 'TestFramework');
      return;
    }

    this.logger.info(`Executing global setup: ${config.globalSetup}`);

    try {
      const result = await this.globalSetupManager.loadAndExecute(config.globalSetup);

      if (!result.success) {
        const errorMessage = `Global setup failed: ${result.error?.message || 'Unknown error'}`;
        this.logger.error(errorMessage, result.error);
        throw new Error(errorMessage);
      }

      this.logger.info(`Global setup completed successfully in ${result.executionTime}ms`);
    } catch (error: any) {
      this.logger.error('Global setup execution failed', error);
      throw new Error(`Global setup failed: ${error.message}`);
    }
  }

  /**
   * Run a test with the given configuration
   */
  async runTest(testConfig: TestConfig): Promise<TaskResult> {
    this.logger.info(`Running test: ${testConfig.name}`, {
      testId: testConfig.id,
      url: testConfig.url,
    });

    // Record test start for CI performance monitoring
    ciPerformanceMonitor.recordTestStart();

    try {
      // Create test session
      const session = await this.sessionManager.createSession(testConfig.name, testConfig.id);

      // Update debug manager with new session
      this.debugManager.updateSession(session);

      // Set the current session for agent token tracking
      setCurrentTestSession(session);

      // Execute test setup if provided
      if (testConfig.setup) {
        try {
          await this.executeTestSetup(testConfig, session);
        } catch (error) {
          // Setup errors are already logged and stored in session by executeTestSetup
          this.logger.warn('Test setup failed, continuing with test execution', {
            testId: testConfig.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Execute data generation if provided
      if (testConfig.data && typeof testConfig.data === 'function') {
        try {
          await this.executeDataGeneration(testConfig, session);
        } catch (error) {
          // Data generation errors are already logged and stored in session by executeDataGeneration
          this.logger.warn('Data generation failed, continuing with test execution', {
            testId: testConfig.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Navigate to test URL
      if (testConfig.url) {
        await this.browserManager.navigateToUrl(testConfig.url);
      }

      // Execute test instructions
      const result = await this.executeTest(testConfig, session);

      // Complete session
      await this.sessionManager.completeSession(
        (result as any).success || false,
        result.error,
        (result as any).report
      );

      // Clear the current session for agent token tracking
      setCurrentTestSession(null);

      this.logger.info(`Test completed: ${(result as any).success ? 'SUCCESS' : 'FAILED'}`, {
        testId: testConfig.id,
        duration: result.duration,
      });

      return result;
    } catch (error: any) {
      this.logger.error('Test execution failed', error, {
        testId: testConfig.id,
        testName: testConfig.name,
      });

      // Complete session with error
      await this.sessionManager.completeSession(false, error.message);

      // Clear the current session for agent token tracking
      setCurrentTestSession(null);

      throw error;
    }
  }

  /**
   * Execute natural language instruction
   */
  async executeNaturalLanguageInstruction(instruction: string): Promise<NaturalLanguageResult> {
    this.logger.info('Executing natural language instruction', { instruction });

    try {
      const startTime = Date.now();

      if (!this.agent) {
        throw new Error('Agent not initialized. Call initialize() first.');
      }

      // Get optimized page content for AI context
      const optimizedContent = await this.getOptimizedPageContent();

      // Create enhanced prompt with context
      const enhancedPrompt = this.createEnhancedPrompt(instruction, optimizedContent);

      // Execute with timeout and tracking
      const result = await this.executeWithTimeout(
        () => this.invokeAgent(enhancedPrompt),
        this.configManager.getExecutionConfig().timeout
      );

      const duration = Date.now() - startTime;

      this.logger.info('Natural language instruction completed', {
        instruction,
        duration,
        success: result.success,
      });

      return {
        result: result.output || '',
        error: result.error,
        duration,
        tokenUsage: this.tokenTracker.getSessionSummary(),
      } as any;
    } catch (error: any) {
      this.logger.error('Natural language instruction failed', error, { instruction });

      return {
        result: '',
        error: error.message,
        duration: 0,
        tokenUsage: this.tokenTracker.getSessionSummary(),
      };
    }
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(filename?: string): Promise<string> {
    try {
      const session = this.sessionManager.getCurrentSession();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotName = filename || `screenshot-${timestamp}.png`;

      let screenshotPath: string;

      if (session) {
        screenshotPath = path.join(session.sessionDir, screenshotName);
      } else {
        screenshotPath = path.join(process.cwd(), 'screenshots', screenshotName);
      }

      await this.browserManager.takeScreenshot({ path: screenshotPath });

      logWithIcon(LogLevel.DEBUG, 'debug', 'Screenshot captured', { path: screenshotPath }, 'TestFramework');

      return screenshotPath;
    } catch (error: any) {
      this.logger.error('Failed to take screenshot', error);
      throw error;
    }
  }

  /**
   * Generate HTML report
   */
  async generateReport(title?: string): Promise<string> {
    this.logger.info('Generating HTML report');

    try {
      const reporter = new HtmlReporter();
      const reportPath = await reporter.generateReport(title ? ({ title } as any) : undefined);

      this.logger.info('HTML report generated', { path: reportPath });

      return reportPath;
    } catch (error: any) {
      this.logger.error('Failed to generate report', error);
      throw error;
    }
  }

  /**
   * Cleanup framework resources
   */
  async cleanup(): Promise<void> {
    this.logger.info('Starting framework cleanup');

    try {
      // Close session
      this.sessionManager.closeSession();

      // Clear debug session
      this.debugManager.updateSession(null);

      // Cleanup browser
      await this.browserManager.cleanup();

      // Dispose resource manager
      await this.resourceManager.disposeAll();

      this.logger.info('Framework cleanup completed');
    } catch (error: any) {
      this.logger.error('Error during framework cleanup', error);
    }
  }

  /**
   * Get framework status
   */
  getStatus() {
    return {
      initialized: this.browserManager.isInitialized() && this.agent !== null,
      hasActiveSession: this.sessionManager.hasActiveSession(),
      toolCount: this.toolManager.getToolCount(),
      tokenUsage: this.tokenTracker.getSessionSummary(),
      currentUrl: this.browserManager.isInitialized() ? this.browserManager.getCurrentUrl() : null,
    };
  }

  // Getters for accessing managers (for backward compatibility and advanced usage)

  getConfigManager(): ConfigManager {
    return this.configManager;
  }

  getBrowserManager(): BrowserManager {
    return this.browserManager;
  }

  /**
   * Get current page (tools compatibility)
   */
  get currentPage() {
    return this.browserManager.getPage();
  }

  /**
   * Take step screenshot (tools compatibility)
   */
  async takeStepScreenshot(_description: string): Promise<string | null> {
    try {
      const session = this.sessionManager.getCurrentSession();
      if (!session) {
        throw new Error('No active session for screenshot');
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotName = `step-${session.steps.length + 1}-${timestamp}.png`;
      const screenshotPath = `${session.screenshotsDir}/${screenshotName}`;

      await this.browserManager.getPage().screenshot({
        path: screenshotPath,
        fullPage: false,
      });

      return screenshotPath;
    } catch (error: any) {
      this.logger.error('Screenshot failed', error);
      return null;
    }
  }

  /**
   * Log test step (tools compatibility)
   */
  logTestStep(
    stepDescription: string,
    toolName: string | null = null,
    toolArgs: any = null,
    result: string = '',
    isSuccess: boolean = true,
    screenshots: string[] = []
  ): void {
    const session = this.sessionManager.getCurrentSession();
    if (!session) return;

    const currentUserId = this.browserManager.getCurrentUserId();

    const step = {
      stepNumber: session.steps.length + 1,
      timestamp: new Date().toISOString(),
      description: stepDescription,
      toolName: toolName || null,
      toolArgs: toolArgs || undefined,
      result: result || null,
      status: isSuccess ? ('SUCCESS' as const) : ('FAILED' as const),
      screenshots: screenshots.map((path) => ({
        filepath: path,
        filename: path.split('/').pop() || 'screenshot.png',
        description: `${stepDescription} screenshot`,
        timestamp: new Date().toISOString(),
        stepNumber: session.steps.length + 1,
      })),
      userId: currentUserId ? currentUserId : undefined, // Include user context for multi-user tests
    };

    session.steps.push(step);
    logWithIcon(LogLevel.DEBUG, 'debug', 'Test step logged', step, 'TestFramework');
  }

  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  getToolManager(): ToolManager {
    return this.toolManager;
  }

  getTokenTracker(): TokenTracker {
    return this.tokenTracker;
  }

  getSnapshotManager(): PageSnapshotManager {
    return this.snapshotManager;
  }

  getDebugManager(): DebugManager {
    return this.debugManager;
  }

  // Legacy methods for backward compatibility

  /**
   * @deprecated Use browserManager.getPage() instead
   */
  getPage() {
    return this.browserManager.getPage();
  }

  /**
   * @deprecated Use configManager.getConfig() instead
   */
  getConfig(): FrameworkConfig {
    return this.configManager.getConfig();
  }

  /**
   * @deprecated Use toolManager.getTools() instead
   */
  getTools(): LangChainTool[] {
    return this.toolManager.getTools();
  }

  // Private methods

  private async setupAgent(tools: LangChainTool[]): Promise<void> {
    logWithIcon(LogLevel.DEBUG, 'debug', 'Setting up AI agent', {}, 'TestFramework');

    try {
      const aiConfig = this.configManager.getAIConfig();
      this.agent = await setupAgent(tools);

      this.logger.info('AI agent setup completed', {
        toolCount: tools.length,
        model: aiConfig.openai.modelName,
      });
    } catch (error: any) {
      this.logger.error('Failed to setup agent', error);
      throw error;
    }
  }

  /**
   * Execute test-level setup function
   */
  private async executeTestSetup(testConfig: TestConfig, _session: TestSession): Promise<void> {
    if (!testConfig.setup) {
      return;
    }

    this.logger.info(`Executing test setup for: ${testConfig.name}`, {
      testId: testConfig.id,
    });

    const startTime = Date.now();

    try {
      // Execute the setup function
      const setupData = await testConfig.setup();
      const executionTime = Date.now() - startTime;

      // Store setup result in session
      const setupResult: TestSetupResult = {
        success: true,
        data: setupData,
        executionTime,
      };

      // Update session with setup result
      await this.sessionManager.updateSessionSetup(setupResult);

      this.logger.info(`Test setup completed successfully in ${executionTime}ms`, {
        testId: testConfig.id,
        hasData: !!setupData,
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      // Store setup error in session
      const setupResult: TestSetupResult = {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        executionTime,
      };

      // Update session with setup result
      await this.sessionManager.updateSessionSetup(setupResult);

      this.logger.error(`Test setup failed after ${executionTime}ms`, error);

      // Throw error to fail the test
      throw new Error(`Test setup failed: ${error.message}`);
    }
  }

  /**
   * Execute test-level data generation function
   */
  private async executeDataGeneration(
    testConfig: TestConfig,
    _session: TestSession
  ): Promise<void> {
    if (!testConfig.data || typeof testConfig.data !== 'function') {
      return;
    }

    this.logger.info(`Executing data generation for: ${testConfig.name}`, {
      testId: testConfig.id,
    });

    const startTime = Date.now();

    try {
      // Execute the data generation function
      const generatedData = await testConfig.data();
      const executionTime = Date.now() - startTime;

      // Store data generation result in session
      const dataResult: DataGenerationResult = {
        success: true,
        data: generatedData,
        executionTime,
        // Token usage will be tracked if the data function uses AI services
        tokenUsage: this.tokenTracker.getSessionSummary() as any,
      };

      // Update session with data generation result
      await this.sessionManager.updateSessionDataGeneration(dataResult);

      this.logger.info(`Data generation completed successfully in ${executionTime}ms`, {
        testId: testConfig.id,
        hasData: !!generatedData,
        dataSize: typeof generatedData === 'object' ? Object.keys(generatedData).length : 1,
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      // Store data generation error in session
      const dataResult: DataGenerationResult = {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        executionTime,
      };

      // Update session with data generation result
      await this.sessionManager.updateSessionDataGeneration(dataResult);

      this.logger.error(`Data generation failed after ${executionTime}ms`, error);

      // Throw error to fail the test
      throw new Error(`Data generation failed: ${error.message}`);
    }
  }

  private async executeTest(testConfig: TestConfig, session: TestSession): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      // Check if this is a multi-user test
      if (testConfig.users && testConfig.users.length > 0 && testConfig.tasks) {
        return await this.executeMultiUserTest(testConfig, session);
      }

      // Single-user test execution (existing logic)
      if (!testConfig.task) {
        throw new Error('Test must have either task (single-user) or users + tasks (multi-user)');
      }

      // Get setup data and test data from session
      const setupData = session.setupResult?.data || null;
      const testData = session.dataGenerationResult?.data || null;

      // Handle both string and function tasks
      const taskInstruction =
        typeof testConfig.task === 'string'
          ? testConfig.task
          : await testConfig.task(testData, setupData);

      // Execute test instructions
      const result = await this.executeNaturalLanguageInstruction(taskInstruction);

      const duration = Date.now() - startTime;

      // Add validation with the validation agent
      let validationResult: { status: 'SUCCESS' | 'FAILED'; conclusion: string } | null = null;
      try {
        // Get the current session for validation
        const currentSession = this.sessionManager.getCurrentSession();
        if (
          currentSession &&
          currentSession.agentHistory &&
          currentSession.agentHistory.length > 0
        ) {
          // Create messages from agent history for validation
          const messages = currentSession.agentHistory.map(
            (entry) => new AIMessage(`${entry.thinking}: ${entry.response}`)
          );

          // Pass the current page for vision-based validation
          const currentPage = this.browserManager.getPage?.() ?? null;
          validationResult = await this.validationAgent.analyzeTestExecution(
            messages,
            taskInstruction,
            currentPage
          );

          // Update session with validation conclusion
          await this.sessionManager.updateSessionConclusion(validationResult.conclusion);
        }
      } catch (error: any) {
        this.logger.warn('Validation agent failed', error);
      }

      // Store the session token summary in the session for the report
      const sessionTokenSummary = this.tokenTracker.getSessionSummary();
      const currentSession = this.sessionManager.getCurrentSession();
      if (currentSession) {
        currentSession.tokenSummary = sessionTokenSummary;
      }

      const taskResult: TaskResult = {
        success:
          validationResult && validationResult.status === 'SUCCESS'
            ? true
            : (result as any).success,
        duration,
        report: {
          testName: testConfig.name,
          testId: testConfig.id || 'unknown',
          success:
            validationResult && validationResult.status === 'SUCCESS'
              ? true
              : (result as any).success,
          duration,
          timestamp: new Date().toISOString(),
          conclusion: validationResult ? validationResult.conclusion : undefined,
        },
        tokenUsage: result.tokenUsage as any,
      };

      // Only add error if it exists
      if (result.error) {
        taskResult.error = result.error;
        taskResult.report.error = result.error;
      }

      return taskResult;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        error: error.message,
        duration,
        report: {
          testName: testConfig.name,
          testId: testConfig.id || 'unknown',
          success: false,
          duration,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        tokenUsage: this.tokenTracker.getSessionSummary(),
      };
    }
  }

  private async executeMultiUserTest(
    testConfig: TestConfig,
    session: TestSession
  ): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      if (!testConfig.users || !testConfig.tasks) {
        throw new Error('Multi-user test requires both users and tasks');
      }

      this.logger.info(`Executing multi-user test with ${testConfig.users.length} users`, {
        testId: testConfig.id,
        users: testConfig.users,
      });

      // Initialize multi-user browser sessions
      await this.browserManager.initializeMultiUser(testConfig.users);

      // Get setup data and test data from session
      const setupData = session.setupResult?.data || null;
      const testData = session.dataGenerationResult?.data || null;

      // Execute tasks function to get user-specific task instructions
      const userTasks: Record<string, string> =
        typeof testConfig.tasks === 'function'
          ? await testConfig.tasks(testData, setupData, testConfig.users)
          : (testConfig.tasks as Record<string, string>);

      // Get all task IDs from tasks (supports both traditional and phase-based workflow)
      const taskIds = Object.keys(userTasks);

      // Detect if this is a phase-based workflow (contains '.phase' in task keys)
      const isPhaseBasedWorkflow = taskIds.some((id) => id.includes('.'));

      if (isPhaseBasedWorkflow) {
        // Phase-based workflow: focus on phases, extract base users for browser context mapping
        const baseUserIds = [...new Set(taskIds.map((taskId) => taskId.split('.')[0]))];
        for (const baseUserId of baseUserIds) {
          if (!testConfig.users.includes(baseUserId)) {
            throw new Error(
              `Base user ${baseUserId} from phase IDs not found in users array: ${testConfig.users.join(', ')}`
            );
          }
        }

        // Log phase structure for debugging
        const phases = taskIds
          .filter((id) => id.includes('.'))
          .map((id) => id.split('.')[1])
          .filter((v, i, a) => a.indexOf(v) === i);
        logWithIcon(LogLevel.DEBUG, 'debug', `Phase-based workflow detected`, {
          totalTasks: taskIds.length,
          phases: phases.sort(),
          baseUsers: baseUserIds,
          executionOrder: taskIds,
        });
      } else {
        // Traditional workflow: validate that all task keys match users array exactly
        for (const taskUserId of taskIds) {
          if (!testConfig.users.includes(taskUserId)) {
            throw new Error(
              `Task user ${taskUserId} not found in users array: ${testConfig.users.join(', ')}`
            );
          }
        }
        logWithIcon(LogLevel.DEBUG, 'debug', `Traditional workflow detected`, { users: taskIds }, 'TestFramework');
      }

      // Execute tasks sequentially in the order they appear in the tasks object
      const userResults = [];
      for (const taskId of taskIds) {
        logWithIcon(LogLevel.DEBUG, 'debug', `Executing task: ${taskId}`, {}, 'TestFramework');

        try {
          // Switch to user context (will parse base user ID internally for phase-based workflow)
          await this.browserManager.switchToUser(taskId);

          // Execute the task instruction
          const taskInstruction = userTasks[taskId];
          const result = await this.executeNaturalLanguageInstruction(taskInstruction);

          userResults.push({
            userId: taskId, // Use task ID for tracking (could be 'user1' or 'user1.phase1')
            success: (result as any).success,
            result: result.result,
            error: result.error,
            tokenUsage: result.tokenUsage as any,
          });
        } catch (error: any) {
          userResults.push({
            userId: taskId, // Use task ID for tracking
            success: false,
            result: '',
            error: error.message || 'Unknown error',
            tokenUsage: null,
          });
        }
      }

      // All results are now in userResults array
      const allResults = userResults;

      // Determine overall success
      const allSuccessful = allResults.every((r) => r.success);
      const duration = Date.now() - startTime;

      // Get the actual token usage from the session's token tracker
      const sessionTokenSummary = this.tokenTracker.getSessionSummary();

      // Store the session token summary in the session for the report
      const currentSession = this.sessionManager.getCurrentSession();
      if (currentSession) {
        currentSession.tokenSummary = sessionTokenSummary;
      }

      // Use the session token summary as the total usage
      const totalTokenUsage = {
        totalTokens: sessionTokenSummary.totalTokens,
        totalCost: sessionTokenSummary.totalCost,
        aiCalls: sessionTokenSummary.aiCalls,
      };

      // Add validation with the validation agent for multi-user tests
      let validationResult: { status: 'SUCCESS' | 'FAILED'; conclusion: string } | null = null;
      try {
        // Get the current session for validation
        const currentSession = this.sessionManager.getCurrentSession();
        if (
          currentSession &&
          currentSession.agentHistory &&
          currentSession.agentHistory.length > 0
        ) {
          // Create combined task instruction for all users
          const combinedTaskInstruction = Object.entries(userTasks)
            .map(([userId, task]) => `${userId}: ${task}`)
            .join('\n');

          // Create messages from agent history for validation
          const messages = currentSession.agentHistory.map(
            (entry) => new AIMessage(`${entry.thinking}: ${entry.response}`)
          );

          // Pass the current page for vision-based validation
          const currentPage = this.browserManager.getPage?.() ?? null;
          validationResult = await this.validationAgent.analyzeTestExecution(
            messages,
            combinedTaskInstruction,
            currentPage
          );

          // Update session with validation conclusion
          await this.sessionManager.updateSessionConclusion(validationResult.conclusion);
        }
      } catch (error: any) {
        this.logger.warn('Multi-user validation agent failed', error);
      }

      const finalSuccess =
        validationResult && validationResult.status === 'SUCCESS' ? true : allSuccessful;

      const taskResult: TaskResult = {
        success: finalSuccess,
        duration,
        report: {
          testName: testConfig.name,
          testId: testConfig.id || 'unknown',
          success: finalSuccess,
          duration,
          timestamp: new Date().toISOString(),
          multiUser: true,
          userResults: allResults,
          conclusion: validationResult ? validationResult.conclusion : undefined,
        },
        tokenUsage: totalTokenUsage,
      };

      // Add error if any user failed
      if (!allSuccessful) {
        const failures = allResults.filter((r) => !r.success);
        taskResult.error = `Multi-user test failed for users: ${failures.map((f) => f.userId).join(', ')}`;
        taskResult.report.error = taskResult.error;
      }

      this.logger.info(`Multi-user test completed: ${allSuccessful ? 'SUCCESS' : 'FAILED'}`, {
        testId: testConfig.id,
        duration,
        userResults: allResults.map((r) => ({ userId: r.userId, success: r.success })),
      });

      return taskResult;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      this.logger.error('Multi-user test execution failed', error, {
        testId: testConfig.id,
        users: testConfig.users,
      });

      return {
        success: false,
        error: error.message,
        duration,
        report: {
          testName: testConfig.name,
          testId: testConfig.id || 'unknown',
          success: false,
          duration,
          error: error.message,
          timestamp: new Date().toISOString(),
          multiUser: true,
        },
        tokenUsage: this.tokenTracker.getSessionSummary(),
      };
    }
  }

  private async getOptimizedPageContent(): Promise<string> {
    if (!this.browserManager.isInitialized()) {
      return '';
    }

    try {
      const page = this.browserManager.getPage();
      const url = page.url();

      return await this.snapshotManager.createSnapshot(page, url);
    } catch (error: any) {
      this.logger.warn('Failed to get optimized page content', error);
      return '';
    }
  }

  private createEnhancedPrompt(instruction: string, pageContent: string): string {
    const basePrompt = `You are a web automation expert. Execute the following instruction on the current web page.

    Current page content (optimized for AI context):
    ${pageContent}

    Instruction: ${instruction}

    Use the available tools to complete this task. Be precise and efficient.`;

    return basePrompt;
  }

  private async invokeAgent(prompt: string): Promise<AgentResponse> {
    if (!this.agent) {
      throw new Error('Agent not initialized');
    }

    const message = new HumanMessage(prompt);
    const params: AgentInvokeParams = { messages: [message] };

    // Track token usage
    const startTime = Date.now();

    try {
      const response = await this.agent.invoke(params, {
        configurable: {
          thread_id: `session-${this.sessionManager.getCurrentSession()?.sessionId || 'default'}`,
        },
        recursionLimit: 200, // Increased recursion limit for complex multi-user tests
      });
      const _duration = Date.now() - startTime;

      // Track tokens (estimation for now)
      this.tokenTracker.recordUsage(
        Math.ceil(prompt.length / 4), // Rough token estimation
        Math.ceil((response.output || '').length / 4),
        this.configManager.getAIConfig().openai.modelName
      );

      return {
        success: true,
        output: response.output || '',
      };
    } catch (error: any) {
      this.logger.error('Agent invocation failed', error);

      return {
        success: false,
        output: '',
        error: error.message,
      };
    }
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>, timeout: number): Promise<T> {
    const controllerId = `timeout-${Date.now()}`;
    const abortController = this.resourceManager.createAbortController(controllerId);

    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          const timeoutId = setTimeout(() => {
            abortController.abort();
            reject(new TestTimeoutError(`Operation timed out after ${timeout}ms`));
          }, timeout);

          abortController.signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
          });
        }),
      ]);
    } finally {
      this.resourceManager.disposeAbortController(controllerId);
    }
  }
}

// Re-export for backward compatibility
export { TestFramework as EnhancedBrowserTestFramework };

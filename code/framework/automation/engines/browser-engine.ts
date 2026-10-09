/**
 * Browser Test Engine
 * Core engine for browser-based test execution
 */

import { EventEmitter } from 'node:events';
import { AGENT_CONFIG } from '../../ai/config/agent-config.js';
import { ValidationAgent } from '../../ai/validation-agent.js';
import { TIMEOUTS } from '../../config/constants.js';
import { buildInitialMessages } from '../../ai/utils/initial-messages.js';
import { GlobalSetupManager } from '../../core/global-setup-manager.js';
import { ResourceManager, globalResourceManager } from '../../core/resource-manager.js';
import { createTestSession, saveTestSession } from '../../core/test-session.js';
import { TokenTracker } from '../../core/token-tracker.js';
import { PageSnapshotManager } from '../../managers/content/snapshot-manager.js';
import type {
  AgentInvokeParams,
  AgentResponse,
  LangChainAgent,
  LangChainTool,
} from '../../types/agent.js';
import { AgentError, TestTimeoutError, createErrorFromUnknown } from '../../types/errors.js';
import type {
  FrameworkConfig,
  TaskResult,
  TestConfig,
  TestSession,
  ToolCall,
} from '../../types/index.js';
import { DirectoryManager } from '../../utils/directory-manager.js';
import { TestHelpers } from '../../utils/test-helpers.js';
import { BrowserManager } from '../browser/browser-manager.js';
import { createAllTools } from '../tools/index.js';
import { info, logSuccess, error as logError, logWithIcon, LogLevel } from '../../core/logger.js';

// Increase max listeners to prevent memory leak warnings during test execution
EventEmitter.defaultMaxListeners = 30;

/**
 * Browser Test Engine Configuration
 */
export interface BrowserEngineConfig {
  framework: FrameworkConfig;
  resultBaseDir: string;
  recorderBaseDir: string;
  isInteractiveMode?: boolean;
  frameworkInstance?: any; // Reference to EnhancedBrowserTestFramework
}

/**
 * Browser Test Engine
 * Handles core browser test execution logic
 */
export class BrowserEngine {
  private browserManager: BrowserManager;
  private agent: LangChainAgent | null = null;
  private toolsArray: LangChainTool[] = [];
  private currentTestSession: TestSession | null = null;
  private config: FrameworkConfig;
  private resultBaseDir: string;
  private recorderBaseDir: string;
  private isInteractiveMode: boolean;
  private tokenTracker: TokenTracker;
  private snapshotManager: PageSnapshotManager;
  private resourceManager: ResourceManager;
  private frameworkInstance: any; // Reference to EnhancedBrowserTestFramework
  private globalSetupManager: GlobalSetupManager;
  private globalSetupExecuted: boolean = false;
  private validationAgent: ValidationAgent;

  constructor(config: BrowserEngineConfig) {
    this.config = config.framework;
    this.resultBaseDir = config.resultBaseDir;
    this.recorderBaseDir = config.recorderBaseDir;
    this.isInteractiveMode = config.isInteractiveMode || false;
    this.frameworkInstance = config.frameworkInstance;

    // Initialize browser manager
    this.browserManager = new BrowserManager({ browser: this.config.browser });

    // Initialize token tracker with custom pricing if provided
    this.tokenTracker = new TokenTracker(
      this.config.ai?.openai?.modelName || 'gpt-4o',
      this.config.pricing
    );

    // Initialize page snapshot manager
    this.snapshotManager = new PageSnapshotManager();

    // Initialize resource manager for memory leak prevention
    this.resourceManager = globalResourceManager;

    // Initialize global setup manager
    this.globalSetupManager = new GlobalSetupManager();

    // Initialize validation agent with token tracker (init() called in initialize())
    this.validationAgent = new ValidationAgent(this.tokenTracker);
  }

  /**
   * Initialize the browser engine
   */
  async initialize(): Promise<void> {
    logWithIcon(LogLevel.INFO, 'rocket', 'Initializing Browser Test Engine', {}, 'BrowserEngine');

    // Load AI provider for validation agent
    await this.validationAgent.init();

    // Note: Directory cleanup is now handled at the test session level, not per-test

    // Ensure directories exist
    await DirectoryManager.ensureDirectory(this.resultBaseDir);
    await DirectoryManager.ensureDirectory(this.recorderBaseDir);

    // Initialize browser manager
    await this.browserManager.initialize();

    // Setup tools with tracking
    await this.setupTools();

    // Create AI agent
    await this.setupAgent();

    logSuccess('Browser Engine initialized successfully!', {}, 'BrowserEngine');
  }

  /**
   * Initialize with a persistent browser (survives process exit).
   * Returns the CDP WebSocket endpoint for reconnection.
   * Used by the recorder flow only.
   *
   * @param options.skipAgent - If true, skip creating the test execution agent.
   *   The recorder has its own agent (recorder-agent-setup.ts) and doesn't need
   *   the test agent. Saves one AI provider instantiation + tool binding per step.
   */
  async initializePersistent(options?: { skipAgent?: boolean }): Promise<string> {
    logWithIcon(LogLevel.INFO, 'rocket', 'Initializing Browser Engine with persistent browser', {}, 'BrowserEngine');

    // Ensure directories exist
    await DirectoryManager.ensureDirectory(this.resultBaseDir);
    await DirectoryManager.ensureDirectory(this.recorderBaseDir);

    // Launch persistent browser
    const wsEndpoint = await this.browserManager.launchPersistent();

    // Setup tools with tracking
    await this.setupTools();

    // Create AI agent (skipped in recorder flow — recorder has its own agent)
    if (!options?.skipAgent) {
      await this.setupAgent();
    }

    logSuccess('Browser Engine initialized with persistent browser', { wsEndpoint }, 'BrowserEngine');

    return wsEndpoint;
  }

  /**
   * Initialize by connecting to an existing browser via CDP.
   * Used by the recorder to reconnect across CLI invocations.
   *
   * @param wsEndpoint - CDP WebSocket endpoint to connect to
   * @param options.skipAgent - If true, skip creating the test execution agent.
   *   The recorder has its own agent and doesn't need the test agent.
   */
  async initializeWithCDP(wsEndpoint: string, options?: { skipAgent?: boolean }): Promise<void> {
    logWithIcon(LogLevel.INFO, 'rocket', 'Initializing Browser Engine with CDP connection', { wsEndpoint }, 'BrowserEngine');

    // Ensure directories exist
    await DirectoryManager.ensureDirectory(this.resultBaseDir);
    await DirectoryManager.ensureDirectory(this.recorderBaseDir);

    // Connect to existing browser via CDP
    await this.browserManager.connectOverCDP(wsEndpoint);

    // Setup tools with tracking
    await this.setupTools();

    // Create AI agent (skipped in recorder flow — recorder has its own agent)
    if (!options?.skipAgent) {
      await this.setupAgent();
    }

    logSuccess('Browser Engine initialized with CDP connection', {}, 'BrowserEngine');
  }

  /**
   * Disconnect from the browser without closing it.
   * The browser process continues running.
   * Used by the recorder between CLI invocations.
   */
  async disconnect(): Promise<void> {
    try {
      // Clean up page snapshots to free memory
      if (this.snapshotManager) {
        this.snapshotManager.clearAll();
      }

      // Disconnect from browser without closing it
      await this.browserManager.disconnect();

      // Dispose resources (but not the browser itself)
      await this.resourceManager.disposeAll();
    } catch (error) {
      const disconnectError = createErrorFromUnknown(error, 'Disconnect failed', {
        component: 'BrowserEngine',
        operation: 'disconnect',
      });
      console.error('Disconnect error:', disconnectError.message);
      throw disconnectError;
    }
  }

  /**
   * Setup browser automation tools
   */
  private async setupTools(): Promise<void> {
    info('Setting up browser automation tools', {}, 'BrowserEngine');
    this.toolsArray = await createAllTools(this.frameworkInstance || this);
  }

  /**
   * Setup AI agent
   */
  private async setupAgent(): Promise<void> {
    logWithIcon(LogLevel.INFO, 'brain', 'Setting up AI agent', {}, 'BrowserEngine');
    const { setupAgent, setCurrentTestSession } = await import('../../ai/agent-setup.js');
    this.agent = await setupAgent(this.toolsArray, {
      getPage: () => this.browserManager.isInitialized() ? this.browserManager.getPage() : null,
    });

    // Set the current session for token tracking
    if (this.currentTestSession) {
      setCurrentTestSession(this.currentTestSession);
    }
  }

  /**
   * Create a new test session
   */
  async createTestSession(testName: string, testId: string | null = null): Promise<TestSession> {
    const session = await createTestSession(testName, testId, this.resultBaseDir);
    this.currentTestSession = session;

    // Reset token tracker for new session
    this.tokenTracker.reset();

    // Set the current session for agent token tracking
    const { setCurrentTestSession } = await import('../../ai/agent-setup.js');
    setCurrentTestSession(session);

    return session;
  }

  /**
   * Log a test step
   */
  logTestStep(
    stepDescription: string,
    toolName: string | null = null,
    toolArgs: any = null,
    result: string | null = null,
    isSuccess: boolean = true,
    screenshots: string[] = []
  ): void {
    TestHelpers.logTestStep(
      stepDescription,
      toolName,
      toolArgs,
      result || '',
      isSuccess,
      this.currentTestSession || undefined,
      screenshots
    );

    // Token usage tracking is now handled by the centralized trackAICall system

    // Add tool call tracking if needed
    if (toolName && this.currentTestSession) {
      const toolCall: ToolCall = {
        stepNumber: this.currentTestSession.steps.length,
        toolName,
        toolArgs,
        result: result || '',
        timestamp: new Date().toISOString(),
        status: isSuccess ? 'SUCCESS' : 'FAILED',
      };
      this.currentTestSession.toolCalls.push(toolCall);
    }
  }

  /**
   * Take a screenshot for current test step
   */
  async takeStepScreenshot(description: string | null = null, fullPage: boolean = true): Promise<string | null> {
    return await TestHelpers.takeStepScreenshot(
      this.browserManager,
      description,
      this.currentTestSession || undefined,
      fullPage
    );
  }

  /**
   * Invoke AI agent with token tracking and resource management
   */
  private async invokeAgentWithTracking(
    messages: AgentInvokeParams,
    config: any = {},
    stepDescription: string = 'AI agent call'
  ): Promise<AgentResponse> {
    // Extract instruction for content optimization
    if (messages && messages.messages && messages.messages.length > 0) {
      const lastMessage = messages.messages[messages.messages.length - 1];
      if (lastMessage.content) {
        (this as any).currentInstruction = lastMessage.content;
      }
    }

    // Estimate prompt tokens
    const messageContent =
      typeof messages === 'object' && messages.messages
        ? messages.messages.map((m: any) => m.content).join(' ')
        : JSON.stringify(messages);

    const estimatedPromptTokens = this.tokenTracker.estimateTokens(messageContent);

    logWithIcon(LogLevel.INFO, 'brain', `${stepDescription} (estimated: ${estimatedPromptTokens} tokens)`, { estimatedTokens: estimatedPromptTokens }, 'BrowserEngine');

    // No AbortController - let the agent run naturally without forced interruption

    const startTime = Date.now();
    let result: AgentResponse;

    try {
      if (!this.agent) {
        throw new AgentError('Agent not initialized', { stepDescription });
      }

      result = await this.agent.invoke(messages, config);
    } catch (error) {
      // Handle error without AbortController cleanup

      const frameworkError = createErrorFromUnknown(
        error,
        `Agent invocation failed: ${stepDescription}`,
        {
          stepDescription,
          estimatedPromptTokens,
        }
      );
      throw frameworkError;
    }

    const duration = Date.now() - startTime;

    // Clean up the abort controller without aborting (just for memory cleanup)
    // Only abort in error cases, not on successful completion

    // Estimate response tokens from properly typed response
    const responseContent =
      result.messages && result.messages.length > 0
        ? result.messages[result.messages.length - 1]?.content || ''
        : result.content || '';

    const estimatedResponseTokens = this.tokenTracker.estimateTokens(responseContent);

    // Record token usage
    const tokenUsage = this.tokenTracker.recordUsage(
      estimatedPromptTokens,
      estimatedResponseTokens,
      this.config.ai?.openai?.modelName
    );

    // Log token usage with enhanced formatting
    info(`Token Usage: ${tokenUsage.totalTokens} tokens ($${tokenUsage.cost.toFixed(4)}) in ${duration}ms`, 
      { totalTokens: tokenUsage.totalTokens, cost: tokenUsage.cost, duration }, 'BrowserEngine');

    // Agent history tracking is now handled by the centralized trackAICall system in agent-setup.ts

    return result;
  }

  /**
   * Run a single task
   */
  async runTask(taskDescription: string, testName: string | null = null): Promise<TaskResult> {
    const _timestamp = new Date().toISOString();
    const name = testName || `Test-${Date.now()}`;

    logWithIcon(LogLevel.INFO, 'target', `Running Task: ${name}`, { taskDescription, startTime: _timestamp }, 'BrowserEngine');

    // Create test session
    const session = await this.createTestSession(name, name.replace(/\s+/g, '-').toLowerCase());

    try {
      // Log initial step
      this.logTestStep('Test started', null, null, `Starting task: ${taskDescription}`, true);

      // Always take screenshot for first step (important evidence)
      await this.takeStepScreenshot('Initial page state');

      // Build initial context message for the agent
      const messages = buildInitialMessages(taskDescription);

      const finalState = await this.invokeAgentWithTracking(
        {
          messages,
        },
        {
          recursionLimit: AGENT_CONFIG.agent.recursionLimit,
          configurable: { thread_id: `session-${this.currentTestSession?.sessionId || 'default'}` },
        },
        `Task execution: ${taskDescription}`
      );

      const result =
        finalState.messages?.[finalState.messages.length - 1]?.content || 'Task completed';

      // Log final step
      this.logTestStep('Test completed', null, null, result, true);

      // Always take screenshot for last step (important evidence)
      await this.takeStepScreenshot('Final page state');

      // Finish session
      await this.finishTestSession('SUCCESS', result);

      logSuccess(`Task "${name}" completed successfully!`, { result }, 'BrowserEngine');

      return {
        testName: name,
        task: taskDescription,
        timestamp: _timestamp,
        status: 'SUCCESS',
        result,
        duration: Date.now() - new Date(_timestamp).getTime(),
        sessionDir: session.sessionDir,
      };
    } catch (error: any) {
      console.error(`\n❌ Task "${name}" failed:`);
      console.error(`💥 Error: ${error.message}\n`);

      // Log error step
      this.logTestStep('Test failed', null, null, error.message, false);
      await this.takeStepScreenshot('Error state');

      // Finish session with failure
      await this.finishTestSession('FAILED', error.message);

      return {
        testName: name,
        task: taskDescription,
        timestamp: _timestamp,
        status: 'FAILED',
        error: error.message,
        duration: Date.now() - new Date(_timestamp).getTime(),
        sessionDir: session.sessionDir,
      };
    }
  }

  /**
   * Run a single test
   */
  async runSingleTest(
    test: TestConfig
  ): Promise<{ success: boolean; session?: any; error?: string }> {
    // Only show detailed logs if not using console reporter (for backwards compatibility)
    const useDetailedLogs = !process.env.ENDORPHIN_CONSOLE_REPORTER;

    if (useDetailedLogs) {
      logWithIcon(LogLevel.INFO, 'rocket', `Starting test: ${test.id} - ${test.name}`, {
        description: test.description,
        priority: test.priority,
        tags: test.tags || []
      }, 'BrowserEngine');
    }

    // Create test session with detailed tracking
    await this.createTestSession(test.name, test.id);

    try {
      this.logTestStep(
        `Starting test execution: ${test.name}`,
        null,
        null,
        `Test ID: ${test.id}`,
        true
      );

      // Global setup is now executed at CLI level before framework initialization

      // Execute setup function if present
      let setupData: any = null;
      if (test.setup && typeof test.setup === 'function') {
        if (useDetailedLogs) {
          info('Executing test setup', {}, 'BrowserEngine');
        }
        setupData = await test.setup();
        this.logTestStep('Test setup completed', null, null, 'Setup data generated', true);
      }

      // Execute data generation function if present
      let generatedData: any = null;
      if (test.data) {
        if (typeof test.data === 'function') {
          if (useDetailedLogs) {
            info('Generating test data', {}, 'BrowserEngine');
          }
          generatedData = await test.data();
          this.logTestStep('Test data generated', null, null, 'Data generation completed', true);
          // Log the generated data in debug mode
          if (process.env.ENDORPHIN_DEBUG === 'true' || process.env.ENDORPHIN_DEBUG === 'verbose' || process.env.ENDORPHIN_LOG_LEVEL === 'DEBUG') {
            logWithIcon(LogLevel.DEBUG, 'debug', `Generated test data: ${JSON.stringify(generatedData, null, 2)}`, { data: generatedData }, 'BrowserEngine');
          }
        } else {
          generatedData = test.data;
        }
      }

      // Process task - support both string and function
      let taskDescription: string;
      if (test.task) {
        if (typeof test.task === 'function') {
          if (useDetailedLogs) {
            logWithIcon(LogLevel.INFO, 'target', 'Executing task function with generated data', {}, 'BrowserEngine');
          }
          taskDescription = await test.task(generatedData, setupData);
          this.logTestStep(
            'Task function executed',
            null,
            null,
            'Task description generated',
            true
          );
        } else {
          taskDescription = test.task;
        }
      } else {
        throw new Error('Test must have either task (single-user) or users + tasks (multi-user)');
      }

      if (useDetailedLogs) {
        info('Final task description', { taskDescription }, 'BrowserEngine');
      }

      // Execute the test task with timeout
      const messages = buildInitialMessages(taskDescription);

      // Add timeout to prevent infinite loops
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () =>
            reject(
              new TestTimeoutError('Test execution timeout', {
                testId: test.id,
                testName: test.name,
                timeout: TIMEOUTS.AGENT_TIMEOUT,
              })
            ),
          TIMEOUTS.AGENT_TIMEOUT
        );
      });

      const agentPromise = this.invokeAgentWithTracking(
        { messages },
        {
          recursionLimit: AGENT_CONFIG.agent.recursionLimit,
          configurable: { thread_id: `session-${this.currentTestSession!.sessionId}` },
        },
        `Test execution: ${test.name}`
      );

      const finalState = await Promise.race([agentPromise, timeoutPromise]);

      // Analyze the final conversation state for test result
      const testResult = await this.analyzeTestResultWithValidation(finalState, taskDescription);

      this.logTestStep(
        `Test execution ${testResult.status.toLowerCase()}`,
        null,
        null,
        testResult.conclusion,
        testResult.status === 'SUCCESS'
      );

      // Finish the test session with proper analysis
      const session = await this.finishTestSession(testResult.status, testResult.conclusion);

      if (useDetailedLogs) {
        logSuccess(`Test ${test.id} ${testResult.status.toLowerCase()}!`, { testId: test.id, status: testResult.status }, 'BrowserEngine');
      }
      return { success: testResult.status === 'SUCCESS', session };
    } catch (error: any) {
      if (useDetailedLogs) {
        console.error(`❌ Test ${test.id} failed:`, error.message);
      }

      this.logTestStep('Test execution failed', null, null, error.message, false);
      const session = await this.finishTestSession('FAILED', error.message);

      return { success: false, error: error.message, session };
    }
  }

  /**
   * Finish current test session
   */
  async finishTestSession(
    status: 'SUCCESS' | 'FAILED' = 'SUCCESS',
    finalResult: string | null = null
  ): Promise<any> {
    if (!this.currentTestSession) return;

    this.currentTestSession.endTime = new Date().toISOString();
    this.currentTestSession.status = status;
    if (finalResult !== null) {
      this.currentTestSession.finalResult = finalResult;

      // Always save the final result as conclusion for detailed reporting
      if (typeof finalResult === 'string' && finalResult.trim().length > 0) {
        this.currentTestSession.conclusion = finalResult.trim();
      }
    }
    this.currentTestSession.duration =
      new Date(this.currentTestSession.endTime).getTime() -
      new Date(this.currentTestSession.startTime).getTime();

    // Add token summary to session
    this.currentTestSession.tokenSummary = this.tokenTracker.getSessionSummary();

    // Save session data
    const summary = await saveTestSession(this.currentTestSession);

    info(`Test session completed: ${status}`, {
      status,
      sessionDir: this.currentTestSession.sessionDir,
      tokenSummary: this.tokenTracker.getFormattedSummary()
    }, 'BrowserEngine');

    this.currentTestSession = null;
    return summary;
  }

  /**
   * Enable interactive mode
   */
  async enableInteractiveMode(): Promise<void> {
    this.isInteractiveMode = true;
    info('Interactive mode enabled - results will be recorded in test-recorder folder', {}, 'BrowserEngine');
    await DirectoryManager.cleanupRecorderDirectory(this.recorderBaseDir);
  }

  /**
   * Disable interactive mode
   */
  disableInteractiveMode(): void {
    this.isInteractiveMode = false;
  }

  /**
   * Set interactive mode
   */
  setInteractiveMode(interactive: boolean): void {
    this.isInteractiveMode = interactive;
  }

  /**
   * Cleanup engine resources
   */
  async cleanup(): Promise<void> {
    try {
      // Clean up page snapshots first to free memory
      if (this.snapshotManager) {
        this.snapshotManager.clearAll();
        info('Page snapshots cleared', {}, 'BrowserEngine');
      }

      // Clean up browser resources
      await this.browserManager.cleanup();

      // Force cleanup of any remaining resources to prevent memory leaks
      await this.resourceManager.disposeAll();

      // Reset global setup flag for future tests
      this.globalSetupExecuted = false;
    } catch (error) {
      const cleanupError = createErrorFromUnknown(error, 'Cleanup failed', {
        component: 'BrowserEngine',
        operation: 'cleanup',
      });
      console.error('❌ Cleanup error:', cleanupError.message);
      throw cleanupError;
    }
  }

  // Public getters for framework compatibility
  get currentPage() {
    return this.browserManager.isInitialized() ? this.browserManager.getPage() : null;
  }

  get currentBrowser() {
    return this.browserManager.isInitialized() ? this.browserManager.getBrowser() : null;
  }

  get currentContext() {
    return this.browserManager.isInitialized() ? this.browserManager.getContext() : null;
  }

  get activeTestSession(): TestSession | null {
    return this.currentTestSession;
  }

  get frameworkConfig(): FrameworkConfig {
    return this.config;
  }

  getBrowserManager(): BrowserManager {
    return this.browserManager;
  }

  getSnapshotManager(): PageSnapshotManager {
    return this.snapshotManager;
  }

  /**
   * Analyze test result with validation agent
   */
  private async analyzeTestResultWithValidation(
    finalState: any,
    testTask: string
  ): Promise<{ status: 'SUCCESS' | 'FAILED'; conclusion: string }> {
    const messages = finalState?.messages || [];

    // First try quick validation
    const quickResult = this.validationAgent.quickValidate(messages);

    // If we have high confidence, use quick result
    if (quickResult.confidence >= 0.8) {
      return {
        status: quickResult.status,
        conclusion: quickResult.conclusion,
      };
    }

    // Otherwise, do full analysis with validation agent
    try {
      const validationResult = await this.validationAgent.analyzeTestExecution(messages, testTask);
      return {
        status: validationResult.status,
        conclusion: validationResult.conclusion,
      };
    } catch {
      console.error('Validation agent failed, falling back to pattern analysis');
      return this.analyzeTestResult(finalState);
    }
  }

  /**
   * Analyze the final agent state to determine test result and extract conclusion
   */
  private analyzeTestResult(finalState: any): { status: 'SUCCESS' | 'FAILED'; conclusion: string } {
    const messages = finalState?.messages || [];
    if (messages.length === 0) {
      return {
        status: 'FAILED',
        conclusion: 'No agent response received',
      };
    }

    const lastMessage = messages[messages.length - 1];
    const content = typeof lastMessage.content === 'string' ? lastMessage.content : '';
    const trimmedContent = content.trim().toLowerCase();

    // Check for validation failure patterns first
    const validationFailurePatterns = [
      'verification failed',
      'unable to verify',
      'verification step was looking for the wrong',
      'expected.*not visible',
      'not found on the page',
      'timeout.*exceeded',
      'element not found',
      'wrong username',
      'incorrect.*displayed',
      'login was not successful',
      'authentication failed',
    ];

    const hasValidationFailure = validationFailurePatterns.some((pattern) => {
      const regex = new RegExp(pattern, 'i');
      return regex.test(trimmedContent);
    });

    if (hasValidationFailure) {
      return {
        status: 'FAILED',
        conclusion: content || 'Test failed due to validation failure',
      };
    }

    // Check for explicit test failure patterns
    const testFailPatterns = [
      'test failed',
      'test execution failed',
      'e2e test failed',
      'test completed with failures',
      'cannot continue with test execution',
      'test aborted due to error',
      'critical error in test execution',
      'test failed',
      'step failed',
      'unable to complete all steps',
    ];

    const hasTestFailure = testFailPatterns.some((pattern) => trimmedContent.includes(pattern));

    if (hasTestFailure) {
      return {
        status: 'FAILED',
        conclusion: content || 'Test execution failed',
      };
    }

    // Check for successful completion patterns
    const testPassPatterns = [
      'test completed successfully',
      'all test steps completed successfully',
      'e2e test passed',
      'test execution finished successfully',
      'all steps have been completed and the test passed',
      'all numbered steps completed successfully',
      'final step completed - test passed',
      'step completion confirmed - test successful',
    ];

    const hasTestSuccess = testPassPatterns.some((pattern) => trimmedContent.includes(pattern));

    if (hasTestSuccess) {
      return {
        status: 'SUCCESS',
        conclusion: content || 'Test completed successfully',
      };
    }

    // If no clear completion pattern, check if we have a meaningful conclusion
    if (content.length > 50) {
      // Default to FAILED if we can't determine success explicitly
      // This is conservative - tests should explicitly indicate success
      return {
        status: 'FAILED',
        conclusion: content || 'Test completed but success could not be verified',
      };
    }

    return {
      status: 'FAILED',
      conclusion: 'Test completed with unclear result',
    };
  }

  /**
   * Execute global setup if configured and not already executed
   */
  private async executeGlobalSetupIfNeeded(): Promise<void> {
    // Skip if already executed or not configured
    if (this.globalSetupExecuted || !this.config.globalSetup) {
      return;
    }

    info('Executing global setup', {}, 'BrowserEngine');

    try {
      const result = await this.globalSetupManager.loadAndExecute(this.config.globalSetup);

      if (!result.success) {
        throw new Error(`Global setup failed: ${result.error?.message || 'Unknown error'}`);
      }

      this.globalSetupExecuted = true;
      logSuccess(`Global setup completed successfully in ${result.executionTime}ms`, { executionTime: result.executionTime }, 'BrowserEngine');
    } catch (error: any) {
      logError('Global setup failed', error, { message: error.message }, 'BrowserEngine');
      throw error; // Re-throw to fail the test
    }
  }
}

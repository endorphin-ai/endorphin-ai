/**
 * Test Framework with Dependency Injection
 * Modern version using DI container for service management
 */

import { HumanMessage } from '@langchain/core/messages';
import * as path from 'node:path';
import { setupAgent } from '../ai/agent-setup.js';
import type {
  AgentInvokeParams,
  AgentResponse,
  LangChainAgent,
  LangChainTool,
} from '../types/agent.js';
import { TestTimeoutError } from '../types/errors.js';
import type { FrameworkConfig, TaskResult, TestConfig, TestSession } from '../types/index.js';

// DI imports
import { BrowserManager } from '../automation/browser/browser-manager.js';
import { PageSnapshotManager } from '../managers/content/snapshot-manager.js';
import { HtmlReporter } from '../reporters/html-reporter.js';
import { ConfigManager } from './config-manager.js';
import { DependencyContainer, createContainer } from './dependency-container.js';
import { Logger, logWithIcon, LogLevel } from './logger.js';
import { ResourceManager } from './resource-manager.js';
import { SERVICE_NAMES, ServiceRegistry } from './service-registry.js';
import { SessionManager } from './session-manager.js';
import { TokenTracker } from './token-tracker.js';
import { ToolManager } from './tool-manager.js';

export interface TestFrameworkDIOptions {
  enableLogging?: boolean;
  container?: DependencyContainer;
  customConfig?: Partial<FrameworkConfig>;
}

export interface NaturalLanguageResult {
  result: string;
  error?: string;
  duration: number;
  tokenUsage?: any;
}

/**
 * Test Framework with Dependency Injection
 * Uses DI container to manage service lifecycle and dependencies
 */
export class TestFrameworkDI {
  private container: DependencyContainer;
  private serviceRegistry: ServiceRegistry;
  private agent: LangChainAgent | null = null;
  private isInteractiveMode: boolean = false;
  private initialized = false;
  private logger?: Logger;

  constructor(options: TestFrameworkDIOptions = {}) {
    // Create or use provided container
    this.container =
      options.container ||
      createContainer({
        enableAutoResolution: true,
        enableCircularDependencyDetection: true,
        enableLogging: options.enableLogging || false,
      });

    this.serviceRegistry = new ServiceRegistry(this.container);
  }

  /**
   * Initialize the framework with dependency injection
   */
  async initialize(config: Partial<FrameworkConfig> = {}): Promise<void> {
    if (this.initialized) {
      throw new Error('Framework is already initialized');
    }

    try {
      // Register all framework services
      await this.serviceRegistry.registerFrameworkServices({
        enableLogging: true,
        customConfig: config,
      });

      // Initialize services
      await this.serviceRegistry.initializeServices();

      // Get logger after initialization
      this.logger = await this.container.resolve<Logger>(SERVICE_NAMES.LOGGER);
      this.logger.info('Test Framework DI initialized successfully');

      // Setup AI agent
      await this.setupAgent();

      this.initialized = true;
    } catch (error: any) {
      console.error('Failed to initialize Test Framework DI:', error);
      throw error;
    }
  }

  /**
   * Run a test with the given configuration
   */
  async runTest(testConfig: TestConfig): Promise<TaskResult> {
    this.ensureInitialized();

    const logger = await this.getLogger();
    logger.info(`Running test: ${testConfig.name}`, {
      testId: testConfig.id,
      url: (testConfig as any).url,
    });

    try {
      const sessionManager = await this.container.resolve<SessionManager>(
        SERVICE_NAMES.SESSION_MANAGER
      );
      const browserManager = await this.container.resolve<BrowserManager>(
        SERVICE_NAMES.BROWSER_MANAGER
      );

      // Create test session
      const session = await sessionManager.createSession(testConfig.name, testConfig.id);

      // Navigate to test URL if provided
      if ((testConfig as any).url) {
        await browserManager.navigateToUrl((testConfig as any).url);
      }

      // Execute test instructions
      const result = await this.executeTest(testConfig, session);

      // Complete session
      await sessionManager.completeSession(
        (result as any).success,
        (result as any).error,
        (result as any).report
      );

      logger.info(`Test completed: ${(result as any).success ? 'SUCCESS' : 'FAILED'}`, {
        testId: testConfig.id,
        duration: result.duration,
      });

      return result;
    } catch (error: any) {
      const logger = await this.getLogger();
      logger.error('Test execution failed', error, {
        testId: testConfig.id,
        testName: testConfig.name,
      });

      // Complete session with error
      const sessionManager = await this.container.resolve<SessionManager>(
        SERVICE_NAMES.SESSION_MANAGER
      );
      await sessionManager.completeSession(false, error.message);

      throw error;
    }
  }

  /**
   * Execute natural language instruction
   */
  async executeNaturalLanguageInstruction(instruction: string): Promise<NaturalLanguageResult> {
    this.ensureInitialized();

    const logger = await this.getLogger();
    logger.info('Executing natural language instruction', { instruction });

    try {
      const startTime = Date.now();

      if (!this.agent) {
        throw new Error('Agent not initialized. Call initialize() first.');
      }

      // Get optimized page content for AI context
      const optimizedContent = await this.getOptimizedPageContent();

      // Create enhanced prompt with context
      const enhancedPrompt = this.createEnhancedPrompt(instruction, optimizedContent);

      // Get execution config
      const configManager = await this.container.resolve<ConfigManager>(
        SERVICE_NAMES.CONFIG_MANAGER
      );
      const executionConfig = configManager.getExecutionConfig();

      // Execute with timeout and tracking
      const result = await this.executeWithTimeout(
        () => this.invokeAgent(enhancedPrompt),
        executionConfig.timeout
      );

      const duration = Date.now() - startTime;

      logger.info('Natural language instruction completed', {
        instruction,
        duration,
        success: (result as any).success,
      });

      const tokenTracker = await this.container.resolve<TokenTracker>(SERVICE_NAMES.TOKEN_TRACKER);

      return {
        result: (result as any).output,
        error: (result as any).error,
        duration,
        tokenUsage: tokenTracker.getSessionSummary(),
      } as NaturalLanguageResult;
    } catch (error: any) {
      const logger = await this.getLogger();
      logger.error('Natural language instruction failed', error, { instruction });

      const tokenTracker = await this.container.resolve<TokenTracker>(SERVICE_NAMES.TOKEN_TRACKER);

      return {
        result: '',
        error: error.message,
        duration: 0,
        tokenUsage: tokenTracker.getSessionSummary(),
      } as NaturalLanguageResult;
    }
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(filename?: string): Promise<string> {
    this.ensureInitialized();

    try {
      const browserManager = await this.container.resolve<BrowserManager>(
        SERVICE_NAMES.BROWSER_MANAGER
      );
      const sessionManager = await this.container.resolve<SessionManager>(
        SERVICE_NAMES.SESSION_MANAGER
      );

      const session = sessionManager.getCurrentSession();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotName = filename || `screenshot-${timestamp}.png`;

      let screenshotPath: string;

      if (session) {
        screenshotPath = path.join(session.sessionDir, screenshotName);
      } else {
        screenshotPath = path.join(process.cwd(), 'screenshots', screenshotName);
      }

      await browserManager.takeScreenshot({ path: screenshotPath });

      logWithIcon(LogLevel.DEBUG, 'debug', 'Screenshot captured', { path: screenshotPath }, 'TestFrameworkDI');

      return screenshotPath;
    } catch (error: any) {
      const logger = await this.getLogger();
      logger.error('Failed to take screenshot', error);
      throw error;
    }
  }

  /**
   * Generate HTML report
   */
  async generateReport(title?: string): Promise<string> {
    this.ensureInitialized();

    const logger = await this.getLogger();
    logger.info('Generating HTML report');

    try {
      const htmlReporter = await this.container.resolve<HtmlReporter>(SERVICE_NAMES.HTML_REPORTER);
      const reportPath = await htmlReporter.generateReport({ title } as any);

      logger.info('HTML report generated', { path: reportPath });

      return reportPath;
    } catch (error: any) {
      logger.error('Failed to generate report', error);
      throw error;
    }
  }

  /**
   * Cleanup framework resources
   */
  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    const logger = await this.getLogger();
    logger.info('Starting framework cleanup');

    try {
      // Close session
      const sessionManager = await this.container.resolve<SessionManager>(
        SERVICE_NAMES.SESSION_MANAGER
      );
      sessionManager.closeSession();

      // Cleanup browser
      const browserManager = await this.container.resolve<BrowserManager>(
        SERVICE_NAMES.BROWSER_MANAGER
      );
      await browserManager.cleanup();

      // Dispose services
      await this.serviceRegistry.dispose();

      this.initialized = false;
      logger.info('Framework cleanup completed');
    } catch (error: any) {
      console.error('Error during framework cleanup:', error);
    }
  }

  /**
   * Get framework status
   */
  async getStatus() {
    if (!this.initialized) {
      return {
        initialized: false,
        hasActiveSession: false,
        toolCount: 0,
        tokenUsage: null,
        currentUrl: null,
      };
    }

    const browserManager = await this.container.resolve<BrowserManager>(
      SERVICE_NAMES.BROWSER_MANAGER
    );
    const sessionManager = await this.container.resolve<SessionManager>(
      SERVICE_NAMES.SESSION_MANAGER
    );
    const toolManager = await this.container.resolve<ToolManager>(SERVICE_NAMES.TOOL_MANAGER);
    const tokenTracker = await this.container.resolve<TokenTracker>(SERVICE_NAMES.TOKEN_TRACKER);

    return {
      initialized: this.initialized,
      hasActiveSession: sessionManager.hasActiveSession(),
      toolCount: toolManager.getToolCount(),
      tokenUsage: tokenTracker.getSessionSummary(),
      currentUrl: browserManager.isInitialized() ? browserManager.getCurrentUrl() : null,
    };
  }

  /**
   * Get service from container
   */
  async getService<T>(serviceName: string): Promise<T> {
    this.ensureInitialized();
    return await this.container.resolve<T>(serviceName);
  }

  /**
   * Get container statistics
   */
  getContainerStats() {
    return this.serviceRegistry.getServiceStatistics();
  }

  // Backward compatibility methods

  /**
   * @deprecated Use getService(SERVICE_NAMES.BROWSER_MANAGER) instead
   */
  async getBrowserManager(): Promise<BrowserManager> {
    return await this.getService<BrowserManager>(SERVICE_NAMES.BROWSER_MANAGER);
  }

  /**
   * @deprecated Use getService(SERVICE_NAMES.CONFIG_MANAGER) instead
   */
  async getConfigManager(): Promise<ConfigManager> {
    return await this.getService<ConfigManager>(SERVICE_NAMES.CONFIG_MANAGER);
  }

  /**
   * @deprecated Use browserManager.getPage() instead
   */
  async getPage() {
    const browserManager = await this.getBrowserManager();
    return browserManager.getPage();
  }

  /**
   * @deprecated Use configManager.getConfig() instead
   */
  async getConfig(): Promise<FrameworkConfig> {
    const configManager = await this.getConfigManager();
    return configManager.getConfig();
  }

  /**
   * @deprecated Use toolManager.getTools() instead
   */
  async getTools(): Promise<LangChainTool[]> {
    const toolManager = await this.getService<ToolManager>(SERVICE_NAMES.TOOL_MANAGER);
    return toolManager.getTools();
  }

  // Private methods

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Framework not initialized. Call initialize() first.');
    }
  }

  private async getLogger(): Promise<Logger> {
    if (!this.logger) {
      this.logger = await this.container.resolve<Logger>(SERVICE_NAMES.LOGGER);
    }
    return this.logger;
  }

  private async setupAgent(): Promise<void> {
    const logger = await this.getLogger();
    logWithIcon(LogLevel.DEBUG, 'debug', 'Setting up AI agent', {}, 'TestFrameworkDI');

    try {
      const configManager = await this.container.resolve<ConfigManager>(
        SERVICE_NAMES.CONFIG_MANAGER
      );
      const toolManager = await this.container.resolve<ToolManager>(SERVICE_NAMES.TOOL_MANAGER);

      const aiConfig = configManager.getAIConfig();
      const tools = await toolManager.setupTools(this);

      this.agent = await setupAgent(tools);

      logger.info('AI agent setup completed', {
        toolCount: tools.length,
        model: aiConfig.openai.modelName,
      });
    } catch (error: any) {
      logger.error('Failed to setup agent', error);
      throw error;
    }
  }

  private async executeTest(testConfig: TestConfig, _session: TestSession): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      // Execute test instructions
      const result = await this.executeNaturalLanguageInstruction((testConfig as any).instructions);

      const duration = Date.now() - startTime;

      return {
        testName: 'Unknown',
        task: 'Natural language command',
        timestamp: new Date().toISOString(),
        status: 'FAILED' as const,
        error: (result as any).error,
        duration,
        sessionDir: '',
      } as TaskResult;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      const tokenTracker = await this.container.resolve<TokenTracker>(SERVICE_NAMES.TOKEN_TRACKER);

      return {
        error: error.message,
        duration,
        tokenUsage: tokenTracker.getSessionSummary(),
      } as TaskResult;
    }
  }

  private async getOptimizedPageContent(): Promise<string> {
    try {
      const browserManager = await this.container.resolve<BrowserManager>(
        SERVICE_NAMES.BROWSER_MANAGER
      );
      const snapshotManager = await this.container.resolve<PageSnapshotManager>(
        SERVICE_NAMES.PAGE_SNAPSHOT_MANAGER
      );

      if (!browserManager.isInitialized()) {
        return '';
      }

      const page = browserManager.getPage();
      const url = page.url();

      return await snapshotManager.createSnapshot(page, url);
    } catch (error: any) {
      const logger = await this.getLogger();
      logger.warn('Failed to get optimized page content', error);
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

    const startTime = Date.now();

    try {
      const response = await this.agent.invoke(params);
      const _duration = Date.now() - startTime;

      // Track tokens (estimation for now)
      const tokenTracker = await this.container.resolve<TokenTracker>(SERVICE_NAMES.TOKEN_TRACKER);
      const configManager = await this.container.resolve<ConfigManager>(
        SERVICE_NAMES.CONFIG_MANAGER
      );

      tokenTracker.recordUsage(
        Math.ceil(prompt.length / 4), // Rough token estimation
        Math.ceil(((response as any).output || '').length / 4),
        configManager.getAIConfig().openai.modelName
      );

      return {
        messages: [], // Add required property
        output: (response as any).output || '',
        error: undefined,
      } as unknown as AgentResponse;
    } catch (error: any) {
      const logger = await this.getLogger();
      logger.error('Agent invocation failed', error);

      return {
        output: '',
        error: error.message,
      } as AgentResponse;
    }
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>, timeout: number): Promise<T> {
    const resourceManager = await this.container.resolve<ResourceManager>(
      SERVICE_NAMES.RESOURCE_MANAGER
    );
    const controllerId = `timeout-${Date.now()}-${Math.random()}`;
    const abortController = resourceManager.createAbortController(controllerId);

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
      resourceManager.disposeAbortController(controllerId);
    }
  }
}

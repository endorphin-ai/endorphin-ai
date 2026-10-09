/**
 * Configuration Manager
 * Handles framework configuration merging, validation, and access
 */

import type { BrowserConfig, ExecutionConfig, FrameworkConfig } from '../types/index.js';

export class ConfigManager {
  private config: FrameworkConfig;

  constructor(userConfig: Partial<FrameworkConfig> = {}) {
    this.config = this.mergeWithDefaults(userConfig);
    this.validateConfig();
  }

  /**
   * Get the current configuration
   */
  getConfig(): FrameworkConfig {
    return { ...this.config };
  }

  /**
   * Get browser configuration
   */
  getBrowserConfig(): BrowserConfig {
    return { ...this.config.browser };
  }

  /**
   * Get execution configuration
   */
  getExecutionConfig(): ExecutionConfig {
    const execution = this.config.execution || { timeout: 30000 };
    return {
      timeout: execution.timeout,
    };
  }

  /**
   * Get AI configuration
   */
  getAIConfig() {
    return { ...this.config.ai };
  }

  /**
   * Get directories configuration
   */
  getDirectories() {
    return {
      tests: this.config.testsDirectory,
      data: this.config.dataDirectory,
      results: this.config.resultsDirectory,
    };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(updates: Partial<FrameworkConfig>): void {
    this.config = this.mergeWithDefaults(updates, this.config);
    this.validateConfig();
  }

  /**
   * Merge user configuration with defaults
   */
  private mergeWithDefaults(
    userConfig: Partial<FrameworkConfig>,
    baseConfig?: FrameworkConfig
  ): FrameworkConfig {
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
          apiKey: process.env.OPENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '',
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

    const base = baseConfig || defaultConfig;

    // Map user's shorthand ai.model → ai.openai.modelName
    const userAI = userConfig.ai as any;
    const openaiOverrides: any = { ...(userConfig.ai?.openai || {}) };
    if (userAI?.model && typeof userAI.model === 'string') {
      openaiOverrides.modelName = userAI.model;
    }
    if (userAI?.temperature !== undefined && typeof userAI.temperature === 'number') {
      openaiOverrides.temperature = userAI.temperature;
    }

    // For Gemini models, pick up GOOGLE_API_KEY if no apiKey set
    const resolvedModel = openaiOverrides.modelName || base.ai?.openai?.modelName || '';
    if (resolvedModel.startsWith('gemini-') && !openaiOverrides.apiKey && !base.ai?.openai?.apiKey) {
      const googleKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
      if (googleKey) {
        openaiOverrides.apiKey = googleKey;
      }
    }

    // Deep merge: base first, then user config for nested objects
    return {
      ...base,
      ...userConfig,
      browser: {
        ...base.browser,
        ...(userConfig.browser || {}),
      },
      ai: {
        ...base.ai,
        ...(userConfig.ai || {}),
        openai: {
          ...base.ai?.openai,
          ...openaiOverrides,
        },
        agent: {
          ...base.ai?.agent,
          ...(userConfig.ai?.agent || {}),
        },
      },
      execution: {
        timeout: userConfig.execution?.timeout ?? base.execution?.timeout ?? 30000,
      },
    };
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    // Browser validation
    const browserType = this.config.browser?.type || 'chromium';
    if (!['chromium', 'firefox', 'webkit'].includes(browserType)) {
      throw new Error(`Invalid browser type: ${browserType}`);
    }

    if (this.config.browser.timeout < 1000) {
      throw new Error('Browser timeout must be at least 1000ms');
    }

    if (this.config.browser.viewport.width < 1 || this.config.browser.viewport.height < 1) {
      throw new Error('Viewport dimensions must be positive');
    }

    // AI validation
    if (!this.config.ai?.openai?.apiKey) {
      const model = this.config.ai?.openai?.modelName || '';
      if (model.startsWith('gemini-')) {
        throw new Error('Google API key is required. Set GOOGLE_API_KEY or GEMINI_API_KEY environment variable.');
      } else {
        throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.');
      }
    }

    if (!this.config.ai.openai.modelName) {
      throw new Error('AI model name is required');
    }

    if (this.config.ai.openai.temperature < 0 || this.config.ai.openai.temperature > 2) {
      throw new Error('Temperature must be between 0 and 2');
    }

    if (this.config.ai.openai.maxTokens < 1) {
      throw new Error('Max tokens must be positive');
    }

    // Execution validation
    const execution = this.config.execution || { timeout: 30000 };
    if (execution.timeout < 1000) {
      throw new Error('Execution timeout must be at least 1000ms');
    }

    // Directory validation
    if (!this.config.testsDirectory || this.config.testsDirectory.trim() === '') {
      throw new Error('Tests directory must be specified');
    }

    if (!this.config.dataDirectory || this.config.dataDirectory.trim() === '') {
      throw new Error('Data directory must be specified');
    }

    if (!this.config.resultsDirectory || this.config.resultsDirectory.trim() === '') {
      throw new Error('Results directory must be specified');
    }

    // Environment validation
    if (!['development', 'staging', 'production'].includes(this.config.environment)) {
      throw new Error(`Invalid environment: ${this.config.environment}`);
    }
  }

  /**
   * Get browser type
   */
  getBrowserType() {
    switch (this.config.browser.type) {
      case 'firefox':
        return 'firefox';
      case 'webkit':
        return 'webkit';
      case 'chromium':
      default:
        return 'chromium';
    }
  }

  /**
   * Get browser launch options
   */
  getBrowserLaunchOptions() {
    return {
      headless: this.config.browser.headless,
      slowMo: this.config.browser.slowMo,
      devtools: this.config.browser.devtools,
      args: ['--start-maximized'],
    };
  }

  /**
   * Get browser context options
   */
  getBrowserContextOptions() {
    return {
      viewport: this.config.browser.viewport,
      recordVideo: this.config.browser.recordVideo
        ? {
            dir: 'test-results/videos/',
            size: this.config.browser.viewport,
          }
        : undefined,
      recordHar: this.config.browser.recordHar
        ? {
            path: 'test-results/network.har',
          }
        : undefined,
    };
  }

  /**
   * Check if configuration is valid
   */
  isValid(): boolean {
    try {
      this.validateConfig();
      return true;
    } catch {
      return false;
    }
  }
}

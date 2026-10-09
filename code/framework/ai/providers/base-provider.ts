/**
 * Base AI Provider Interface
 * Defines the contract for all AI providers (OpenAI, Gemini, Claude, etc.)
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

export interface TokenUsage {
  promptTokens: number;
  responseTokens: number;
  totalTokens: number;
  cost: number;
  model: string;
}

export interface ProviderConfig {
  model: string;
  temperature?: number;
  maxRetries?: number;
  apiKey?: string;
  maxTokens?: number;
  timeout?: number;
}

export abstract class BaseAIProvider {
  protected config: ProviderConfig;
  protected modelName: string;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.modelName = config.model;
  }

  /**
   * Get the provider name (e.g., 'openai', 'gemini', 'claude')
   */
  abstract getProviderName(): string;

  /**
   * Create a chat model instance for this provider
   */
  abstract createChatModel(): BaseChatModel;

  /**
   * Validate that the provider is properly configured
   */
  abstract validateConfig(): { isValid: boolean; error?: string };

  /**
   * Calculate token usage and cost from a response
   * @param response - The model response
   * @param promptText - The input prompt text
   * @param responseText - The response text
   */
  abstract calculateTokenUsage(
    response: any,
    promptText: string,
    responseText: string
  ): TokenUsage;

  /**
   * Get the API key for this provider
   */
  protected getApiKey(): string | undefined {
    // Priority: config.apiKey > environment variable
    return this.config.apiKey || this.getEnvironmentApiKey();
  }

  /**
   * Get the API key from environment variables
   * Override in subclasses for provider-specific env vars
   */
  protected abstract getEnvironmentApiKey(): string | undefined;

  /**
   * Check if this provider supports the given model
   */
  abstract supportsModel(modelName: string): boolean;

  /**
   * Get default configuration for this provider
   */
  abstract getDefaultConfig(): Partial<ProviderConfig>;
}
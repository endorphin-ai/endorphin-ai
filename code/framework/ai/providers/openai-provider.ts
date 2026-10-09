/**
 * OpenAI Provider Implementation
 * Handles GPT models (gpt-4o, gpt-4, gpt-3.5-turbo, etc.)
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseAIProvider, type ProviderConfig, type TokenUsage } from './base-provider.js';
import { getModelPricing, DEFAULT_MODEL_PRICING } from '../../config/pricing-config.js';

// Lazy-loaded to avoid requiring @langchain/openai when only Gemini is used.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ChatOpenAIClass: any = null;

export class OpenAIProvider extends BaseAIProvider {
  private static readonly SUPPORTED_MODELS = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4',
    'gpt-4-turbo',
    'gpt-4-turbo-preview',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k',
    'gpt-3.5-turbo-instruct',
  ];

  getProviderName(): string {
    return 'openai';
  }

  /**
   * Load @langchain/openai dynamically. Must be called before createChatModel().
   */
  async ensureLoaded(): Promise<void> {
    if (!ChatOpenAIClass) {
      try {
        const mod = await import('@langchain/openai');
        ChatOpenAIClass = mod.ChatOpenAI;
      } catch (err: any) {
        throw new Error(
          `Failed to load @langchain/openai. Install it with: npm install @langchain/openai. Error: ${err.message}`
        );
      }
    }
  }

  createChatModel(): BaseChatModel {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable or provide apiKey in config.');
    }

    if (!ChatOpenAIClass) {
      throw new Error('OpenAIProvider not loaded. Call ensureLoaded() before createChatModel().');
    }

    return new ChatOpenAIClass({
      openAIApiKey: apiKey,
      modelName: this.modelName,
      temperature: this.config.temperature || 0.1,
      maxRetries: this.config.maxRetries || 3,
      ...(this.config.maxTokens ? { maxTokens: this.config.maxTokens } : {}),
      timeout: this.config.timeout || 30000,
    });
  }

  validateConfig(): { isValid: boolean; error?: string } {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        isValid: false,
        error: 'OpenAI API key is required. Set OPENAI_API_KEY environment variable or provide apiKey in config.',
      };
    }

    if (!this.supportsModel(this.modelName)) {
      return {
        isValid: false,
        error: `Model '${this.modelName}' is not a recognized OpenAI model. Supported models: ${OpenAIProvider.SUPPORTED_MODELS.join(', ')}`,
      };
    }

    return { isValid: true };
  }

  calculateTokenUsage(response: any, promptText: string, responseText: string): TokenUsage {
    // Check if response has actual token usage from OpenAI
    if (response?.usage) {
      const usage = response.usage;
      const pricing = getModelPricing(this.modelName, DEFAULT_MODEL_PRICING);
      
      const promptTokens = usage.prompt_tokens || usage.promptTokens || 0;
      const responseTokens = usage.completion_tokens || usage.completionTokens || 0;
      const totalTokens = usage.total_tokens || usage.totalTokens || (promptTokens + responseTokens);
      
      const cost = (promptTokens * pricing.input + responseTokens * pricing.output) / 1000;

      return {
        promptTokens,
        responseTokens,
        totalTokens,
        cost,
        model: this.modelName,
      };
    }

    // Fallback to estimation if no usage data
    const estimatedPromptTokens = Math.ceil(promptText.length / 4);
    const estimatedResponseTokens = Math.ceil(responseText.length / 4);
    const totalTokens = estimatedPromptTokens + estimatedResponseTokens;
    
    const pricing = getModelPricing(this.modelName, DEFAULT_MODEL_PRICING);
    const cost = (estimatedPromptTokens * pricing.input + estimatedResponseTokens * pricing.output) / 1000;

    return {
      promptTokens: estimatedPromptTokens,
      responseTokens: estimatedResponseTokens,
      totalTokens,
      cost,
      model: this.modelName,
    };
  }

  protected getEnvironmentApiKey(): string | undefined {
    return process.env.OPENAI_API_KEY;
  }

  supportsModel(modelName: string): boolean {
    // Check exact match
    if (OpenAIProvider.SUPPORTED_MODELS.includes(modelName)) {
      return true;
    }
    
    // Check if it starts with gpt- (for future models)
    if (modelName.startsWith('gpt-')) {
      return true;
    }
    
    // Check for date-versioned models (e.g., gpt-4o-2024-08-06)
    const baseModel = modelName.split('-20')[0]; // Split at year pattern
    return OpenAIProvider.SUPPORTED_MODELS.includes(baseModel);
  }

  getDefaultConfig(): Partial<ProviderConfig> {
    return {
      model: 'gpt-4o',
      temperature: 0.1,
      maxRetries: 3,
      maxTokens: 8000,
      timeout: 30000,
    };
  }
}
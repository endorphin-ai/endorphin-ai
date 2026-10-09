/**
 * Google Gemini Provider Implementation
 * Handles Gemini models (gemini-pro, gemini-1.5-pro, gemini-2.0-flash, etc.)
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseAIProvider, type ProviderConfig, type TokenUsage } from './base-provider.js';
import { getModelPricing, DEFAULT_MODEL_PRICING, type PricingConfig } from '../../config/pricing-config.js';

// Lazy-loaded to avoid requiring @langchain/google-genai when only OpenAI is used.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ChatGoogleGenerativeAIClass: any = null;

export class GeminiProvider extends BaseAIProvider {
  private static readonly SUPPORTED_MODELS = [
    'gemini-pro',
    'gemini-pro-vision',
    'gemini-1.5-pro',
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-2.0-flash',
    'gemini-2.0-flash-thinking',
    'gemini-2.0-flash-exp',
  ];

  // Updated pricing for Gemini models (as of 2025)
  private static readonly GEMINI_PRICING: PricingConfig = {
    'gemini-1.5-pro': {
      input: 0.00125,  // $1.25 per 1M chars ≈ $0.00125 per 1K tokens
      output: 0.005,   // $5 per 1M chars ≈ $0.005 per 1K tokens
    },
    'gemini-1.5-flash': {
      input: 0.000075, // $0.075 per 1M chars
      output: 0.0003,  // $0.30 per 1M chars
    },
    'gemini-2.0-flash': {
      input: 0.000075, // Same as 1.5-flash
      output: 0.0003,
    },
    'gemini-pro': {
      input: 0.0005,
      output: 0.0015,
    },
    'gemini-pro-vision': {
      input: 0.0005,
      output: 0.0015,
    },
  };

  getProviderName(): string {
    return 'gemini';
  }

  /**
   * Load @langchain/google-genai dynamically. Must be called before createChatModel().
   * This avoids requiring the package at module load time when only OpenAI is used.
   */
  async ensureLoaded(): Promise<void> {
    if (!ChatGoogleGenerativeAIClass) {
      try {
        const mod = await import('@langchain/google-genai');
        ChatGoogleGenerativeAIClass = mod.ChatGoogleGenerativeAI;
      } catch (err: any) {
        throw new Error(
          `Failed to load @langchain/google-genai. Install it with: npm install @langchain/google-genai. Error: ${err.message}`
        );
      }
    }
  }

  createChatModel(): BaseChatModel {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Google API key is required. Set GOOGLE_API_KEY or GEMINI_API_KEY environment variable or provide apiKey in config.');
    }

    if (!ChatGoogleGenerativeAIClass) {
      throw new Error('GeminiProvider not loaded. Call ensureLoaded() before createChatModel().');
    }

    // Map model names to Gemini's expected format
    let modelName = this.modelName;

    // Handle common variations
    if (modelName === 'gemini-1.5-pro') {
      modelName = 'gemini-1.5-pro-latest';
    } else if (modelName === 'gemini-1.5-flash') {
      modelName = 'gemini-1.5-flash-latest';
    }

    return new ChatGoogleGenerativeAIClass({
      apiKey,
      model: modelName,
      temperature: this.config.temperature || 0.1,
      maxRetries: this.config.maxRetries || 3,
      maxOutputTokens: this.config.maxTokens || 8192,
    });
  }

  validateConfig(): { isValid: boolean; error?: string } {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        isValid: false,
        error: 'Google API key is required. Set GOOGLE_API_KEY or GEMINI_API_KEY environment variable or provide apiKey in config.',
      };
    }

    if (!this.supportsModel(this.modelName)) {
      return {
        isValid: false,
        error: `Model '${this.modelName}' is not a recognized Gemini model. Supported models: ${GeminiProvider.SUPPORTED_MODELS.join(', ')}`,
      };
    }

    return { isValid: true };
  }

  calculateTokenUsage(response: any, promptText: string, responseText: string): TokenUsage {
    // Gemini uses character count, we need to estimate tokens
    // Rough approximation: 1 token ≈ 4 characters for English text
    
    // Check if response has usage metadata from Gemini
    if (response?.usageMetadata) {
      const usage = response.usageMetadata;
      
      // Gemini provides token counts in some responses
      const promptTokens = usage.promptTokenCount || Math.ceil(promptText.length / 4);
      const responseTokens = usage.candidatesTokenCount || Math.ceil(responseText.length / 4);
      const totalTokens = usage.totalTokenCount || (promptTokens + responseTokens);
      
      // Get pricing for this model
      const modelPricing = this.getModelPricing();
      const cost = (promptTokens * modelPricing.input + responseTokens * modelPricing.output) / 1000;

      return {
        promptTokens,
        responseTokens,
        totalTokens,
        cost,
        model: this.modelName,
      };
    }

    // Fallback to estimation
    const estimatedPromptTokens = Math.ceil(promptText.length / 4);
    const estimatedResponseTokens = Math.ceil(responseText.length / 4);
    const totalTokens = estimatedPromptTokens + estimatedResponseTokens;
    
    const modelPricing = this.getModelPricing();
    const cost = (estimatedPromptTokens * modelPricing.input + estimatedResponseTokens * modelPricing.output) / 1000;

    return {
      promptTokens: estimatedPromptTokens,
      responseTokens: estimatedResponseTokens,
      totalTokens,
      cost,
      model: this.modelName,
    };
  }

  private getModelPricing(): { input: number; output: number } {
    // Check our custom Gemini pricing first
    for (const [model, pricing] of Object.entries(GeminiProvider.GEMINI_PRICING)) {
      if (this.modelName.includes(model)) {
        return pricing;
      }
    }
    
    // Fall back to default pricing config
    return getModelPricing(this.modelName, {
      ...DEFAULT_MODEL_PRICING,
      ...GeminiProvider.GEMINI_PRICING,
    });
  }

  protected getEnvironmentApiKey(): string | undefined {
    // Support both GOOGLE_API_KEY and GEMINI_API_KEY
    return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  }

  supportsModel(modelName: string): boolean {
    // Check exact match
    if (GeminiProvider.SUPPORTED_MODELS.includes(modelName)) {
      return true;
    }
    
    // Check if it starts with gemini-
    if (modelName.startsWith('gemini-')) {
      return true;
    }
    
    return false;
  }

  getDefaultConfig(): Partial<ProviderConfig> {
    return {
      model: 'gemini-1.5-pro',
      temperature: 0.1,
      maxRetries: 3,
      maxTokens: 8192,
      timeout: 30000,
    };
  }
}
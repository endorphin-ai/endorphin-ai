/**
 * AI Provider Factory
 * Automatically detects and creates the appropriate AI provider based on model name
 */

import { BaseAIProvider, type ProviderConfig } from './base-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { info, warn } from '../../core/logger.js';

export class AIProviderFactory {
  /**
   * Create an AI provider based on the model name in the config.
   * For Gemini models, dynamically loads @langchain/google-genai so it
   * is not required when only OpenAI is used.
   * @param config - Provider configuration with model name
   * @returns The appropriate AI provider instance
   */
  static async create(config: ProviderConfig): Promise<BaseAIProvider> {
    const modelName = config.model.toLowerCase();

    // Detect provider based on model name patterns
    let provider: BaseAIProvider;

    if (modelName.startsWith('gpt-') || modelName.includes('gpt')) {
      info(`Detected OpenAI provider for model: ${config.model}`, { model: config.model }, 'AIProviderFactory');
      const openaiProvider = new OpenAIProvider(config);
      await openaiProvider.ensureLoaded();
      provider = openaiProvider;
    } else if (modelName.startsWith('gemini-') || modelName.includes('gemini')) {
      info(`Detected Gemini provider for model: ${config.model}`, { model: config.model }, 'AIProviderFactory');
      const geminiProvider = new GeminiProvider(config);
      await geminiProvider.ensureLoaded();
      provider = geminiProvider;
    } else if (modelName.startsWith('claude-') || modelName.includes('claude')) {
      // Future: Add Claude provider
      warn(`Claude models are not yet supported. Falling back to OpenAI.`, { model: config.model }, 'AIProviderFactory');
      const openaiProvider = new OpenAIProvider({ ...config, model: 'gpt-4o' });
      await openaiProvider.ensureLoaded();
      provider = openaiProvider;
    } else {
      // Default to OpenAI for unknown models
      warn(`Unknown model type: ${config.model}. Defaulting to OpenAI provider.`, { model: config.model }, 'AIProviderFactory');
      const defaultProvider = new OpenAIProvider(config);
      await defaultProvider.ensureLoaded();
      provider = defaultProvider;
    }

    // Validate the provider configuration
    const validation = provider.validateConfig();
    if (!validation.isValid) {
      throw new Error(`Provider configuration error: ${validation.error}`);
    }

    return provider;
  }

  /**
   * Detect provider type from model name
   * @param modelName - The model name to check
   * @returns The provider type ('openai', 'gemini', 'claude', or 'unknown')
   */
  static detectProvider(modelName: string): 'openai' | 'gemini' | 'claude' | 'unknown' {
    const model = modelName.toLowerCase();

    if (model.startsWith('gpt-') || model.includes('gpt')) {
      return 'openai';
    } else if (model.startsWith('gemini-') || model.includes('gemini')) {
      return 'gemini';
    } else if (model.startsWith('claude-') || model.includes('claude')) {
      return 'claude';
    }

    return 'unknown';
  }

  /**
   * Get a list of all supported models across all providers
   */
  static getSupportedModels(): string[] {
    return [
      // OpenAI models
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k',

      // Gemini models
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-2.0-flash',
      'gemini-pro',
      'gemini-pro-vision',

      // Future: Claude models
      // 'claude-3-opus',
      // 'claude-3-sonnet',
      // 'claude-3-haiku',
    ];
  }

  /**
   * Check if a model is supported
   */
  static isModelSupported(modelName: string): boolean {
    const providerType = this.detectProvider(modelName);

    if (providerType === 'unknown') {
      return false;
    }

    // Create a temporary provider to check model support
    const config: ProviderConfig = { model: modelName };

    try {
      let provider: BaseAIProvider;

      switch (providerType) {
        case 'openai':
          provider = new OpenAIProvider(config);
          break;
        case 'gemini':
          provider = new GeminiProvider(config);
          break;
        default:
          return false;
      }

      return provider.supportsModel(modelName);
    } catch {
      return false;
    }
  }
}

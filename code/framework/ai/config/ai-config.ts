/**
 * Unified AI Configuration
 * Supports multiple AI providers with automatic detection
 */

import * as dotenv from 'dotenv';
import { AIProviderFactory } from '../providers/provider-factory.js';

dotenv.config();

/**
 * Modern AI configuration interface
 * Simplified and provider-agnostic
 */
export interface UnifiedAIConfig {
  model: string;           // Model name (auto-detects provider)
  temperature?: number;    // Response randomness (0-1)
  maxRetries?: number;     // Number of retry attempts
  apiKey?: string;         // Optional API key (falls back to env vars)
  maxTokens?: number;      // Maximum response tokens
  timeout?: number;        // Request timeout in milliseconds
}

/**
 * Legacy AI configuration interface (for backward compatibility)
 */
export interface LegacyAIConfig {
  openai: {
    apiKey: string;
    modelName: string;
    temperature: number;
    maxTokens: number;
  };
  agent: {
    recursionLimit: number;
    stopPhrases: string[];
  };
}

/**
 * Agent behavior configuration
 */
export interface AgentBehaviorConfig {
  recursionLimit: number;
  timeout: number;
  stopPhrases: string[];
  stepDelay?: number;
}

/**
 * Convert legacy config to unified format
 */
export function convertLegacyConfig(legacy: LegacyAIConfig): UnifiedAIConfig {
  return {
    model: legacy.openai.modelName,
    temperature: legacy.openai.temperature,
    apiKey: legacy.openai.apiKey,
    maxTokens: legacy.openai.maxTokens,
    maxRetries: 3, // Default value
  };
}

/**
 * Check if config is in legacy format
 */
export function isLegacyConfig(config: any): config is LegacyAIConfig {
  return config?.openai?.modelName !== undefined;
}

/**
 * Get default AI configuration based on environment
 */
export function getDefaultAIConfig(): UnifiedAIConfig {
  // Auto-detect which API keys are available
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGemini = !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
  
  // Default to the provider that has API key available
  let defaultModel = 'gpt-4o'; // Default to OpenAI
  
  if (!hasOpenAI && hasGemini) {
    defaultModel = 'gemini-1.5-pro';
  }
  
  return {
    model: defaultModel,
    temperature: 0.1,
    maxRetries: 3,
    maxTokens: 8000,
    timeout: 30000,
  };
}

/**
 * Get agent behavior configuration
 */
export function getAgentBehaviorConfig(): AgentBehaviorConfig {
  return {
    recursionLimit: 200,
    timeout: 5 * 60 * 1000, // 5 minutes
    stepDelay: 3000,
    stopPhrases: [
      'test completed successfully',
      'verification complete',
      'test finished successfully',
      'all steps completed',
      'task finished',
      'stop',
      'stop - test completed',
    ],
  };
}

/**
 * Validate AI configuration
 */
export function validateAIConfig(config: UnifiedAIConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.model || typeof config.model !== 'string') {
    errors.push('Model name is required and must be a string');
  }
  
  if (config.temperature !== undefined) {
    if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 1) {
      errors.push('Temperature must be a number between 0 and 1');
    }
  }
  
  if (config.maxRetries !== undefined) {
    if (typeof config.maxRetries !== 'number' || config.maxRetries < 0) {
      errors.push('maxRetries must be a positive number');
    }
  }
  
  if (config.maxTokens !== undefined) {
    if (typeof config.maxTokens !== 'number' || config.maxTokens < 1) {
      errors.push('maxTokens must be a positive number');
    }
  }
  
  // Check if model is supported
  if (config.model && !AIProviderFactory.isModelSupported(config.model)) {
    const providerType = AIProviderFactory.detectProvider(config.model);
    if (providerType === 'unknown') {
      errors.push(`Unknown model: ${config.model}. Model name should start with 'gpt-' for OpenAI or 'gemini-' for Google`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * DEPRECATED: Use UnifiedAIConfig instead
 * Kept for backward compatibility
 */
export const AGENT_CONFIG = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    modelName: 'gpt-4o',
  },
  agent: getAgentBehaviorConfig(),
  execution: {
    stepDelay: 3000,
  },
} as const;
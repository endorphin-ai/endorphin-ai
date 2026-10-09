/**
 * Vision-Based Verification System
 * Uses AI vision (GPT-4o or Gemini) to verify page content via screenshots
 * Supports multiple providers via the AIProviderFactory
 */

import { HumanMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Page } from 'playwright';
import type { VisionConfig } from '../../types/agent.js';
import { AIProviderFactory } from '../providers/provider-factory.js';
import type { BaseAIProvider } from '../providers/base-provider.js';
import { info, logSuccess, error as logError, warn } from '../../core/logger.js';
import { ICONS } from '../../config/icons.js';

export interface VisionVerificationResult {
  /** Whether the verification passed */
  passed: boolean;
  /** Confidence score from 0.0 to 1.0 */
  confidence: number;
  /** Human-readable reason for the result */
  reason: string;
  /** Token usage for this vision call */
  tokenUsage: {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
    cost: number;
  };
  /** Duration of the vision call in milliseconds */
  durationMs: number;
}

/**
 * VisionVerifier - Takes a screenshot and asks an AI model with vision to verify
 * a condition on the page visually. Supports OpenAI (GPT-4o) and Google Gemini.
 */
export class VisionVerifier {
  private model!: BaseChatModel;
  private provider!: BaseAIProvider;
  private config: Required<VisionConfig>;

  constructor(visionConfig: VisionConfig) {
    this.config = {
      enabled: visionConfig.enabled,
      model: visionConfig.model ?? 'gpt-4o',
      temperature: visionConfig.temperature ?? 0.1,
      maxTokens: visionConfig.maxTokens ?? 1000,
      mode: visionConfig.mode ?? 'supplement',
    };
  }

  async init(): Promise<void> {
    // Use the provider factory to create the appropriate model
    this.provider = await AIProviderFactory.create({
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      maxRetries: 2,
      timeout: 30000,
    });

    this.model = this.provider.createChatModel();

    info(
      `VisionVerifier initialized with ${this.provider.getProviderName()} provider (model: ${this.config.model})`,
      { provider: this.provider.getProviderName(), model: this.config.model },
      'VisionVerifier'
    );
  }

  /**
   * Check if vision verification is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get the verification mode
   */
  getMode(): 'supplement' | 'primary' {
    return this.config.mode;
  }

  /**
   * Get the provider name (openai, gemini, etc.)
   */
  getProviderName(): string {
    return this.provider.getProviderName();
  }

  /**
   * Get the model name (e.g., 'gpt-4o', 'gemini-2.0-flash')
   */
  getModelName(): string {
    return this.config.model;
  }

  /**
   * Verify a condition on the page using AI vision
   * @param page - Playwright page to screenshot
   * @param question - Natural language verification question
   * @param context - Additional context about what is being verified
   * @returns VisionVerificationResult
   */
  async verify(
    page: Page,
    question: string,
    context?: string
  ): Promise<VisionVerificationResult> {
    const startTime = Date.now();

    info(
      `${ICONS.tools} Vision verification (${this.provider.getProviderName()}): "${question}"`,
      { question, context, provider: this.provider.getProviderName() },
      'VisionVerifier'
    );

    try {
      // Take a screenshot as a base64-encoded PNG
      const screenshotBuffer = await page.screenshot({
        fullPage: false,
        type: 'png',
      });
      const base64Image = screenshotBuffer.toString('base64');

      // Construct the vision prompt
      const systemPrompt = `You are a QA verification agent. Analyze the screenshot and answer the verification question.

Your response MUST be in this exact JSON format:
{
  "passed": true/false,
  "confidence": 0.0-1.0,
  "reason": "Brief explanation of what you see and why it passes or fails"
}

Rules:
- "passed": true if the visual evidence supports the assertion, false otherwise
- "confidence": your certainty level (0.0 = completely unsure, 1.0 = absolutely certain)
- "reason": describe what you actually see that supports or contradicts the assertion
- Be precise and factual. Only report what is visible in the screenshot.
- If elements are partially visible or ambiguous, set confidence accordingly.`;

      const userPrompt = context
        ? `Verification question: ${question}\n\nContext: ${context}`
        : `Verification question: ${question}`;

      const message = new HumanMessage({
        content: [
          { type: 'text', text: `${systemPrompt}\n\n${userPrompt}` },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${base64Image}`,
              detail: 'high',
            },
          },
        ],
      });

      const response = await this.model.invoke([message]);
      const durationMs = Date.now() - startTime;

      // Parse the response
      const responseText = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      // Try to extract JSON from the response
      let parsed: { passed: boolean; confidence: number; reason: string };
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch {
        warn(
          `Vision response not valid JSON, interpreting: ${responseText.substring(0, 200)}`,
          { response: responseText },
          'VisionVerifier'
        );
        const lowerResponse = responseText.toLowerCase();
        parsed = {
          passed: lowerResponse.includes('pass') || lowerResponse.includes('true') || lowerResponse.includes('yes'),
          confidence: 0.5,
          reason: responseText.substring(0, 500),
        };
      }

      // Calculate token usage using the provider
      const tokenUsage = this.provider.calculateTokenUsage(
        response,
        `${systemPrompt}\n\n${userPrompt}`,
        responseText
      );

      const result: VisionVerificationResult = {
        passed: parsed.passed,
        confidence: parsed.confidence,
        reason: parsed.reason,
        tokenUsage: {
          promptTokens: tokenUsage.promptTokens,
          responseTokens: tokenUsage.responseTokens,
          totalTokens: tokenUsage.totalTokens,
          cost: tokenUsage.cost,
        },
        durationMs,
      };

      if (result.passed) {
        logSuccess(
          `Vision verification PASSED (${this.provider.getProviderName()}, confidence: ${(result.confidence * 100).toFixed(0)}%): ${result.reason}`,
          { tool: 'visionVerifier', result, provider: this.provider.getProviderName() },
          'VisionVerifier'
        );
      } else {
        logError(
          `Vision verification FAILED (${this.provider.getProviderName()}, confidence: ${(result.confidence * 100).toFixed(0)}%): ${result.reason}`,
          undefined,
          { tool: 'visionVerifier', result, provider: this.provider.getProviderName() },
          'VisionVerifier'
        );
      }

      return result;
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      logError(
        `Vision verification error (${this.provider.getProviderName()}): ${error.message}`,
        error instanceof Error ? error : undefined,
        { tool: 'visionVerifier', error: error.message, provider: this.provider.getProviderName() },
        'VisionVerifier'
      );

      return {
        passed: false,
        confidence: 0,
        reason: `Vision verification failed: ${error.message}`,
        tokenUsage: { promptTokens: 0, responseTokens: 0, totalTokens: 0, cost: 0 },
        durationMs,
      };
    }
  }

  /**
   * Verify a list of items are visible using vision
   * @param page - Playwright page
   * @param items - Items to verify
   * @param containerDescription - Optional description of where to look
   */
  async verifyListVisible(
    page: Page,
    items: string[],
    containerDescription?: string
  ): Promise<VisionVerificationResult> {
    const question = containerDescription
      ? `Are all of the following items visible in the ${containerDescription}: ${items.join(', ')}?`
      : `Are all of the following items visible on the page: ${items.join(', ')}?`;

    return await this.verify(page, question, `Expected items: ${items.join(', ')}`);
  }

  /**
   * Verify element state using vision
   * @param page - Playwright page
   * @param elementDescription - Description of the element
   * @param expectedState - Expected visual state
   */
  async verifyElementState(
    page: Page,
    elementDescription: string,
    expectedState: string
  ): Promise<VisionVerificationResult> {
    return await this.verify(
      page,
      `Is the element "${elementDescription}" in the state: ${expectedState}?`,
      `Looking for: ${elementDescription} to be ${expectedState}`
    );
  }
}

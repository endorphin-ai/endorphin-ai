/**
 * Validation Agent for Test Result Analysis
 *
 * A specialized agent that analyzes test execution conversations
 * to determine if tests passed or failed based on the execution history.
 * Supports optional vision-based screenshot verification for higher confidence.
 */

import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Page } from 'playwright';
import type { TokenTracker } from '../core/token-tracker.js';
import { trackAICall } from './agent-setup.js';
import { AGENT_CONFIG } from './config/agent-config.js';
import { AIProviderFactory } from './providers/provider-factory.js';
import type { BaseAIProvider } from './providers/base-provider.js';
import { getGlobalConfig } from '../core/config-loader.js';
import { logWithIcon, LogLevel, info, warn, error as logError } from '../core/logger.js';
import { getValidationSystemPrompt, getValidationAnalysisPrompt } from './prompts/validation-prompts.js';
import { getVisionVerifier } from './vision/index.js';

export interface ValidationResult {
  status: 'SUCCESS' | 'FAILED';
  conclusion: string;
  confidence: number;
  reasoning: string;
  visionResult?: {
    passed: boolean;
    confidence: number;
    reason: string;
  };
}

/**
 * Validation Agent - Analyzes test execution to determine pass/fail
 */
export class ValidationAgent {
  private model!: BaseChatModel;
  private provider!: BaseAIProvider;
  private modelName!: string;
  private tokenTracker: TokenTracker | undefined;

  constructor(tokenTracker?: TokenTracker) {
    this.tokenTracker = tokenTracker;
  }

  async init(): Promise<void> {
    // Use the model from global config (user's chosen provider)
    const globalCfg = getGlobalConfig();
    this.modelName = globalCfg?.ai?.openai?.modelName || AGENT_CONFIG.openai.modelName;

    this.provider = await AIProviderFactory.create({
      model: this.modelName,
      temperature: 0.1,
      maxRetries: 2,
      timeout: 30000,
    });
    this.model = this.provider.createChatModel();
  }

  /**
   * Analyze test execution messages to determine result.
   * If a page is provided and vision is enabled, also captures a screenshot
   * for visual confirmation of the test outcome.
   */
  async analyzeTestExecution(messages: BaseMessage[], testTask: string, page?: Page | null): Promise<ValidationResult> {
    const systemPrompt = getValidationSystemPrompt(testTask);

    // Extract relevant execution history
    const executionHistory = this.formatExecutionHistory(messages);

    const prompt = getValidationAnalysisPrompt(executionHistory, testTask);

    try {
      // Track token usage if tracker is available
      const systemMessage = new SystemMessage(systemPrompt);
      const humanMessage = new HumanMessage(prompt);

      // Estimate token usage before making the call
      if (this.tokenTracker) {
        const promptTokens = this.tokenTracker.estimateTokens(systemPrompt + prompt);
        logWithIcon(LogLevel.INFO, 'brain', `Validation Agent: Estimated ${promptTokens} input tokens`, { promptTokens });
      }

      const startTime = Date.now();
      const response = await this.model.invoke([systemMessage, humanMessage]);
      const duration = Date.now() - startTime;

      const content = response.content as string;

      // Record token usage and track in agent history
      let tokenUsage;
      const usageMetadata = response.usage_metadata as { input_tokens: number; output_tokens: number } | undefined;
      if (this.tokenTracker && usageMetadata) {
        tokenUsage = this.tokenTracker.recordUsage(
          usageMetadata.input_tokens || 0,
          usageMetadata.output_tokens || 0,
          this.modelName
        );
      } else if (this.tokenTracker) {
        // Fallback: estimate tokens if usage metadata not available
        const promptTokens = this.tokenTracker.estimateTokens(systemPrompt + prompt);
        const responseTokens = this.tokenTracker.estimateTokens(content);
        tokenUsage = this.tokenTracker.recordUsage(promptTokens, responseTokens, this.modelName);
      } else {
        // Create basic token usage if no tracker
        const _estimatedPrompt = Math.ceil((systemPrompt + prompt).length / 4);
        const _estimatedResponse = Math.ceil(content.length / 4);
        tokenUsage = this.provider.calculateTokenUsage(
          response,
          systemPrompt + prompt,
          content
        );
      }

      // Track this AI call in agent history
      trackAICall(
        'Validation Agent',
        `${systemPrompt}\n\n${prompt}`,
        content,
        tokenUsage,
        duration,
        'Test result validation and analysis'
      );

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]) as ValidationResult;

        // Vision verification: take a screenshot and ask the vision model
        // to visually confirm the test outcome for higher confidence
        if (page) {
          const visionResult = await this.runVisionValidation(page, testTask, result);
          if (visionResult) {
            result.visionResult = visionResult;

            // Adjust confidence based on vision agreement/disagreement
            if (visionResult.passed === (result.status === 'SUCCESS')) {
              // Vision agrees with text analysis — boost confidence
              result.confidence = Math.min(1.0, result.confidence + 0.1);
              result.reasoning += ` | Vision confirms: ${visionResult.reason}`;
            } else {
              // Vision disagrees — lower confidence and warn
              result.confidence = Math.max(0.0, result.confidence - 0.2);
              result.reasoning += ` | Vision DISAGREES (${visionResult.confidence * 100}%): ${visionResult.reason}`;
              warn(
                `Vision verification disagrees with text analysis: text=${result.status}, vision=${visionResult.passed ? 'PASS' : 'FAIL'}`,
                { textStatus: result.status, visionPassed: visionResult.passed, visionReason: visionResult.reason },
                'ValidationAgent'
              );
            }
          }
        }

        // Use info logger for both SUCCESS and FAILED to trigger ValidationAgent-specific coloring
        if (result.status === 'SUCCESS') {
          info('✅ Validation Agent Analysis: SUCCESS', {
            status: result.status,
            confidence: result.confidence,
            conclusion: result.conclusion,
            reasoning: result.reasoning,
            visionUsed: !!result.visionResult,
          }, 'ValidationAgent');
        } else {
          info('❌ Validation Agent Analysis: FAILED', {
            status: result.status,
            confidence: result.confidence,
            conclusion: result.conclusion,
            reasoning: result.reasoning,
            visionUsed: !!result.visionResult,
          }, 'ValidationAgent');
        }
        return result;
      }

      // Fallback if JSON parsing fails
      return {
        status: 'FAILED',
        conclusion: 'Unable to parse validation result',
        confidence: 0,
        reasoning: 'JSON parsing failed',
      };
    } catch (error) {
      logError('Validation agent error', error instanceof Error ? error : undefined, { message: String(error) }, 'ValidationAgent');
      return {
        status: 'FAILED',
        conclusion: 'Validation agent encountered an error',
        confidence: 0,
        reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Run vision-based validation by taking a screenshot and asking
   * the vision model to confirm the test outcome visually
   */
  private async runVisionValidation(
    page: Page,
    testTask: string,
    textResult: ValidationResult
  ): Promise<{ passed: boolean; confidence: number; reason: string } | null> {
    try {
      const globalCfg = getGlobalConfig();
      const visionVerifier = await getVisionVerifier(globalCfg?.ai?.vision);

      if (!visionVerifier) {
        return null;
      }

      info('Running vision validation on final page state...', {}, 'ValidationAgent');

      // Ask the vision model to confirm the test outcome
      const question = textResult.status === 'SUCCESS'
        ? `The test "${testTask}" was reported as PASSED. Does the current page state visually confirm that the test completed successfully? Look for expected elements, success indicators, or the final expected state.`
        : `The test "${testTask}" was reported as FAILED. Does the current page state visually confirm that something went wrong? Look for error messages, missing elements, or unexpected state.`;

      const visionResult = await visionVerifier.verify(page, question, `Test task: ${testTask}`);

      // Track the vision AI call
      if (this.tokenTracker) {
        this.tokenTracker.recordUsage(
          visionResult.tokenUsage.promptTokens,
          visionResult.tokenUsage.responseTokens,
          visionVerifier.getModelName()
        );
      }

      trackAICall(
        'Validation Vision',
        question,
        visionResult.reason,
        {
          promptTokens: visionResult.tokenUsage.promptTokens,
          responseTokens: visionResult.tokenUsage.responseTokens,
          totalTokens: visionResult.tokenUsage.totalTokens,
          cost: visionResult.tokenUsage.cost,
          model: visionVerifier.getModelName(),
        },
        visionResult.durationMs,
        'Vision-based validation confirmation'
      );

      info(
        `Vision validation: ${visionResult.passed ? 'CONFIRMS' : 'CONTRADICTS'} text result (${(visionResult.confidence * 100).toFixed(0)}% confidence)`,
        { passed: visionResult.passed, confidence: visionResult.confidence, reason: visionResult.reason },
        'ValidationAgent'
      );

      return {
        passed: visionResult.passed,
        confidence: visionResult.confidence,
        reason: visionResult.reason,
      };
    } catch (error) {
      warn(
        'Vision validation failed, using text-only result',
        { error: error instanceof Error ? error.message : String(error) },
        'ValidationAgent'
      );
      return null;
    }
  }

  /**
   * Format execution history for analysis
   */
  private formatExecutionHistory(messages: BaseMessage[]): string {
    return messages
      .slice(-20) // Last 20 messages for context
      .map((msg, idx) => {
        const role = msg._getType() === 'human' ? 'USER' : 'AGENT';
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);

        // Include tool calls if present
        const toolCalls = (msg as any).tool_calls;
        if (toolCalls?.length) {
          const tools = toolCalls
            .map((tc: any) => `[TOOL: ${tc.name}(${JSON.stringify(tc.args)})]`)
            .join(', ');
          return `${idx + 1}. ${role}: ${content}\n   ${tools}`;
        }

        return `${idx + 1}. ${role}: ${content}`;
      })
      .join('\n\n');
  }

  /**
   * Quick validation based on patterns (faster, less accurate)
   */
  quickValidate(messages: BaseMessage[]): ValidationResult {
    const lastMessages = messages.slice(-5);
    const content = lastMessages
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join(' ')
      .toLowerCase();

    // Check for success patterns
    const successPatterns = [
      'all steps completed successfully',
      'test passed',
      'verification successful',
      'login was successful',
      'element.*is visible',
      'username.*is visible',
      'therefore.*login was successful',
      'successfully.*verified',
      'found.*username',
      'andrew.*is visible',
      'maximus.*is visible',
    ];

    const failurePatterns = [
      'test failed',
      'verification failed',
      'element not found',
      'timeout exceeded',
      'unable to complete',
      'error occurred',
    ];

    const hasSuccess = successPatterns.some((p) => new RegExp(p).test(content));
    const hasFailure = failurePatterns.some((p) => new RegExp(p).test(content));

    if (hasSuccess && !hasFailure) {
      return {
        status: 'SUCCESS',
        conclusion: 'Test completed successfully based on pattern matching',
        confidence: 0.7,
        reasoning: 'Success patterns detected without failure indicators',
      };
    }

    return {
      status: 'FAILED',
      conclusion: 'Test failed or outcome unclear',
      confidence: 0.6,
      reasoning: hasFailure ? 'Failure patterns detected' : 'No clear success indicators found',
    };
  }
}

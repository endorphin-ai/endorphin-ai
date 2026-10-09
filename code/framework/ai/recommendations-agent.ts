/**
 * Recommendations Agent - AI-Powered Post-Test Analysis
 * 
 * Analyzes test failures and provides intelligent recommendations
 * for improving test reliability and accuracy
 */

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { TokenTracker } from '../core/token-tracker.js';
import { trackAICall } from './agent-setup.js';
import { AGENT_CONFIG } from './config/agent-config.js';
import { AIProviderFactory } from './providers/provider-factory.js';
import type { BaseAIProvider } from './providers/base-provider.js';
import { getGlobalConfig } from '../core/config-loader.js';
import { logWithIcon, LogLevel, error as logError } from '../core/logger.js';

export interface FailureData {
  type: string;
  selector?: string;
  state?: string;
  error: string;
  stepDescription?: string;
  pageSnapshot?: {
    url: string;
    title: string;
    html: string;
    visibleText: string;
  } | undefined;
  alternatives?: Array<{
    selector: string;
    element: string;
    text: string;
    confidence: number;
  }>;
  screenshot?: string;
  timestamp: string;
}

export interface Recommendation {
  type: 'selector_improvement' | 'general_advice' | 'element_alternative';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  originalSelector?: string;
  suggestedSelector?: string;
  reason: string;
}

export interface RecommendationsResult {
  recommendations: Recommendation[];
  summary: string;
  confidence: number;
  analysisCount: number;
}

/**
 * Recommendations Agent - Provides AI-powered test improvement suggestions
 */
export class RecommendationsAgent {
  private model!: BaseChatModel;
  private provider!: BaseAIProvider;
  private modelName!: string;
  private tokenTracker: TokenTracker | undefined;

  constructor(tokenTracker?: TokenTracker) {
    this.tokenTracker = tokenTracker;
  }

  async init(): Promise<void> {
    const globalCfg = getGlobalConfig();
    this.modelName = globalCfg?.ai?.openai?.modelName || AGENT_CONFIG.openai.modelName;

    this.provider = await AIProviderFactory.create({
      model: this.modelName,
      temperature: 0.2,
      maxRetries: 2,
      timeout: 30000,
    });
    this.model = this.provider.createChatModel();
  }

  /**
   * Analyze failure data and generate recommendations
   */
  async analyzeFailures(
    failureData: FailureData[], 
    testName: string,
    testTask: string
  ): Promise<RecommendationsResult> {
    if (failureData.length === 0) {
      return {
        recommendations: [],
        summary: 'No failures detected during test execution.',
        confidence: 1.0,
        analysisCount: 0
      };
    }

    const systemPrompt = `You are an AI test improvement consultant. Your job is to analyze test execution failures and provide actionable recommendations to improve test reliability.

Test Context:
- Test Name: ${testName}
- Test Task: ${testTask}

Your analysis should focus on:
1. **Selector Improvements**: When a selector failed but alternatives were found, suggest better selectors
2. **Element Alternatives**: When buttons weren't found but links were (or vice versa), suggest using the found element type
3. **General Advice**: Broader recommendations for test stability

Guidelines:
- Be specific and actionable
- Prioritize recommendations that will have the biggest impact
- If a button selector failed but a link with similar text was found, recommend using the link instead
- If text verification failed but similar text was found, suggest using the partial match
- Consider element stability - some selectors are more reliable than others
- Focus on what was actually found on the page vs what was expected

Provide your analysis as JSON in this format:
{
  "recommendations": [
    {
      "type": "selector_improvement" | "general_advice" | "element_alternative",
      "priority": "high" | "medium" | "low",
      "title": "Brief title of the recommendation",
      "description": "Detailed description of what to change and why",
      "originalSelector": "The failing selector (if applicable)",
      "suggestedSelector": "The recommended selector (if applicable)",
      "reason": "Why this recommendation will improve the test"
    }
  ],
  "summary": "Overall summary of the analysis and key insights",
  "confidence": 0.0 to 1.0
}`;

    // Format failure data for analysis
    const failureAnalysis = this.formatFailureData(failureData);

    const prompt = `Analyze these test execution failures and provide recommendations:

${failureAnalysis}

Based on the failures above, provide actionable recommendations to improve test reliability. Focus on practical changes that can be made to selectors, element targeting, or test approach.`;

    try {
      const systemMessage = new SystemMessage(systemPrompt);
      const humanMessage = new HumanMessage(prompt);

      // Track token usage
      if (this.tokenTracker) {
        const promptTokens = this.tokenTracker.estimateTokens(systemPrompt + prompt);
        logWithIcon(LogLevel.INFO, 'brain', `Recommendations Agent: Estimated ${promptTokens} input tokens`, { promptTokens });
      }

      const startTime = Date.now();
      const response = await this.model.invoke([systemMessage, humanMessage]);
      const duration = Date.now() - startTime;

      const content = response.content as string;

      // Record token usage
      let tokenUsage;
      const usageMetadata = response.usage_metadata as { input_tokens: number; output_tokens: number } | undefined;
      if (this.tokenTracker && usageMetadata) {
        tokenUsage = this.tokenTracker.recordUsage(
          usageMetadata.input_tokens || 0,
          usageMetadata.output_tokens || 0,
          this.modelName
        );
      } else if (this.tokenTracker) {
        const promptTokens = this.tokenTracker.estimateTokens(systemPrompt + prompt);
        const responseTokens = this.tokenTracker.estimateTokens(content);
        tokenUsage = this.tokenTracker.recordUsage(promptTokens, responseTokens, this.modelName);
      } else {
        tokenUsage = this.provider.calculateTokenUsage(
          response,
          systemPrompt + prompt,
          content
        );
      }

      // Track this AI call
      trackAICall(
        'Recommendations Agent',
        `${systemPrompt}\n\n${prompt}`,
        content,
        tokenUsage,
        duration,
        `Post-test failure analysis for ${testName}`
      );

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        
        logWithIcon(LogLevel.INFO, 'bulb', `Generated ${result.recommendations.length} recommendations for test improvements`, {
          testName,
          recommendationCount: result.recommendations.length,
          confidence: result.confidence
        }, 'RecommendationsAgent');

        return {
          recommendations: result.recommendations || [],
          summary: result.summary || 'Analysis completed',
          confidence: result.confidence || 0.5,
          analysisCount: failureData.length
        };
      }

      // Fallback if JSON parsing fails
      return {
        recommendations: [],
        summary: 'Unable to parse recommendations from AI analysis',
        confidence: 0,
        analysisCount: failureData.length
      };

    } catch (error) {
      logError('Recommendations agent error', error instanceof Error ? error : undefined, { 
        message: String(error),
        testName,
        failureCount: failureData.length 
      }, 'RecommendationsAgent');
      
      return {
        recommendations: [],
        summary: `Recommendations agent encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0,
        analysisCount: failureData.length
      };
    }
  }

  /**
   * Format failure data for AI analysis
   */
  private formatFailureData(failureData: FailureData[]): string {
    return failureData.map((failure, index) => {
      let analysis = `Failure ${index + 1}:
- Type: ${failure.type}
- Error: ${failure.error}
- Timestamp: ${failure.timestamp}`;

      if (failure.stepDescription) {
        analysis += `\n- Step Description: ${failure.stepDescription}`;
      }

      if (failure.selector) {
        analysis += `\n- Original Selector: ${failure.selector}`;
      }

      if (failure.state) {
        analysis += `\n- Expected State: ${failure.state}`;
      }

      if (failure.pageSnapshot) {
        analysis += `\n- Page Context:`;
        analysis += `\n  * URL: ${failure.pageSnapshot.url}`;
        analysis += `\n  * Title: ${failure.pageSnapshot.title}`;
        analysis += `\n  * Visible Text (first 500 chars): ${failure.pageSnapshot.visibleText.substring(0, 500)}...`;
        
        // Extract key HTML elements for context
        const htmlSnippet = this.extractRelevantHTML(failure.pageSnapshot.html, failure.selector);
        if (htmlSnippet) {
          analysis += `\n  * Relevant HTML: ${htmlSnippet}`;
        }
      }

      if (failure.alternatives && failure.alternatives.length > 0) {
        analysis += '\n- Alternatives Found:';
        failure.alternatives.forEach(alt => {
          analysis += `\n  * ${alt.element}: "${alt.text}" (${Math.round(alt.confidence * 100)}% match)`;
          analysis += `\n    Selector: ${alt.selector}`;
        });
      }

      return analysis;
    }).join('\n\n---\n\n');
  }

  /**
   * Extract relevant HTML context around the failed selector
   */
  private extractRelevantHTML(html: string, failedSelector?: string): string {
    if (!failedSelector) {
      return '';
    }

    try {
      // Simple extraction - look for buttons, links, forms near where the selector might have been
      const htmlLines = html.split('\n');
      const relevantLines: string[] = [];
      
      // Extract form elements, buttons, links (up to 10 lines)
      for (let i = 0; i < htmlLines.length && relevantLines.length < 10; i++) {
        const line = htmlLines[i].trim();
        if (line.includes('<button') || 
            line.includes('<a ') || 
            line.includes('<input') || 
            line.includes('<form') ||
            line.includes('role="button"') ||
            line.includes('onclick')) {
          relevantLines.push(line);
        }
      }
      
      return relevantLines.join('\n');
    } catch {
      return 'HTML parsing failed';
    }
  }

  /**
   * Generate a human-readable recommendations report
   */
  formatRecommendationsReport(result: RecommendationsResult, testName: string): string {
    if (result.recommendations.length === 0) {
      return `\n🎯 Test Recommendations for ${testName}:\n   No specific recommendations - test execution was clean!\n`;
    }

    let report = `\n🎯 AI Test Recommendations for ${testName}:\n`;
    report += `   Analyzed ${result.analysisCount} failure(s) with ${Math.round(result.confidence * 100)}% confidence\n\n`;

    // Group recommendations by priority
    const byPriority = {
      high: result.recommendations.filter(r => r.priority === 'high'),
      medium: result.recommendations.filter(r => r.priority === 'medium'),
      low: result.recommendations.filter(r => r.priority === 'low')
    };

    // High priority recommendations
    if (byPriority.high.length > 0) {
      report += `   🔴 HIGH PRIORITY:\n`;
      byPriority.high.forEach((rec, i) => {
        report += `   ${i + 1}. ${rec.title}\n`;
        report += `      ${rec.description}\n`;
        if (rec.originalSelector && rec.suggestedSelector) {
          report += `      Change: ${rec.originalSelector} → ${rec.suggestedSelector}\n`;
        }
        report += `      Why: ${rec.reason}\n\n`;
      });
    }

    // Medium priority recommendations
    if (byPriority.medium.length > 0) {
      report += `   🟡 MEDIUM PRIORITY:\n`;
      byPriority.medium.forEach((rec, i) => {
        report += `   ${i + 1}. ${rec.title}\n`;
        report += `      ${rec.description}\n`;
        if (rec.originalSelector && rec.suggestedSelector) {
          report += `      Consider: ${rec.originalSelector} → ${rec.suggestedSelector}\n`;
        }
        report += `      Why: ${rec.reason}\n\n`;
      });
    }

    // Low priority recommendations
    if (byPriority.low.length > 0) {
      report += `   🟢 LOW PRIORITY:\n`;
      byPriority.low.forEach((rec, i) => {
        report += `   ${i + 1}. ${rec.title}\n`;
        report += `      ${rec.description}\n`;
        report += `      Why: ${rec.reason}\n\n`;
      });
    }

    report += `💡 Summary: ${result.summary}\n`;
    
    return report;
  }
}
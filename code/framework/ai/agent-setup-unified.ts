/**
 * Unified AI Agent Setup with Multi-Provider Support
 * Supports OpenAI, Gemini, and future providers through a unified interface
 */

import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { Annotation, MemorySaver, StateGraph } from '@langchain/langgraph';
import type { TestSession } from '../types/test.js';
import { getCurrentBrowserManager } from '../utils/user-utils.js';
import { AIProviderFactory } from './providers/provider-factory.js';
import type { BaseAIProvider } from './providers/base-provider.js';
import type { UnifiedAIConfig } from './config/ai-config.js';
import {
  getAgentBehaviorConfig,
  isLegacyConfig,
  convertLegacyConfig,
  validateAIConfig,
  getDefaultAIConfig
} from './config/ai-config.js';
import { buildToolMap, executeToolsSequentially } from './utils/sequential-tool-executor.js';
import { info, logSuccess, logWithIcon, LogLevel, error as logError, warn } from '../core/logger.js';
import { ICONS } from '../config/icons.js';

// Global variables to track session and token tracking
let currentSession: TestSession | null = null;
let agentCallCounter = 0;
let currentProvider: BaseAIProvider | null = null;

/**
 * Set the current test session for token tracking
 */
export function setCurrentTestSession(session: TestSession | null) {
  currentSession = session;
  agentCallCounter = 0;
}

/**
 * Global function to track any AI call in the agent history
 */
export function trackAICall(
  callType: string,
  prompt: string,
  response: string,
  tokenUsage: {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
    cost: number;
    model: string;
  },
  duration: number,
  context?: string,
  userId?: string
) {
  if (!currentSession) return;

  agentCallCounter++;

  const agentEntry = {
    historyId: currentSession.agentHistory.length + 1,
    timestamp: new Date().toISOString(),
    thinking: `${callType} ${agentCallCounter}`,
    prompt: prompt.substring(0, 500) + (prompt.length > 500 ? '...' : ''),
    response: response.substring(0, 500) + (response.length > 500 ? '...' : ''),
    userId: userId || undefined,
    tokenUsage,
    duration,
    context: context || `${callType} #${agentCallCounter}`,
  };

  currentSession.agentHistory.push(agentEntry);
  logWithIcon(LogLevel.INFO, 'brain', `${callType} ${agentCallCounter}: ${tokenUsage.totalTokens} tokens ($${tokenUsage.cost.toFixed(4)}) in ${duration}ms`, {
    callType,
    callNumber: agentCallCounter,
    totalTokens: tokenUsage.totalTokens,
    cost: tokenUsage.cost,
    duration,
    model: tokenUsage.model
  });
}

// State Annotation for Memory Management
const TestState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  testContext: Annotation<{
    sessionId?: string;
    testName?: string;
    startTime?: number;
  }>({
    reducer: (x, y) => ({ ...x, ...y }),
  }),
});

type TestStateType = typeof TestState.State;

interface AgentWorkflow {
  invoke(
    input: any,
    config?: {
      configurable?: {
        thread_id?: string;
        [key: string]: any;
      };
      [key: string]: any;
    }
  ): Promise<any>;
}

// Global memory saver instance
const memorySaver = new MemorySaver();

/**
 * Setup AI agent with tools and workflow
 * Supports both new unified config and legacy config formats
 */
export async function setupAgent(
  tools: any[],
  config?: { thread_id?: string },
  aiConfig?: UnifiedAIConfig | any
): Promise<AgentWorkflow> {
  info(`${ICONS.brain} Configuring AI agent with tools`, {}, 'Agent');

  // Get AI configuration
  let unifiedConfig: UnifiedAIConfig;
  
  if (!aiConfig) {
    // Use default configuration
    unifiedConfig = getDefaultAIConfig();
    info(`${ICONS.brain} Using default AI configuration`, { model: unifiedConfig.model }, 'Agent');
  } else if (isLegacyConfig(aiConfig)) {
    // Convert legacy config to unified format
    unifiedConfig = convertLegacyConfig(aiConfig);
    info(`${ICONS.brain} Converting legacy configuration to unified format`, { model: unifiedConfig.model }, 'Agent');
  } else {
    // Use provided unified config
    unifiedConfig = aiConfig as UnifiedAIConfig;
  }

  // Validate configuration
  const validation = validateAIConfig(unifiedConfig);
  if (!validation.isValid) {
    throw new Error(`Invalid AI configuration: ${validation.errors.join(', ')}`);
  }

  // Create provider based on model
  const provider = await AIProviderFactory.create(unifiedConfig);
  currentProvider = provider;
  const providerName = provider.getProviderName();
  info(`${ICONS.brain} Using ${providerName} provider with model: ${unifiedConfig.model}`, {
    provider: providerName,
    model: unifiedConfig.model
  }, 'Agent');

  // Log memory configuration
  if (config?.thread_id) {
    info(`${ICONS.brain} Memory persistence enabled with thread_id: ${config.thread_id}`, { threadId: config.thread_id }, 'Agent');
  } else {
    info(`${ICONS.brain} Using session-based memory (no thread_id specified)`, {}, 'Agent');
  }

  // Get behavior configuration
  const behaviorConfig = getAgentBehaviorConfig();

  // Build a tool lookup map for sequential execution
  const toolsByName = buildToolMap(tools);

  // Sequential tool executor — prevents race conditions when the LLM
  // returns multiple tool calls simultaneously (e.g. two fill operations).
  const toolNode = (state: TestStateType) => {
    return executeToolsSequentially(state.messages, toolsByName);
  };

  // Create chat model using provider
  const chatModel = provider.createChatModel();
  const model = (chatModel as any).bindTools
    ? (chatModel as any).bindTools(tools)
    : chatModel;

  // Helper functions for message similarity and decision logic
  function isSimilarMessage(msg1: string, msg2: string): boolean {
    const normalized1 = msg1.toLowerCase().replace(/\s+/g, ' ');
    const normalized2 = msg2.toLowerCase().replace(/\s+/g, ' ');

    if (normalized1 === normalized2) return true;

    const similarity = calculateSimilarity(normalized1, normalized2);
    return similarity > 0.9;
  }

  function calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  function levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + substitutionCost
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  function shouldContinue(state: TestStateType): string {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1] as AIMessage;

    info(`${ICONS.brain} Decision logic - Message count: ${messages.length}`, { messageCount: messages.length }, 'Agent');
    info(`${ICONS.brain} Last message content: "${lastMessage.content || 'no content'}"`, { content: lastMessage.content || 'no content' }, 'Agent');
    info(`${ICONS.brain} Tool calls: ${lastMessage.tool_calls?.length || 0}`, { toolCallCount: lastMessage.tool_calls?.length || 0 }, 'Agent');

    const content = typeof lastMessage.content === 'string' ? lastMessage.content.toLowerCase() : '';

    // Check for stop conditions
    const hasStopPhrase = behaviorConfig.stopPhrases.some((phrase: string) =>
      content.includes(phrase.toLowerCase())
    );

    if (hasStopPhrase) {
      info(`${ICONS.brain} Stop condition detected: ${content}`, { content }, 'Agent');
      return '__end__';
    }

    // Check message limits
    const browserManager = getCurrentBrowserManager();
    const isMultiUser = browserManager?.isMultiUserMode?.();
    const maxMessages = isMultiUser ? 200 : 100;

    if (messages.length > maxMessages) {
      warn(
        `${ICONS.brain} Maximum conversation length reached, ending test (${messages.length}/${maxMessages})`,
        { messageCount: messages.length, maxMessages },
        'Agent'
      );
      return '__end__';
    }

    // Loop detection
    if (messages.length >= 8) {
      const lastContent = content.trim();
      const recentMessages = messages
        .slice(-6)
        .map((m) => (typeof m.content === 'string' ? m.content.trim() : ''));

      const identicalCount = recentMessages.filter(
        (msg) => msg.length > 20 && isSimilarMessage(lastContent, msg)
      ).length;

      if (identicalCount >= 3) {
        warn(`${ICONS.brain} Message repetition detected, agent stuck in loop - FAILING test`, { repeatedMessage: lastContent.substring(0, 100) }, 'Agent');
        return '__end__';
      }

      // Check for repeated tool calls
      const recentToolCalls = messages
        .slice(-8)
        .filter((m) => (m as any).tool_calls && (m as any).tool_calls.length > 0)
        .flatMap((m) => (m as any).tool_calls?.map((tc: any) => tc.function?.name) || [])
        .filter((name) => name) as string[];

      if (recentToolCalls.length >= 6) {
        const toolCounts = recentToolCalls.reduce(
          (acc, tool) => {
            acc[tool] = (acc[tool] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        const maxToolCount = Math.max(...Object.values(toolCounts));
        const repeatedTool = Object.keys(toolCounts).find(
          (tool) => toolCounts[tool] === maxToolCount
        );

        if (maxToolCount >= 4) {
          warn(
            `${ICONS.brain} Tool repetition detected: "${repeatedTool}" used ${maxToolCount} times recently - FAILING test`,
            { repeatedTool, maxToolCount },
            'Agent'
          );
          return '__end__';
        }
      }
    }

    if (lastMessage.tool_calls?.length) {
      info(`${ICONS.brain} Continuing to tools node`, { toolCount: lastMessage.tool_calls?.length || 0 }, 'Agent');
      return 'tools';
    }

    info(`${ICONS.brain} No tool calls remaining - ending test`, {}, 'Agent');
    return '__end__';
  }

  async function callModel(state: TestStateType): Promise<Partial<TestStateType>> {
    const startTime = Date.now();

    let newTestContext = state.testContext || {};

    if (!newTestContext.startTime) {
      newTestContext = {
        ...newTestContext,
        startTime: Date.now(),
      };
      info(`${ICONS.brain} Test session started - conversation memory will track progress naturally`, {}, 'Agent');
    }

    info(
      `Agent processing message ${state.messages.length + 1} - Memory persisted via thread_id`,
      { messageNumber: state.messages.length + 1 },
      'Agent'
    );

    try {
      const response = await model.invoke(state.messages);
      const duration = Date.now() - startTime;

      // Track agent calls with provider-specific token calculation
      if (response instanceof AIMessage && currentProvider) {
        const hasToolCalls = response.tool_calls && response.tool_calls.length > 0;
        const hasContent = response.content && response.content.length > 0;

        const lastHumanMessage = state.messages.filter((m) => m._getType() === 'human').slice(-1)[0];
        const prompt = lastHumanMessage?.content || 'Agent processing conversation';
        const responseContent = typeof response.content === 'string' ? response.content : '';

        let callType = 'Agent Decision';
        let contextInfo = 'General agent processing';

        if (hasToolCalls && response.tool_calls) {
          const toolNames = response.tool_calls.map((tc) => tc.name || 'unknown');
          callType = 'Tool Selection';
          contextInfo = `Selected tools: ${toolNames.join(', ')}`;

          if (responseContent && responseContent.length > 10) {
            contextInfo += ` | Reasoning: ${responseContent.substring(0, 100)}`;
          }
        } else if (hasContent && responseContent.length > 10) {
          callType = 'Agent Reasoning';
          contextInfo = 'Agent analysis and conclusion';
        } else {
          return {
            messages: [response],
            testContext: newTestContext,
          };
        }

        // Use provider's token calculation
        const promptText = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
        const tokenUsage = currentProvider.calculateTokenUsage(
          response,
          promptText,
          responseContent + (hasToolCalls ? ` | Tools: ${JSON.stringify(response.tool_calls)}` : '')
        );

        const browserManager = getCurrentBrowserManager();
        const currentUserId = browserManager ? browserManager.getCurrentUserId() : undefined;

        trackAICall(
          callType,
          promptText,
          responseContent + (hasToolCalls ? ` | Tools: ${JSON.stringify(response.tool_calls)}` : ''),
          tokenUsage,
          duration,
          contextInfo,
          currentUserId || undefined
        );
      }

      return {
        messages: [response],
        testContext: newTestContext,
      };
    } catch (error: any) {
      logError(`${ICONS.brain} Agent model invocation failed`, error instanceof Error ? error : undefined, { message: String(error) }, 'Agent');

      if (error.lc_error_code === 'INVALID_TOOL_RESULTS') {
        logError(`${ICONS.brain} Tool results error - checking tool call responses`, error instanceof Error ? error : undefined, { errorCode: error.lc_error_code }, 'Agent');
        throw new Error(`Tool results error: ${error.message}`);
      }

      if (error.lc_error_code === 'GRAPH_RECURSION_LIMIT') {
        logError(`${ICONS.brain} Recursion limit reached - test may be stuck in loop`, error instanceof Error ? error : undefined, { errorCode: error.lc_error_code }, 'Agent');
        throw new Error(`Recursion limit reached: ${error.message}`);
      }

      // Gemini empty-candidates crash: the provider returned no candidates
      // (safety filter, content blocked, or token overflow). If tool calls have
      // already been executed (messages > 4), end the agent loop gracefully
      // with a stop phrase instead of crashing.
      const isEmptyCandidates = String(error).includes("Cannot read properties of undefined (reading 'message')");
      if (isEmptyCandidates && state.messages.length > 4) {
        warn(
          `${ICONS.brain} Model returned empty response (possible safety filter or token overflow). Ending agent loop gracefully.`,
          { messageCount: state.messages.length },
          'Agent'
        );
        return {
          messages: [new AIMessage('stop - test completed')],
          testContext: newTestContext,
        };
      }

      throw new Error(`Agent invocation failed: ${error.message}`);
    }
  }

  const workflow = new StateGraph(TestState)
    .addNode('agent', callModel)
    .addEdge('__start__', 'agent')
    .addNode('tools', toolNode)
    .addEdge('tools', 'agent')
    .addConditionalEdges('agent', shouldContinue);

  const agent = workflow.compile({
    checkpointer: memorySaver,
  });

  logSuccess(`${ICONS.brain} AI agent configured successfully with ${providerName}`, { provider: providerName, model: unifiedConfig.model }, 'Agent');
  return agent;
}
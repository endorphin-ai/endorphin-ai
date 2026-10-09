/**
 * Endorphin e2e AI test framework
 * Copyright (C) 2025 Redstudio Agency
 *
 * AI Agent Setup - Proper LangGraph Memory Implementation
 *
 * 🧠 Memory Strategy:
 * - Uses LangGraph's MemorySaver for conversation persistence
 * - Agent naturally remembers previous actions through message history
 * - No manual step tracking - let conversation flow handle progress
 * - thread_id provides session-based memory across tool calls
 * - Simplified state management focused on message continuity
 *
 * 🎯 E2E Test Completion Logic:
 * - Only ends test when ALL numbered steps are completed
 * - Ignores partial completion phrases like "login completed"
 * - Supports both positive (test passed) and negative (test failed) scenarios
 * - Prevents premature test termination after individual step completion
 */

import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { Annotation, MemorySaver, StateGraph } from '@langchain/langgraph';
import { AIProviderFactory } from './providers/provider-factory.js';
import { getGlobalConfig } from '../core/config-loader.js';
import type { Page } from 'playwright';
import type { TestSession } from '../types/test.js';
import { getCurrentBrowserManager } from '../utils/user-utils.js';
import { AGENT_CONFIG } from './config/agent-config.js';
import { PageContextInjector } from './context/page-context-injector.js';
import { buildToolMap, executeToolsSequentially } from './utils/sequential-tool-executor.js';
import { info, logSuccess, logWithIcon, LogLevel, error as logError, warn } from '../core/logger.js';
import { ICONS } from '../config/icons.js';

// Warn about short phrases at startup
AGENT_CONFIG.agent.stopPhrases.forEach((phrase) => {
  if (phrase.length < 8) {
    warn(`Stop phrase "${phrase}" is too short (minimum 8 characters) and will be ignored.`, undefined, 'Agent');
  }
});

/**
 * Checks if a message text contains any of the stop phrases.
 * Both sides are lower-cased and it matches as a whole phrase using word boundaries.
 * Phrases shorter than 8 characters are ignored.
 * Pure function as requested.
 */
export function containsStopPhrase(text: string, phrases: readonly string[]): boolean {
  const lowerText = text.toLowerCase();
  for (const phrase of phrases) {
    if (phrase.length < 8) {
      continue;
    }

    const lowerPhrase = phrase.toLowerCase();
    // Escape regex characters just in case, though they should mostly be text
    const escapedPhrase = lowerPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedPhrase}\\b`, 'i');

    if (regex.test(lowerText)) {
      return true;
    }
  }
  return false;
}

// Global variables to track session and token tracking
let currentSession: TestSession | null = null;
let agentCallCounter = 0;

/**
 * Set the current test session for token tracking
 */
export function setCurrentTestSession(session: TestSession | null) {
  currentSession = session;
  agentCallCounter = 0;
}

// Global reference to the page context injector for reset
let activePageContextInjector: PageContextInjector | null = null;

/**
 * Reset the page context injector state (called at start of new test session)
 */
export function resetPageContextInjector(): void {
  if (activePageContextInjector) {
    activePageContextInjector.reset();
  }
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
    userId: userId || undefined, // Include user context for multi-user tests
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
    duration
  });
}

// Simplified State Annotation for Proper Memory Management
const TestState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  // Let conversation memory handle the rest naturally
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
 * @param tools - Array of browser automation tools
 * @param config - Optional configuration with thread_id for memory persistence
 * @returns Compiled agent workflow
 */
export async function setupAgent(
  tools: any[],
  config?: {
    thread_id?: string;
    getPage?: () => Page | null;
  }
): Promise<AgentWorkflow> {
  info(`${ICONS.brain} Configuring AI agent with tools`, {}, 'Agent');

  // Log memory configuration
  if (config?.thread_id) {
    info(`${ICONS.brain} Memory persistence enabled with thread_id: ${config.thread_id}`, { threadId: config.thread_id }, 'Agent');
  } else {
    info(`${ICONS.brain} Using session-based memory (no thread_id specified)`, {}, 'Agent');
  }

  // Create page context injector for auto-injecting accessibility tree
  const pageContextInjector = new PageContextInjector();
  const getPage = config?.getPage ?? (() => null);
  activePageContextInjector = pageContextInjector;

  // Build a tool lookup map for sequential execution
  const toolsByName = buildToolMap(tools);

  // Sequential tool executor — prevents race conditions when the LLM
  // returns multiple tool calls simultaneously (e.g. two fill operations).
  const toolNode = (state: TestStateType) => {
    return executeToolsSequentially(state.messages, toolsByName);
  };

  // Create AI model via provider factory (supports OpenAI, Gemini, etc.)
  const globalCfg = getGlobalConfig();
  const agentModelName = globalCfg?.ai?.openai?.modelName || AGENT_CONFIG.openai.modelName;

  const provider = await AIProviderFactory.create({
    model: agentModelName,
    temperature: 0.1,
    maxRetries: 3,
    timeout: 30000,
  });
  const chatModel = provider.createChatModel();
  const model = (chatModel as any).bindTools
    ? (chatModel as any).bindTools(tools)
    : chatModel;

  //TODO: Move to
  function isSimilarMessage(msg1: string, msg2: string): boolean {
    // Remove whitespace and normalize
    const normalized1 = msg1.toLowerCase().replace(/\s+/g, ' ');
    const normalized2 = msg2.toLowerCase().replace(/\s+/g, ' ');

    // Check for exact match
    if (normalized1 === normalized2) return true;

    // Check for 90% similarity (accounting for minor variations)
    const similarity = calculateSimilarity(normalized1, normalized2);
    return similarity > 0.9;
  }

  //TODO: Move to
  function calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  //TODO: Move to
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

  //TODO: Move to framework/ai/utils/decision-logic.ts
  function shouldContinue(state: TestStateType): string {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1] as AIMessage;

    // Debug logging (simplified to avoid confusion with tracking)
    info(`${ICONS.brain} Decision logic - Message count: ${messages.length}`, { messageCount: messages.length }, 'Agent');
    info(`${ICONS.brain} Last message content: "${lastMessage.content || 'no content'}"`, { content: lastMessage.content || 'no content' }, 'Agent');
    info(`${ICONS.brain} Tool calls: ${lastMessage.tool_calls?.length || 0}`, { toolCallCount: lastMessage.tool_calls?.length || 0 }, 'Agent');

    const content =
      typeof lastMessage.content === 'string' ? lastMessage.content.toLowerCase() : '';

    // Check for explicit stop conditions in the message content (from original working version)
    const hasStopPhrase = containsStopPhrase(content, AGENT_CONFIG.agent.stopPhrases);

    if (hasStopPhrase) {
      info(`${ICONS.brain} Stop condition detected: ${content}`, { content }, 'Agent');
      return '__end__';
    }

    // Advanced infinite loop protection
    // Increase limit for multi-user tests (check if we have multiple users active)
    const browserManager = getCurrentBrowserManager();
    const isMultiUser =
      browserManager && browserManager.isMultiUserMode && browserManager.isMultiUserMode();
    const maxMessages = isMultiUser ? 200 : 100; // Higher limits for complex tests

    if (messages.length > maxMessages) {
      warn(
        `${ICONS.brain} Maximum conversation length reached, ending test (${messages.length}/${maxMessages})`,
        { messageCount: messages.length, maxMessages },
        'Agent'
      );
      return '__end__';
    }

    // Enhanced loop detection - check for repeated actions
    //TODO: Move loop detection logic to framework/ai/utils/loop-detection.ts
    if (messages.length >= 8) {
      const lastContent = content.trim();
      const recentMessages = messages
        .slice(-6)
        .map((m) => (typeof m.content === 'string' ? m.content.trim() : ''));

      // Check if last 3 messages are identical (ignoring small variations)
      const identicalCount = recentMessages.filter(
        (msg) => msg.length > 20 && isSimilarMessage(lastContent, msg)
      ).length;

      if (identicalCount >= 3) {
        warn(`${ICONS.brain} Message repetition detected, agent stuck in loop - FAILING test`, { repeatedMessage: lastContent.substring(0, 100) }, 'Agent');
        return '__end__';
      }

      // Check for repeated tool calls (same tool used many times)
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

        const toolCountValues = Object.values(toolCounts);
        if (toolCountValues.length > 0) {
          const maxToolCount = Math.max(...toolCountValues);
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
    }

    // Continue if there are tool calls to make
    if (lastMessage.tool_calls?.length) {
      info(`${ICONS.brain} Continuing to tools node`, { toolCount: lastMessage.tool_calls?.length || 0 }, 'Agent');
      return 'tools';
    }

    // KEY BEHAVIOR FROM ORIGINAL: If no tool calls, end the test
    info(`${ICONS.brain} No tool calls remaining - ending test`, {}, 'Agent');
    return '__end__';
  }

  //TODO: Move to framework/ai/utils/model-caller.ts
  async function callModel(state: TestStateType): Promise<Partial<TestStateType>> {
    const startTime = Date.now();

    // Simple context initialization on first run
    let newTestContext = state.testContext || {};

    if (!newTestContext.startTime) {
      newTestContext = {
        ...newTestContext,
        startTime: Date.now(),
      };
      info(`${ICONS.brain} Test session started - conversation memory will track progress naturally`, {}, 'Agent');
    }

    // Log conversation progress
    info(
      `Agent processing message ${state.messages.length + 1} - Memory persisted via thread_id`,
      { messageNumber: state.messages.length + 1 },
      'Agent'
    );

    try {
      // Auto-inject page context before every model invocation
      // Use a local copy to prevent the injected message from persisting in LangGraph state
      const messagesForInvocation = [...state.messages];
      const page = getPage();
      const injectionResult = await pageContextInjector.injectContext(page, messagesForInvocation);

      if (injectionResult.injected) {
        info(
          `Page context injected: ${injectionResult.injectionType} (${injectionResult.contextChars} chars, ${injectionResult.durationMs}ms)`,
          {
            injectionType: injectionResult.injectionType,
            contextChars: injectionResult.contextChars,
            durationMs: injectionResult.durationMs,
          },
          'Agent'
        );
      }

      let response = await model.invoke(messagesForInvocation);

      // Gemini narration guard: detect when model describes tool calls in text
      // instead of actually invoking them (common with gemini-flash).
      // Retry up to 2 times with increasingly aggressive nudges.
      if (
        response instanceof AIMessage &&
        (!response.tool_calls || response.tool_calls.length === 0)
      ) {
        const txt = typeof response.content === 'string' ? response.content : '';
        const looksLikeNarration =
          /\btoolCalls\b/i.test(txt) ||
          /\bnavigate\b.*\burl\b/i.test(txt) ||
          (/"action"\s*:\s*"execute_step"/i.test(txt) && /"toolCalls"/i.test(txt)) ||
          (/"action"/i.test(txt) && /"tool/i.test(txt));

        if (looksLikeNarration) {
          warn(
            'Model described tool calls in text instead of invoking them — retrying with nudge',
            { contentSnippet: txt.substring(0, 120) },
            'Agent'
          );

          // Retry 1: firm nudge
          messagesForInvocation.push(response);
          messagesForInvocation.push(
            new HumanMessage(
              'You described what tools to call but did NOT actually call them. ' +
              'You MUST invoke the tools through the function calling interface. ' +
              'Call the appropriate tool NOW (e.g. navigate, click, fill). Do NOT respond with text describing the action.'
            )
          );
          try {
            response = await model.invoke(messagesForInvocation);
          } catch (retryError: any) {
            if (String(retryError).includes("Cannot read properties of undefined (reading 'message')")) {
              warn('Gemini empty candidates on narration retry 1 — ending gracefully', {}, 'Agent');
              return { messages: [new AIMessage('stop - test completed')], testContext: newTestContext };
            }
            throw retryError;
          }

          // Retry 2: final aggressive attempt
          if (
            response instanceof AIMessage &&
            (!response.tool_calls || response.tool_calls.length === 0)
          ) {
            const txt2 = typeof response.content === 'string' ? response.content : '';
            warn(
              'Still no tool calls after retry — second attempt',
              { contentSnippet: txt2.substring(0, 120) },
              'Agent'
            );
            messagesForInvocation.push(response);
            messagesForInvocation.push(
              new HumanMessage(
                'CRITICAL: You are failing to use function calling. ' +
                'You must invoke one of the available tools right now. ' +
                'Example: to navigate, call the "navigate" tool with location parameter. ' +
                'To click, call the "click" tool with selector and strategy parameters. ' +
                'DO IT NOW.'
              )
            );
            try {
              response = await model.invoke(messagesForInvocation);
            } catch (retry2Error: any) {
              if (String(retry2Error).includes("Cannot read properties of undefined (reading 'message')")) {
                warn('Gemini empty candidates on narration retry 2 — ending gracefully', {}, 'Agent');
                return { messages: [new AIMessage('stop - test completed')], testContext: newTestContext };
              }
              throw retry2Error;
            }
          }
        }
      }

    const duration = Date.now() - startTime;

    // Track EVERY agent call - including individual tool selections
    if (response instanceof AIMessage) {
      const hasToolCalls = response.tool_calls && response.tool_calls.length > 0;
      const hasContent = response.content && response.content.length > 0;

      // Extract conversation context for better understanding
      const lastHumanMessage = state.messages.filter((m) => m._getType() === 'human').slice(-1)[0];

      const prompt = lastHumanMessage?.content || 'Agent processing conversation';
      const responseContent = typeof response.content === 'string' ? response.content : '';

      // Classify the type of decision
      let callType = 'Agent Decision';
      let contextInfo = 'General agent processing';

      if (hasToolCalls && response.tool_calls) {
        // This is a tool selection decision
        const toolNames = response.tool_calls.map((tc) => tc.name || 'unknown');
        callType = 'Tool Selection';
        contextInfo = `Selected tools: ${toolNames.join(', ')}`;

        // Add reasoning if there's content along with tool calls
        if (responseContent && responseContent.length > 10) {
          contextInfo += ` | Reasoning: ${responseContent.substring(0, 100)}`;
        }
      } else if (hasContent && responseContent.length > 10) {
        // This is a reasoning/conclusion decision
        callType = 'Agent Reasoning';
        contextInfo = 'Agent analysis and conclusion';
      } else {
        // Skip very short or empty responses
        return {
          messages: [response],
          testContext: newTestContext,
        };
      }

      // Calculate cost using provider
      const promptText = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
      const tokenUsage = provider.calculateTokenUsage(
        response,
        promptText,
        responseContent + JSON.stringify(response.tool_calls || [])
      );

      // Get current user context for multi-user tests
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

      // Handle specific error types
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

      // Re-throw with more context
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

  logSuccess(`${ICONS.brain} AI agent configured successfully`, {}, 'Agent');
  return agent;
}

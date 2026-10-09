/**
 * Recorder Agent Setup — Lightweight LangGraph agent for the test recorder.
 *
 * Reuses the framework's browser tools, PageContextInjector, and AIProviderFactory
 * but strips out all test-execution-specific logic (step tracking, structured JSON,
 * loop detection, completion phrases, token cost tracking).
 *
 * The recorder agent receives a single command from Claude Code, reads the page's
 * accessibility tree, picks the right tool(s), and calls them directly.
 */

import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { Annotation, StateGraph } from '@langchain/langgraph';
import type { Page } from 'playwright';
import { AIProviderFactory } from './providers/provider-factory.js';
import { PageContextInjector } from './context/page-context-injector.js';
import { buildToolMap, executeToolsSequentially } from './utils/sequential-tool-executor.js';
import { getGlobalConfig } from '../core/config-loader.js';
import { AGENT_CONFIG } from './config/agent-config.js';
import { info, warn } from '../core/logger.js';

/**
 * Recorder agent state — just messages, no test context.
 */
const RecorderState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
  }),
});

type RecorderStateType = typeof RecorderState.State;

export interface RecorderAgentConfig {
  getPage: () => Page | null;
}

/**
 * Create a lightweight agent for the test recorder.
 *
 * @param tools - The 26 browser tools created via createAllTools(framework)
 * @param config - Config with getPage callback for accessibility tree injection
 * @returns A compiled LangGraph agent (invoke with { messages: [SystemMessage] })
 */
export async function setupRecorderAgent(
  tools: any[],
  config: RecorderAgentConfig
) {
  const { getPage } = config;

  // Resolve AI model from global config
  const globalCfg = getGlobalConfig();
  const modelName = globalCfg?.ai?.openai?.modelName || AGENT_CONFIG.openai.modelName;

  const provider = await AIProviderFactory.create({
    model: modelName,
    temperature: 0.1,
    maxRetries: 3,
    timeout: 30000,
  });
  const chatModel = provider.createChatModel();

  // Bind tools (safe cast for Gemini which lacks bindTools in type signature)
  const model = (chatModel as any).bindTools
    ? (chatModel as any).bindTools(tools)
    : chatModel;

  // Page context injector (reused as-is)
  const pageContextInjector = new PageContextInjector({ persistSnapshots: false });

  // Tool map for sequential execution
  const toolsByName = buildToolMap(tools);

  // --- Graph nodes ---

  async function callModel(state: RecorderStateType): Promise<Partial<RecorderStateType>> {
    // Inject page context into a local copy (don't pollute state)
    const messagesForInvocation = [...state.messages];
    const page = getPage();
    const injectionResult = await pageContextInjector.injectContext(page, messagesForInvocation);

    if (injectionResult.injected) {
      info(
        `[Recorder] Page context injected: ${injectionResult.injectionType} (${injectionResult.contextChars} chars)`,
        {},
        'RecorderAgent'
      );
    }

    let response: AIMessage;
    try {
      response = await model.invoke(messagesForInvocation);
    } catch (invokeError: any) {
      // Gemini empty-candidates crash: the provider returns no candidates
      // (safety filter, content blocked, or token overflow). LangChain crashes at
      // `result[0].message`. Handle gracefully instead of crashing the recorder.
      const isEmptyCandidates = String(invokeError).includes(
        "Cannot read properties of undefined (reading 'message')"
      );
      if (isEmptyCandidates) {
        warn(
          '[Recorder] Gemini empty candidates — model returned empty response',
          {},
          'RecorderAgent'
        );
        return {
          messages: [new AIMessage('Command could not be executed — model returned empty response')],
        };
      }
      throw invokeError;
    }

    // For the recorder, the first model call MUST produce tool calls.
    // Some models (Gemini Flash) output text describing actions instead of
    // invoking tools. Retry up to 2 times with increasingly explicit nudges.
    if (
      response instanceof AIMessage &&
      (!response.tool_calls || response.tool_calls.length === 0) &&
      state.messages.length <= 3 // Only on the first agent turn (SystemMessage + HumanMessage + context)
    ) {
      const txt = typeof response.content === 'string' ? response.content : '';
      warn(
        `[Recorder] No tool calls on first turn — retrying (content: "${txt.substring(0, 80)}")`,
        {},
        'RecorderAgent'
      );

      // Retry 1: firm nudge
      messagesForInvocation.push(response);
      messagesForInvocation.push(
        new HumanMessage(
          'You MUST call a tool NOW using the function calling interface. ' +
          'Do NOT respond with text. Call the navigate, click, or fill tool directly.'
        )
      );
      try {
        response = await model.invoke(messagesForInvocation);
      } catch (retryError: any) {
        if (String(retryError).includes("Cannot read properties of undefined (reading 'message')")) {
          warn('[Recorder] Gemini empty candidates on retry', {}, 'RecorderAgent');
          return { messages: [new AIMessage('Command could not be executed — model returned empty response')] };
        }
        throw retryError;
      }

      // Retry 2: final attempt
      if (
        response instanceof AIMessage &&
        (!response.tool_calls || response.tool_calls.length === 0)
      ) {
        const txt2 = typeof response.content === 'string' ? response.content : '';
        warn(
          `[Recorder] Still no tool calls after retry — second attempt (content: "${txt2.substring(0, 80)}")`,
          {},
          'RecorderAgent'
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
            warn('[Recorder] Gemini empty candidates on retry 2', {}, 'RecorderAgent');
            return { messages: [new AIMessage('Command could not be executed — model returned empty response')] };
          }
          throw retry2Error;
        }
      }
    }

    return { messages: [response] };
  }

  async function toolNode(state: RecorderStateType): Promise<Partial<RecorderStateType>> {
    return await executeToolsSequentially(state.messages, toolsByName);
  }

  function shouldContinue(state: RecorderStateType): string {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;

    if (lastMessage.tool_calls?.length) {
      info(`[Recorder] Tool calls: ${lastMessage.tool_calls.length}`, {}, 'RecorderAgent');
      return 'tools';
    }

    // Safety: cap at 20 messages to prevent runaway
    if (state.messages.length > 20) {
      warn('[Recorder] Max messages reached, stopping', {}, 'RecorderAgent');
      return '__end__';
    }

    info('[Recorder] No more tool calls, command complete', {}, 'RecorderAgent');
    return '__end__';
  }

  // --- Build graph ---

  const workflow = new StateGraph(RecorderState)
    .addNode('agent', callModel)
    .addEdge('__start__', 'agent')
    .addNode('tools', toolNode)
    .addEdge('tools', 'agent')
    .addConditionalEdges('agent', shouldContinue);

  // No MemorySaver — each recorder step is independent
  return workflow.compile();
}

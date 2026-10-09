/**
 * Sequential Tool Executor
 * Shared utility for executing LangChain tool calls one at a time.
 *
 * ToolNode (from @langchain/langgraph) uses Promise.all() internally which
 * causes race conditions when the LLM returns multiple browser tool calls
 * (e.g. two fill operations on the same page). This executor runs them
 * sequentially via a for...of loop instead.
 */

import { AIMessage, ToolMessage } from '@langchain/core/messages';
import { info, warn, error as logError } from '../../core/logger.js';
import { ICONS } from '../../config/icons.js';

interface ToolLike {
  name: string;
  invoke(args: any): Promise<any>;
}

/**
 * Build a name→tool lookup map from an array of tools.
 */
export function buildToolMap(tools: ToolLike[]): Map<string, ToolLike> {
  const map = new Map<string, ToolLike>();
  for (const t of tools) {
    map.set(t.name, t);
  }
  return map;
}

/**
 * Execute tool calls from the last AIMessage sequentially and return
 * the resulting ToolMessages.
 *
 * @param messages - Current conversation messages (last must be an AIMessage with tool_calls)
 * @param toolsByName - Map of tool name → tool instance
 * @returns Object with `messages` array of ToolMessages
 */
export async function executeToolsSequentially(
  messages: any[],
  toolsByName: Map<string, ToolLike>
): Promise<{ messages: ToolMessage[] }> {
  const lastMessage = messages[messages.length - 1] as AIMessage;
  const toolCalls = lastMessage.tool_calls || [];

  if (toolCalls.length === 0) {
    warn(`${ICONS.brain} Tool node invoked but no tool calls found`, {}, 'Agent');
    return { messages: [] };
  }

  info(
    `${ICONS.brain} Executing ${toolCalls.length} tool call(s) sequentially`,
    { count: toolCalls.length, tools: toolCalls.map((tc) => tc.name) },
    'Agent'
  );

  const toolMessages: ToolMessage[] = [];

  for (const toolCall of toolCalls) {
    const matchedTool = toolsByName.get(toolCall.name);

    if (!matchedTool) {
      toolMessages.push(
        new ToolMessage({
          content: `Tool "${toolCall.name}" not found`,
          tool_call_id: toolCall.id || '',
          name: toolCall.name,
        })
      );
      continue;
    }

    try {
      const result = await matchedTool.invoke(toolCall.args);
      const content = typeof result === 'string' ? result : JSON.stringify(result);
      toolMessages.push(
        new ToolMessage({
          content,
          tool_call_id: toolCall.id || '',
          name: toolCall.name,
        })
      );
    } catch (err: any) {
      logError(
        `${ICONS.brain} Tool "${toolCall.name}" execution failed`,
        err instanceof Error ? err : undefined,
        { toolName: toolCall.name, message: String(err) },
        'Agent'
      );
      toolMessages.push(
        new ToolMessage({
          content: `Tool execution failed: ${err.message}`,
          tool_call_id: toolCall.id || '',
          name: toolCall.name,
        })
      );
    }
  }

  return { messages: toolMessages };
}

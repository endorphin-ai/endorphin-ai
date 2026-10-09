import { BaseMessage, SystemMessage } from '@langchain/core/messages';
import { createSystemContext } from '../../config/system-context.js';

/**
 * Builds the initial message sequence for the agent.
 * @param taskDescription The description of the task to be performed
 * @returns An array containing the initial system message
 */
export function buildInitialMessages(taskDescription: string): BaseMessage[] {
  const systemContext = createSystemContext(taskDescription);
  return [new SystemMessage(systemContext)];
}

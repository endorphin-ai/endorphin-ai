import { SystemMessage } from '@langchain/core/messages';
import { buildInitialMessages } from '../../../framework/ai/utils/initial-messages.js';
import { createSystemContext } from '../../../framework/config/system-context.js';

describe('BrowserEngine - Initial Messages', () => {
  it('buildInitialMessages returns exactly one SystemMessage with the correct context', () => {
    const testTask = 'Navigate to example.com and verify the heading';

    // 1. Call the public helper
    const messages = buildInitialMessages(testTask);

    // 2. Assert there is exactly one message
    expect(messages.length).toBe(1);

    // 3. Assert it is a SystemMessage
    const message = messages[0];
    expect(message).toBeInstanceOf(SystemMessage);

    // 4. Assert its content contains the task description and exactly matches createSystemContext
    const content = message.content as string;

    // Check that it includes the raw task string
    expect(content).toContain(testTask);

    // Check that it matches the output of createSystemContext exactly
    const expectedContext = createSystemContext(testTask);
    expect(content).toEqual(expectedContext);
  });
});

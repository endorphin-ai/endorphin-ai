import { containsStopPhrase } from '../../../framework/ai/agent-setup.js';
import * as logger from '../../../framework/core/logger.js';

describe('containsStopPhrase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('evaluates short substring correctly', () => {
    const phrases = ['test completed successfully', 'verification complete'];
    expect(containsStopPhrase('Click the Stop button', phrases)).toBe(false);
    expect(containsStopPhrase('I will stop here', phrases)).toBe(false);
  });

  it('matches full phrases ignoring case and punctuation', () => {
    const phrases = ['test completed successfully', 'stop - test completed'];
    expect(containsStopPhrase('Test completed successfully.', phrases)).toBe(true);
    expect(containsStopPhrase('...stop - test completed', phrases)).toBe(true);
  });

  it('matches phrase with word boundaries', () => {
    const phrases = ['task finished'];
    expect(containsStopPhrase('task finished', phrases)).toBe(true);
    expect(containsStopPhrase('task finished?', phrases)).toBe(true);
    expect(containsStopPhrase('mytask finished', phrases)).toBe(false);
    expect(containsStopPhrase('task finishedly', phrases)).toBe(false);
  });

  it('ignores short phrases', () => {
    // Using a 4-letter phrase, and another to show it doesn't break matching
    const phrases = ['stop', 'task finished'];

    expect(containsStopPhrase('Click the Stop button', phrases)).toBe(false);
    expect(containsStopPhrase('Please stop now', phrases)).toBe(false);
    expect(containsStopPhrase('My task finished', phrases)).toBe(true);
  });
});

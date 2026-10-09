/**
 * Fill Tool Reliability Tests
 *
 * Regression tests for three fixes:
 * 1. Sequential tool execution in agent-setup.ts (prevents parallel race conditions)
 * 2. Explicit focus before fill in interaction.ts (scrollIntoViewIfNeeded + click)
 * 3. Retry on value mismatch in interaction.ts (pressSequentially + JS evaluate fallbacks)
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AIMessage, ToolMessage } from '@langchain/core/messages';

// ---------------------------------------------------------------------------
// Mock logger (must come before any framework imports)
// ---------------------------------------------------------------------------
jest.mock('../../../framework/core/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  logSuccess: jest.fn(),
  logError: jest.fn(),
  logWithIcon: jest.fn(),
  LogLevel: { DEBUG: 'DEBUG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' },
}));

jest.mock('../../../framework/config/icons', () => ({
  ICONS: {
    brain: '',
    tools: '',
    keyboard: '',
    button: '',
    success: '',
    failure: '',
    debug: '',
  },
}));

jest.mock('../../../framework/config/constants', () => ({
  TIMEOUTS: { ELEMENT_WAIT: 5000 },
}));

// ---------------------------------------------------------------------------
// Group 1: Sequential Tool Execution (agent-setup.ts toolNode)
// ---------------------------------------------------------------------------
describe('Sequential Tool Execution', () => {
  /**
   * We replicate the toolNode closure from agent-setup.ts in isolation so we
   * can verify execution order without needing a full LangGraph StateGraph.
   *
   * The logic under test:
   *   - iterate tool_calls with for...of (sequential)
   *   - collect ToolMessages in order
   *   - catch individual tool errors without blocking subsequent tools
   */

  function createToolNode(toolsByName: Map<string, { name: string; invoke: (args: any) => Promise<any> }>) {
    return async (state: { messages: any[] }) => {
      const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
      const toolCalls = lastMessage.tool_calls || [];

      if (toolCalls.length === 0) {
        return { messages: [] };
      }

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
    };
  }

  let executionOrder: string[];

  beforeEach(() => {
    executionOrder = [];
  });

  it('should execute multiple tool calls one at a time (sequential)', async () => {
    const toolA = {
      name: 'fillA',
      invoke: jest.fn<(args: any) => Promise<string>>().mockImplementation(async () => {
        executionOrder.push('fillA-start');
        await new Promise((r) => setTimeout(r, 10));
        executionOrder.push('fillA-end');
        return 'filled A';
      }),
    };
    const toolB = {
      name: 'fillB',
      invoke: jest.fn<(args: any) => Promise<string>>().mockImplementation(async () => {
        executionOrder.push('fillB-start');
        await new Promise((r) => setTimeout(r, 10));
        executionOrder.push('fillB-end');
        return 'filled B';
      }),
    };

    const toolsByName = new Map<string, any>();
    toolsByName.set('fillA', toolA);
    toolsByName.set('fillB', toolB);

    const toolNode = createToolNode(toolsByName);

    const aiMessage = new AIMessage({
      content: '',
      tool_calls: [
        { name: 'fillA', args: { selector: '#a', value: 'A' }, id: 'call_1', type: 'tool_call' as const },
        { name: 'fillB', args: { selector: '#b', value: 'B' }, id: 'call_2', type: 'tool_call' as const },
      ],
    });

    await toolNode({ messages: [aiMessage] });

    // Sequential means fillA must fully complete before fillB starts
    expect(executionOrder).toEqual(['fillA-start', 'fillA-end', 'fillB-start', 'fillB-end']);
  });

  it('should collect tool results in order as ToolMessages', async () => {
    const tool1 = { name: 'navigate', invoke: jest.fn<(args: any) => Promise<string>>().mockResolvedValue('navigated') };
    const tool2 = { name: 'fill', invoke: jest.fn<(args: any) => Promise<string>>().mockResolvedValue('filled') };
    const tool3 = { name: 'click', invoke: jest.fn<(args: any) => Promise<string>>().mockResolvedValue('clicked') };

    const toolsByName = new Map<string, any>();
    toolsByName.set('navigate', tool1);
    toolsByName.set('fill', tool2);
    toolsByName.set('click', tool3);

    const toolNode = createToolNode(toolsByName);

    const aiMessage = new AIMessage({
      content: '',
      tool_calls: [
        { name: 'navigate', args: { url: 'https://example.com' }, id: 'id_1', type: 'tool_call' as const },
        { name: 'fill', args: { selector: '#email', value: 'a@b.com' }, id: 'id_2', type: 'tool_call' as const },
        { name: 'click', args: { selector: '#submit' }, id: 'id_3', type: 'tool_call' as const },
      ],
    });

    const result = await toolNode({ messages: [aiMessage] });

    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].content).toBe('navigated');
    expect(result.messages[0].name).toBe('navigate');
    expect(result.messages[1].content).toBe('filled');
    expect(result.messages[1].name).toBe('fill');
    expect(result.messages[2].content).toBe('clicked');
    expect(result.messages[2].name).toBe('click');
  });

  it('should not block subsequent tools when one tool throws an error', async () => {
    const failingTool = {
      name: 'failTool',
      invoke: jest.fn<(args: any) => Promise<string>>().mockRejectedValue(new Error('selector not found')),
    };
    const successTool = {
      name: 'successTool',
      invoke: jest.fn<(args: any) => Promise<string>>().mockResolvedValue('success result'),
    };

    const toolsByName = new Map<string, any>();
    toolsByName.set('failTool', failingTool);
    toolsByName.set('successTool', successTool);

    const toolNode = createToolNode(toolsByName);

    const aiMessage = new AIMessage({
      content: '',
      tool_calls: [
        { name: 'failTool', args: {}, id: 'id_fail', type: 'tool_call' as const },
        { name: 'successTool', args: {}, id: 'id_ok', type: 'tool_call' as const },
      ],
    });

    const result = await toolNode({ messages: [aiMessage] });

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].content).toContain('Tool execution failed: selector not found');
    expect(result.messages[0].name).toBe('failTool');
    expect(result.messages[1].content).toBe('success result');
    expect(result.messages[1].name).toBe('successTool');
    expect(successTool.invoke).toHaveBeenCalledTimes(1);
  });

  it('should return a "not found" ToolMessage for unknown tool names', async () => {
    const toolsByName = new Map<string, any>();

    const toolNode = createToolNode(toolsByName);

    const aiMessage = new AIMessage({
      content: '',
      tool_calls: [
        { name: 'nonExistentTool', args: {}, id: 'id_unknown', type: 'tool_call' as const },
      ],
    });

    const result = await toolNode({ messages: [aiMessage] });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toContain('Tool "nonExistentTool" not found');
  });

  it('should return empty messages array when there are no tool calls', async () => {
    const toolsByName = new Map<string, any>();
    const toolNode = createToolNode(toolsByName);

    const aiMessage = new AIMessage({ content: 'no tools needed' });

    const result = await toolNode({ messages: [aiMessage] });

    expect(result.messages).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Helpers: mock Playwright objects for fill tool tests
// ---------------------------------------------------------------------------

function createMockLocator(overrides: Record<string, any> = {}) {
  return {
    scrollIntoViewIfNeeded: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    click: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    clear: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    fill: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    press: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    pressSequentially: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    inputValue: jest.fn<() => Promise<string>>().mockResolvedValue(''),
    count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
    waitFor: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockPage(locator: ReturnType<typeof createMockLocator>) {
  return {
    waitForSelector: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    locator: jest.fn().mockReturnValue(locator),
    fill: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    type: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    keyboard: {
      down: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      press: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      up: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    },
    evaluate: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    waitForTimeout: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
}

function createMockFramework(mockPage: any) {
  return {
    currentPage: mockPage,
    takeStepScreenshot: jest.fn<() => Promise<string | null>>().mockResolvedValue(null),
    logTestStep: jest.fn(),
  } as any;
}

// ---------------------------------------------------------------------------
// Group 2: Fill Tool Focus (interaction.ts — scrollIntoViewIfNeeded + click)
// ---------------------------------------------------------------------------
describe('Fill Tool Focus', () => {
  // We import createFillTool lazily to ensure mocks are in place
  let createFillTool: typeof import('../../../framework/automation/tools/interaction').createFillTool;

  beforeEach(async () => {
    const mod = await import('../../../framework/automation/tools/interaction');
    createFillTool = mod.createFillTool;
  });

  it('should call scrollIntoViewIfNeeded before fill', async () => {
    const callOrder: string[] = [];
    const mockLocator = createMockLocator({
      scrollIntoViewIfNeeded: jest.fn<() => Promise<void>>().mockImplementation(async () => {
        callOrder.push('scrollIntoViewIfNeeded');
      }),
      click: jest.fn<() => Promise<void>>().mockImplementation(async () => {
        callOrder.push('click');
      }),
      clear: jest.fn<() => Promise<void>>().mockImplementation(async () => {
        callOrder.push('clear');
      }),
      fill: jest.fn<() => Promise<void>>().mockImplementation(async () => {
        callOrder.push('fill');
      }),
      inputValue: jest.fn<() => Promise<string>>().mockResolvedValue('test@example.com'),
    });
    const mockPage = createMockPage(mockLocator);
    mockPage.fill.mockImplementation(async () => { callOrder.push('page.fill'); });
    const framework = createMockFramework(mockPage);

    const fillTool = createFillTool(framework);
    await fillTool.invoke({ selector: '#email', value: 'test@example.com' });

    // scrollIntoViewIfNeeded should appear before clear and page.fill
    const scrollIdx = callOrder.indexOf('scrollIntoViewIfNeeded');
    const clearIdx = callOrder.indexOf('clear');
    const pageFillIdx = callOrder.indexOf('page.fill');
    expect(scrollIdx).toBeGreaterThanOrEqual(0);
    expect(scrollIdx).toBeLessThan(clearIdx);
    expect(clearIdx).toBeLessThan(pageFillIdx);
  });

  it('should call click before fill to ensure focus', async () => {
    const callOrder: string[] = [];
    const mockLocator = createMockLocator({
      scrollIntoViewIfNeeded: jest.fn<() => Promise<void>>().mockImplementation(async () => {
        callOrder.push('scrollIntoViewIfNeeded');
      }),
      click: jest.fn<() => Promise<void>>().mockImplementation(async () => {
        callOrder.push('click');
      }),
      clear: jest.fn<() => Promise<void>>().mockImplementation(async () => {
        callOrder.push('clear');
      }),
      fill: jest.fn<() => Promise<void>>().mockImplementation(async () => {
        callOrder.push('fill');
      }),
      inputValue: jest.fn<() => Promise<string>>().mockResolvedValue('hello'),
    });
    const mockPage = createMockPage(mockLocator);
    mockPage.fill.mockImplementation(async () => { callOrder.push('page.fill'); });
    const framework = createMockFramework(mockPage);

    const fillTool = createFillTool(framework);
    await fillTool.invoke({ selector: '#name', value: 'hello' });

    const clickIdx = callOrder.indexOf('click');
    const pageFillIdx = callOrder.indexOf('page.fill');
    expect(clickIdx).toBeGreaterThanOrEqual(0);
    expect(clickIdx).toBeLessThan(pageFillIdx);
  });

  it('should not prevent fill from attempting when focus fails', async () => {
    const mockLocator = createMockLocator({
      scrollIntoViewIfNeeded: jest.fn<() => Promise<void>>().mockRejectedValue(new Error('scroll failed')),
      click: jest.fn<() => Promise<void>>().mockRejectedValue(new Error('click failed')),
      inputValue: jest.fn<() => Promise<string>>().mockResolvedValue('hello'),
    });
    const mockPage = createMockPage(mockLocator);
    const framework = createMockFramework(mockPage);

    const fillTool = createFillTool(framework);
    const result = await fillTool.invoke({ selector: '#input', value: 'hello' });

    // Fill should still have been attempted and succeeded despite focus failures
    expect(mockPage.fill).toHaveBeenCalled();
    expect(result).toContain('Successfully filled');
  });
});

// ---------------------------------------------------------------------------
// Group 3: Fill Tool Retry (interaction.ts — retry on value mismatch)
// ---------------------------------------------------------------------------
describe('Fill Tool Retry', () => {
  let createFillTool: typeof import('../../../framework/automation/tools/interaction').createFillTool;

  beforeEach(async () => {
    const mod = await import('../../../framework/automation/tools/interaction');
    createFillTool = mod.createFillTool;
  });

  it('should not retry when fill succeeds on first try', async () => {
    const mockLocator = createMockLocator({
      inputValue: jest.fn<() => Promise<string>>().mockResolvedValue('correct-value'),
    });
    const mockPage = createMockPage(mockLocator);
    const framework = createMockFramework(mockPage);

    const fillTool = createFillTool(framework);
    const result = await fillTool.invoke({ selector: '#field', value: 'correct-value' });

    expect(result).toContain('Successfully filled');
    // pressSequentially should NOT have been called (no fallback needed)
    expect(mockLocator.pressSequentially).not.toHaveBeenCalled();
    // evaluate should NOT have been called (no JS fallback needed)
    expect(mockPage.evaluate).not.toHaveBeenCalled();
  });

  it('should attempt Fallback 1 (pressSequentially) when fill value mismatches', async () => {
    let callCount = 0;
    const mockLocator = createMockLocator({
      inputValue: jest.fn<() => Promise<string>>().mockImplementation(async () => {
        callCount++;
        // First check (after standard fill): return wrong value
        // Second check (after clearFirst double-check): return empty
        // Third check (after pressSequentially): return correct value
        if (callCount <= 2) return 'wrong-value';
        return 'correct-value';
      }),
    });
    const mockPage = createMockPage(mockLocator);
    const framework = createMockFramework(mockPage);

    const fillTool = createFillTool(framework);
    const result = await fillTool.invoke({ selector: '#field', value: 'correct-value' });

    expect(mockLocator.pressSequentially).toHaveBeenCalledWith('correct-value', { delay: 30 });
    expect(result).toContain('Successfully filled');
    expect(result).toContain('pressSequentially');
  });

  it('should attempt Fallback 2 (JS evaluate) when Fallback 1 also fails', async () => {
    let callCount = 0;
    const mockLocator = createMockLocator({
      inputValue: jest.fn<() => Promise<string>>().mockImplementation(async () => {
        callCount++;
        // First two checks (standard fill + clearFirst double-check): wrong value
        // Third check (after pressSequentially): still wrong
        // Fourth check (after JS evaluate): correct
        if (callCount <= 3) return 'wrong-value';
        return 'correct-value';
      }),
    });
    const mockPage = createMockPage(mockLocator);
    const framework = createMockFramework(mockPage);

    const fillTool = createFillTool(framework);
    const result = await fillTool.invoke({ selector: '#field', value: 'correct-value' });

    // pressSequentially should have been tried first
    expect(mockLocator.pressSequentially).toHaveBeenCalled();
    // Then JS evaluate fallback
    expect(mockPage.evaluate).toHaveBeenCalled();
    expect(result).toContain('Successfully filled');
    expect(result).toContain('jsEvaluate');
  });

  it('should return failure message when all strategies are exhausted', async () => {
    const mockLocator = createMockLocator({
      inputValue: jest.fn<() => Promise<string>>().mockResolvedValue('always-wrong'),
    });
    const mockPage = createMockPage(mockLocator);
    const framework = createMockFramework(mockPage);

    const fillTool = createFillTool(framework);
    const result = await fillTool.invoke({ selector: '#field', value: 'expected' });

    // Both fallbacks should have been attempted
    expect(mockLocator.pressSequentially).toHaveBeenCalled();
    expect(mockPage.evaluate).toHaveBeenCalled();
    // Final result should indicate failure
    expect(result).toContain('Failed to fill');
    expect(result).toContain('all strategies exhausted');
  });

  it('should handle Fallback 1 throwing an error and still try Fallback 2', async () => {
    let inputCallCount = 0;
    const mockLocator = createMockLocator({
      inputValue: jest.fn<() => Promise<string>>().mockImplementation(async () => {
        inputCallCount++;
        // After standard fill: wrong. After JS evaluate: correct.
        if (inputCallCount <= 2) return 'wrong';
        return 'correct';
      }),
      pressSequentially: jest.fn<() => Promise<void>>().mockRejectedValue(new Error('pressSequentially failed')),
    });
    const mockPage = createMockPage(mockLocator);
    const framework = createMockFramework(mockPage);

    const fillTool = createFillTool(framework);
    const result = await fillTool.invoke({ selector: '#field', value: 'correct' });

    // pressSequentially was attempted but threw
    expect(mockLocator.pressSequentially).toHaveBeenCalled();
    // JS evaluate should still have been attempted
    expect(mockPage.evaluate).toHaveBeenCalled();
    expect(result).toContain('Successfully filled');
  });

  it('should use triple-clear before pressSequentially in Fallback 1', async () => {
    const callOrder: string[] = [];
    let inputCallCount = 0;
    const mockLocator = createMockLocator({
      clear: jest.fn<() => Promise<void>>().mockImplementation(async () => { callOrder.push('clear'); }),
      fill: jest.fn<() => Promise<void>>().mockImplementation(async () => { callOrder.push('locator.fill'); }),
      press: jest.fn<() => Promise<void>>().mockImplementation(async (key: string) => { callOrder.push(`press:${key}`); }),
      pressSequentially: jest.fn<() => Promise<void>>().mockImplementation(async () => { callOrder.push('pressSequentially'); }),
      inputValue: jest.fn<() => Promise<string>>().mockImplementation(async () => {
        inputCallCount++;
        // First call: clearFirst double-check returns empty
        // Second call (after standard fill): wrong value triggers fallback
        // Third call (after pressSequentially): correct value
        if (inputCallCount === 1) return '';
        if (inputCallCount === 2) return 'wrong';
        return 'correct';
      }),
    });
    const mockPage = createMockPage(mockLocator);
    const framework = createMockFramework(mockPage);

    const fillTool = createFillTool(framework);
    await fillTool.invoke({ selector: '#field', value: 'correct', clearFirst: true });

    // In the fallback path: clear, fill(''), Ctrl+A, Backspace should appear before pressSequentially
    const fallbackClearIdx = callOrder.lastIndexOf('clear');
    const pressSeqIdx = callOrder.indexOf('pressSequentially');

    // The triple-clear happens in the fallback, which is the last batch of clear calls
    expect(fallbackClearIdx).toBeLessThan(pressSeqIdx);
    expect(callOrder).toContain('press:Control+a');
    expect(callOrder).toContain('press:Backspace');
    expect(callOrder.indexOf('press:Control+a')).toBeLessThan(pressSeqIdx);
    expect(callOrder.indexOf('press:Backspace')).toBeLessThan(pressSeqIdx);
  });
});

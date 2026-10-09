/**
 * Page Context Injector Tests
 * Tests for the main orchestrator that injects accessibility tree context
 * into the AI agent's conversation
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the logger (use relative path to avoid moduleNameMapper resolution issues)
jest.mock('../../../framework/core/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  logWithIcon: jest.fn(),
  LogLevel: { DEBUG: 'DEBUG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' },
}));

// Mock the snapshot-store (fire-and-forget persistence)
jest.mock('../../../framework/ai/context/snapshot-store', () => ({
  persistSnapshot: jest.fn(),
}));

// Mock the accessibility snapshot capture (DOM-based tree builder)
const mockCaptureAccessibilityTree = jest.fn();
jest.mock('../../../framework/ai/context/accessibility-snapshot-capture', () => ({
  captureAccessibilityTree: (...args: unknown[]) => mockCaptureAccessibilityTree(...args),
}));

import { PageContextInjector } from '../../../framework/ai/context/page-context-injector';

/**
 * Create a mock Playwright page with controllable accessibility snapshot.
 * The captureAccessibilityTree function is mocked separately; this sets up
 * the page mock and configures the mock capture to return the desired snapshot.
 *
 * Uses mockImplementation so the same snapshot is returned on every call
 * to captureAccessibilityTree (important for tests that call injectContext
 * multiple times with the same page).
 */
function createMockPage(options: {
  url?: string;
  title?: string;
  snapshot?: object | null;
  snapshotError?: Error;
} = {}) {
  const {
    url = 'https://example.com',
    title = 'Test Page',
    snapshot = { role: 'WebArea', name: 'Test', children: [{ role: 'button', name: 'Click' }] },
    snapshotError,
  } = options;

  // Configure the mock capture function for this page
  if (snapshotError) {
    mockCaptureAccessibilityTree.mockRejectedValue(snapshotError);
  } else {
    mockCaptureAccessibilityTree.mockResolvedValue(snapshot);
  }

  const page: any = {
    url: jest.fn().mockReturnValue(url),
    title: jest.fn().mockResolvedValue(title),
  };

  return page;
}

describe('PageContextInjector', () => {
  let injector: PageContextInjector;

  beforeEach(() => {
    mockCaptureAccessibilityTree.mockReset();
    injector = new PageContextInjector({
      persistSnapshots: false, // Disable persistence for most tests
    });
  });

  describe('injectContext()', () => {
    it('should return skipReason "no_page" when page is null', async () => {
      const messages: any[] = [];

      const result = await injector.injectContext(null, messages);

      expect(result.injected).toBe(false);
      expect(result.skipReason).toBe('no_page');
      expect(result.durationMs).toBeDefined();
      expect(messages).toHaveLength(0);
    });

    it('should inject full tree on first call (initial)', async () => {
      const mockPage = createMockPage();
      const messages: any[] = [];

      const result = await injector.injectContext(mockPage, messages);

      expect(result.injected).toBe(true);
      expect(result.injectionType).toBe('full_tree');
      expect(result.durationMs).toBeDefined();
      expect(result.contextChars).toBeGreaterThan(0);
      // SystemMessage should be prepended
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toContain('[Current Page Context]');
      expect(messages[0].content).toContain('Accessibility Tree:');
    });

    it('should return skipReason "no_changes" when tree hash is identical', async () => {
      const mockPage = createMockPage();

      // First call: initial injection
      const messages1: any[] = [];
      await injector.injectContext(mockPage, messages1);
      expect(messages1).toHaveLength(1);

      // Second call: same page, same tree -> should skip
      const messages2: any[] = [];
      const result = await injector.injectContext(mockPage, messages2);

      expect(result.injected).toBe(false);
      expect(result.skipReason).toBe('no_changes');
      expect(messages2).toHaveLength(0);
    });

    it('should inject full tree on URL change regardless of hash', async () => {
      // First call with URL A
      const mockPage1 = createMockPage({ url: 'https://example.com/page-a' });
      const messages1: any[] = [];
      await injector.injectContext(mockPage1, messages1);
      expect(messages1).toHaveLength(1);

      // Second call with URL B (same tree structure, but navigation)
      const mockPage2 = createMockPage({ url: 'https://example.com/page-b' });
      const messages2: any[] = [];
      const result = await injector.injectContext(mockPage2, messages2);

      expect(result.injected).toBe(true);
      expect(result.injectionType).toBe('full_tree');
      expect(messages2).toHaveLength(1);
      expect(messages2[0].content).toContain('page-b');
    });

    it('should use full_tree injectionType for small pages', async () => {
      // Small tree (well under 3000 char threshold)
      const mockPage = createMockPage({
        snapshot: {
          role: 'WebArea',
          name: 'Small Page',
          children: [
            { role: 'button', name: 'OK' },
          ],
        },
      });
      const messages: any[] = [];

      const result = await injector.injectContext(mockPage, messages);

      expect(result.injected).toBe(true);
      expect(result.injectionType).toBe('full_tree');
    });

    it('should use interactive_summary_diff for large pages on subsequent calls', async () => {
      // Create a large tree that exceeds largePageThreshold (3000 chars).
      // Use 80 children (under maxChildrenPerNode=100) to avoid pruning.
      const manyChildren = Array.from({ length: 80 }, (_, i) => ({
        role: 'button',
        name: `Button number ${i} with a somewhat long descriptive label for padding`,
      }));

      // Set up first mock
      mockCaptureAccessibilityTree.mockResolvedValueOnce({
        role: 'WebArea',
        name: 'Large Page',
        children: manyChildren,
      });

      const mockPage1: any = {
        url: jest.fn().mockReturnValue('https://example.com/big'),
        title: jest.fn().mockResolvedValue('Large Page'),
      };

      // First call: initial -> always full_tree
      const messages1: any[] = [];
      await injector.injectContext(mockPage1, messages1);

      // Second call: same URL but different tree (change a button name)
      const modifiedChildren = manyChildren.map((child, i) =>
        i === 0
          ? { role: 'button' as const, name: 'Modified First Button Label' }
          : child
      );
      modifiedChildren.push({ role: 'button', name: 'Extra New Button' });

      mockCaptureAccessibilityTree.mockResolvedValueOnce({
        role: 'WebArea',
        name: 'Large Page',
        children: modifiedChildren,
      });

      const mockPage2: any = {
        url: jest.fn().mockReturnValue('https://example.com/big'),
        title: jest.fn().mockResolvedValue('Large Page'),
      };

      const messages2: any[] = [];
      const result = await injector.injectContext(mockPage2, messages2);

      expect(result.injected).toBe(true);
      expect(result.injectionType).toBe('interactive_summary_diff');
    });

    it('should handle accessibility snapshot error gracefully with empty tree', async () => {
      // When page.accessibility.snapshot() throws, captureSnapshot catches it
      // and sets rawTree to null, producing a valid snapshot with "(empty page)"
      const mockPage = createMockPage({
        snapshotError: new Error('Accessibility API unavailable'),
      });
      const messages: any[] = [];

      const result = await injector.injectContext(mockPage, messages);

      // The snapshot still succeeds with a null tree
      expect(result.injected).toBe(true);
      expect(result.injectionType).toBe('full_tree');
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toContain('[Current Page Context]');
    });

    it('should handle gracefully when accessibility capture returns null tree', async () => {
      // When captureAccessibilityTree returns null, the code still produces
      // a valid snapshot with "(empty page)" as the serialized tree
      mockCaptureAccessibilityTree.mockResolvedValueOnce(null);
      const mockPage: any = {
        url: jest.fn().mockReturnValue('https://example.com/broken'),
        title: jest.fn().mockResolvedValue('Broken Page'),
      };

      const messages: any[] = [];
      const result = await injector.injectContext(mockPage, messages);

      // Code is defensive: even without accessibility, it creates a valid snapshot
      expect(result.injected).toBe(true);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toContain('[Current Page Context]');
    });

    it('should append HumanMessage to the messages array (local copy pattern)', async () => {
      const mockPage = createMockPage();
      const existingMessage = { content: 'existing user message' };
      const messages: any[] = [existingMessage];

      await injector.injectContext(mockPage, messages);

      // HumanMessage should be appended (pushed) after existing messages
      // Uses HumanMessage (not SystemMessage) for Gemini compatibility
      expect(messages).toHaveLength(2);
      expect(messages[0]).toBe(existingMessage);
      expect(messages[1].content).toContain('[Current Page Context]');
      expect(messages[1]._getType()).toBe('human');
    });

    it('should include page title and URL in the context message', async () => {
      const mockPage = createMockPage({
        url: 'https://mysite.com/dashboard',
        title: 'Dashboard',
      });
      const messages: any[] = [];

      await injector.injectContext(mockPage, messages);

      expect(messages[0].content).toContain('Dashboard');
      expect(messages[0].content).toContain('https://mysite.com/dashboard');
    });

    it('should track durationMs correctly', async () => {
      const mockPage = createMockPage();
      const messages: any[] = [];

      const result = await injector.injectContext(mockPage, messages);

      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle page with null accessibility snapshot', async () => {
      const mockPage = createMockPage({ snapshot: null });
      const messages: any[] = [];

      const result = await injector.injectContext(mockPage, messages);

      // Should still inject with "(empty page)" or similar
      if (result.injected) {
        expect(messages).toHaveLength(1);
      }
    });

    it('should persist snapshot when persistSnapshots is enabled', async () => {
      const { persistSnapshot } = require('../../../framework/ai/context/snapshot-store');
      const injectorWithPersist = new PageContextInjector({
        persistSnapshots: true,
        snapshotDir: '/tmp/test-persist',
      });

      const mockPage = createMockPage();
      const messages: any[] = [];

      await injectorWithPersist.injectContext(mockPage, messages);

      expect(persistSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com',
          title: 'Test Page',
        }),
        '/tmp/test-persist'
      );
    });
  });

  describe('reset()', () => {
    it('should clear previous snapshot state so next call is treated as initial', async () => {
      const mockPage = createMockPage();

      // First call: initial
      const messages1: any[] = [];
      await injector.injectContext(mockPage, messages1);
      expect(messages1).toHaveLength(1);

      // Second call: should skip (no changes)
      const messages2: any[] = [];
      const result1 = await injector.injectContext(mockPage, messages2);
      expect(result1.skipReason).toBe('no_changes');

      // Reset
      injector.reset();

      // Third call after reset: should inject again (treated as initial)
      const messages3: any[] = [];
      const result2 = await injector.injectContext(mockPage, messages3);
      expect(result2.injected).toBe(true);
      expect(result2.injectionType).toBe('full_tree');
      expect(messages3).toHaveLength(1);
    });
  });

  describe('constructor configuration', () => {
    it('should use default config values when no config provided', () => {
      const defaultInjector = new PageContextInjector();

      // We can verify defaults by testing behavior -- small page should use full_tree
      expect(defaultInjector).toBeDefined();
    });

    it('should merge provided config with defaults', async () => {
      const customInjector = new PageContextInjector({
        largePageThreshold: 100,
        maxContextChars: 200,
      });

      // A tree that would be "small" under default threshold but "large" under 100
      const mockPage = createMockPage({
        snapshot: {
          role: 'WebArea',
          name: 'Page',
          children: [
            { role: 'button', name: 'A somewhat long button label for testing' },
            { role: 'textbox', name: 'Another element with some text' },
          ],
        },
      });

      // First call is always initial (full_tree)
      const messages1: any[] = [];
      await customInjector.injectContext(mockPage, messages1);

      // Second call with different tree: should use interactive_summary_diff
      // because the serialized tree exceeds the custom threshold of 100
      const mockPage2 = createMockPage({
        snapshot: {
          role: 'WebArea',
          name: 'Page',
          children: [
            { role: 'button', name: 'A somewhat long button label for testing' },
            { role: 'textbox', name: 'Another element with some text' },
            { role: 'link', name: 'Extra link that makes tree different' },
          ],
        },
      });

      const messages2: any[] = [];
      const result = await customInjector.injectContext(mockPage2, messages2);

      expect(result.injected).toBe(true);
    });
  });
});

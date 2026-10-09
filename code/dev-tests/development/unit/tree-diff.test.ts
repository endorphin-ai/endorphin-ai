/**
 * Tree Diff Tests
 * Tests for accessibility tree snapshot comparison (diffTrees and diffSnapshots)
 */

import { describe, it, expect } from '@jest/globals';
import { diffTrees, diffSnapshots } from '../../../framework/ai/context/tree-diff';
import type {
  AccessibilityNode,
  AccessibilitySnapshot,
} from '../../../framework/types/accessibility';

/**
 * Helper to create a minimal AccessibilitySnapshot for testing diffSnapshots.
 */
function makeSnapshot(
  tree: AccessibilityNode | null,
  overrides: Partial<AccessibilitySnapshot> = {}
): AccessibilitySnapshot {
  return {
    id: 'test-snapshot',
    url: 'https://example.com',
    title: 'Test Page',
    timestamp: new Date().toISOString(),
    trigger: 'tool_call',
    tree,
    treeHash: 'hash',
    serializedTree: '(mock)',
    interactiveSummary: [],
    ...overrides,
  };
}

describe('TreeDiff', () => {
  describe('diffTrees()', () => {
    it('should return hasChanges: false for identical trees', () => {
      const tree: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'button', name: 'Submit' },
          { role: 'textbox', name: 'Email' },
        ],
      };

      // Same structure for both
      const previous: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'button', name: 'Submit' },
          { role: 'textbox', name: 'Email' },
        ],
      };

      const result = diffTrees(previous, tree);

      expect(result.hasChanges).toBe(false);
      expect(result.changed).toHaveLength(0);
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
    });

    it('should detect added node in added array', () => {
      const previous: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'button', name: 'Submit' },
        ],
      };

      const current: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'button', name: 'Submit' },
          { role: 'textbox', name: 'Email' },
        ],
      };

      const result = diffTrees(previous, current);

      expect(result.hasChanges).toBe(true);
      expect(result.added).toHaveLength(1);
      expect(result.added[0].description).toContain('textbox');
      expect(result.added[0].description).toContain('Email');
      expect(result.removed).toHaveLength(0);
    });

    it('should detect removed node in removed array', () => {
      const previous: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'button', name: 'Submit' },
          { role: 'textbox', name: 'Email' },
        ],
      };

      const current: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'button', name: 'Submit' },
        ],
      };

      const result = diffTrees(previous, current);

      expect(result.hasChanges).toBe(true);
      expect(result.removed).toHaveLength(1);
      expect(result.removed[0].description).toContain('textbox');
      expect(result.removed[0].description).toContain('Email');
      expect(result.added).toHaveLength(0);
    });

    it('should detect value change in changed array with changedProperties', () => {
      const previous: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'textbox', name: 'Email', value: 'old@example.com' },
        ],
      };

      const current: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'textbox', name: 'Email', value: 'new@example.com' },
        ],
      };

      const result = diffTrees(previous, current);

      expect(result.hasChanges).toBe(true);
      expect(result.changed).toHaveLength(1);
      expect(result.changed[0].changedProperties).toContain('value');
      expect(result.changed[0].description).toContain('textbox');
    });

    it('should detect disabled toggled in changed array', () => {
      const previous: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'button', name: 'Submit', disabled: false },
        ],
      };

      const current: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'button', name: 'Submit', disabled: true },
        ],
      };

      const result = diffTrees(previous, current);

      expect(result.hasChanges).toBe(true);
      expect(result.changed).toHaveLength(1);
      expect(result.changed[0].changedProperties).toContain('disabled');
    });

    it('should detect checked toggled in changed array', () => {
      const previous: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'checkbox', name: 'Accept', checked: false },
        ],
      };

      const current: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'checkbox', name: 'Accept', checked: true },
        ],
      };

      const result = diffTrees(previous, current);

      expect(result.hasChanges).toBe(true);
      expect(result.changed).toHaveLength(1);
      expect(result.changed[0].changedProperties).toContain('checked');
    });

    it('should detect name changed at same path in changed array', () => {
      const previous: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'button', name: 'Submit' },
        ],
      };

      const current: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'button', name: 'Submitting...' },
        ],
      };

      const result = diffTrees(previous, current);

      // Identity includes name, so different name = different identity
      // This means the old node is "removed" and new node is "added"
      expect(result.hasChanges).toBe(true);
      expect(result.removed).toHaveLength(1);
      expect(result.added).toHaveLength(1);
      expect(result.removed[0].description).toContain('Submit');
      expect(result.added[0].description).toContain('Submitting...');
    });

    it('should treat node moved to different path as remove + add', () => {
      const previous: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'button', name: 'Action' },
          { role: 'textbox', name: 'Input' },
        ],
      };

      // Swap order: button moves from index 0 to index 1
      const current: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'textbox', name: 'Input' },
          { role: 'button', name: 'Action' },
        ],
      };

      const result = diffTrees(previous, current);

      // Different paths mean different identities, so treated as remove + add
      expect(result.hasChanges).toBe(true);
      // Both the old positions are "removed" and new positions are "added"
      expect(result.added.length).toBeGreaterThan(0);
      expect(result.removed.length).toBeGreaterThan(0);
    });

    it('should detect multiple property changes on same node', () => {
      const previous: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'textbox', name: 'Email', value: 'old', disabled: false },
        ],
      };

      const current: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'textbox', name: 'Email', value: 'new', disabled: true },
        ],
      };

      const result = diffTrees(previous, current);

      expect(result.hasChanges).toBe(true);
      expect(result.changed).toHaveLength(1);
      expect(result.changed[0].changedProperties).toContain('value');
      expect(result.changed[0].changedProperties).toContain('disabled');
    });

    it('should include node reference in diff entries', () => {
      const previous: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'button', name: 'Old Button' },
        ],
      };

      const current: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'link', name: 'New Link' },
        ],
      };

      const result = diffTrees(previous, current);

      expect(result.added[0].node).toBeDefined();
      expect(result.added[0].node.role).toBe('link');
      expect(result.removed[0].node).toBeDefined();
      expect(result.removed[0].node.role).toBe('button');
    });
  });

  describe('diffSnapshots()', () => {
    it('should treat null previous tree and non-null current as all nodes added', () => {
      const previous = makeSnapshot(null);
      const current = makeSnapshot({
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'button', name: 'Click' },
          { role: 'textbox', name: 'Input' },
        ],
      });

      const result = diffSnapshots(previous, current);

      expect(result.hasChanges).toBe(true);
      // Root + 2 children = 3 added nodes
      expect(result.added).toHaveLength(3);
      expect(result.removed).toHaveLength(0);
      expect(result.changed).toHaveLength(0);
    });

    it('should treat non-null previous and null current as all nodes removed', () => {
      const previous = makeSnapshot({
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'button', name: 'Click' },
        ],
      });
      const current = makeSnapshot(null);

      const result = diffSnapshots(previous, current);

      expect(result.hasChanges).toBe(true);
      // Root + 1 child = 2 removed nodes
      expect(result.removed).toHaveLength(2);
      expect(result.added).toHaveLength(0);
      expect(result.changed).toHaveLength(0);
    });

    it('should return no changes when both trees are null', () => {
      const previous = makeSnapshot(null);
      const current = makeSnapshot(null);

      const result = diffSnapshots(previous, current);

      expect(result.hasChanges).toBe(false);
      expect(result.changed).toHaveLength(0);
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
    });

    it('should delegate to diffTrees when both trees are non-null', () => {
      const tree: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'button', name: 'Submit' },
        ],
      };

      const previous = makeSnapshot({
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'button', name: 'Submit' },
        ],
      });

      const current = makeSnapshot({
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'button', name: 'Submit' },
        ],
      });

      const result = diffSnapshots(previous, current);

      // Identical trees -> no changes
      expect(result.hasChanges).toBe(false);
    });
  });
});

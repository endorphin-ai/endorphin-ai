/**
 * Tree Schema Validator Security Tests
 * Tests structural limits enforcement, role validation,
 * and resource exhaustion prevention for accessibility trees.
 */

import { describe, it, expect } from '@jest/globals';
import { validateTreeSchema } from '../../../framework/ai/context/security/tree-schema-validator';
import type { AccessibilityNode } from '../../../framework/types/accessibility';

describe('Tree Schema Validator', () => {
  describe('validateTreeSchema()', () => {
    // --- Basic validation ---

    it('should return valid result for a well-formed tree', () => {
      const tree: AccessibilityNode = {
        role: 'WebArea',
        name: 'Test Page',
        children: [
          { role: 'button', name: 'Click Me' },
          { role: 'textbox', name: 'Input' },
        ],
      };

      const result = validateTreeSchema(tree);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.nodeCount).toBe(3);
      expect(result.tree.role).toBe('WebArea');
      expect(result.tree.children).toHaveLength(2);
    });

    it('should return a deep clone (not mutate the original)', () => {
      const original: AccessibilityNode = {
        role: 'WebArea',
        name: 'Original',
        children: [
          { role: 'button', name: 'Child' },
        ],
      };

      const result = validateTreeSchema(original);

      // Modify the clone
      result.tree.name = 'Modified';
      result.tree.children![0].name = 'Modified Child';

      // Original should be unchanged
      expect(original.name).toBe('Original');
      expect(original.children![0].name).toBe('Child');
    });

    it('should handle tree with no children', () => {
      const tree: AccessibilityNode = {
        role: 'WebArea',
        name: 'Empty Page',
      };

      const result = validateTreeSchema(tree);

      expect(result.valid).toBe(true);
      expect(result.nodeCount).toBe(1);
      expect(result.tree.children).toBeUndefined();
    });

    // --- Max depth enforcement ---

    it('should prune subtrees exceeding max depth', () => {
      // Build a chain of depth 30 (exceeds default 25)
      let node: AccessibilityNode = { role: 'button', name: 'Leaf' };
      for (let i = 0; i < 29; i++) {
        node = { role: 'group', name: `Level ${29 - i}`, children: [node] };
      }

      const result = validateTreeSchema(node);

      expect(result.valid).toBe(false);
      expect(result.warnings.some(w => w.includes('Pruned subtree at depth'))).toBe(true);
    });

    it('should respect custom max depth', () => {
      // Chain of depth 5
      let node: AccessibilityNode = { role: 'button', name: 'Leaf' };
      for (let i = 0; i < 4; i++) {
        node = { role: 'group', name: `Level ${4 - i}`, children: [node] };
      }

      const result = validateTreeSchema(node, { maxDepth: 3 });

      expect(result.valid).toBe(false);
      expect(result.warnings.some(w => w.includes('Pruned subtree at depth'))).toBe(true);
    });

    it('should keep tree within max depth limit', () => {
      // Chain of depth 5 (within default 25)
      let node: AccessibilityNode = { role: 'button', name: 'Leaf' };
      for (let i = 0; i < 4; i++) {
        node = { role: 'group', name: `Level ${4 - i}`, children: [node] };
      }

      const result = validateTreeSchema(node);

      expect(result.valid).toBe(true);
      expect(result.nodeCount).toBe(5);
    });

    // --- Max children per node ---

    it('should prune excess children beyond maxChildrenPerNode', () => {
      const children = Array.from({ length: 150 }, (_, i) => ({
        role: 'button' as const,
        name: `Button ${i}`,
      }));

      const tree: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children,
      };

      const result = validateTreeSchema(tree);

      expect(result.valid).toBe(false);
      expect(result.tree.children!.length).toBe(100); // default maxChildrenPerNode
      expect(result.warnings.some(w => w.includes('Pruned') && w.includes('children'))).toBe(true);
    });

    it('should respect custom maxChildrenPerNode', () => {
      const children = Array.from({ length: 20 }, (_, i) => ({
        role: 'button' as const,
        name: `Button ${i}`,
      }));

      const tree: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children,
      };

      const result = validateTreeSchema(tree, { maxChildrenPerNode: 10 });

      expect(result.valid).toBe(false);
      expect(result.tree.children!.length).toBe(10);
    });

    // --- Max total nodes ---

    it('should truncate tree at maxTotalNodes', () => {
      // Create a wide tree with 50 groups of 50 buttons = 2501 nodes (root + 50 groups + 2500 buttons)
      const groups = Array.from({ length: 50 }, (_, gi) => ({
        role: 'group' as const,
        name: `Group ${gi}`,
        children: Array.from({ length: 50 }, (_, bi) => ({
          role: 'button' as const,
          name: `Button ${gi}-${bi}`,
        })),
      }));

      const tree: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: groups,
      };

      const result = validateTreeSchema(tree);

      expect(result.nodeCount).toBeLessThanOrEqual(2000); // default maxTotalNodes
      expect(result.warnings.some(w => w.includes('truncated'))).toBe(true);
    });

    it('should respect custom maxTotalNodes', () => {
      const children = Array.from({ length: 20 }, (_, i) => ({
        role: 'button' as const,
        name: `Button ${i}`,
      }));

      const tree: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children,
      };

      const result = validateTreeSchema(tree, { maxTotalNodes: 10 });

      expect(result.nodeCount).toBeLessThanOrEqual(10);
    });

    // --- Role validation ---

    it('should replace unknown roles with "generic"', () => {
      const tree: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'custom-widget', name: 'Custom' },
          { role: 'invented_role', name: 'Invented' },
        ],
      };

      const result = validateTreeSchema(tree);

      expect(result.tree.children![0].role).toBe('generic');
      expect(result.tree.children![1].role).toBe('generic');
    });

    it('should keep valid WAI-ARIA roles unchanged', () => {
      const tree: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'button', name: 'Button' },
          { role: 'link', name: 'Link' },
          { role: 'textbox', name: 'Input' },
          { role: 'heading', name: 'Title' },
          { role: 'navigation', name: 'Nav' },
          { role: 'main', name: 'Main Content' },
        ],
      };

      const result = validateTreeSchema(tree);

      expect(result.tree.children![0].role).toBe('button');
      expect(result.tree.children![1].role).toBe('link');
      expect(result.tree.children![2].role).toBe('textbox');
      expect(result.tree.children![3].role).toBe('heading');
      expect(result.tree.children![4].role).toBe('navigation');
      expect(result.tree.children![5].role).toBe('main');
    });

    // --- String length enforcement ---

    it('should truncate long names to maxStringLength', () => {
      const longName = 'A'.repeat(300);
      const tree: AccessibilityNode = {
        role: 'button',
        name: longName,
      };

      const result = validateTreeSchema(tree);

      expect(result.tree.name.length).toBe(200); // default maxStringLength
      expect(result.tree.name).toMatch(/\.\.\.$/);
    });

    it('should truncate long values', () => {
      const longValue = 'V'.repeat(300);
      const tree: AccessibilityNode = {
        role: 'textbox',
        name: 'Input',
        value: longValue,
      };

      const result = validateTreeSchema(tree);

      expect((result.tree.value as string).length).toBe(200);
      expect(result.tree.value).toMatch(/\.\.\.$/);
    });

    it('should truncate long descriptions', () => {
      const longDesc = 'D'.repeat(300);
      const tree: AccessibilityNode = {
        role: 'button',
        name: 'OK',
        description: longDesc,
      };

      const result = validateTreeSchema(tree);

      expect(result.tree.description!.length).toBe(200);
      expect(result.tree.description).toMatch(/\.\.\.$/);
    });

    it('should respect custom maxStringLength', () => {
      const tree: AccessibilityNode = {
        role: 'button',
        name: 'A'.repeat(100),
      };

      const result = validateTreeSchema(tree, { maxStringLength: 50 });

      expect(result.tree.name.length).toBe(50);
    });

    // --- Optional properties preservation ---

    it('should copy boolean state properties', () => {
      const tree: AccessibilityNode = {
        role: 'checkbox',
        name: 'Agree',
        checked: true,
        disabled: false,
        expanded: true,
        focused: true,
        pressed: false,
        selected: true,
      };

      const result = validateTreeSchema(tree);

      expect(result.tree.checked).toBe(true);
      expect(result.tree.disabled).toBe(false);
      expect(result.tree.expanded).toBe(true);
      expect(result.tree.focused).toBe(true);
      expect(result.tree.pressed).toBe(false);
      expect(result.tree.selected).toBe(true);
    });

    it('should copy "mixed" checked/pressed states', () => {
      const tree: AccessibilityNode = {
        role: 'checkbox',
        name: 'Mixed',
        checked: 'mixed',
        pressed: 'mixed',
      };

      const result = validateTreeSchema(tree);

      expect(result.tree.checked).toBe('mixed');
      expect(result.tree.pressed).toBe('mixed');
    });

    it('should copy numeric values', () => {
      const tree: AccessibilityNode = {
        role: 'slider',
        name: 'Volume',
        value: 75,
      };

      const result = validateTreeSchema(tree);

      expect(result.tree.value).toBe(75);
    });

    it('should skip non-finite numeric values', () => {
      const tree: AccessibilityNode = {
        role: 'slider',
        name: 'Volume',
        value: Infinity as any,
      };

      const result = validateTreeSchema(tree);

      expect(result.tree.value).toBeUndefined();
    });

    it('should validate heading levels (1-6)', () => {
      const tree: AccessibilityNode = {
        role: 'heading',
        name: 'Title',
        level: 3,
      };

      const result = validateTreeSchema(tree);

      expect(result.tree.level).toBe(3);
    });

    it('should skip invalid heading levels', () => {
      const tree: AccessibilityNode = {
        role: 'heading',
        name: 'Title',
        level: 99,
      };

      const result = validateTreeSchema(tree);

      expect(result.tree.level).toBeUndefined();
    });

    // --- Edge cases / resource exhaustion ---

    it('should handle null root gracefully by returning minimal tree', () => {
      // When the root would be pruned (e.g., maxTotalNodes = 0),
      // a minimal fallback tree is returned
      const tree: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
      };

      const result = validateTreeSchema(tree, { maxTotalNodes: 0 });

      expect(result.tree).toBeDefined();
      expect(result.tree.role).toBe('WebArea');
    });

    it('should handle extremely deep tree (resource exhaustion attempt)', () => {
      // Build a chain of depth 1000
      let node: AccessibilityNode = { role: 'button', name: 'Leaf' };
      for (let i = 0; i < 999; i++) {
        node = { role: 'group', name: `L${i}`, children: [node] };
      }

      const result = validateTreeSchema(node);

      // Should complete without stack overflow
      // Nodes at depths 0-25 are kept (26 nodes) + depth 26 is counted but pruned = 27
      expect(result.nodeCount).toBeLessThanOrEqual(27);
      expect(result.valid).toBe(false);
    });

    it('should handle extremely wide tree (resource exhaustion attempt)', () => {
      const children = Array.from({ length: 10000 }, (_, i) => ({
        role: 'button' as const,
        name: `B${i}`,
      }));

      const tree: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children,
      };

      const result = validateTreeSchema(tree);

      // Should be pruned to maxChildrenPerNode (100) + root = 101
      expect(result.nodeCount).toBeLessThanOrEqual(101);
      expect(result.valid).toBe(false);
    });

    it('should handle combined width and depth exhaustion', () => {
      // Create a tree designed to maximize node count
      const buildWideTree = (depth: number, width: number): AccessibilityNode => ({
        role: 'group',
        name: `D${depth}`,
        children: depth > 0
          ? Array.from({ length: width }, (_, i) => buildWideTree(depth - 1, width))
          : [{ role: 'button', name: 'Leaf' }],
      });

      // 5^5 = 3125 leaf nodes + internal nodes = ~3900 total
      const tree = buildWideTree(5, 5);

      const result = validateTreeSchema(tree);

      expect(result.nodeCount).toBeLessThanOrEqual(2000);
    });

    // --- Non-string property types (defensive) ---

    it('should skip non-string descriptions', () => {
      const tree: AccessibilityNode = {
        role: 'button',
        name: 'OK',
        description: 123 as any,
      };

      const result = validateTreeSchema(tree);

      expect(result.tree.description).toBeUndefined();
    });

    it('should skip non-boolean disabled values', () => {
      const tree: AccessibilityNode = {
        role: 'button',
        name: 'OK',
        disabled: 'yes' as any,
      };

      const result = validateTreeSchema(tree);

      expect(result.tree.disabled).toBeUndefined();
    });

    it('should skip non-string/non-number value types', () => {
      const tree: AccessibilityNode = {
        role: 'textbox',
        name: 'Input',
        value: { malicious: true } as any,
      };

      const result = validateTreeSchema(tree);

      expect(result.tree.value).toBeUndefined();
    });
  });
});

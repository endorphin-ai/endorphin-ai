/**
 * Accessibility Tree Serializer Tests
 * Tests for tree-to-text serialization and interactive element extraction
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  serializeTree,
  extractInteractiveElements,
  buildIdentityString,
} from '../../../framework/ai/context/accessibility-tree-serializer';
import type { AccessibilityNode } from '../../../framework/types/accessibility';

describe('AccessibilityTreeSerializer', () => {
  describe('serializeTree()', () => {
    it('should serialize empty tree (root with no children)', () => {
      const root: AccessibilityNode = {
        role: 'WebArea',
        name: 'Test Page',
      };

      const result = serializeTree(root);

      expect(result).toBe('- WebArea "Test Page"');
    });

    it('should serialize simple flat tree (heading, textbox, button)', () => {
      const root: AccessibilityNode = {
        role: 'WebArea',
        name: 'Test Page',
        children: [
          { role: 'heading', name: 'Welcome', level: 1 },
          { role: 'textbox', name: 'Username' },
          { role: 'button', name: 'Submit' },
        ],
      };

      const result = serializeTree(root);
      const lines = result.split('\n');

      expect(lines).toHaveLength(4);
      expect(lines[0]).toBe('- WebArea "Test Page"');
      expect(lines[1]).toBe('  - heading "Welcome" (level 1)');
      expect(lines[2]).toBe('  - textbox "Username"');
      expect(lines[3]).toBe('  - button "Submit"');
    });

    it('should serialize nested tree (form > group > inputs)', () => {
      const root: AccessibilityNode = {
        role: 'WebArea',
        name: 'Form Page',
        children: [
          {
            role: 'form',
            name: 'Login Form',
            children: [
              {
                role: 'group',
                name: 'Credentials',
                children: [
                  { role: 'textbox', name: 'Email' },
                  { role: 'textbox', name: 'Password' },
                ],
              },
              { role: 'button', name: 'Login' },
            ],
          },
        ],
      };

      const result = serializeTree(root);
      const lines = result.split('\n');

      expect(lines).toHaveLength(6);
      expect(lines[0]).toBe('- WebArea "Form Page"');
      expect(lines[1]).toBe('  - form "Login Form"');
      expect(lines[2]).toBe('    - group "Credentials"');
      expect(lines[3]).toBe('      - textbox "Email"');
      expect(lines[4]).toBe('      - textbox "Password"');
      expect(lines[5]).toBe('    - button "Login"');
    });

    it('should include value for value-carrying roles (textbox with value)', () => {
      const root: AccessibilityNode = {
        role: 'WebArea',
        name: '',
        children: [
          { role: 'textbox', name: 'Email', value: 'user@example.com' },
        ],
      };

      const result = serializeTree(root);
      const lines = result.split('\n');

      expect(lines[1]).toContain('(value: "user@example.com")');
    });

    it('should include state flags (disabled, checked, expanded)', () => {
      const root: AccessibilityNode = {
        role: 'WebArea',
        name: '',
        children: [
          { role: 'button', name: 'Submit', disabled: true },
          { role: 'checkbox', name: 'Accept Terms', checked: true },
          { role: 'treeitem', name: 'Section', expanded: true },
        ],
      };

      const result = serializeTree(root);
      const lines = result.split('\n');

      expect(lines[1]).toContain('[disabled]');
      expect(lines[2]).toContain('[checked]');
      expect(lines[3]).toContain('[expanded]');
    });

    it('should handle collapsed and mixed states', () => {
      const root: AccessibilityNode = {
        role: 'WebArea',
        name: '',
        children: [
          { role: 'treeitem', name: 'Collapsed', expanded: false },
          { role: 'checkbox', name: 'Mixed', checked: 'mixed' },
        ],
      };

      const result = serializeTree(root);

      expect(result).toContain('[collapsed]');
      expect(result).toContain('[mixed]');
    });

    it('should handle selected, focused, and pressed states', () => {
      const root: AccessibilityNode = {
        role: 'WebArea',
        name: '',
        children: [
          { role: 'tab', name: 'Tab 1', selected: true },
          { role: 'textbox', name: 'Input', focused: true },
          { role: 'button', name: 'Toggle', pressed: true },
        ],
      };

      const result = serializeTree(root);

      expect(result).toContain('[selected]');
      expect(result).toContain('[focused]');
      expect(result).toContain('[pressed]');
    });

    it('should truncate long names (>80 chars)', () => {
      const longName = 'A'.repeat(100);
      const root: AccessibilityNode = {
        role: 'WebArea',
        name: '',
        children: [
          { role: 'heading', name: longName },
        ],
      };

      const result = serializeTree(root);

      // Should truncate to 77 chars + '...'
      expect(result).toContain('A'.repeat(77) + '...');
      expect(result).not.toContain('A'.repeat(78));
    });

    it('should truncate long values (>50 chars)', () => {
      const longValue = 'B'.repeat(60);
      const root: AccessibilityNode = {
        role: 'WebArea',
        name: '',
        children: [
          { role: 'textbox', name: 'Field', value: longValue },
        ],
      };

      const result = serializeTree(root);

      // Should truncate to 47 chars + '...'
      expect(result).toContain('B'.repeat(47) + '...');
      expect(result).not.toContain('B'.repeat(48));
    });

    it('should not truncate names at exactly 80 chars', () => {
      const exactName = 'C'.repeat(80);
      const root: AccessibilityNode = {
        role: 'WebArea',
        name: '',
        children: [
          { role: 'heading', name: exactName },
        ],
      };

      const result = serializeTree(root);

      expect(result).toContain(`"${exactName}"`);
      expect(result).not.toContain('...');
    });

    it('should not truncate values at exactly 50 chars', () => {
      const exactValue = 'D'.repeat(50);
      const root: AccessibilityNode = {
        role: 'WebArea',
        name: '',
        children: [
          { role: 'textbox', name: 'Field', value: exactValue },
        ],
      };

      const result = serializeTree(root);

      expect(result).toContain(`(value: "${exactValue}")`);
      expect(result).not.toContain('...');
    });

    it('should add [CHANGED] marker for changed identities', () => {
      const root: AccessibilityNode = {
        role: 'WebArea',
        name: '',
        children: [
          { role: 'button', name: 'Submit' },
        ],
      };

      // Build the identity the same way the serializer does
      const identity = buildIdentityString('button', 'Submit', [0]);
      const changedIdentities = new Set([identity]);

      const result = serializeTree(root, { changedIdentities });

      expect(result).toContain('[CHANGED]');
    });

    it('should add [NEW] marker for new identities', () => {
      const root: AccessibilityNode = {
        role: 'WebArea',
        name: '',
        children: [
          { role: 'button', name: 'New Button' },
        ],
      };

      const identity = buildIdentityString('button', 'New Button', [0]);
      const newIdentities = new Set([identity]);

      const result = serializeTree(root, { newIdentities });

      expect(result).toContain('[NEW]');
    });

    it('should prefer [NEW] over [CHANGED] when both are present', () => {
      const root: AccessibilityNode = {
        role: 'WebArea',
        name: '',
        children: [
          { role: 'button', name: 'Ambiguous' },
        ],
      };

      const identity = buildIdentityString('button', 'Ambiguous', [0]);
      const changedIdentities = new Set([identity]);
      const newIdentities = new Set([identity]);

      const result = serializeTree(root, { changedIdentities, newIdentities });

      expect(result).toContain('[NEW]');
      expect(result).not.toContain('[CHANGED]');
    });

    it('should skip name in quotes when name is empty', () => {
      const root: AccessibilityNode = {
        role: 'separator',
        name: '',
      };

      const result = serializeTree(root);

      expect(result).toBe('- separator');
      expect(result).not.toContain('""');
    });

    it('should respect maxDepth option', () => {
      const root: AccessibilityNode = {
        role: 'WebArea',
        name: '',
        children: [
          {
            role: 'form',
            name: 'Form',
            children: [
              {
                role: 'textbox',
                name: 'Deep Input',
              },
            ],
          },
        ],
      };

      const result = serializeTree(root, { maxDepth: 1 });
      const lines = result.split('\n');

      expect(lines).toHaveLength(2);
      expect(result).toContain('form');
      expect(result).not.toContain('Deep Input');
    });

    it('should not add value for non-value roles', () => {
      const root: AccessibilityNode = {
        role: 'WebArea',
        name: '',
        children: [
          { role: 'button', name: 'Click Me', value: 'some-val' },
        ],
      };

      const result = serializeTree(root);

      // button is not a VALUE_ROLE, so value should not appear
      expect(result).not.toContain('(value:');
    });
  });

  describe('extractInteractiveElements()', () => {
    it('should extract only interactive roles from mixed tree', () => {
      const root: AccessibilityNode = {
        role: 'WebArea',
        name: 'Page',
        children: [
          { role: 'heading', name: 'Title' },
          { role: 'paragraph', name: 'Some text' },
          { role: 'button', name: 'Click Me' },
          { role: 'textbox', name: 'Email' },
          { role: 'link', name: 'Home' },
          { role: 'separator', name: '' },
          { role: 'checkbox', name: 'Accept' },
        ],
      };

      const elements = extractInteractiveElements(root);

      expect(elements).toHaveLength(4);
      expect(elements.map((e) => e.role)).toEqual([
        'button',
        'textbox',
        'link',
        'checkbox',
      ]);
    });

    it('should return empty array for tree with no interactive children', () => {
      const root: AccessibilityNode = {
        role: 'WebArea',
        name: 'Static Page',
      };

      const elements = extractInteractiveElements(root);

      expect(elements).toHaveLength(0);
      expect(elements).toEqual([]);
    });

    it('should include value and state info on interactive elements', () => {
      const root: AccessibilityNode = {
        role: 'WebArea',
        name: '',
        children: [
          {
            role: 'textbox',
            name: 'Username',
            value: 'john',
            disabled: true,
          },
          {
            role: 'checkbox',
            name: 'Remember',
            checked: true,
          },
        ],
      };

      const elements = extractInteractiveElements(root);

      expect(elements).toHaveLength(2);
      expect(elements[0].value).toBe('john');
      expect(elements[0].disabled).toBe(true);
      expect(elements[1].checked).toBe(true);
    });

    it('should track depth correctly for nested interactive elements', () => {
      const root: AccessibilityNode = {
        role: 'WebArea',
        name: '',
        children: [
          {
            role: 'form',
            name: 'Login',
            children: [
              {
                role: 'group',
                name: 'Fields',
                children: [
                  { role: 'textbox', name: 'Email' },
                ],
              },
            ],
          },
          { role: 'button', name: 'Top Level' },
        ],
      };

      const elements = extractInteractiveElements(root);

      expect(elements).toHaveLength(2);
      // textbox is at depth 3: WebArea(0) > form(1) > group(2) > textbox(3)
      expect(elements[0].role).toBe('textbox');
      expect(elements[0].depth).toBe(3);
      // button is at depth 1: WebArea(0) > button(1)
      expect(elements[1].role).toBe('button');
      expect(elements[1].depth).toBe(1);
    });

    it('should include all interactive roles', () => {
      const allInteractiveRoles = [
        'button', 'link', 'textbox', 'combobox', 'checkbox', 'radio',
        'slider', 'spinbutton', 'switch', 'menuitem', 'tab', 'searchbox',
        'option', 'menuitemcheckbox', 'menuitemradio',
      ];

      const root: AccessibilityNode = {
        role: 'WebArea',
        name: '',
        children: allInteractiveRoles.map((role) => ({
          role,
          name: `${role} element`,
        })),
      };

      const elements = extractInteractiveElements(root);

      expect(elements).toHaveLength(allInteractiveRoles.length);
      for (const role of allInteractiveRoles) {
        expect(elements.some((e) => e.role === role)).toBe(true);
      }
    });
  });

  describe('buildIdentityString()', () => {
    it('should build identity from role, name, and path', () => {
      const identity = buildIdentityString('button', 'Submit', [0, 1, 2]);

      expect(identity).toBe('button:Submit:0.1.2');
    });

    it('should handle empty path', () => {
      const identity = buildIdentityString('WebArea', 'Page', []);

      expect(identity).toBe('WebArea:Page:');
    });

    it('should handle empty name', () => {
      const identity = buildIdentityString('separator', '', [0]);

      expect(identity).toBe('separator::0');
    });
  });
});

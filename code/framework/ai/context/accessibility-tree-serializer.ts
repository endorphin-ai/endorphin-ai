/**
 * Accessibility Tree Serializer
 * Transforms a Playwright AccessibilityNode tree into a compact,
 * LLM-readable text format for page context injection.
 */

import type { AccessibilityNode, InteractiveElement } from '../../types/accessibility.js';

const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'textbox', 'combobox', 'checkbox', 'radio',
  'slider', 'spinbutton', 'switch', 'menuitem', 'tab', 'searchbox',
  'option', 'menuitemcheckbox', 'menuitemradio',
]);

const VALUE_ROLES = new Set([
  'textbox', 'combobox', 'slider', 'spinbutton', 'searchbox',
]);

export interface SerializeOptions {
  /** Indent string per level. Default: '  ' (2 spaces) */
  indent?: string;
  /** Maximum depth to serialize. Default: Infinity */
  maxDepth?: number;
  /** Set of node identities to annotate with [CHANGED] */
  changedIdentities?: Set<string>;
  /** Set of node identities to annotate with [NEW] */
  newIdentities?: Set<string>;
}

/**
 * Serialize an accessibility tree into a compact, indented text representation.
 * Each node is rendered on one line with role, name, value, and state properties.
 *
 * Format per line:
 *   {indent}- {role} "{name}"{value_suffix}{state_suffix}{change_marker}
 *
 * @param root - The root AccessibilityNode from Playwright's accessibility.snapshot()
 * @param options - Optional configuration
 * @returns The serialized text representation of the tree
 */
export function serializeTree(
  root: AccessibilityNode,
  options: SerializeOptions = {}
): string {
  const indent = options.indent ?? '  ';
  const maxDepth = options.maxDepth ?? Infinity;
  const lines: string[] = [];

  function visit(node: AccessibilityNode, depth: number, pathIndices: number[]): void {
    if (depth > maxDepth) return;

    const prefix = indent.repeat(depth);
    let line = `${prefix}- ${node.role}`;

    // Add name in quotes (skip if empty or same as role)
    if (node.name && node.name.trim().length > 0) {
      // Truncate very long names to 80 chars
      const displayName = node.name.length > 80
        ? `${node.name.substring(0, 77)}...`
        : node.name;
      line += ` "${displayName}"`;
    }

    // Add level for headings
    if (node.level !== undefined) {
      line += ` (level ${node.level})`;
    }

    // Add value for value-carrying roles
    if (VALUE_ROLES.has(node.role) && node.value !== undefined) {
      const valueStr = String(node.value);
      const displayValue = valueStr.length > 50
        ? `${valueStr.substring(0, 47)}...`
        : valueStr;
      line += ` (value: "${displayValue}")`;
    }

    // Add state flags
    const states: string[] = [];
    if (node.disabled) states.push('disabled');
    if (node.checked === true) states.push('checked');
    if (node.checked === 'mixed') states.push('mixed');
    if (node.expanded === true) states.push('expanded');
    if (node.expanded === false) states.push('collapsed');
    if (node.selected) states.push('selected');
    if (node.focused) states.push('focused');
    if (node.pressed === true) states.push('pressed');

    if (states.length > 0) {
      line += ` [${states.join(', ')}]`;
    }

    // Add change markers
    const identity = buildIdentityString(node.role, node.name, pathIndices);
    if (options.newIdentities?.has(identity)) {
      line += ' [NEW]';
    } else if (options.changedIdentities?.has(identity)) {
      line += ' [CHANGED]';
    }

    lines.push(line);

    // Recurse into children
    if (node.children) {
      node.children.forEach((child, index) => {
        visit(child, depth + 1, [...pathIndices, index]);
      });
    }
  }

  visit(root, 0, []);
  return lines.join('\n');
}

/**
 * Extract all interactive elements from the tree.
 * Interactive roles: button, link, textbox, combobox, checkbox, radio,
 * slider, spinbutton, switch, menuitem, tab, searchbox, option.
 *
 * @param root - The root AccessibilityNode
 * @returns Array of InteractiveElement entries
 */
export function extractInteractiveElements(
  root: AccessibilityNode
): InteractiveElement[] {
  const elements: InteractiveElement[] = [];

  function visit(node: AccessibilityNode, depth: number): void {
    if (INTERACTIVE_ROLES.has(node.role)) {
      const element: InteractiveElement = {
        role: node.role,
        name: node.name,
        depth,
      };

      if (node.value !== undefined) {
        element.value = node.value;
      }
      if (node.disabled !== undefined) {
        element.disabled = node.disabled;
      }
      if (node.checked !== undefined) {
        element.checked = node.checked;
      }

      elements.push(element);
    }

    if (node.children) {
      for (const child of node.children) {
        visit(child, depth + 1);
      }
    }
  }

  visit(root, 0);
  return elements;
}

/**
 * Build a string identity for a node based on role + name + path.
 * This is the canonical identity used for diffing.
 */
export function buildIdentityString(
  role: string,
  name: string,
  path: number[]
): string {
  return `${role}:${name}:${path.join('.')}`;
}

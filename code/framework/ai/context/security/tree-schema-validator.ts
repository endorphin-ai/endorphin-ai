/**
 * Accessibility Tree Schema Validator
 *
 * Validates and prunes AccessibilityNode trees to enforce structural limits
 * before injection into the LLM prompt. Prevents resource exhaustion from
 * excessively deep, wide, or large trees crafted by malicious pages.
 */

import type { AccessibilityNode } from '../../../types/accessibility.js';

/** Schema validation limits */
interface TreeSchemaLimits {
  /** Maximum tree depth. Default: 25 */
  maxDepth: number;
  /** Maximum children per node. Default: 100 */
  maxChildrenPerNode: number;
  /** Maximum total nodes in tree. Default: 2000 */
  maxTotalNodes: number;
  /** Maximum string length for name/value fields. Default: 200 */
  maxStringLength: number;
}

const DEFAULT_LIMITS: TreeSchemaLimits = {
  maxDepth: 25,
  maxChildrenPerNode: 100,
  maxTotalNodes: 2000,
  maxStringLength: 200,
};

/** Known WAI-ARIA roles (subset of the full spec, covering common roles) */
const VALID_ROLES = new Set([
  // Landmark roles
  'banner', 'complementary', 'contentinfo', 'form', 'main', 'navigation', 'region', 'search',
  // Document structure
  'article', 'cell', 'columnheader', 'definition', 'directory', 'document', 'feed',
  'figure', 'group', 'heading', 'img', 'list', 'listitem', 'math', 'none', 'note',
  'presentation', 'row', 'rowgroup', 'rowheader', 'separator', 'table', 'term', 'toolbar',
  // Widget roles
  'alert', 'alertdialog', 'button', 'checkbox', 'combobox', 'dialog', 'grid', 'gridcell',
  'link', 'listbox', 'log', 'marquee', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox',
  'menuitemradio', 'option', 'progressbar', 'radio', 'radiogroup', 'scrollbar', 'searchbox',
  'slider', 'spinbutton', 'status', 'switch', 'tab', 'tablist', 'tabpanel', 'textbox',
  'timer', 'tooltip', 'tree', 'treegrid', 'treeitem',
  // Generic / browser-specific
  'generic', 'WebArea', 'text', 'paragraph', 'blockquote', 'code', 'emphasis',
  'strong', 'subscript', 'superscript', 'time', 'deletion', 'insertion',
]);

/**
 * Result of tree validation.
 */
export interface TreeValidationResult {
  /** Whether the tree is valid (within limits) */
  valid: boolean;
  /** The validated (possibly pruned) tree */
  tree: AccessibilityNode;
  /** Warnings about pruning actions taken */
  warnings: string[];
  /** Total node count after validation */
  nodeCount: number;
}

/**
 * Validate and prune an AccessibilityNode tree against schema limits.
 * Returns a pruned copy — does NOT mutate the input tree.
 *
 * @param root - The root AccessibilityNode to validate
 * @param limits - Optional custom limits (merged with defaults)
 * @returns Validation result with pruned tree and warnings
 */
export function validateTreeSchema(
  root: AccessibilityNode,
  limits: Partial<TreeSchemaLimits> = {}
): TreeValidationResult {
  const config = { ...DEFAULT_LIMITS, ...limits };
  const warnings: string[] = [];
  let totalNodes = 0;

  function cloneAndValidate(node: AccessibilityNode, depth: number): AccessibilityNode | null {
    // Enforce max total nodes
    if (totalNodes >= config.maxTotalNodes) {
      return null;
    }
    totalNodes++;

    // Enforce max depth
    if (depth > config.maxDepth) {
      warnings.push(`Pruned subtree at depth ${depth} (max: ${config.maxDepth})`);
      return null;
    }

    // Clone node (shallow, children handled below)
    const validated: AccessibilityNode = {
      role: node.role,
      name: node.name,
    };

    // Validate role — replace unknown roles with 'generic'
    if (!VALID_ROLES.has(validated.role)) {
      validated.role = 'generic';
    }

    // Clamp string lengths
    if (validated.name && validated.name.length > config.maxStringLength) {
      validated.name = `${validated.name.substring(0, config.maxStringLength - 3)}...`;
    }

    // Copy optional properties with validation
    if (node.value !== undefined) {
      if (typeof node.value === 'string') {
        validated.value = node.value.length > config.maxStringLength
          ? `${node.value.substring(0, config.maxStringLength - 3)}...`
          : node.value;
      } else if (typeof node.value === 'number' && isFinite(node.value)) {
        validated.value = node.value;
      }
    }

    if (node.description !== undefined && typeof node.description === 'string') {
      validated.description = node.description.length > config.maxStringLength
        ? `${node.description.substring(0, config.maxStringLength - 3)}...`
        : node.description;
    }

    if (typeof node.checked === 'boolean' || node.checked === 'mixed') validated.checked = node.checked;
    if (typeof node.disabled === 'boolean') validated.disabled = node.disabled;
    if (typeof node.expanded === 'boolean') validated.expanded = node.expanded;
    if (typeof node.focused === 'boolean') validated.focused = node.focused;
    if (typeof node.pressed === 'boolean' || node.pressed === 'mixed') validated.pressed = node.pressed;
    if (typeof node.selected === 'boolean') validated.selected = node.selected;
    if (typeof node.level === 'number' && node.level >= 1 && node.level <= 6) validated.level = node.level;

    // Validate children
    if (node.children && node.children.length > 0) {
      let childArray = node.children;

      // Enforce max children per node
      if (childArray.length > config.maxChildrenPerNode) {
        warnings.push(`Pruned ${childArray.length - config.maxChildrenPerNode} children from ${validated.role} "${validated.name}" (max: ${config.maxChildrenPerNode})`);
        childArray = childArray.slice(0, config.maxChildrenPerNode);
      }

      const validatedChildren: AccessibilityNode[] = [];
      for (const child of childArray) {
        if (totalNodes >= config.maxTotalNodes) {
          warnings.push(`Tree truncated at ${config.maxTotalNodes} nodes`);
          break;
        }
        const validChild = cloneAndValidate(child, depth + 1);
        if (validChild) {
          validatedChildren.push(validChild);
        }
      }

      if (validatedChildren.length > 0) {
        validated.children = validatedChildren;
      }
    }

    return validated;
  }

  const validatedTree = cloneAndValidate(root, 0);

  // Root should always exist — if it was null, create a minimal one
  const resultTree = validatedTree || { role: 'WebArea', name: '' };

  return {
    valid: warnings.length === 0,
    tree: resultTree,
    warnings,
    nodeCount: totalNodes,
  };
}

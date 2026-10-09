/**
 * Accessibility Tree Diff
 * Compares two accessibility tree snapshots and identifies
 * CHANGED, NEW, and REMOVED nodes.
 */

import type {
  AccessibilityNode,
  AccessibilitySnapshot,
  DiffEntry,
  TreeDiffResult,
} from '../../types/accessibility.js';
import { buildIdentityString } from './accessibility-tree-serializer.js';

interface FlatNode {
  node: AccessibilityNode;
  identity: string;
  path: number[];
}

/**
 * Flatten a tree into a map of identity -> FlatNode.
 */
function flattenTree(root: AccessibilityNode): Map<string, FlatNode> {
  const map = new Map<string, FlatNode>();

  function visit(node: AccessibilityNode, path: number[]): void {
    const identity = buildIdentityString(node.role, node.name, path);
    map.set(identity, { node, identity, path });

    if (node.children) {
      node.children.forEach((child, index) => {
        visit(child, [...path, index]);
      });
    }
  }

  visit(root, []);
  return map;
}

/**
 * Properties to compare for change detection.
 */
const COMPARABLE_PROPERTIES: (keyof AccessibilityNode)[] = [
  'value', 'checked', 'disabled', 'expanded', 'selected', 'pressed', 'name',
];

function getChangedProperties(
  prev: AccessibilityNode,
  curr: AccessibilityNode
): string[] {
  const changed: string[] = [];
  for (const prop of COMPARABLE_PROPERTIES) {
    if (prev[prop] !== curr[prop]) {
      changed.push(prop);
    }
  }
  return changed;
}

function nodeDescription(node: AccessibilityNode): string {
  let desc = node.role;
  if (node.name) desc += ` "${node.name}"`;
  if (node.value !== undefined) desc += ` (value: "${node.value}")`;
  return desc;
}

/**
 * Compare two accessibility tree roots directly.
 *
 * @param previousRoot - The previous tree root
 * @param currentRoot  - The current tree root
 * @returns TreeDiffResult
 */
export function diffTrees(
  previousRoot: AccessibilityNode,
  currentRoot: AccessibilityNode
): TreeDiffResult {
  const prevMap = flattenTree(previousRoot);
  const currMap = flattenTree(currentRoot);

  const changed: DiffEntry[] = [];
  const added: DiffEntry[] = [];
  const removed: DiffEntry[] = [];

  // Find added and changed nodes
  for (const [identity, curr] of currMap) {
    const prev = prevMap.get(identity);
    if (!prev) {
      added.push({
        identity,
        description: nodeDescription(curr.node),
        node: curr.node,
      });
    } else {
      const changedProps = getChangedProperties(prev.node, curr.node);
      if (changedProps.length > 0) {
        changed.push({
          identity,
          description: nodeDescription(curr.node),
          changedProperties: changedProps,
          node: curr.node,
        });
      }
    }
  }

  // Find removed nodes
  for (const [identity, prev] of prevMap) {
    if (!currMap.has(identity)) {
      removed.push({
        identity,
        description: nodeDescription(prev.node),
        node: prev.node,
      });
    }
  }

  return {
    hasChanges: changed.length > 0 || added.length > 0 || removed.length > 0,
    changed,
    added,
    removed,
  };
}

/**
 * Compare two accessibility snapshots and produce a diff result.
 *
 * @param previous - The previous snapshot
 * @param current  - The current snapshot
 * @returns TreeDiffResult with changed, added, and removed entries
 */
export function diffSnapshots(
  previous: AccessibilitySnapshot,
  current: AccessibilitySnapshot
): TreeDiffResult {
  // If either tree is null, treat as full change
  if (!previous.tree && !current.tree) {
    return { hasChanges: false, changed: [], added: [], removed: [] };
  }
  if (!previous.tree && current.tree) {
    // Everything is new
    const currMap = flattenTree(current.tree);
    const added: DiffEntry[] = [];
    for (const [identity, flat] of currMap) {
      added.push({
        identity,
        description: nodeDescription(flat.node),
        node: flat.node,
      });
    }
    return { hasChanges: true, changed: [], added, removed: [] };
  }
  if (previous.tree && !current.tree) {
    // Everything is removed
    const prevMap = flattenTree(previous.tree);
    const removed: DiffEntry[] = [];
    for (const [identity, flat] of prevMap) {
      removed.push({
        identity,
        description: nodeDescription(flat.node),
        node: flat.node,
      });
    }
    return { hasChanges: true, changed: [], added: [], removed };
  }

  return diffTrees(previous.tree!, current.tree!);
}

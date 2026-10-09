/**
 * Accessibility Tree Types
 * Interfaces for page context injection via Playwright accessibility API
 */

/**
 * A single node from Playwright's page.accessibility.snapshot().
 * This mirrors Playwright's AccessibilitySnapshot type but is owned by us
 * to avoid coupling to Playwright's internal type exports.
 */
export interface AccessibilityNode {
  role: string;
  name: string;
  value?: string | number;
  description?: string;
  checked?: boolean | 'mixed';
  disabled?: boolean;
  expanded?: boolean;
  focused?: boolean;
  level?: number; // For headings (h1=1, h2=2, etc.)
  pressed?: boolean | 'mixed';
  selected?: boolean;
  children?: AccessibilityNode[];
}

/**
 * A captured accessibility tree snapshot with metadata.
 * This is what gets stored in memory for diffing and persisted as YAML.
 */
export interface AccessibilitySnapshot {
  /** Unique identifier for this snapshot (ISO timestamp) */
  id: string;
  /** Page URL at time of capture */
  url: string;
  /** Page title at time of capture */
  title: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** What triggered this snapshot */
  trigger: 'navigation' | 'tool_call' | 'initial';
  /** The root node of the accessibility tree (null if capture failed) */
  tree: AccessibilityNode | null;
  /** SHA-256 hash of the serialized tree for quick comparison */
  treeHash: string;
  /** The serialized text representation (cached to avoid re-serialization) */
  serializedTree: string;
  /** Interactive elements extracted from the tree */
  interactiveSummary: InteractiveElement[];
}

/**
 * An interactive element extracted from the accessibility tree.
 * Used in the interactive_summary for large pages.
 */
export interface InteractiveElement {
  role: string;
  name: string;
  value?: string | number;
  disabled?: boolean;
  checked?: boolean | 'mixed';
  /** Depth in the tree (for context about where the element lives) */
  depth: number;
}

/**
 * Result of diffing two accessibility snapshots.
 */
export interface TreeDiffResult {
  /** Whether any changes were detected */
  hasChanges: boolean;
  /** Nodes that were modified (present in both, but properties changed) */
  changed: DiffEntry[];
  /** Nodes that are new (present in current but not in previous) */
  added: DiffEntry[];
  /** Nodes that were removed (present in previous but not in current) */
  removed: DiffEntry[];
}

/**
 * A single entry in a diff result.
 */
export interface DiffEntry {
  /** The node identity (role + name path) */
  identity: string;
  /** Human-readable description of the node */
  description: string;
  /** For changed nodes: which properties changed */
  changedProperties?: string[];
  /** The node itself (current state for changed/added, previous state for removed) */
  node: AccessibilityNode;
}

/**
 * The identity key used to match nodes across snapshots.
 * Composed of the role, name, and position path from root.
 */
export interface NodeIdentity {
  /** The accessibility role (button, textbox, heading, etc.) */
  role: string;
  /** The accessible name */
  name: string;
  /** Path indices from root (e.g., [0, 2, 1] means root > child[0] > child[2] > child[1]) */
  path: number[];
}

/**
 * Configuration for the page context injector.
 */
export interface PageContextInjectorConfig {
  /** Character threshold for switching from full tree to interactive summary + diff.
   *  Default: 3000 */
  largePageThreshold: number;
  /** Maximum total characters for injected context. Default: 4000 */
  maxContextChars: number;
  /** Whether to persist snapshots as YAML. Default: true */
  persistSnapshots: boolean;
  /** Whether to keep snapshots after session ends. Default: false */
  keepSnapshots: boolean;
  /** Directory for YAML snapshot persistence. Default: '.endorphin-tmp' */
  snapshotDir: string;
}

/**
 * Result of the injection attempt, returned to callModel for logging.
 */
export interface InjectionResult {
  /** Whether a SystemMessage was injected */
  injected: boolean;
  /** Why injection was skipped (if injected is false) */
  skipReason?: 'no_page' | 'no_changes' | 'snapshot_failed' | 'timeout';
  /** Type of injection performed */
  injectionType?: 'full_tree' | 'interactive_summary_diff' | 'minimal_fallback';
  /** Time taken for the entire injection process in ms */
  durationMs: number;
  /** Character count of the injected context */
  contextChars?: number;
}

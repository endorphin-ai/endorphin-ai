/**
 * Page Snapshot Type Definitions
 * Core interfaces and types for page snapshots and differential analysis
 */

import type { OptimizedContent } from './optimization-types.js';

export interface PageSnapshot {
  id: string;
  timestamp: number;
  url: string;
  title: string;
  dom: DOMSnapshot;
  forms: FormSnapshot[];
  interactive: InteractiveSnapshot[];
  optimizedContent?: OptimizedContent;
  metadata: SnapshotMetadata;
}

export interface DOMSnapshot {
  elements: ElementSnapshot[];
  totalElements: number;
  visibleElements: number;
}

export interface ElementSnapshot {
  id: string;
  tagName: string;
  selector: string;
  textContent: string;
  attributes: Record<string, string>;
  isVisible: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  hash: string; // For quick comparison
}

export interface FormSnapshot {
  selector: string;
  fields: FormFieldSnapshot[];
  isValid: boolean;
  submitButton?: string | undefined;
}

export interface FormFieldSnapshot {
  selector: string;
  type: string;
  value: string;
  placeholder: string;
  isRequired: boolean;
  isDisabled: boolean;
  validationMessage?: string | undefined;
}

export interface InteractiveSnapshot {
  selector: string;
  tagName: string;
  type: string;
  textContent: string;
  isEnabled: boolean;
  isVisible: boolean;
  href?: string | undefined;
}

export interface SnapshotMetadata {
  pageLoadState: string;
  networkIdle: boolean;
  scrollPosition: { x: number; y: number };
  viewportSize: { width: number; height: number };
  elementCounts: {
    total: number;
    interactive: number;
    forms: number;
    links: number;
    buttons: number;
    inputs: number;
  };
}

export interface PageDelta {
  snapshotId: string;
  previousSnapshotId: string;
  timestamp: number;
  changes: ChangeRecord[];
  summary: DeltaSummary;
}

export interface ChangeRecord {
  type: 'added' | 'removed' | 'modified' | 'moved';
  element: ElementSnapshot;
  previousState?: ElementSnapshot;
  description: string;
}

export interface DeltaSummary {
  totalChanges: number;
  addedElements: number;
  removedElements: number;
  modifiedElements: number;
  movedElements: number;
  affectedForms: number;
  affectedInteractive: number;
  significance: 'minor' | 'moderate' | 'major';
}

/**
 * Snapshot comparison options
 */
export interface SnapshotComparisonOptions {
  includeInvisible?: boolean;
  includeTextChanges?: boolean;
  includeAttributeChanges?: boolean;
  ignoreSelectors?: string[];
  maxTextLength?: number;
}

/**
 * Snapshot capture options
 */
export interface SnapshotCaptureOptions {
  includeMetadata?: boolean;
  includeForms?: boolean;
  includeInteractive?: boolean;
  maxTextLength?: number;
  optimizeContent?: boolean;
}

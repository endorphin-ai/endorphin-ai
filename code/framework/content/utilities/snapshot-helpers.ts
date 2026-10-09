/**
 * Snapshot Utility Functions
 * Helper functions for snapshot operations
 */

import type {
  ElementSnapshot,
  PageSnapshot,
  SnapshotComparisonOptions,
} from '../types/snapshot-types.js';

/**
 * Generate a stable selector for an element in browser context
 */
export function generateElementSelector(element: Element): string {
  // Try ID first
  if (element.id) {
    return `#${element.id}`;
  }

  // Try data-testid
  const testId = element.getAttribute('data-testid');
  if (testId) {
    return `[data-testid="${testId}"]`;
  }

  // Try unique class combination
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(' ').filter((c) => c.trim());
    if (classes.length > 0) {
      const classSelector = `.${classes.join('.')}`;
      const doc = element.ownerDocument || document;
      if (doc.querySelectorAll(classSelector).length === 1) {
        return classSelector;
      }
    }
  }

  // Fall back to tag + nth-child
  const parent = element.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter((el) => el.tagName === element.tagName);
    const index = siblings.indexOf(element);
    return `${element.tagName.toLowerCase()}:nth-child(${index + 1})`;
  }

  return element.tagName.toLowerCase();
}

/**
 * Simple hash function for quick comparison
 */
export function createElementHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Create element hash data for comparison
 */
export function createElementHashData(element: {
  tagName: string;
  textContent: string;
  attributes: Record<string, string>;
  isVisible: boolean;
}): string {
  return `${element.tagName}|${element.textContent}|${JSON.stringify(element.attributes)}|${element.isVisible}`;
}

/**
 * Extract important attributes from an element
 */
export function extractImportantAttributes(
  element: Element,
  maxLength: number = 100
): Record<string, string> {
  const importantAttrs = [
    'id',
    'class',
    'data-testid',
    'href',
    'src',
    'alt',
    'title',
    'name',
    'type',
    'value',
    'placeholder',
  ];
  const attributes: Record<string, string> = {};

  Array.from(element.attributes).forEach((attr) => {
    if (importantAttrs.includes(attr.name) || attr.name.startsWith('data-')) {
      attributes[attr.name] = attr.value.slice(0, maxLength);
    }
  });

  return attributes;
}

/**
 * Check if element is visible
 */
export function isElementVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    computedStyle.visibility !== 'hidden' &&
    computedStyle.display !== 'none'
  );
}

/**
 * Get element bounds
 */
export function getElementBounds(element: Element): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Compare two snapshots with options
 */
export function compareSnapshotsWithOptions(
  previous: PageSnapshot,
  current: PageSnapshot,
  options: SnapshotComparisonOptions = {}
): {
  addedElements: ElementSnapshot[];
  removedElements: ElementSnapshot[];
  modifiedElements: Array<{ current: ElementSnapshot; previous: ElementSnapshot }>;
} {
  const previousElements = new Map(previous.dom.elements.map((el) => [el.selector, el]));
  const currentElements = new Map(current.dom.elements.map((el) => [el.selector, el]));

  const addedElements: ElementSnapshot[] = [];
  const removedElements: ElementSnapshot[] = [];
  const modifiedElements: Array<{ current: ElementSnapshot; previous: ElementSnapshot }> = [];

  // Apply selector filters
  const shouldIgnoreSelector = (selector: string): boolean => {
    if (!options.ignoreSelectors) return false;
    return options.ignoreSelectors.some((pattern) => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(selector);
      }
      return selector.includes(pattern);
    });
  };

  // Find added elements
  for (const [selector, element] of currentElements) {
    if (shouldIgnoreSelector(selector)) continue;
    if (!options.includeInvisible && !element.isVisible) continue;

    if (!previousElements.has(selector)) {
      addedElements.push(element);
    }
  }

  // Find removed elements
  for (const [selector, element] of previousElements) {
    if (shouldIgnoreSelector(selector)) continue;
    if (!options.includeInvisible && !element.isVisible) continue;

    if (!currentElements.has(selector)) {
      removedElements.push(element);
    }
  }

  // Find modified elements
  for (const [selector, currentElement] of currentElements) {
    if (shouldIgnoreSelector(selector)) continue;
    if (!options.includeInvisible && !currentElement.isVisible) continue;

    const previousElement = previousElements.get(selector);
    if (previousElement && hasElementChanged(previousElement, currentElement, options)) {
      modifiedElements.push({ current: currentElement, previous: previousElement });
    }
  }

  return { addedElements, removedElements, modifiedElements };
}

/**
 * Check if an element has changed based on comparison options
 */
export function hasElementChanged(
  previous: ElementSnapshot,
  current: ElementSnapshot,
  options: SnapshotComparisonOptions = {}
): boolean {
  // Always check hash first for quick comparison
  if (previous.hash !== current.hash) {
    return true;
  }

  // Detailed comparison based on options
  if (options.includeTextChanges !== false && previous.textContent !== current.textContent) {
    return true;
  }

  if (options.includeAttributeChanges !== false) {
    const prevAttrs = Object.keys(previous.attributes);
    const currAttrs = Object.keys(current.attributes);

    if (prevAttrs.length !== currAttrs.length) {
      return true;
    }

    for (const attr of currAttrs) {
      if (previous.attributes[attr] !== current.attributes[attr]) {
        return true;
      }
    }
  }

  // Check visibility changes
  if (previous.isVisible !== current.isVisible) {
    return true;
  }

  return false;
}

/**
 * Filter snapshot elements based on criteria
 */
export function filterSnapshotElements(
  snapshot: PageSnapshot,
  filter: {
    includeInvisible?: boolean;
    tagNames?: string[];
    hasText?: boolean;
    hasAttributes?: string[];
    maxTextLength?: number;
  }
): ElementSnapshot[] {
  return snapshot.dom.elements.filter((element) => {
    // Visibility filter
    if (!filter.includeInvisible && !element.isVisible) {
      return false;
    }

    // Tag name filter
    if (filter.tagNames && !filter.tagNames.includes(element.tagName.toLowerCase())) {
      return false;
    }

    // Text content filter
    if (filter.hasText && !element.textContent.trim()) {
      return false;
    }

    // Attribute filter
    if (filter.hasAttributes) {
      const hasAllAttributes = filter.hasAttributes.every((attr) =>
        Object.keys(element.attributes).includes(attr)
      );
      if (!hasAllAttributes) {
        return false;
      }
    }

    // Text length filter
    if (filter.maxTextLength && element.textContent.length > filter.maxTextLength) {
      return false;
    }

    return true;
  });
}

/**
 * Get snapshot statistics
 */
export function getSnapshotStatistics(snapshot: PageSnapshot): {
  totalElements: number;
  visibleElements: number;
  interactiveElements: number;
  formElements: number;
  textElements: number;
  imageElements: number;
  linkElements: number;
} {
  const elements = snapshot.dom.elements;

  return {
    totalElements: elements.length,
    visibleElements: elements.filter((el) => el.isVisible).length,
    interactiveElements: elements.filter(
      (el) =>
        ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) ||
        el.attributes['onclick'] !== undefined ||
        el.attributes['role'] === 'button'
    ).length,
    formElements: elements.filter((el) =>
      ['INPUT', 'SELECT', 'TEXTAREA', 'FORM'].includes(el.tagName)
    ).length,
    textElements: elements.filter((el) => el.textContent.trim().length > 0).length,
    imageElements: elements.filter((el) => el.tagName === 'IMG').length,
    linkElements: elements.filter((el) => el.tagName === 'A' && el.attributes['href']).length,
  };
}

/**
 * Create a summary of snapshot changes
 */
export function createChangeSummary(
  addedElements: ElementSnapshot[],
  removedElements: ElementSnapshot[],
  modifiedElements: Array<{ current: ElementSnapshot; previous: ElementSnapshot }>
): string {
  const totalChanges = addedElements.length + removedElements.length + modifiedElements.length;

  if (totalChanges === 0) {
    return 'No changes detected';
  }

  const summary: string[] = [];

  if (addedElements.length > 0) {
    summary.push(`${addedElements.length} element(s) added`);
  }

  if (removedElements.length > 0) {
    summary.push(`${removedElements.length} element(s) removed`);
  }

  if (modifiedElements.length > 0) {
    summary.push(`${modifiedElements.length} element(s) modified`);
  }

  return summary.join(', ');
}

/**
 * Sanitize text content for storage
 */
export function sanitizeTextContent(text: string, maxLength: number = 100): string {
  return text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .slice(0, maxLength);
}

/**
 * Create element fingerprint for deduplication
 */
export function createElementFingerprint(element: ElementSnapshot): string {
  const key = `${element.tagName}:${element.textContent}:${element.attributes.id || ''}:${element.attributes.class || ''}`;
  return createElementHash(key);
}

/**
 * Text Sanitizer for Prompt Injection Defense
 *
 * Sanitizes all text extracted from the DOM before it reaches the LLM prompt.
 * Applies Unicode normalization, control character stripping, prompt injection
 * pattern detection, and length truncation.
 */

import type { AccessibilityNode } from '../../../types/accessibility.js';

/** Maximum allowed length for name/description fields */
const MAX_NAME_LENGTH = 200;
/** Maximum allowed length for value fields */
const MAX_VALUE_LENGTH = 100;

/**
 * Patterns that indicate prompt injection attempts.
 * Each pattern is matched case-insensitively against the text.
 */
const INJECTION_PATTERNS: RegExp[] = [
  // Instruction override attempts
  /ignore\s+(all\s+)?previous\s+(instructions?|prompts?|context)/i,
  /disregard\s+(all\s+)?previous/i,
  /forget\s+(everything|all|your)\s+(instructions?|prompts?|rules?)/i,
  /override\s+(system|previous)\s+(prompt|instructions?|message)/i,
  /new\s+instructions?\s*:/i,

  // Role impersonation
  /^system\s*:/im,
  /^assistant\s*:/im,
  /^user\s*:/im,
  /you\s+are\s+now\s+a/i,
  /act\s+as\s+(a|an|if)\s/i,
  /pretend\s+(you\s+are|to\s+be)/i,

  // Delimiter/boundary breaking
  /\[\/?(system|user|assistant|inst)\]/i,
  /<\/?system>/i,
  /<<\/?SYS>>/i,
  /```\s*(system|prompt|instruction)/i,

  // Data exfiltration
  /repeat\s+(back|everything|all|the)\s+(above|instructions?|prompt|system)/i,
  /what\s+(are|were)\s+your\s+(instructions?|rules?|system\s+prompt)/i,
  /show\s+me\s+(your|the)\s+(system\s+)?prompt/i,
  /output\s+(your|the|all)\s+(instructions?|prompt|rules?)/i,

  // Tool/action hijacking
  /execute\s+(the\s+following|this)\s+(command|code|script)/i,
  /call\s+(the\s+)?(function|tool|api)\s/i,
  /navigate\s+to\s+https?:\/\//i,
  /click\s+on\s+.*\s+and\s+then\s+(enter|type|fill)/i,
];

/**
 * Sanitize a single text string from the DOM.
 *
 * Applies these transformations in order:
 * 1. Unicode NFC normalization
 * 2. Strip control characters (except common whitespace)
 * 3. Collapse excessive whitespace
 * 4. Detect and flag prompt injection patterns
 * 5. Truncate to max length
 *
 * @param text - Raw text from the DOM
 * @param maxLength - Maximum allowed length
 * @returns Sanitized text
 */
export function sanitizeText(text: string, maxLength: number = MAX_NAME_LENGTH): string {
  if (!text) return text;

  // 1. Unicode NFC normalization (canonical decomposition + composition)
  let sanitized = text.normalize('NFC');

  // 2. Strip control characters (keep tab, newline, carriage return, space)
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

  // 3. Strip zero-width and invisible Unicode characters
  sanitized = sanitized.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/g, '');

  // 4. Collapse whitespace (newlines, tabs, multiple spaces -> single space)
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // 5. Check for prompt injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      sanitized = `[UNTRUSTED] ${sanitized}`;
      break; // Only flag once
    }
  }

  // 6. Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = `${sanitized.substring(0, maxLength - 3)}...`;
  }

  return sanitized;
}

/**
 * Sanitize all text fields in an AccessibilityNode tree (in-place).
 * Returns the same tree reference with all string fields sanitized.
 *
 * @param tree - The root AccessibilityNode (will be mutated)
 * @returns The same tree, sanitized
 */
export function sanitizeTree(tree: AccessibilityNode): AccessibilityNode {
  function visit(node: AccessibilityNode): void {
    // Sanitize name
    if (node.name) {
      node.name = sanitizeText(node.name, MAX_NAME_LENGTH);
    }

    // Sanitize description
    if (node.description) {
      node.description = sanitizeText(node.description, MAX_NAME_LENGTH);
    }

    // Sanitize string values
    if (typeof node.value === 'string') {
      node.value = sanitizeText(node.value, MAX_VALUE_LENGTH);
    }

    // Sanitize role (should be a known role, but clamp it)
    if (node.role) {
      node.role = node.role.replace(/[^a-zA-Z]/g, '').substring(0, 50);
    }

    // Recurse into children
    if (node.children) {
      for (const child of node.children) {
        visit(child);
      }
    }
  }

  visit(tree);
  return tree;
}

/**
 * Content formatting utilities for AI consumption
 */

import type { ContentChunk, OptimizationContext } from '../types/optimization-types.js';

/**
 * Format selected chunks for AI consumption
 */
export function formatForAI(chunks: ContentChunk[], _context: OptimizationContext): string {
  if (chunks.length === 0) {
    return 'No relevant content found on the page.';
  }

  // Group chunks by type for better organization
  const groupedChunks = chunks.reduce(
    (groups, chunk) => {
      if (!groups[chunk.type]) groups[chunk.type] = [];
      groups[chunk.type].push(chunk);
      return groups;
    },
    {} as Record<string, ContentChunk[]>
  );

  let formatted = '';

  // Format in logical order
  const typeOrder: ContentChunk['type'][] = [
    'header',
    'navigation',
    'form',
    'interactive',
    'content',
    'sidebar',
    'footer',
  ];

  for (const type of typeOrder) {
    const typeChunks = groupedChunks[type];
    if (!typeChunks || typeChunks.length === 0) continue;

    formatted += `\n=== ${type.toUpperCase()} ELEMENTS ===\n`;

    typeChunks
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .forEach((chunk, index) => {
        formatted += `${index + 1}. ${chunk.content}`;
        if (chunk.context) {
          formatted += ` (${chunk.context})`;
        }
        formatted += '\n';
      });
  }

  return formatted.trim();
}

/**
 * Estimate token count for content using cached calculation
 */
export function estimateTokens(content: string, cache?: Map<string, number>): number {
  // Use cache for performance
  if (cache?.has(content)) {
    return cache.get(content)!;
  }

  // Improved token estimation
  // ~3.7 characters per token for English with HTML structure
  const tokens = Math.ceil(content.length / 3.7);

  // Cache the result
  if (cache) {
    cache.set(content, tokens);
  }

  return tokens;
}

/**
 * Clean HTML content for better readability
 */
export function cleanContent(content: string): string {
  return content
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\n\s*\n/g, '\n') // Remove excessive line breaks
    .trim();
}

/**
 * Extract context information from element
 */
export function extractContext(element: any): string {
  const contextParts: string[] = [];

  // Add data attributes
  if (element.dataset) {
    Object.entries(element.dataset).forEach(([key, value]) => {
      if (key.includes('test') || key.includes('id') || key.includes('role')) {
        contextParts.push(`data-${key}="${value}"`);
      }
    });
  }

  // Add aria attributes
  if (element.getAttribute) {
    const ariaLabel = element.getAttribute('aria-label');
    const role = element.getAttribute('role');

    if (ariaLabel) contextParts.push(`aria-label="${ariaLabel}"`);
    if (role) contextParts.push(`role="${role}"`);
  }

  // Add id and class if meaningful
  if (element.id && element.id.length < 50) {
    contextParts.push(`id="${element.id}"`);
  }

  if (element.className && typeof element.className === 'string') {
    const classes = element.className
      .split(' ')
      .filter((cls: string) => cls.length > 2 && cls.length < 30)
      .slice(0, 3);
    if (classes.length > 0) {
      contextParts.push(`class="${classes.join(' ')}"`);
    }
  }

  return contextParts.join(' ');
}

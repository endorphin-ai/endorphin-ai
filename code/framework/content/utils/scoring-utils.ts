/**
 * Content scoring utilities for optimization
 */

import type { ContentChunk, OptimizationContext } from '../types/optimization-types.js';

/**
 * Calculate relevance and priority scores for chunks
 */
export function calculateScores(chunks: ContentChunk[], context: OptimizationContext): void {
  const instruction = context.instruction?.toLowerCase() || '';
  const taskType = context.taskType || 'general';

  // Extract keywords from instruction for relevance scoring
  const keywords = extractKeywords(instruction);
  const actionWords = extractActionWords(instruction);

  for (const chunk of chunks) {
    // Calculate relevance score based on keyword matching
    let relevanceScore = 0;
    const chunkText = chunk.content.toLowerCase();

    // Keyword matching with weighted scoring
    keywords.forEach((keyword) => {
      if (chunkText.includes(keyword)) {
        relevanceScore += 2; // Base keyword match
      }
      // Partial matching for compound words
      if (keyword.length > 5 && chunkText.includes(keyword.substring(0, 5))) {
        relevanceScore += 0.5;
      }
    });

    // Action-specific scoring
    if (chunk.interactive && actionWords.length > 0) {
      relevanceScore += 3; // Interactive elements are important for actions
    }

    // Task-specific scoring
    relevanceScore += getTaskTypeScore(chunk, taskType);

    // Position-based scoring (elements higher on page often more important)
    if (chunk.position.y < 600) {
      // Above the fold
      relevanceScore += 1;
    }

    // Element-specific scoring
    if (chunk.context?.includes('data-testid')) {
      relevanceScore += 2; // Test IDs are important for automation
    }

    chunk.relevanceScore = relevanceScore;
  }

  // Normalize scores to 0-1 range
  const maxRelevance = Math.max(...chunks.map((c) => c.relevanceScore));
  if (maxRelevance > 0) {
    chunks.forEach((chunk) => {
      chunk.relevanceScore = chunk.relevanceScore / maxRelevance;
    });
  }
}

/**
 * Select optimal chunks based on token budget and scores
 */
export function selectOptimalChunks(
  chunks: ContentChunk[],
  context: OptimizationContext
): ContentChunk[] {
  const maxTokens = context.maxTokens || 3000; // Default token budget
  const priorityTypes = context.priorityTypes || ['navigation', 'form', 'interactive', 'header'];

  // Sort chunks by combined score (relevance + priority + type bonus)
  const scoredChunks = chunks
    .map((chunk) => ({
      ...chunk,
      combinedScore: calculateCombinedScore(chunk, priorityTypes),
    }))
    .sort((a, b) => b.combinedScore - a.combinedScore);

  // Select chunks using greedy algorithm with token budget
  const selectedChunks: ContentChunk[] = [];
  let currentTokens = 0;

  // Always include high-priority chunks first
  const highPriorityChunks = scoredChunks.filter(
    (chunk) => chunk.combinedScore > 0.8 && chunk.tokens < maxTokens * 0.3
  );

  for (const chunk of highPriorityChunks) {
    if (currentTokens + chunk.tokens <= maxTokens) {
      selectedChunks.push(chunk);
      currentTokens += chunk.tokens;
    }
  }

  // Fill remaining budget with other relevant chunks
  const remainingChunks = scoredChunks.filter(
    (chunk) => !selectedChunks.includes(chunk) && chunk.combinedScore > 0.2
  );

  for (const chunk of remainingChunks) {
    if (currentTokens + chunk.tokens <= maxTokens) {
      selectedChunks.push(chunk);
      currentTokens += chunk.tokens;
    }
  }

  // Ensure we have at least some interactive elements if task involves actions
  if (context.instruction && isActionInstruction(context.instruction)) {
    const interactiveChunks = selectedChunks.filter((c) => c.interactive);
    if (interactiveChunks.length === 0) {
      // Add at least one interactive chunk even if over budget
      const bestInteractive = chunks
        .filter((c) => c.interactive)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)[0];

      if (bestInteractive) {
        selectedChunks.push(bestInteractive);
      }
    }
  }

  return selectedChunks;
}

/**
 * Extract keywords from instruction text
 */
export function extractKeywords(instruction: string): string[] {
  if (!instruction) return [];

  // Common stop words to filter out
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'can',
    'this',
    'that',
    'these',
    'those',
    'i',
    'you',
    'he',
    'she',
    'it',
    'we',
    'they',
  ]);

  return instruction
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word))
    .filter((word) => /^[a-zA-Z]+$/.test(word)) // Only alphabetic words
    .slice(0, 10); // Limit to most relevant keywords
}

/**
 * Extract action words from instruction
 */
export function extractActionWords(instruction: string): string[] {
  const actionWords = [
    'click',
    'press',
    'tap',
    'select',
    'choose',
    'pick',
    'fill',
    'enter',
    'type',
    'input',
    'write',
    'navigate',
    'go',
    'visit',
    'open',
    'load',
    'search',
    'find',
    'look',
    'locate',
    'submit',
    'send',
    'save',
    'confirm',
    'scroll',
    'swipe',
    'drag',
    'drop',
  ];

  return actionWords.filter((action) => instruction.toLowerCase().includes(action));
}

/**
 * Get task-specific relevance score
 */
export function getTaskTypeScore(chunk: ContentChunk, taskType: string): number {
  const taskTypeMapping: Record<string, Record<ContentChunk['type'], number>> = {
    navigation: {
      navigation: 3,
      interactive: 2,
      header: 2,
      content: 1,
      form: 1,
      footer: 0,
      sidebar: 1,
    },
    form_filling: {
      form: 3,
      interactive: 2,
      content: 1,
      navigation: 1,
      header: 1,
      footer: 0,
      sidebar: 0,
    },
    data_extraction: {
      content: 3,
      header: 2,
      interactive: 1,
      navigation: 1,
      form: 1,
      footer: 1,
      sidebar: 1,
    },
    verification: {
      content: 3,
      interactive: 2,
      header: 2,
      navigation: 1,
      form: 1,
      footer: 1,
      sidebar: 1,
    },
    general: {
      interactive: 2,
      content: 2,
      navigation: 1,
      form: 1,
      header: 1,
      footer: 0,
      sidebar: 1,
    },
  };

  const categoryScores = taskTypeMapping[taskType] || taskTypeMapping['general'];
  return (categoryScores as any)[chunk.type] || 0;
}

/**
 * Calculate combined score for chunk selection
 */
export function calculateCombinedScore(
  chunk: ContentChunk,
  priorityTypes: ContentChunk['type'][]
): number {
  let combinedScore = chunk.relevanceScore * 0.6; // Base relevance weight

  // Add priority type bonus
  if (priorityTypes.includes(chunk.type)) {
    combinedScore += 0.3;
  }

  // Add interactive bonus
  if (chunk.interactive) {
    combinedScore += 0.2;
  }

  // Position bonus (normalize to 0-1 range)
  const positionScore = Math.max(0, 1 - chunk.position.y / 2000);
  combinedScore += positionScore * 0.1;

  return Math.min(combinedScore, 1); // Cap at 1.0
}

/**
 * Check if instruction contains action words
 */
export function isActionInstruction(instruction: string): boolean {
  const actionWords = extractActionWords(instruction);
  return actionWords.length > 0;
}

/**
 * Remove duplicate chunks based on similarity
 */
export function deduplicateChunks(chunks: ContentChunk[]): ContentChunk[] {
  const seen = new Set<string>();
  const result: ContentChunk[] = [];

  for (const chunk of chunks) {
    // Create similarity key based on content and position
    const similarityKey = `${chunk.type}-${chunk.content.substring(0, 50)}-${Math.round(chunk.position.x / 50)}-${Math.round(chunk.position.y / 50)}`;

    if (!seen.has(similarityKey)) {
      seen.add(similarityKey);
      result.push(chunk);
    }
  }

  return result;
}

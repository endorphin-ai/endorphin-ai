/**
 * Content optimization types and interfaces
 */

export interface ContentChunk {
  id: string;
  type: 'navigation' | 'form' | 'content' | 'interactive' | 'footer' | 'sidebar' | 'header';
  selector: string;
  content: string;
  tokens: number;
  interactive: boolean;
  relevanceScore: number;
  priorityScore: number;
  position: { x: number; y: number; width: number; height: number };
  context?: string;
}

export interface OptimizationContext {
  instruction?: string;
  taskType?: 'navigation' | 'form_filling' | 'data_extraction' | 'verification' | 'general';
  targetElements?: string[];
  maxTokens?: number;
  priorityTypes?: ContentChunk['type'][];
}

export interface OptimizedContent {
  chunks: ContentChunk[];
  formattedContent: string;
  totalTokens: number;
  compressionRatio: number;
  metadata: {
    originalElements: number;
    selectedElements: number;
    discardedElements: number;
    optimizationTime: number;
  };
}

export interface ExtractionStrategy {
  type: ContentChunk['type'];
  selectors: string[];
  priority: number;
}

export interface OptimizerStatistics {
  tokenEstimationCacheSize: number;
  selectorCacheSize: number;
}

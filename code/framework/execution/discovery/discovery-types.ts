/**
 * Test Discovery Types
 * Type definitions for test discovery functionality
 */

import type { TestConfig } from '../../types/index.js';

/**
 * Extended test object with discovery metadata
 */
export interface DiscoveredTest extends TestConfig {
  sourceFile: string;
  exportName: string;
}

/**
 * Test discovery configuration
 */
export interface DiscoveryConfig {
  testsDirectory?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxConcurrency?: number; // Maximum concurrent file loading (also matches max multi-user limit of 5)
  enableTypeScript?: boolean;
}

/**
 * Test discovery result
 */
export interface TestDiscoveryResult {
  tests: Map<string, DiscoveredTest>;
  totalTests: number;
  totalFiles: number;
  errors: Array<{ file: string; error: string }>;
  duration: number;
}

/**
 * Test file load result
 */
export interface TestFileResult {
  filename: string;
  tests: DiscoveredTest[];
  success: boolean;
  error?: string;
}

/**
 * Test execution options
 */
export interface TestExecutionOptions {
  includeQuarantined?: boolean;
  timeout?: number;
}

/**
 * Test filter criteria
 */
export interface TestFilter {
  tags?: string[];
  priority?: string[];
  excludeTags?: string[];
  pattern?: string;
  quarantined?: boolean;
}

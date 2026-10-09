/**
 * CLI-related types
 */

import type { ViewportSize } from './browser';

export interface CLIFlags {
  headless?: boolean;
  viewport?: ViewportSize;
  timeout?: number;
  model?: string;
  environment?: string;
  baseUrl?: string;
  temperature?: number;
  testsDirectory?: string;
  dataDirectory?: string;
}

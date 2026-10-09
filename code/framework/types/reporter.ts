/**
 * Reporting and test summary types
 */

import type { TestResult } from './test';

export interface TestSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
  timestamp: string;
}

export interface TestReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: string;
    generatedAt: string;
  };
  results: TestResult[];
}

export interface ReportOptions {
  filename?: string;
  template?: string;
  includeScreenshots?: boolean;
  includeLogs?: boolean;
}

/**
 * Test Results Manager Module
 * Handles test result collection, storage, and processing
 */

import type { TestReport, TestSession } from '../types/index.js';
import { existsSync, promises as fs } from 'node:fs';
import * as path from 'node:path';
import { warn, logSuccess } from '../core/logger.js';

export interface TestResultsManagerOptions {
  resultsDir?: string;
  recorderDir?: string;
  enableRecorderCopy?: boolean;
}

/**
 * Manages test results storage, processing, and report generation
 */
export class TestResultsManager {
  private testResults: any[] = [];
  private resultsDir: string;
  private recorderDir: string;
  private enableRecorderCopy: boolean;

  constructor(options: TestResultsManagerOptions = {}) {
    this.resultsDir = options.resultsDir || path.resolve('./test-results');
    this.recorderDir = options.recorderDir || path.resolve('./test-recorder-sessions');
    this.enableRecorderCopy = options.enableRecorderCopy || false;

    // Note: Call initialize() after construction to ensure directories exist
  }

  /**
   * Initialize the results manager by ensuring directories exist
   */
  async initialize(): Promise<void> {
    await this.ensureDirectoriesExist();
  }

  /**
   * Add a test result to the collection
   */
  addTestResult(result: any): void {
    this.testResults.push(result);
  }

  /**
   * Get all test results
   */
  getTestResults(): any[] {
    return [...this.testResults];
  }

  /**
   * Clear all test results
   */
  clearTestResults(): void {
    this.testResults = [];
  }

  /**
   * Process a completed test session
   */
  processCompletedSession(session: TestSession): any {
    // This would be called from saveTestSession in test-session.ts
    // Add to results collection
    this.addTestResult(session);

    // Note: Recorder data is stored directly in test-recorder directory during recording
    // No need to copy from test-results to avoid duplication

    return session;
  }

  // REMOVED: copySessionToRecorder method to prevent duplicate storage
  // Test recorder now stores data only in test-recorder directory during recording

  /**
   * Generate a test report from collected results
   */
  generateReport(): TestReport {
    const passed = this.testResults.filter((r) => r.status === 'SUCCESS').length;
    const failed = this.testResults.filter((r) => r.status === 'FAILED').length;
    const total = this.testResults.length;

    const report: TestReport = {
      summary: {
        total,
        passed,
        failed,
        passRate: total > 0 ? `${((passed / total) * 100).toFixed(2)}%` : '0%',
        generatedAt: new Date().toISOString(),
      },
      results: this.testResults.map((session) => ({
        testId: session.testId,
        name: session.sessionName,
        status: session.status === 'SUCCESS' ? 'passed' : 'failed',
        duration: session.duration || 0,
        error: session.error,
        screenshots:
          session.steps?.flatMap(
            (step: any) => step.screenshots?.map((s: any) => s.filename) || []
          ) || [],
        logs: session.steps?.map((step: any) => step.description) || [],
        timestamp: session.startTime,
      })),
    };

    return report;
  }

  /**
   * Generate and save a report to file
   */
  async saveReport(filename?: string): Promise<string> {
    const report = this.generateReport();
    const reportPath = path.join(this.resultsDir, filename || `report-${Date.now()}.json`);

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    logSuccess(`Report saved to: ${reportPath}`, { reportPath }, 'TestResultsManager');

    return reportPath;
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectoriesExist(): Promise<void> {
    try {
      if (!existsSync(this.resultsDir)) {
        await fs.mkdir(this.resultsDir, { recursive: true });
      }
      if (this.enableRecorderCopy && !existsSync(this.recorderDir)) {
        await fs.mkdir(this.recorderDir, { recursive: true });
      }
    } catch (_error) {
      const message = _error instanceof Error ? _error.message : String(_error);
      warn(`Could not create directories: ${message}`, { message }, 'TestResultsManager');
    }
  }
}

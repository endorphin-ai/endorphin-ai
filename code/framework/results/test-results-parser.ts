/**
 * Test Results Parser
 * Parses test result data from the test-results directory
 * Handles aggregation and processing of test execution data for reporting
 */

import type { TestSession, TestSummary } from '../types/index.js';
import fs from 'fs';
import path from 'path';

/**
 * Parsed test result data structure
 */
export interface ParsedTestResult {
  resultDir: string;
  resultPath: string;
  summary: TestSummary;
  session: TestSession;
  screenshots: string[];
  screenshotsPath: string;
}

/**
 * Test statistics for reporting
 */
export interface TestStats {
  testId: string;
  testName: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  lastRun: string | null;
  averageDuration: number;
  totalDuration: number;
}

/**
 * Aggregated report data
 */
export interface ReportData {
  generatedAt: string;
  totalTests: number;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number;
  testStats: TestStats[];
  results: ParsedTestResult[];
  hasMoreResults: boolean;
}

/**
 * Cleanup summary
 */
export interface CleanupSummary {
  removedCount: number;
  removedDirs: string[];
  totalTestIds: number;
  keptPerTest: number;
}

/**
 * TestResultsParser - Parses test result data from the test-results directory
 * Handles aggregation and processing of test execution data for reporting
 */
export class TestResultsParser {
  private testResultsDir: string;

  /**
   * Create a new TestResultsParser instance
   * @param testResultsDir - Path to the test-results directory
   */
  constructor(testResultsDir: string) {
    this.testResultsDir = testResultsDir;
  }

  /**
   * Get all test result directories sorted by timestamp (newest first)
   * @returns Array of directory names
   */
  getAllTestResults(): string[] {
    if (!fs.existsSync(this.testResultsDir)) {
      return [];
    }

    const dirs = fs
      .readdirSync(this.testResultsDir)
      .filter((item) => {
        const fullPath = path.join(this.testResultsDir, item);
        return fs.statSync(fullPath).isDirectory() && item.includes('_');
      })
      .sort((a, b) => {
        // Extract timestamp from directory name and sort newest first
        const timestampA = a.split('_')[1];
        const timestampB = b.split('_')[1];
        return new Date(timestampB).getTime() - new Date(timestampA).getTime();
      });

    return dirs;
  }

  /**
   * Get test results filtered by test ID
   * @param testId - The test ID to filter by
   * @returns Array of directory names for the specific test
   */
  getTestResultsByTestId(testId: string): string[] {
    return this.getAllTestResults().filter((dir) => dir.startsWith(`${testId}_`));
  }

  /**
   * Parse a single test result directory
   * @param resultDir - Directory name of the test result
   * @returns Parsed test result data or null if parsing fails
   */
  parseTestResult(resultDir: string): ParsedTestResult | null {
    try {
      const resultPath = path.join(this.testResultsDir, resultDir);

      // Check if directory exists
      if (!fs.existsSync(resultPath)) {
        return null;
      }

      // Read summary.json
      const summaryPath = path.join(resultPath, 'summary.json');
      const sessionPath = path.join(resultPath, 'test-session.json');
      const screenshotsPath = path.join(resultPath, 'screenshots');

      if (!fs.existsSync(summaryPath) || !fs.existsSync(sessionPath)) {
        return null;
      }

      const summary: TestSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      const session: TestSession = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));

      // Get screenshot files
      const screenshots = fs.existsSync(screenshotsPath)
        ? fs
            .readdirSync(screenshotsPath)
            .filter(
              (file) => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')
            )
        : [];

      return {
        resultDir,
        resultPath,
        summary,
        session,
        screenshots,
        screenshotsPath,
      };
    } catch (error) {
      console.error(`Error parsing test result ${resultDir}:`, error);
      return null;
    }
  }

  /**
   * Generate aggregated report data for multiple test results
   * @param resultDirs - Array of result directory names to include
   * @returns Aggregated report data
   */
  generateReportData(resultDirs: string[] | null = null): ReportData {
    const dirs = resultDirs || this.getAllTestResults();
    const results: ParsedTestResult[] = [];
    const testStats = new Map<string, TestStats>();

    for (const dir of dirs) {
      const result = this.parseTestResult(dir);
      if (result) {
        results.push(result);

        // Update test statistics
        const testId = result.session.testId;
        if (!testStats.has(testId)) {
          testStats.set(testId, {
            testId,
            testName: result.session.testName,
            totalRuns: 0,
            successfulRuns: 0,
            failedRuns: 0,
            lastRun: null,
            averageDuration: 0,
            totalDuration: 0,
          });
        }

        const stats = testStats.get(testId)!;
        stats.totalRuns++;
        stats.totalDuration += result.session.duration || 0;
        stats.averageDuration = Math.round(stats.totalDuration / stats.totalRuns);

        if (result.session.status === 'SUCCESS') {
          stats.successfulRuns++;
        } else {
          stats.failedRuns++;
        }

        // Update last run (results are sorted newest first)
        if (!stats.lastRun || new Date(result.session.startTime) > new Date(stats.lastRun)) {
          stats.lastRun = result.session.startTime;
        }
      }
    }

    // Calculate overall statistics
    const totalTests = testStats.size;
    const totalRuns = results.length;
    const successfulRuns = results.filter((r) => r.session.status === 'SUCCESS').length;
    const failedRuns = totalRuns - successfulRuns;
    const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;

    return {
      generatedAt: new Date().toISOString(),
      totalTests,
      totalRuns,
      successfulRuns,
      failedRuns,
      successRate,
      testStats: Array.from(testStats.values()),
      results: results.slice(0, 50), // Limit to 50 most recent results for performance
      hasMoreResults: results.length > 50,
    };
  }

  /**
   * Get the most recent test result for a specific test ID
   * @param testId - The test ID to get the latest result for
   * @returns Latest test result or null if not found
   */
  getLatestTestResult(testId: string): ParsedTestResult | null {
    const results = this.getTestResultsByTestId(testId);
    if (results.length === 0) {
      return null;
    }

    return this.parseTestResult(results[0]);
  }

  /**
   * Clean up old test results, keeping only the specified number of recent results per test
   * @param keepPerTest - Number of recent results to keep per test (default: 10)
   * @returns Cleanup summary with counts of removed directories
   */
  cleanupOldResults(keepPerTest: number = 10): CleanupSummary {
    const allResults = this.getAllTestResults();
    const testGroups = new Map<string, string[]>();

    // Group results by test ID
    for (const dir of allResults) {
      const testId = dir.split('_')[0];
      if (!testGroups.has(testId)) {
        testGroups.set(testId, []);
      }
      testGroups.get(testId)!.push(dir);
    }

    let removedCount = 0;
    const removedDirs: string[] = [];

    // For each test, keep only the most recent results
    for (const [, dirs] of testGroups) {
      if (dirs.length > keepPerTest) {
        const toRemove = dirs.slice(keepPerTest);

        for (const dir of toRemove) {
          try {
            const dirPath = path.join(this.testResultsDir, dir);
            fs.rmSync(dirPath, { recursive: true, force: true });
            removedCount++;
            removedDirs.push(dir);
          } catch (error) {
            console.error(`Failed to remove directory ${dir}:`, error);
          }
        }
      }
    }

    return {
      removedCount,
      removedDirs,
      totalTestIds: testGroups.size,
      keptPerTest: keepPerTest,
    };
  }
}

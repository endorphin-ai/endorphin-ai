/**
 * HTML Reporter
 * Main HTML reporter class using modular components
 */

import path from 'path';
import { HtmlGenerator, type ReportOptions } from '../reporting/generators/html-generator.js';
import { AssetManager } from '../reporting/processors/asset-manager.js';
import { ResultsParser } from '../reporting/processors/results-parser.js';
import type { TestSession } from '../types/index.js';
import { info, logSuccess, error as logError } from '../core/logger.js';

export interface HtmlReporterOptions {
  testResultsDir?: string;
  maxReportAge?: number;
  maxReportsPerTest?: number;
}

/**
 * HTML Reporter for Endorphin AI test results
 * Generates interactive HTML reports from test-results data
 */
export class HtmlReporter {
  private resultsParser: ResultsParser;
  private htmlGenerator: HtmlGenerator;
  private assetManager: AssetManager;
  private testResultsDir: string;
  private reportsDir: string;

  constructor(testResultsDir: string = './test-results', options: HtmlReporterOptions = {}) {
    this.testResultsDir = path.resolve(testResultsDir);
    this.reportsDir = path.join(this.testResultsDir, 'reports');

    // Initialize components
    this.resultsParser = new ResultsParser(this.testResultsDir);
    this.htmlGenerator = new HtmlGenerator(this.reportsDir);
    this.assetManager = new AssetManager({
      reportsDir: this.reportsDir,
      maxReportAge: options.maxReportAge || 30,
      maxReportsPerTest: options.maxReportsPerTest || 10,
    });
  }

  /**
   * Generate HTML report from test sessions (for testing)
   */
  async generateReport(sessions: TestSession[]): Promise<string>;
  /**
   * Generate HTML report from all test results
   */
  async generateReport(options?: ReportOptions): Promise<string>;
  async generateReport(optionsOrSessions: ReportOptions | TestSession[] = {}): Promise<string> {
    try {
      info('Generating HTML test report', {}, 'HTMLReporter');

      let reportData;
      let options: ReportOptions = {};
      
      // Check if we have sessions or options
      if (Array.isArray(optionsOrSessions)) {
        // Handle sessions directly (for testing)
        const sessions = optionsOrSessions as TestSession[];
        reportData = this.resultsParser.createReportDataFromSessions(sessions);
      } else {
        // Handle normal options
        options = optionsOrSessions as ReportOptions;
        reportData = this.resultsParser.collectTestResults(options.resultDirs);
      }

      if (reportData.testResults.length === 0) {
        info(`Looking for test results in: ${  this.testResultsDir}`, {}, 'HTMLReporter');
        info('To generate a report, you need to run some tests first:', {}, 'HTMLReporter');
        info('1. Run: npx endorphin run test HEALTH-001', {}, 'HTMLReporter');
        info('2. Or run: npx endorphin run test all', {}, 'HTMLReporter');
        info('3. Then try: npx endorphin generate report', {}, 'HTMLReporter');
        throw new Error('No test results found. Run some tests first.');
      }

      // Generate HTML report
      const reportPath = await this.htmlGenerator.generateReport(reportData, options);

      logSuccess(`Report generated: ${reportPath}`, { 
        reportPath, 
        testResultsCount: reportData.testResults.length,
        successRate: reportData.summary.successRate 
      }, 'HTMLReporter');

      return reportPath;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate report: ${message}`);
    }
  }

  /**
   * Open the most recent report in browser
   */
  async openReport(reportPath: string | null = null): Promise<void> {
    try {
      const targetPath = reportPath || (await this.getLatestReport());

      if (!targetPath) {
        throw new Error('No reports found. Generate a report first.');
      }

      try {
        // Dynamically import the 'open' package if available
        // Dynamic import to avoid bundling issues
        const openModule = await import('open' as any);
        const open = openModule.default || openModule;
        await open(targetPath);
        info(`Opened report: ${targetPath}`, { targetPath }, 'HTMLReporter');
      } catch {
        info(`Report generated: ${targetPath}`, { targetPath }, 'HTMLReporter');
        info('Install "open" package to automatically open reports in browser', {}, 'HTMLReporter');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(`Failed to open report: ${message}`, error instanceof Error ? error : undefined, { message }, 'HTMLReporter');
      info(`You can manually open: ${reportPath || 'latest report'}`, { reportPath }, 'HTMLReporter');
    }
  }

  /**
   * Get the latest report file
   */
  private async getLatestReport(): Promise<string | null> {
    try {
      const fs = await import('fs');

      if (!fs.existsSync(this.reportsDir)) {
        return null;
      }

      const files = fs
        .readdirSync(this.reportsDir)
        .filter((file) => file.endsWith('.html'))
        .map((file) => ({
          name: file,
          path: path.join(this.reportsDir, file),
          mtime: fs.statSync(path.join(this.reportsDir, file)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      return files.length > 0 ? files[0].path : null;
    } catch (error) {
      console.warn('Error finding latest report:', error);
      return null;
    }
  }

  /**
   * Generate custom report with specific options
   */
  async generateCustomReport(
    options: ReportOptions & {
      template?: string;
      filters?: {
        status?: 'SUCCESS' | 'FAILED';
        testName?: string;
        dateRange?: { start: string; end: string };
      };
    } = {}
  ): Promise<string> {
    try {
      info('Generating custom HTML report', {}, 'HTMLReporter');

      // Parse test results
      const reportData = this.resultsParser.collectTestResults(options.resultDirs);

      // Apply filters if specified
      if (options.filters) {
        reportData.testResults = this.resultsParser.filterResults(
          reportData.testResults,
          options.filters
        );

        // Recalculate summary for filtered results
        reportData.summary = this.calculateFilteredSummary(reportData.testResults);
      }

      if (reportData.testResults.length === 0) {
        throw new Error('No test results match the specified filters.');
      }

      // Generate HTML report with custom options
      const reportPath = await this.htmlGenerator.generateReport(reportData, options);

      logSuccess(`Custom report generated: ${reportPath}`, { 
        reportPath,
        testResultsCount: reportData.testResults.length 
      }, 'HTMLReporter');

      return reportPath;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate custom report: ${message}`);
    }
  }

  /**
   * Calculate summary for filtered results
   */
  private calculateFilteredSummary(testResults: any[]): any {
    const totalTests = testResults.length;
    const passedTests = testResults.filter((result) => result.status === 'SUCCESS').length;
    const failedTests = totalTests - passedTests;
    const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
    const totalDuration = testResults.reduce((sum, result) => sum + (result.duration || 0), 0);

    return {
      totalTests,
      passedTests,
      failedTests,
      successRate,
      totalDuration,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Clean up old results keeping specified number per test
   */
  async cleanupResults(keepPerTest: number = 10): Promise<{
    deletedSessions: number;
    deletedReports: number;
    freedSpaceMB: number;
  }> {
    try {
      info(`Cleaning up test results (keeping ${keepPerTest} per test)`, { keepPerTest }, 'HTMLReporter');

      // Clean up reports and screenshots
      const cleanupResult = await this.assetManager.cleanupResults(keepPerTest);

      const freedSpaceMB = Math.round((cleanupResult.freedSpace / (1024 * 1024)) * 100) / 100;

      logSuccess('Cleanup completed', {
        deletedReports: cleanupResult.deletedReports,
        deletedScreenshots: cleanupResult.deletedScreenshots,
        freedSpaceMB
      }, 'HTMLReporter');

      return {
        deletedSessions: 0, // Legacy compatibility
        deletedReports: cleanupResult.deletedReports,
        freedSpaceMB,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Cleanup failed: ${message}`);
    }
  }

  /**
   * Clean up old reports by age
   */
  cleanupOldReports(maxAge: number = 30): {
    deleted: number;
    freedSpaceMB: number;
  } {
    try {
      info(`Cleaning up reports older than ${maxAge} days`, { maxAge }, 'HTMLReporter');

      const cleanupResult = this.assetManager.cleanupOldReports(maxAge);
      const freedSpaceMB = Math.round((cleanupResult.freedSpace / (1024 * 1024)) * 100) / 100;

      logSuccess('Cleanup completed', {
        deletedReports: cleanupResult.deletedReports,
        freedSpaceMB
      }, 'HTMLReporter');

      return {
        deleted: cleanupResult.deletedReports,
        freedSpaceMB,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(`Cleanup failed: ${message}`, error instanceof Error ? error : undefined, { message }, 'HTMLReporter');
      return { deleted: 0, freedSpaceMB: 0 };
    }
  }

  /**
   * Get report statistics
   */
  getStatistics() {
    try {
      const assetStats = this.assetManager.getAssetStatistics();
      const reportData = this.resultsParser.collectTestResults();
      const testStats = this.resultsParser.getTestStatistics(reportData.testResults);

      return {
        reports: {
          count: assetStats.reportsCount,
          oldestReport: assetStats.oldestReport,
          newestReport: assetStats.newestReport,
        },
        screenshots: {
          count: assetStats.screenshotsCount,
        },
        storage: {
          totalSizeMB: Math.round((assetStats.totalSize / (1024 * 1024)) * 100) / 100,
        },
        tests: testStats,
        directories: {
          testResults: this.testResultsDir,
          reports: this.reportsDir,
        },
      };
    } catch (error) {
      console.warn('Error getting statistics:', error);
      return null;
    }
  }

  /**
   * Verify report integrity
   */
  verifyIntegrity() {
    try {
      return this.assetManager.verifyAssetIntegrity();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(`Integrity check failed: ${message}`, error instanceof Error ? error : undefined, { message }, 'HTMLReporter');
      return {
        missingAssets: [],
        brokenLinks: [],
        orphanedScreenshots: [],
      };
    }
  }

  /**
   * Export test results to different formats
   */
  exportResults(format: 'json' | 'csv' = 'json'): string {
    try {
      const reportData = this.resultsParser.collectTestResults();
      return this.resultsParser.exportResults(reportData.testResults, format);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Export failed: ${message}`);
    }
  }

  /**
   * Get available templates
   */
  getAvailableTemplates(): string[] {
    return this.htmlGenerator.getAvailableTemplates();
  }

  // Getters for accessing components
  getResultsParser(): ResultsParser {
    return this.resultsParser;
  }

  getHtmlGenerator(): HtmlGenerator {
    return this.htmlGenerator;
  }

  getAssetManager(): AssetManager {
    return this.assetManager;
  }
}

// Re-export types for backward compatibility
export type { ReportOptions } from '../reporting/generators/html-generator.js';
export type {
  ParsedTestResult,
  ReportData,
  ReportSummary,
} from '../reporting/processors/results-parser.js';

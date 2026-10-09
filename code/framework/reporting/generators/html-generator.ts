/**
 * HTML Report Generator
 * Handles HTML template processing and report generation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ParsedTestResult, ReportData } from '../processors/results-parser.js';

/**
 * Get possible package template paths when installed via npm
 */
function getPackageTemplatePaths(): string[] {
  const packagePaths: string[] = [];
  
  try {
    // Try to resolve the package's main module
    const packageRoot = require.resolve('endorphin-ai/package.json');
    if (packageRoot) {
      const packageDir = path.dirname(packageRoot);
      packagePaths.push(
        path.join(packageDir, 'dist', 'framework', 'templates'),
        path.join(packageDir, 'framework', 'templates'),
        path.join(packageDir, 'templates')
      );
    }
  } catch {
    // Package not found via require.resolve, try alternative methods
  }

  try {
    // Try to find via node_modules resolution
    const nodeModulesPath = require.resolve('endorphin-ai');
    if (nodeModulesPath) {
      const modulePath = path.dirname(nodeModulesPath);
      packagePaths.push(
        path.join(modulePath, '..', 'framework', 'templates'),
        path.join(modulePath, '..', 'dist', 'framework', 'templates'),
        path.join(modulePath, 'framework', 'templates'),
        path.join(modulePath, 'templates')
      );
    }
  } catch {
    // Module not found via require.resolve
  }

  // Try common npm installation paths
  const cwd = process.cwd();
  packagePaths.push(
    // Local node_modules
    path.join(cwd, 'node_modules', 'endorphin-ai', 'dist', 'framework', 'templates'),
    path.join(cwd, 'node_modules', 'endorphin-ai', 'framework', 'templates'),
    path.join(cwd, 'node_modules', 'endorphin-ai', 'templates'),
    // Alternative paths for tarballs and packages with flattened structure
    path.join(cwd, 'node_modules', 'endorphin-ai', 'dist', 'templates'),
    path.join(cwd, 'node_modules', 'endorphin-ai', 'dist', 'dist', 'framework', 'templates'),
    // Global node_modules (common paths for different OS and npm versions)
    path.join(process.env.HOME || '/', '.npm', 'node_modules', 'endorphin-ai', 'dist', 'framework', 'templates'),
    path.join('/usr/local/lib/node_modules', 'endorphin-ai', 'dist', 'framework', 'templates'),
    // Additional global paths for different npm configurations
    path.join(process.env.APPDATA || '/', 'npm', 'node_modules', 'endorphin-ai', 'dist', 'framework', 'templates'), // Windows
    path.join(process.env.PREFIX || '/usr/local', 'lib', 'node_modules', 'endorphin-ai', 'dist', 'framework', 'templates'),
    // Alternative paths for yarn global and pnpm global
    path.join(process.env.HOME || '/', '.yarn', 'global', 'node_modules', 'endorphin-ai', 'dist', 'framework', 'templates'),
    path.join(process.env.HOME || '/', '.local', 'share', 'pnpm', 'global', '5', 'node_modules', 'endorphin-ai', 'dist', 'framework', 'templates')
  );

  return packagePaths.filter(p => p); // Remove any undefined/null paths
}

/**
 * Get templates directory - works both in development and when installed as package
 */
function getTemplatesDir(): string {
  // Debug mode: show all paths being tried
  const debugMode = process.env.ENDORPHIN_DEBUG === 'verbose' || process.env.ENDORPHIN_DEBUG === 'true';
  // Get the directory path of the current file (ES modules compatible)
  // Handle Jest environment where import.meta.url might not be available
  let currentDir: string;
  
  // Use dynamic evaluation to avoid Jest parse errors
  try {
    // This technique avoids Jest parse errors with import.meta
    // eslint-disable-next-line no-eval
    const importMeta = (0, eval)('import.meta');
    if (importMeta && importMeta.url) {
      const currentFileUrl = importMeta.url;
      const currentFilePath = fileURLToPath(currentFileUrl);
      currentDir = path.dirname(currentFilePath);
    } else {
      currentDir = process.cwd();
    }
  } catch {
    // Fallback for Jest or other environments
    currentDir = process.cwd();
  }

  // Try multiple possible paths for templates
  const possiblePaths = [
    // When running from source (development)
    path.join(process.cwd(), 'framework', 'templates'),
    // When installed as npm package - templates in dist/framework/templates
    path.join(currentDir, '..', 'templates'),
    // When installed as npm package - alternative path
    path.join(currentDir, '..', '..', 'templates'),
    // When running from compiled dist/framework/reporting/generators
    path.resolve(currentDir, '../../templates'),
    // When running from node_modules/endorphin-ai/dist/framework/reporting/generators
    path.resolve(currentDir, '../../../framework/templates'),
    // Direct path in distribution
    path.join(currentDir, 'templates'),
    // NEW: When installed as npm package, find via require.resolve
    ...getPackageTemplatePaths(),
  ];

  for (const templatePath of possiblePaths) {
    const templateFile = path.join(templatePath, 'reporter', 'report-template.html');
    if (debugMode) {
      console.log(`🔍 Checking template path: ${templatePath}`);
      console.log(`   Looking for: ${templateFile}`);
      console.log(`   Exists: ${fs.existsSync(templateFile)}`);
    }
    
    if (fs.existsSync(templateFile)) {
      if (debugMode) {
        console.log(`✅ Found templates at: ${templatePath}`);
      }
      return templatePath;
    }
  }

  // Enhanced error message for troubleshooting
  const errorMessage = [
    `Templates directory not found. This usually happens with global installations.`,
    ``,
    `Searched ${possiblePaths.length} possible paths:`,
    ...possiblePaths.map(p => `  - ${p}`),
    ``,
    `Troubleshooting:`,
    `1. Try installing locally: npm install endorphin-ai --save-dev`,
    `2. Check global installation: npm list -g endorphin-ai`,
    `3. Enable debug mode: ENDORPHIN_DEBUG=verbose npx endorphin-ai generate report`,
    `4. Manual check: find /usr/local/lib/node_modules -name "report-template.html" 2>/dev/null`
  ].join('\n');

  throw new Error(errorMessage);
}

export interface ReportOptions {
  filename?: string;
  template?: string;
  includeScreenshots?: boolean;
  includeTokenUsage?: boolean;
  resultDirs?: string[];
}

/**
 * HTML Report Generator
 * Generates interactive HTML reports from parsed test data
 */
export class HtmlGenerator {
  private reportsDir: string;
  private templatesDir: string;

  constructor(reportsDir: string) {
    this.reportsDir = reportsDir;
    this.templatesDir = getTemplatesDir();

    // Ensure reports directory exists
    try {
      if (!fs.existsSync(this.reportsDir)) {
        fs.mkdirSync(this.reportsDir, { recursive: true });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: Could not create reports directory: ${message}`);
    }
  }

  /**
   * Generate HTML report from report data
   */
  async generateReport(reportData: ReportData, options: ReportOptions = {}): Promise<string> {
    try {
      // Generate filename with timestamp
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const ampm = hours >= 12 ? 'pm' : 'am';
      const hour12 = hours % 12 || 12;
      
      const filename = options.filename || 
        `report-${dateStr}-time-${hour12}-${minutes.toString().padStart(2, '0')}-${seconds.toString().padStart(2, '0')}-${ampm}.html`;
      const templateName = options.template || 'report-template.html';

      // Load HTML template
      const templatePath = path.join(this.templatesDir, 'reporter', templateName);
      let htmlTemplate = fs.readFileSync(templatePath, 'utf8');

      // Process template with report data
      htmlTemplate = this.processTemplate(htmlTemplate, reportData, options);

      // Write the processed HTML
      const outputPath = path.join(this.reportsDir, filename);
      fs.writeFileSync(outputPath, htmlTemplate, 'utf8');

      // Copy static assets (CSS, JS)
      await this.copyStaticAssets();

      // Copy screenshots if enabled
      if (options.includeScreenshots !== false) {
        await this.copyScreenshots(reportData);
      }

      return outputPath;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate HTML report: ${message}`);
    }
  }

  /**
   * Process the HTML template with report data
   */
  private processTemplate(template: string, data: ReportData, _options: ReportOptions): string {
    let processedTemplate = template;

    // Calculate token summary from all results
    const totalTokens = data.testResults.reduce((total: number, result: ParsedTestResult) => {
      return total + (result.tokenSummary?.totalTokens || 0);
    }, 0);
    const totalCost = data.testResults.reduce((total: number, result: ParsedTestResult) => {
      return total + (result.tokenSummary?.totalCost || 0);
    }, 0);
    
    // Calculate total duration from all results
    const totalDuration = data.testResults.reduce((total: number, result: ParsedTestResult) => {
      return total + (result.duration || 0);
    }, 0);

    // Replace summary data
    const replacements = {
      '{{totalTests}}': data.summary.totalTests.toString(),
      '{{totalRuns}}': data.summary.totalTests.toString(),
      '{{successfulRuns}}': data.summary.passedTests.toString(),
      '{{failedRuns}}': data.summary.failedTests.toString(),
      '{{successRate}}': data.summary.successRate.toFixed(1),
      '{{totalTokens}}': totalTokens.toLocaleString(),
      '{{totalCost}}': totalCost.toFixed(4),
      '{{totalDuration}}': this.formatDuration(totalDuration),
      '{{generatedAt}}': new Date().toLocaleString(),
      '{{testStatsTable}}': this.generateTestStatsTable(data.testResults),
      '{{recentResultsTable}}': this.generateRecentResultsTable(data.testResults),
      '{{testDataJson}}': JSON.stringify(this.formatTestDataForTemplate(data), null, 2),
    };

    // Apply all replacements
    for (const [placeholder, value] of Object.entries(replacements)) {
      const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
      processedTemplate = processedTemplate.replace(regex, value);
    }

    return processedTemplate;
  }

  /**
   * Generate test statistics table HTML
   */
  private generateTestStatsTable(allTestResults: ParsedTestResult[]): string {
    if (allTestResults.length === 0) {
      return '<tr><td colspan="6" class="text-center">No test results available</td></tr>';
    }

    // Group results by test name for aggregated statistics
    const testStats: Record<
      string,
      {
        testName: string;
        totalRuns: number;
        successfulRuns: number;
        failedRuns: number;
        avgDuration: number;
        lastRun: string;
      }
    > = {};

    allTestResults.forEach((result) => {
      const testName = result.testName;

      if (!testStats[testName]) {
        testStats[testName] = {
          testName,
          totalRuns: 0,
          successfulRuns: 0,
          failedRuns: 0,
          avgDuration: 0,
          lastRun: result.startTime,
        };
      }

      const stats = testStats[testName];
      stats.totalRuns++;

      if (result.status === 'SUCCESS') {
        stats.successfulRuns++;
      } else {
        stats.failedRuns++;
      }

      // Update average duration
      stats.avgDuration =
        (stats.avgDuration * (stats.totalRuns - 1) + result.duration) / stats.totalRuns;

      // Update last run if this is more recent
      if (new Date(result.startTime) > new Date(stats.lastRun)) {
        stats.lastRun = result.startTime;
      }
    });

    return Object.values(testStats)
      .map((stats) => {
        const successRate =
          stats.totalRuns > 0 ? ((stats.successfulRuns / stats.totalRuns) * 100).toFixed(1) : '0.0';
        const avgDurationFormatted = this.formatDuration(stats.avgDuration);
        
        // Status badge based on success rate
        const statusBadge = stats.successfulRuns > stats.failedRuns 
          ? '<span class="badge bg-success">PASSING</span>' 
          : '<span class="badge bg-danger">FAILING</span>';

        // Calculate total tokens and cost for this test
        const testResultsForThisTest = allTestResults.filter(r => r.testName === stats.testName);
        const totalTokens = testResultsForThisTest.reduce((sum, r) => sum + (r.tokenSummary?.totalTokens || 0), 0);
        const totalCost = testResultsForThisTest.reduce((sum, r) => sum + (r.tokenSummary?.totalCost || 0), 0);
        const mostCommonModel = testResultsForThisTest[0]?.tokenSummary?.model || 'Unknown';

        return `
          <tr>
            <td><strong>${this.escapeHtml(stats.testName)}</strong><br>
                <small class="text-muted">${stats.totalRuns} runs, ${successRate}% success</small></td>
            <td>${statusBadge}</td>
            <td>${avgDurationFormatted}</td>
            <td><span class="badge bg-warning text-dark">${totalTokens}</span></td>
            <td><span class="badge bg-primary">$${totalCost.toFixed(4)}</span></td>
            <td><code>${mostCommonModel}</code></td>
          </tr>
        `;
      })
      .join('');
  }

  /**
   * Generate recent results table HTML
   */
  private generateRecentResultsTable(testResults: ParsedTestResult[]): string {
    if (testResults.length === 0) {
      return '<tr><td colspan="7" class="text-center">No recent test results</td></tr>';
    }

    // Show all results instead of limiting to 10
    const recentResults = testResults;

    return recentResults
      .map((result, index) => {
        const statusBadge =
          result.status === 'SUCCESS'
            ? '<span class="badge bg-success">✓ Passed</span>'
            : '<span class="badge bg-danger">✗ Failed</span>';

        const durationFormatted = this.formatDuration(result.duration);
        
        // Token information with badges
        const tokenInfo = result.tokenSummary 
          ? `<span class="badge bg-warning text-dark">${result.tokenSummary.totalTokens || 0}</span>` 
          : '<span class="badge bg-warning text-dark">0</span>';
        
        const costInfo = result.tokenSummary 
          ? `<span class="badge bg-primary">$${(result.tokenSummary.totalCost || 0).toFixed(4)}</span>` 
          : '<span class="badge bg-primary">$0.0000</span>';

        // Step information
        const stepInfo = `${result.successfulSteps || 0}/${result.totalSteps || 0}`;

        // Actions - View Details button with proper attributes
        const viewDetailsBtn = `
          <button class="btn btn-sm btn-outline-primary view-details-btn" 
                  data-result-index="${index}"
                  onclick="showTestDetails('${result.sessionId}')" 
                  title="View detailed execution steps">
            <i class="bi bi-eye"></i> View Details
          </button>
        `;

        return `
          <tr class="test-result-row" data-result-index="${index}">
            <td>
              <strong>${this.escapeHtml(result.testName)}</strong><br>
              <small class="text-muted">${this.escapeHtml(result.testId)}</small>
            </td>
            <td>${statusBadge}</td>
            <td>${durationFormatted}</td>
            <td>${tokenInfo}</td>
            <td>${costInfo}</td>
            <td>${stepInfo}</td>
            <td>${viewDetailsBtn}</td>
          </tr>
        `;
      })
      .join('');
  }

  /**
   * Generate test results HTML for detailed view
   */
  generateTestResultsHtml(testResults: ParsedTestResult[]): string {
    return testResults
      .map((result) => {
        const statusClass = result.status === 'SUCCESS' ? 'success' : 'failure';
        const statusIcon = result.status === 'SUCCESS' ? '✅' : '❌';

        const screenshotsHtml = result.screenshots
          .map(
            (screenshot) =>
              `<img src="screenshots/${screenshot}" alt="Screenshot" class="screenshot-thumb">`
          )
          .join('');

        const stepsHtml = result.steps
          .map(
            (step, index) => {
              const stepTokens = step.tokenUsage 
                ? `<span class="badge bg-warning text-dark ms-2">${step.tokenUsage.totalTokens}</span>`
                : '';
              const stepCost = step.tokenUsage 
                ? `<span class="badge bg-primary ms-1">$${step.tokenUsage.cost.toFixed(4)}</span>`
                : '';
              
              return `
                <div class="step">
                  <strong>Step ${index + 1}:</strong> ${this.escapeHtml(step.description || 'No description')}
                  ${stepTokens}${stepCost}
                </div>
              `;
            }
          )
          .join('');

        const tokenUsageHtml = result.tokenSummary
          ? `
          <div class="token-usage">
            <strong>Token Usage:</strong> 
            <span class="badge bg-warning text-dark ms-2">${result.tokenSummary.totalTokens}</span> 
            <span class="badge bg-primary ms-1">$${result.tokenSummary.totalCost?.toFixed(4) || '0.0000'}</span>
          </div>
        `
          : '';

        return `
          <div class="test-result ${statusClass}">
            <div class="test-header">
              <h3>${statusIcon} ${this.escapeHtml(result.testName)}</h3>
              <div class="test-meta">
                <span class="test-id">ID: ${this.escapeHtml(result.testId)}</span>
                <span class="duration">Duration: ${this.formatDuration(result.duration)}</span>
                <span class="timestamp">${new Date(result.startTime).toLocaleString()}</span>
              </div>
            </div>
            <div class="test-content">
              ${result.finalResult ? `<div class="result">${this.escapeHtml(result.finalResult)}</div>` : ''}
              ${tokenUsageHtml}
              <div class="screenshots">${screenshotsHtml}</div>
              <details class="test-steps">
                <summary>Test Steps (${result.steps.length})</summary>
                ${stepsHtml}
              </details>
            </div>
          </div>
        `;
      })
      .join('');
  }

  /**
   * Format test data for JavaScript template consumption
   */
  private formatTestDataForTemplate(data: ReportData): any[] {
    return data.testResults.map(result => ({
      session: {
        sessionId: result.sessionId,
        testId: result.testId,
        testName: result.testName,
        status: result.status,
        duration: result.duration,
        startTime: result.startTime,
        endTime: result.endTime,
        finalResult: result.finalResult,
        conclusion: result.conclusion,
        steps: result.steps,
        agentHistory: result.agentHistory,
        tokenSummary: result.tokenSummary,
        setupResult: result.setupResult,
        dataGenerationResult: result.dataGenerationResult
      },
      summary: {
        sessionId: result.sessionId,
        tokenSummary: result.tokenSummary
      },
      screenshots: result.screenshots,
      resultDir: result.sessionDir
    }));
  }

  /**
   * Copy static assets (CSS, JS) to reports directory
   */
  private copyStaticAssets(): void {
    try {
      // Create assets directory
      const assetsDir = path.join(this.reportsDir, 'assets');
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      const assetsToMap = [
        { source: 'styles.css', dest: 'assets/styles.css' },
        { source: 'scripts.js', dest: 'assets/scripts.js' },
      ];

      for (const asset of assetsToMap) {
        const sourcePath = path.join(this.templatesDir, 'reporter', asset.source);
        const destPath = path.join(this.reportsDir, asset.dest);

        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, destPath);
        }
      }
    } catch (error) {
      console.warn('Warning: Could not copy static assets:', error);
    }
  }

  /**
   * Copy screenshots from test results to reports directory
   */
  private copyScreenshots(reportData: ReportData): void {
    try {
      const screenshotsDir = path.join(this.reportsDir, 'screenshots');

      if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
      }

      // Copy screenshots from each test result
      for (const result of reportData.testResults) {
        const sessionScreenshotsDir = path.join(result.sessionDir, 'screenshots');

        if (fs.existsSync(sessionScreenshotsDir)) {
          const screenshots = fs.readdirSync(sessionScreenshotsDir);

          for (const screenshot of screenshots) {
            const sourcePath = path.join(sessionScreenshotsDir, screenshot);
            const destPath = path.join(screenshotsDir, screenshot);

            if (fs.existsSync(sourcePath) && !fs.existsSync(destPath)) {
              fs.copyFileSync(sourcePath, destPath);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Warning: Could not copy screenshots:', error);
    }
  }

  /**
   * Format duration in milliseconds to human readable format
   */
  private formatDuration(duration: number): string {
    if (duration < 1000) {
      return `${duration}ms`;
    }

    const seconds = Math.floor(duration / 1000);
    const ms = duration % 1000;

    if (seconds < 60) {
      return ms > 0 ? `${seconds}.${ms.toString().padStart(3, '0')}s` : `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}m ${remainingSeconds}s`;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const div = { innerHTML: '' } as any;
    div.textContent = text;
    return (
      div.innerHTML ||
      text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    );
  }

  /**
   * Generate custom report with specific template
   */
  generateCustomReport(
    reportData: ReportData,
    templateContent: string,
    filename: string
  ): string {
    try {
      // Process custom template
      const processedTemplate = this.processTemplate(templateContent, reportData, {});

      // Write the processed HTML
      const outputPath = path.join(this.reportsDir, filename);
      fs.writeFileSync(outputPath, processedTemplate, 'utf8');

      return outputPath;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate custom report: ${message}`);
    }
  }

  /**
   * Get available templates
   */
  getAvailableTemplates(): string[] {
    try {
      const templatesPath = path.join(this.templatesDir, 'reporter');

      if (!fs.existsSync(templatesPath)) {
        return [];
      }

      return fs
        .readdirSync(templatesPath)
        .filter((file) => file.endsWith('.html'))
        .map((file) => file.replace('.html', ''));
    } catch (error) {
      console.warn('Warning: Could not read templates directory:', error);
      return [];
    }
  }
}

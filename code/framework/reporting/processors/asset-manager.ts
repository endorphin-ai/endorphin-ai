/**
 * Asset Manager
 * Handles static assets, screenshots, and cleanup operations for reports
 */

import fs from 'fs';
import path from 'path';

export interface CleanupResult {
  deletedReports: number;
  deletedScreenshots: number;
  freedSpace: number;
}

export interface AssetManagerConfig {
  reportsDir: string;
  screenshotsDir?: string;
  maxReportAge?: number; // days
  maxReportsPerTest?: number;
}

/**
 * Asset Manager
 * Manages static assets, screenshots, and cleanup for reports
 */
export class AssetManager {
  private config: AssetManagerConfig;

  constructor(config: AssetManagerConfig) {
    this.config = {
      maxReportAge: 30,
      maxReportsPerTest: 10,
      ...config,
      screenshotsDir: config.screenshotsDir || path.join(config.reportsDir, 'screenshots'),
    };
  }

  /**
   * Copy static assets to reports directory
   */
  copyStaticAssets(templatesDir: string): void {
    try {
      const assetsToMap = [
        { source: 'styles.css', dest: 'styles.css' },
        { source: 'scripts.js', dest: 'scripts.js' },
        { source: 'favicon.ico', dest: 'favicon.ico' },
      ];

      // Ensure reports directory exists
      if (!fs.existsSync(this.config.reportsDir)) {
        fs.mkdirSync(this.config.reportsDir, { recursive: true });
      }

      for (const asset of assetsToMap) {
        const sourcePath = path.join(templatesDir, 'reporter', asset.source);
        const destPath = path.join(this.config.reportsDir, asset.dest);

        if (fs.existsSync(sourcePath)) {
          try {
            fs.copyFileSync(sourcePath, destPath);
          } catch (error) {
            console.warn(`Warning: Could not copy ${asset.source}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Warning: Could not copy static assets:', error);
    }
  }

  /**
   * Copy screenshots from test results to reports directory
   */
  copyScreenshots(sessionDirs: string[]): number {
    let copiedCount = 0;

    try {
      // Ensure screenshots directory exists
      if (!fs.existsSync(this.config.screenshotsDir!)) {
        fs.mkdirSync(this.config.screenshotsDir!, { recursive: true });
      }

      for (const sessionDir of sessionDirs) {
        const sessionScreenshotsDir = path.join(sessionDir, 'screenshots');

        if (fs.existsSync(sessionScreenshotsDir)) {
          const screenshots = fs.readdirSync(sessionScreenshotsDir);

          for (const screenshot of screenshots) {
            const sourcePath = path.join(sessionScreenshotsDir, screenshot);
            const destPath = path.join(this.config.screenshotsDir!, screenshot);

            // Only copy if destination doesn't exist to avoid overwriting
            if (fs.existsSync(sourcePath) && !fs.existsSync(destPath)) {
              try {
                fs.copyFileSync(sourcePath, destPath);
                copiedCount++;
              } catch (error) {
                console.warn(`Warning: Could not copy screenshot ${screenshot}:`, error);
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn('Warning: Could not copy screenshots:', error);
    }

    return copiedCount;
  }

  /**
   * Clean up old report files
   */
  cleanupOldReports(maxAge: number = this.config.maxReportAge!): CleanupResult {
    const result: CleanupResult = {
      deletedReports: 0,
      deletedScreenshots: 0,
      freedSpace: 0,
    };

    try {
      if (!fs.existsSync(this.config.reportsDir)) {
        return result;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAge);

      const files = fs.readdirSync(this.config.reportsDir);

      for (const file of files) {
        const filePath = path.join(this.config.reportsDir, file);

        try {
          const stats = fs.statSync(filePath);

          if (stats.isFile() && file.endsWith('.html') && stats.mtime < cutoffDate) {
            const size = stats.size;
            fs.unlinkSync(filePath);
            result.deletedReports++;
            result.freedSpace += size;
          }
        } catch (error) {
          console.warn(`Warning: Could not process file ${file}:`, error);
        }
      }

      // Clean up orphaned screenshots
      result.deletedScreenshots = this.cleanupOrphanedScreenshots();
    } catch (error) {
      console.warn('Warning: Could not cleanup old reports:', error);
    }

    return result;
  }

  /**
   * Clean up orphaned screenshots that no longer have associated reports
   */
  private cleanupOrphanedScreenshots(): number {
    let deletedCount = 0;

    try {
      if (!fs.existsSync(this.config.screenshotsDir!)) {
        return deletedCount;
      }

      // Get all current report files
      const reportFiles = this.getReportFiles();
      const referencedScreenshots = new Set<string>();

      // Extract screenshot references from reports
      for (const reportFile of reportFiles) {
        try {
          const content = fs.readFileSync(reportFile, 'utf8');
          const screenshotMatches = content.match(/screenshots\/[^"'\s]+\.(?:png|jpg|jpeg|gif)/g);

          if (screenshotMatches) {
            screenshotMatches.forEach((match) => {
              const filename = path.basename(match);
              referencedScreenshots.add(filename);
            });
          }
        } catch (error) {
          console.warn(`Warning: Could not read report file ${reportFile}:`, error);
        }
      }

      // Delete unreferenced screenshots
      const screenshots = fs.readdirSync(this.config.screenshotsDir!);

      for (const screenshot of screenshots) {
        if (!referencedScreenshots.has(screenshot)) {
          try {
            const screenshotPath = path.join(this.config.screenshotsDir!, screenshot);
            const _stats = fs.statSync(screenshotPath);
            fs.unlinkSync(screenshotPath);
            deletedCount++;
            // Add size to freed space (this would need to be tracked separately)
          } catch (error) {
            console.warn(`Warning: Could not delete screenshot ${screenshot}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Warning: Could not cleanup orphaned screenshots:', error);
    }

    return deletedCount;
  }

  /**
   * Clean up results keeping only the most recent per test
   */
  cleanupResults(
    keepPerTest: number = this.config.maxReportsPerTest!
  ): CleanupResult {
    const result: CleanupResult = {
      deletedReports: 0,
      deletedScreenshots: 0,
      freedSpace: 0,
    };

    try {
      // Group reports by test name
      const reportsByTest = this.groupReportsByTest();

      for (const [_testName, reports] of Object.entries(reportsByTest)) {
        if (reports.length <= keepPerTest) {
          continue;
        }

        // Sort by modification time (newest first)
        reports.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

        // Delete older reports
        const reportsToDelete = reports.slice(keepPerTest);

        for (const report of reportsToDelete) {
          try {
            const size = fs.statSync(report.path).size;
            fs.unlinkSync(report.path);
            result.deletedReports++;
            result.freedSpace += size;
          } catch (error) {
            console.warn(`Warning: Could not delete report ${report.path}:`, error);
          }
        }
      }

      // Clean up orphaned screenshots after deleting reports
      result.deletedScreenshots = this.cleanupOrphanedScreenshots();
    } catch (error) {
      console.warn('Warning: Could not cleanup results:', error);
    }

    return result;
  }

  /**
   * Get all report files
   */
  private getReportFiles(): string[] {
    try {
      if (!fs.existsSync(this.config.reportsDir)) {
        return [];
      }

      return fs
        .readdirSync(this.config.reportsDir)
        .filter((file) => file.endsWith('.html'))
        .map((file) => path.join(this.config.reportsDir, file));
    } catch (error) {
      console.warn('Warning: Could not read reports directory:', error);
      return [];
    }
  }

  /**
   * Group reports by test name
   */
  private groupReportsByTest(): Record<
    string,
    Array<{ path: string; mtime: Date; testName: string }>
  > {
    const grouped: Record<string, Array<{ path: string; mtime: Date; testName: string }>> = {};

    try {
      const reportFiles = this.getReportFiles();

      for (const reportFile of reportFiles) {
        try {
          const stats = fs.statSync(reportFile);
          const filename = path.basename(reportFile, '.html');

          // Extract test name from filename (assuming format: report-testname-date.html)
          const testName = this.extractTestNameFromFilename(filename);

          if (!grouped[testName]) {
            grouped[testName] = [];
          }

          grouped[testName].push({
            path: reportFile,
            mtime: stats.mtime,
            testName,
          });
        } catch (error) {
          console.warn(`Warning: Could not process report ${reportFile}:`, error);
        }
      }
    } catch (error) {
      console.warn('Warning: Could not group reports by test:', error);
    }

    return grouped;
  }

  /**
   * Extract test name from report filename
   */
  private extractTestNameFromFilename(filename: string): string {
    // Try to extract test name from various filename patterns
    const patterns = [
      /^report-(.+)-\d{4}-\d{2}-\d{2}$/, // report-testname-2023-12-01
      /^(.+)-report-\d{4}-\d{2}-\d{2}$/, // testname-report-2023-12-01
      /^report-(.+)$/, // report-testname
      /^(.+)-report$/, // testname-report
    ];

    for (const pattern of patterns) {
      const match = filename.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // Fallback to full filename
    return filename;
  }

  /**
   * Get asset statistics
   */
  getAssetStatistics(): {
    reportsCount: number;
    screenshotsCount: number;
    totalSize: number;
    oldestReport?: Date | undefined;
    newestReport?: Date | undefined;
  } {
    const stats = {
      reportsCount: 0,
      screenshotsCount: 0,
      totalSize: 0,
      oldestReport: undefined as Date | undefined,
      newestReport: undefined as Date | undefined,
    };

    try {
      // Count reports
      const reportFiles = this.getReportFiles();
      stats.reportsCount = reportFiles.length;

      let oldestTime = Infinity;
      let newestTime = 0;

      for (const reportFile of reportFiles) {
        try {
          const fileStat = fs.statSync(reportFile);
          stats.totalSize += fileStat.size;

          const mtime = fileStat.mtime.getTime();
          if (mtime < oldestTime) {
            oldestTime = mtime;
            stats.oldestReport = fileStat.mtime;
          }
          if (mtime > newestTime) {
            newestTime = mtime;
            stats.newestReport = fileStat.mtime;
          }
        } catch (error) {
          console.warn(`Warning: Could not stat report ${reportFile}:`, error);
        }
      }

      // Count screenshots
      if (fs.existsSync(this.config.screenshotsDir!)) {
        const screenshots = fs.readdirSync(this.config.screenshotsDir!);
        stats.screenshotsCount = screenshots.length;

        for (const screenshot of screenshots) {
          try {
            const screenshotPath = path.join(this.config.screenshotsDir!, screenshot);
            const fileStat = fs.statSync(screenshotPath);
            stats.totalSize += fileStat.size;
          } catch (error) {
            console.warn(`Warning: Could not stat screenshot ${screenshot}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Warning: Could not get asset statistics:', error);
    }

    return stats;
  }

  /**
   * Verify asset integrity
   */
  verifyAssetIntegrity(): {
    missingAssets: string[];
    brokenLinks: string[];
    orphanedScreenshots: string[];
  } {
    const result = {
      missingAssets: [] as string[],
      brokenLinks: [] as string[],
      orphanedScreenshots: [] as string[],
    };

    try {
      const reportFiles = this.getReportFiles();
      const referencedScreenshots = new Set<string>();

      for (const reportFile of reportFiles) {
        try {
          const content = fs.readFileSync(reportFile, 'utf8');

          // Check for missing CSS/JS assets
          const assetLinks = content.match(/(href|src)=["']([^"']+\.(?:css|js))["']/g);
          if (assetLinks) {
            for (const link of assetLinks) {
              const match = link.match(/(?:href|src)=["']([^"']+)["']/);
              if (match) {
                const assetPath = path.resolve(this.config.reportsDir, match[1]);
                if (!fs.existsSync(assetPath)) {
                  result.missingAssets.push(match[1]);
                }
              }
            }
          }

          // Check for broken screenshot links
          const screenshotLinks = content.match(
            /src=["']screenshots\/[^"']+\.(?:png|jpg|jpeg|gif)["']/g
          );
          if (screenshotLinks) {
            for (const link of screenshotLinks) {
              const match = link.match(/src=["']screenshots\/([^"']+)["']/);
              if (match) {
                const screenshotPath = path.join(this.config.screenshotsDir!, match[1]);
                referencedScreenshots.add(match[1]);

                if (!fs.existsSync(screenshotPath)) {
                  result.brokenLinks.push(`screenshots/${match[1]}`);
                }
              }
            }
          }
        } catch (error) {
          console.warn(`Warning: Could not verify assets in ${reportFile}:`, error);
        }
      }

      // Find orphaned screenshots
      if (fs.existsSync(this.config.screenshotsDir!)) {
        const allScreenshots = fs.readdirSync(this.config.screenshotsDir!);
        result.orphanedScreenshots = allScreenshots.filter(
          (screenshot) => !referencedScreenshots.has(screenshot)
        );
      }
    } catch (error) {
      console.warn('Warning: Could not verify asset integrity:', error);
    }

    return result;
  }
}

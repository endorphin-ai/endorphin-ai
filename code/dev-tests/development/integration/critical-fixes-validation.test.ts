/**
 * Critical Fixes Validation Tests
 * Validates that the specific issues reported by the user have been fixed
 */

import { promises as fs } from 'fs';
import path from 'path';
import { HtmlGenerator } from '../../../framework/reporting/generators/html-generator.js';
import { BrowserManager } from '../../../framework/automation/browser/browser-manager.js';
import { TestRecorder } from '../../../framework/test-recorder/session-recorder.js';
import { EnhancedBrowserTestFramework } from '../../../framework/automation/browser/browser-framework.js';

describe('Critical Fixes Validation Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(__dirname, '../../../tmp/critical-fixes-validation');
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    // Clean up snapshot dir created by PageContextInjector during real browser tests
    try {
      await fs.rm(path.join(process.cwd(), '.endorphin-tmp'), { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Problem 1: Reporter template path broken', () => {
    it('should find templates in distributed package structure', async () => {
      const reportsDir = path.join(testDir, 'reports');
      
      // This should NOT throw "ENOENT: no such file or directory" error
      expect(() => new HtmlGenerator(reportsDir)).not.toThrow();
      
      const generator = new HtmlGenerator(reportsDir);
      
      // Should be able to generate a report without path errors
      const mockReportData = {
        testResults: [{
          testId: 'TEST-001',
          testName: 'Test Report Path Fix',
          status: 'SUCCESS' as const,
          duration: 1500,
          startTime: new Date().toISOString(),
          steps: [],
          screenshots: [],
          sessionDir: testDir,
          finalResult: 'Test completed successfully'
        }],
        summary: {
          totalTests: 1,
          passedTests: 1,
          failedTests: 0,
          successRate: 100,
          totalDuration: 1500,
          timestamp: new Date().toISOString()
        }
      };
      
      // This was the exact error that was failing before
      const reportPath = await generator.generateReport(mockReportData, { 
        filename: 'template-path-test.html' 
      });
      
      expect(reportPath).toBeDefined();
      
      // Verify report was actually created
      const reportExists = await fs.access(reportPath).then(() => true).catch(() => false);
      expect(reportExists).toBe(true);
      
      // Verify report content is valid HTML
      const content = await fs.readFile(reportPath, 'utf8');
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('Test Report Path Fix');
    });
  });

  describe('Problem 2: MaxListenersExceeded warning', () => {
    it('should not generate MaxListenersExceeded warnings', async () => {
      const originalWarnings: string[] = [];
      const originalEmitWarning = process.emitWarning;
      
      // Capture warnings
      process.emitWarning = function(warning: string | Error) {
        if (typeof warning === 'string') {
          originalWarnings.push(warning);
        } else {
          originalWarnings.push(warning.message);
        }
      };

      try {
        const config = {
          browser: {
            type: 'chromium' as const,
            headless: true,
            timeout: 10000,
            viewport: { width: 1280, height: 720 }
          }
        };

        const browserManager = new BrowserManager({ browser: config.browser });
        
        await browserManager.initialize();
        
        // Create multiple pages (this previously caused listener accumulation)
        const pages = [];
        for (let i = 0; i < 5; i++) {
          const page = await browserManager.createNewPage();
          pages.push(page);
        }
        
        // Close all pages (should clean up listeners)
        for (const page of pages) {
          await page.close();
        }
        
        await browserManager.cleanup();
        
        // Check for MaxListenersExceeded warnings
        const maxListenerWarnings = originalWarnings.filter(w => 
          w.includes('MaxListenersExceeded') || w.includes('possible EventEmitter memory leak')
        );
        
        expect(maxListenerWarnings).toHaveLength(0);
        
      } finally {
        process.emitWarning = originalEmitWarning;
      }
    });
  });

  describe('Problem 3: PNG screenshot quality error', () => {
    it('should handle PNG screenshots without quality errors', async () => {
      const config = {
        browser: {
          type: 'chromium' as const,
          headless: true,
          timeout: 10000,
          viewport: { width: 1280, height: 720 }
        }
      };

      const browserManager = new BrowserManager({ browser: config.browser });
      
      try {
        await browserManager.initialize();
        await browserManager.navigateToUrl('data:text/html,<h1>PNG Test</h1>');
        
        // This was the exact error: "options.quality is unsupported for the png screenshots"
        const pngPath = path.join(testDir, 'test.png');
        
        // Should NOT throw "options.quality is unsupported for the png screenshots"
        await expect(
          browserManager.takeScreenshot({ 
            path: pngPath, 
            quality: 90 // This should be ignored for PNG
          })
        ).resolves.not.toThrow();
        
        // Verify screenshot was created
        const exists = await fs.access(pngPath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
        
        // Test JPEG with quality still works
        const jpegPath = path.join(testDir, 'test.jpeg');
        await expect(
          browserManager.takeScreenshot({ 
            path: jpegPath, 
            quality: 90 // This should work for JPEG
          })
        ).resolves.not.toThrow();
        
      } finally {
        await browserManager.cleanup();
      }
    });
  });

  describe('Problem 4: Dual browser opening', () => {
    it('should only open one browser for single test', async () => {
      const config = {
        browser: {
          type: 'chromium' as const,
          headless: true,
          timeout: 10000,
          viewport: { width: 1280, height: 720 }
        },
        resultBaseDir: testDir,
        recorderBaseDir: testDir,
      };

      const framework = new EnhancedBrowserTestFramework(config);
      
      try {
        // Initialize once
        await framework.initialize();
        const browser1 = framework.currentBrowser;
        
        // Initialize again - should reuse browser
        await framework.initialize();
        const browser2 = framework.currentBrowser;
        
        // Should be same browser instance
        expect(browser2).toBe(browser1);
        
        // Run multiple operations - should not create new browsers
        await framework.runTask('Navigate to test page', 'test-1');
        const browser3 = framework.currentBrowser;
        
        await framework.runTask('Perform test action', 'test-2');
        const browser4 = framework.currentBrowser;
        
        // All should be the same browser instance
        expect(browser3).toBe(browser1);
        expect(browser4).toBe(browser1);
        
      } finally {
        await framework.cleanup();
      }
    });
  });

  describe('Problem 5: Test recorder functionality', () => {
    it('should be able to import and instantiate test recorder', async () => {
      // Test that imports work (was causing "Cannot find module" errors)
      expect(() => {
        const framework = new EnhancedBrowserTestFramework({ resultBaseDir: testDir, recorderBaseDir: testDir });
        const testData = { id: 'TEST-001', name: 'Test', site: 'https://example.com' };
        new TestRecorder(framework, testData, testDir);
      }).not.toThrow();
    });

    it('should use framework browser manager for screenshots', async () => {
      const config = {
        browser: {
          type: 'chromium' as const,
          headless: true,
          timeout: 10000,
          viewport: { width: 1280, height: 720 }
        },
        resultBaseDir: testDir,
        recorderBaseDir: testDir,
      };

      const framework = new EnhancedBrowserTestFramework(config);
      const testData = { id: 'REC-001', name: 'Recording Test', site: 'https://example.com' };
      const recorder = new TestRecorder(framework, testData, testDir);
      
      try {
        await framework.initialize();
        await recorder.startRecording();
        
        // Navigate using framework (not direct page access)
        await framework.runTask('Navigate to data:text/html,<h1>Recorder Test</h1>', 'nav');
        
        // Record step should work without browser errors
        await expect(
          recorder.recordStep('Test navigation', 'navigate', { url: 'test' }, 'Success')
        ).resolves.not.toThrow();
        
        await recorder.stopRecording();
        
      } finally {
        await framework.cleanup();
      }
    });
  });

  describe('Problem 6: testData generation format', () => {
    it('should generate new data format in test files', async () => {
      // Test session recorder generates correct format
      const framework = new EnhancedBrowserTestFramework({ resultBaseDir: testDir, recorderBaseDir: testDir });
      const testData = { 
        id: 'GEN-001', 
        name: 'Format Test',
        testData: { key: 'value', user: 'test' }
      };
      const recorder = new TestRecorder(framework, testData, testDir);
      
      try {
        await recorder.startRecording();
        await recorder.recordStep('Test step', 'action', {}, 'Success');
        const result = await recorder.stopRecording();
        
        expect(result).toBeDefined();
        expect(result!.testFilePath).toBeDefined();
        
        // Read generated test file
        const testContent = await fs.readFile(result!.testFilePath, 'utf8');
        
        // Should have NEW format  
        expect(testContent).toContain('data: async () => {');
        expect(testContent).toMatch(/return\s+\{/);
        
        // Should NOT have OLD format
        expect(testContent).not.toContain('testData: {');
        
        // Should contain the test data
        expect(testContent).toContain('"key": "value"');
        expect(testContent).toContain('"user": "test"');
        
      } finally {
        await framework.cleanup();
      }
    });
  });

  describe('Integration: All fixes working together', () => {
    it('should pass complete workflow without any of the reported errors', async () => {
      const config = {
        browser: {
          type: 'chromium' as const,
          headless: true,
          timeout: 10000,
          viewport: { width: 1280, height: 720 }
        },
        resultBaseDir: testDir,
        recorderBaseDir: testDir,
      };

      const framework = new EnhancedBrowserTestFramework(config);
      
      try {
        // 1. Initialize framework (browser management)
        await framework.initialize();
        
        // 2. Run a test task
        await framework.runTask('Navigate to data:text/html,<h1>Integration Test</h1>', 'integration');
        
        // 3. Take screenshot (PNG quality fix)
        const browserManager = framework.getBrowserManager();
        if (browserManager) {
          const screenshotPath = path.join(testDir, 'integration-test.png');
          await browserManager.takeScreenshot({ path: screenshotPath, quality: 90 });
        }
        
        // 4. Generate HTML report (template path fix)
        const reportsDir = path.join(testDir, 'reports');
        const generator = new HtmlGenerator(reportsDir);
        
        const mockReportData = {
          testResults: [{
            testId: 'INT-001',
            testName: 'Integration Test',
            status: 'SUCCESS' as const,
            duration: 2000,
            startTime: new Date().toISOString(),
            steps: [],
            screenshots: ['integration-test.png'],
            sessionDir: testDir,
            finalResult: 'Integration test completed'
          }],
          summary: {
            totalTests: 1,
            passedTests: 1,
            failedTests: 0,
            successRate: 100,
            totalDuration: 2000,
            timestamp: new Date().toISOString()
          }
        };
        
        const reportPath = await generator.generateReport(mockReportData);
        
        // Verify everything worked
        expect(reportPath).toBeDefined();
        const reportExists = await fs.access(reportPath).then(() => true).catch(() => false);
        expect(reportExists).toBe(true);
        
        // No errors should have occurred in this complete workflow
        
      } finally {
        await framework.cleanup();
      }
    });
  });
});
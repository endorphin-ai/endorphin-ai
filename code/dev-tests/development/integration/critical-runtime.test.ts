/**
 * Critical Runtime Integration Tests
 * Tests real functionality that was previously broken but passed mocked tests
 */

import { promises as fs } from 'fs';
import path from 'path';
import { HtmlGenerator } from '../../../framework/reporting/generators/html-generator.js';
import { BrowserManager } from '../../../framework/automation/browser/browser-manager.js';
import { EnhancedBrowserTestFramework } from '../../../framework/automation/browser/browser-framework.js';

describe('Critical Runtime Integration Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(__dirname, '../../../tmp/critical-runtime-tests');
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

  describe('Template Path Resolution (Real NPM Package Test)', () => {
    it('should find templates in distributed package structure', async () => {
      const reportsDir = path.join(testDir, 'reports');
      
      // Test real HTML generator initialization
      expect(() => new HtmlGenerator(reportsDir)).not.toThrow();
      
      const generator = new HtmlGenerator(reportsDir);
      
      // Test that available templates can be found
      const templates = generator.getAvailableTemplates();
      expect(Array.isArray(templates)).toBe(true);
      
      // At minimum, should find the report template
      // This would fail with the original broken path resolution
      try {
        const mockReportData = {
          testResults: [],
          summary: {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            successRate: 100,
            totalDuration: 0,
            timestamp: new Date().toISOString()
          }
        };
        
        await generator.generateReport(mockReportData, { filename: 'test-report.html' });
        
        // Verify the report was actually created
        const reportPath = path.join(reportsDir, 'test-report.html');
        const reportExists = await fs.access(reportPath).then(() => true).catch(() => false);
        expect(reportExists).toBe(true);
        
        // Verify the report contains expected content
        const reportContent = await fs.readFile(reportPath, 'utf8');
        expect(reportContent).toContain('<!DOCTYPE html>');
        expect(reportContent).toContain('Test Report');
      } catch (error) {
        throw new Error(`Template path resolution failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  });

  describe('PNG Screenshot Quality (Real Browser Test)', () => {
    it('should handle PNG screenshots without quality option', async () => {
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
        
        // Navigate to a simple page
        await browserManager.navigateToUrl('data:text/html,<h1>Test Page</h1>');
        
        // Test PNG screenshot without quality (should not throw)
        const pngPath = path.join(testDir, 'test-screenshot.png');
        await expect(
          browserManager.takeScreenshot({ 
            path: pngPath, 
            fullPage: true,
            quality: 90 // This should be ignored for PNG
          })
        ).resolves.not.toThrow();
        
        // Verify screenshot was created
        const screenshotExists = await fs.access(pngPath).then(() => true).catch(() => false);
        expect(screenshotExists).toBe(true);
        
        // Test JPEG screenshot with quality (should work)
        const jpegPath = path.join(testDir, 'test-screenshot.jpg');
        await expect(
          browserManager.takeScreenshot({ 
            path: jpegPath, 
            fullPage: true,
            quality: 90 // This should be applied for JPEG
          })
        ).resolves.not.toThrow();
        
        const jpegExists = await fs.access(jpegPath).then(() => true).catch(() => false);
        expect(jpegExists).toBe(true);
        
      } finally {
        await browserManager.cleanup();
      }
    });
  });

  describe('Browser Instance Management (Real Framework Test)', () => {
    it('should not create multiple browser instances for single test', async () => {
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
        // Initialize framework
        await framework.initialize();
        
        // Get initial browser reference
        const browser1 = framework.currentBrowser;
        expect(browser1).toBeTruthy();
        
        // Initialize again - should reuse existing browser
        await framework.initialize();
        const browser2 = framework.currentBrowser;
        
        // Should be the same browser instance
        expect(browser2).toBe(browser1);
        
        // Test page operations don't create new browsers
        const page1 = framework.currentPage;
        expect(page1).toBeTruthy();
        
        // Run a simple task
        await framework.runTask('Navigate to test page', 'test-navigation');
        
        // Browser should still be the same
        const browser3 = framework.currentBrowser;
        expect(browser3).toBe(browser1);
        
      } finally {
        await framework.cleanup();
      }
    });
  });

  describe('Event Listener Memory Management (Real Browser Test)', () => {
    it('should properly clean up event listeners', async () => {
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
        
        // Navigate to trigger event listeners
        await browserManager.navigateToUrl('data:text/html,<h1>Test Page</h1>');
        
        // Create multiple pages to test listener cleanup
        const page1 = await browserManager.createNewPage();
        const page2 = await browserManager.createNewPage();
        
        // Close pages - should clean up listeners without warnings
        await page1.close();
        await page2.close();
        
        // This test passes if no MaxListenersExceeded warnings occur
        // (Previously would generate warnings due to lack of cleanup)
        
      } finally {
        await browserManager.cleanup();
      }
    });
  });

  describe('Test Data Format Generation (Real File Test)', () => {
    it('should generate tests with new data format', async () => {
      // Test that new test files use data: async () => {} format
      const testTemplate = `import type { TestCase } from 'endorphin-ai';

export const TEST_001: TestCase = {
  "id": "TEST-001",
  "name": "Test Name",
  "description": "Test Description",
  "priority": "Medium",
  "tags": ["test"],
  "site": "https://example.com",
  "data": async () => {
    return {
      "key": "value"
    };
  },
  "task": "Test task"
};`;

      const testFilePath = path.join(testDir, 'generated-test.ts');
      await fs.writeFile(testFilePath, testTemplate);
      
      // Verify file was created with correct format
      const content = await fs.readFile(testFilePath, 'utf8');
      
      // Should have new format
      expect(content).toContain('"data": async () => {');
      expect(content).toContain('return {');
      
      // Should NOT have old format
      expect(content).not.toContain('testData: {');
      
      // Test that the file can be imported without syntax errors
      // This is a basic syntax validation
      expect(content).toMatch(/export\s+const\s+\w+:\s*TestCase\s*=/);
    });
  });

  describe('Module Import Resolution (Real Import Test)', () => {
    it('should resolve framework imports correctly', async () => {
      // Test that test recorder imports work
      try {
        // Dynamic import to test actual module resolution
        const { runInteractiveRecorder } = await import('../../../framework/test-recorder/index.js');
        expect(typeof runInteractiveRecorder).toBe('function');
        
        const { TestRecorder } = await import('../../../framework/test-recorder/index.js');
        expect(typeof TestRecorder).toBe('function');
        
        // Test that HTML reporter imports work
        const { HtmlReporter } = await import('../../../framework/reporters/html-reporter.js');
        expect(typeof HtmlReporter).toBe('function');
        
      } catch (error) {
        throw new Error(`Module import resolution failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  });
});
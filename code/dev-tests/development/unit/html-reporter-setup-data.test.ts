/**
 * Tests for HTML Reporter setup and data generation display functionality
 */

import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { resolve } from 'path';
import { HtmlReporter } from '../../../framework/reporters/html-reporter.js';
import type {
  DataGenerationResult,
  TestSession,
  TestSetupResult,
} from '../../../framework/types/index';

describe('HTMLReporter Setup and Data Generation', () => {
  let reporter: HtmlReporter;
  let testDir: string;

  beforeEach(() => {
    testDir = resolve(__dirname, '../../../tmp/html-reporter-setup-tests');

    // Clean and create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    reporter = new HtmlReporter(testDir, {
      maxReportAge: 30,
      maxReportsPerTest: 10,
    });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('session with setup results', () => {
    it('should include setup results in generated report', async () => {
      const setupResult: TestSetupResult = {
        success: true,
        data: {
          apiKey: 'test-key-123',
          environment: 'test',
          baseUrl: 'https://api.test.com',
        },
        executionTime: 150,
      };

      const session: TestSession = {
        sessionId: 'test-session-001',
        testName: 'Test with Setup',
        testId: 'SETUP-001',
        status: 'completed',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:05:00Z'),
        duration: 300000,
        steps: [
          {
            id: 'step-1',
            action: 'navigate',
            description: 'Navigate to homepage',
            status: 'completed',
            timestamp: new Date('2023-01-01T10:01:00Z'),
            duration: 1000,
            screenshot: 'screenshot-1.png',
          },
        ],
        screenshotCounter: 1,
        setupResult,
      };

      const sessions = [session];
      const reportPath = await reporter.generateReport(sessions);

      expect(existsSync(reportPath)).toBe(true);

      // Read the generated HTML
      const htmlContent = readFileSync(reportPath, 'utf8');

      // Check that setup data is embedded in the HTML
      expect(htmlContent).toContain('"setupResult"');
      expect(htmlContent).toContain('"apiKey": "test-key-123"');
      expect(htmlContent).toContain('"environment": "test"');
      expect(htmlContent).toContain('"executionTime": 150');
      expect(htmlContent).toContain('"success": true');
    });

    it('should include failed setup results', async () => {
      const setupResult: TestSetupResult = {
        success: false,
        error: new Error('Setup failed: API connection timeout'),
        executionTime: 5000,
      };

      const session: TestSession = {
        sessionId: 'test-session-002',
        testName: 'Test with Failed Setup',
        testId: 'SETUP-002',
        status: 'completed',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:05:00Z'),
        duration: 300000,
        steps: [],
        screenshotCounter: 0,
        setupResult,
      };

      const sessions = [session];
      const reportPath = await reporter.generateReport(sessions);

      const htmlContent = readFileSync(reportPath, 'utf8');

      expect(htmlContent).toContain('"setupResult"');
      expect(htmlContent).toContain('"success": false');
      expect(htmlContent).toContain('"executionTime": 5000');
      expect(htmlContent).toContain('Setup failed: API connection timeout');
    });
  });

  describe('session with data generation results', () => {
    it('should include data generation results with token usage', async () => {
      const dataGenerationResult: DataGenerationResult = {
        success: true,
        data: {
          users: [
            { id: 1, name: 'John Doe', email: 'john@test.com' },
            { id: 2, name: 'Jane Smith', email: 'jane@test.com' },
          ],
          products: [{ id: 'prod-1', name: 'Test Product', price: 99.99 }],
        },
        executionTime: 2500,
        tokenUsage: {
          promptTokens: 150,
          responseTokens: 75,
          totalTokens: 225,
          cost: 0.0045,
          model: 'gpt-4o',
        },
      };

      const session: TestSession = {
        sessionId: 'test-session-003',
        testName: 'Test with Data Generation',
        testId: 'DATA-001',
        status: 'completed',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:05:00Z'),
        duration: 300000,
        steps: [],
        screenshotCounter: 0,
        dataGenerationResult,
      };

      const sessions = [session];
      const reportPath = await reporter.generateReport(sessions);

      const htmlContent = readFileSync(reportPath, 'utf8');

      expect(htmlContent).toContain('"dataGenerationResult"');
      expect(htmlContent).toContain('"success": true');
      expect(htmlContent).toContain('"executionTime": 2500');
      expect(htmlContent).toContain('"users"');
      expect(htmlContent).toContain('John Doe');
      expect(htmlContent).toContain('Test Product');
      expect(htmlContent).toContain('"tokenUsage"');
      expect(htmlContent).toContain('"promptTokens": 150');
      expect(htmlContent).toContain('"responseTokens": 75');
      expect(htmlContent).toContain('"totalTokens": 225');
      expect(htmlContent).toContain('"cost": 0.0045');
      expect(htmlContent).toContain('"model": "gpt-4o"');
    });

    it('should include failed data generation results', async () => {
      const dataGenerationResult: DataGenerationResult = {
        success: false,
        error: new Error('Data generation failed: OpenAI API error'),
        executionTime: 1000,
      };

      const session: TestSession = {
        sessionId: 'test-session-004',
        testName: 'Test with Failed Data Generation',
        testId: 'DATA-002',
        status: 'completed',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:05:00Z'),
        duration: 300000,
        steps: [],
        screenshotCounter: 0,
        dataGenerationResult,
      };

      const sessions = [session];
      const reportPath = await reporter.generateReport(sessions);

      const htmlContent = readFileSync(reportPath, 'utf8');

      expect(htmlContent).toContain('"dataGenerationResult"');
      expect(htmlContent).toContain('"success": false');
      expect(htmlContent).toContain('"executionTime": 1000');
      expect(htmlContent).toContain('Data generation failed: OpenAI API error');
    });
  });

  describe('session with both setup and data generation', () => {
    it('should include both setup and data generation results', async () => {
      const setupResult: TestSetupResult = {
        success: true,
        data: { initialized: true, timestamp: '2023-01-01T10:00:00Z' },
        executionTime: 200,
      };

      const dataGenerationResult: DataGenerationResult = {
        success: true,
        data: { testData: 'generated content' },
        executionTime: 1500,
        tokenUsage: {
          promptTokens: 100,
          responseTokens: 50,
          totalTokens: 150,
          cost: 0.003,
          model: 'gpt-4o',
        },
      };

      const session: TestSession = {
        sessionId: 'test-session-005',
        testName: 'Test with Setup and Data Generation',
        testId: 'BOTH-001',
        status: 'completed',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:05:00Z'),
        duration: 300000,
        steps: [],
        screenshotCounter: 0,
        setupResult,
        dataGenerationResult,
      };

      const sessions = [session];
      const reportPath = await reporter.generateReport(sessions);

      const htmlContent = readFileSync(reportPath, 'utf8');

      // Check setup results
      expect(htmlContent).toContain('"setupResult"');
      expect(htmlContent).toContain('"initialized": true');
      expect(htmlContent).toContain('"executionTime": 200');

      // Check data generation results
      expect(htmlContent).toContain('"dataGenerationResult"');
      expect(htmlContent).toContain('"testData": "generated content"');
      expect(htmlContent).toContain('"executionTime": 1500');
      expect(htmlContent).toContain('"tokenUsage"');
      expect(htmlContent).toContain('"totalTokens": 150');
    });
  });

  describe('sessions without setup or data generation', () => {
    it('should generate report normally when no setup or data generation', async () => {
      const session: TestSession = {
        sessionId: 'test-session-006',
        testName: 'Normal Test Without Setup',
        testId: 'NORMAL-001',
        status: 'completed',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T10:05:00Z'),
        duration: 300000,
        steps: [
          {
            id: 'step-1',
            action: 'navigate',
            description: 'Navigate to homepage',
            status: 'completed',
            timestamp: new Date('2023-01-01T10:01:00Z'),
            duration: 1000,
          },
        ],
        screenshotCounter: 0,
      };

      const sessions = [session];
      const reportPath = await reporter.generateReport(sessions);

      expect(existsSync(reportPath)).toBe(true);

      const htmlContent = readFileSync(reportPath, 'utf8');

      // Should not contain setup or data generation results
      expect(htmlContent).not.toContain('"setupResult"');
      expect(htmlContent).not.toContain('"dataGenerationResult"');

      // But should contain normal test data
      expect(htmlContent).toContain('Normal Test Without Setup');
      expect(htmlContent).toContain('NORMAL-001');
      expect(htmlContent).toContain('Navigate to homepage');
    });
  });

  describe('HTML template integration', () => {
    it('should include JavaScript for displaying setup and data results', async () => {
      const session: TestSession = {
        sessionId: 'test-session-007',
        testName: 'Template Integration Test',
        testId: 'TEMPLATE-001',
        status: 'completed',
        startTime: new Date(),
        endTime: new Date(),
        duration: 300000,
        steps: [],
        screenshotCounter: 0,
        setupResult: {
          success: true,
          data: { test: 'data' },
          executionTime: 100,
        },
      };

      const sessions = [session];
      const reportPath = await reporter.generateReport(sessions);

      const htmlContent = readFileSync(reportPath, 'utf8');

      // Check that the HTML contains the setup result data
      expect(htmlContent).toContain('"setupResult"');
      expect(htmlContent).toContain('"test": "data"');
      expect(htmlContent).toContain('<script type="application/json" id="test-data">');
    });
  });

  describe('error handling', () => {
    it('should handle setup results with complex error objects', async () => {
      const complexError = new Error('Complex setup error');
      complexError.stack = 'Error: Complex setup error\n    at setupFunction (test.js:10:5)';
      (complexError as any).code = 'SETUP_TIMEOUT';

      const setupResult: TestSetupResult = {
        success: false,
        error: complexError,
        executionTime: 30000,
      };

      const session: TestSession = {
        sessionId: 'test-session-008',
        testName: 'Test with Complex Error',
        testId: 'ERROR-001',
        status: 'failed',
        startTime: new Date(),
        endTime: new Date(),
        duration: 300000,
        steps: [],
        screenshotCounter: 0,
        setupResult,
      };

      const sessions = [session];
      const reportPath = await reporter.generateReport(sessions);

      const htmlContent = readFileSync(reportPath, 'utf8');

      expect(htmlContent).toContain('"setupResult"');
      expect(htmlContent).toContain('Complex setup error');
      expect(htmlContent).toContain('"success": false');
    });

    it('should handle data generation results with undefined token usage', async () => {
      const dataGenerationResult: DataGenerationResult = {
        success: true,
        data: { result: 'test' },
        executionTime: 1000,
        // tokenUsage is undefined
      };

      const session: TestSession = {
        sessionId: 'test-session-009',
        testName: 'Test without Token Usage',
        testId: 'NO-TOKENS-001',
        status: 'completed',
        startTime: new Date(),
        endTime: new Date(),
        duration: 300000,
        steps: [],
        screenshotCounter: 0,
        dataGenerationResult,
      };

      const sessions = [session];
      const reportPath = await reporter.generateReport(sessions);

      const htmlContent = readFileSync(reportPath, 'utf8');

      expect(htmlContent).toContain('"dataGenerationResult"');
      expect(htmlContent).toContain('"result": "test"');
      expect(htmlContent).toContain('"success": true');
      // Should not contain tokenUsage
      expect(htmlContent).not.toContain('"tokenUsage"');
    });
  });
});

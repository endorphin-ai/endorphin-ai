/**
 * Test Manager - Handles test discovery, loading, and execution coordination (TypeScript)
 * Manages individual test files in the tests/ folder
 */

import type { TaskResult, TestConfig } from '../types/index.js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { info, logSuccess, logWithIcon, LogLevel, error as logError, warn } from './logger.js';

dotenv.config();

// Handle Jest environment where import.meta.url might not be available
let __filename: string = '';
let __dirname: string = process.cwd();

try {
  __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch {
  // Fallback for Jest or other environments without import.meta
  __dirname = process.cwd();
}

interface LoadedTest extends TestConfig {
  filename: string;
  filePath: string;
}

interface TestCriteria {
  tag?: string;
  priority?: 'High' | 'Medium' | 'Low';
  idPattern?: RegExp;
  nameSearch?: string;
}

interface TestSummary {
  total: number;
  byPriority: Record<string, number>;
  byTag: Record<string, number>;
  files: number;
}

interface NewTestData {
  name: string;
  description: string;
  priority?: 'High' | 'Medium' | 'Low';
  tags?: string[];
  site?: string;
  testData?: Record<string, any>;
  prerequisites?: string[];
  task: string;
}

export class TestManager {
  private framework: any = null; // Framework instance (if needed)
  private testsDir: string;
  private testFiles: string[] = [];
  private loadedTests: Map<string, LoadedTest> = new Map();

  constructor() {
    this.testsDir = path.join(__dirname, '../../tests');
  }

  async loadTests(): Promise<Map<string, LoadedTest>> {
    try {
      await this.loadAllTests();
      return this.loadedTests;
    } catch (error) {
      logError('Error loading tests', error instanceof Error ? error : undefined, { message: String(error) }, 'TestManager');
      throw error;
    }
  }

  /**
   * Load all test files from the tests directory
   */
  private async loadAllTests(): Promise<void> {
    try {
      const files = fs.readdirSync(this.testsDir);
      this.testFiles = files.filter((file) => file.endsWith('.js') && file.startsWith('QE-'));

      for (const file of this.testFiles) {
        await this.loadTestFile(file);
      }
    } catch (error) {
      logError('Error loading test files', error instanceof Error ? error : undefined, { testsDir: this.testsDir, message: String(error) }, 'TestManager');
    }
  }

  /**
   * Load an individual test file
   */
  private async loadTestFile(filename: string): Promise<void> {
    try {
      const filePath = path.join(this.testsDir, filename);
      const testModule = await import(`file://${filePath}`);

      // Handle both export default and export const formats
      let testCase = testModule.default;

      // If no default export, look for named exports starting with QE
      if (!testCase) {
        const exports = Object.keys(testModule);
        const qeExport = exports.find((key) => key.startsWith('QE'));
        if (qeExport) {
          testCase = testModule[qeExport];
        }
      }

      if (testCase?.id) {
        this.loadedTests.set(testCase.id, {
          ...testCase,
          filename,
          filePath,
        });
        info(`Loaded test: ${testCase.id} - ${testCase.name}`, { testId: testCase.id, testName: testCase.name, filename }, 'TestManager');
      } else {
        warn(`Invalid test file format: ${filename}`, { filename }, 'TestManager');
      }
    } catch (error) {
      logError(`Error loading test file ${filename}`, error instanceof Error ? error : undefined, { filename, message: String(error) }, 'TestManager');
    }
  }

  /**
   * List all available tests
   */
  listAllTests(): void {
    info('Listing available test cases', { testCount: this.loadedTests.size }, 'TestManager');

    const sortedTests = Array.from(this.loadedTests.values()).sort((a, b) =>
      a.id.localeCompare(b.id)
    );

    sortedTests.forEach((test) => {
      info(`Test: ${test.id} - ${test.name}`, {
        testId: test.id,
        name: test.name,
        description: test.description,
        priority: test.priority,
        tags: test.tags,
        prerequisites: test.testData?.prerequisites
      }, 'TestManager');
    });
  }

  /**
   * Find tests by various criteria
   */
  findTests(criteria: TestCriteria = {}): LoadedTest[] {
    const allTests = Array.from(this.loadedTests.values());

    return allTests.filter((test) => {
      // Filter by tag
      if (criteria.tag && !test.tags.includes(criteria.tag)) {
        return false;
      }

      // Filter by priority
      if (criteria.priority && test.priority !== criteria.priority) {
        return false;
      }

      // Filter by ID pattern
      if (criteria.idPattern && !test.id.match(criteria.idPattern)) {
        return false;
      }

      // Filter by name search
      if (
        criteria.nameSearch &&
        !test.name.toLowerCase().includes(criteria.nameSearch.toLowerCase())
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * Run a single test by ID
   */
  async runTestById(testId: string): Promise<TaskResult | null> {
    const test = this.loadedTests.get(testId);
    if (!test) {
      logError(`Test ${testId} not found`, new Error('Test not found'), { testId }, 'TestManager');
      return null;
    }

    logWithIcon(LogLevel.INFO, 'target', `Running Test: ${test.id} - ${test.name}`, {
      testId: test.id,
      testName: test.name,
      description: test.description,
      priority: test.priority,
      tags: test.tags,
      prerequisites: test.testData?.prerequisites
    }, 'TestManager');

    if (!this.framework) {
      throw new Error('Framework not initialized. Call setFramework() first.');
    }

    return await this.framework.runTask(test.task, test.name);
  }

  /**
   * Run multiple tests by their IDs
   */
  async runTests(testIds: string[]): Promise<TaskResult[]> {
    const results: TaskResult[] = [];

    for (const testId of testIds) {
      const result = await this.runTestById(testId);
      if (result) {
        results.push(result);
      }

      // Add delay between tests
      if (testIds.indexOf(testId) < testIds.length - 1) {
        info('Waiting 2 seconds before next test', { currentTest: testIds.indexOf(testId) + 1, totalTests: testIds.length }, 'TestManager');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    return results;
  }

  /**
   * Run tests by tag
   */
  async runTestsByTag(tag: string): Promise<TaskResult[]> {
    const tests = this.findTests({ tag });
    const testIds = tests.map((test) => test.id);

    logWithIcon(LogLevel.INFO, 'target', `Running ${tests.length} tests with tag: ${tag}`, { tag, testCount: tests.length, testIds }, 'TestManager');

    return await this.runTests(testIds);
  }

  /**
   * Run tests by priority
   */
  async runTestsByPriority(priority: 'High' | 'Medium' | 'Low'): Promise<TaskResult[]> {
    const tests = this.findTests({ priority });
    const testIds = tests.map((test) => test.id);

    logWithIcon(LogLevel.INFO, 'target', `Running ${tests.length} tests with priority: ${priority}`, { priority, testCount: tests.length, testIds }, 'TestManager');

    return await this.runTests(testIds);
  }

  /**
   * Run smoke tests
   */
  async runSmokeTests(): Promise<TaskResult[]> {
    return await this.runTestsByTag('smoke');
  }

  /**
   * Run authentication tests
   */
  async runAuthTests(): Promise<TaskResult[]> {
    return await this.runTestsByTag('authentication');
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<TaskResult[]> {
    const allTestIds = Array.from(this.loadedTests.keys()).sort();

    logWithIcon(LogLevel.INFO, 'target', `Running ALL ${allTestIds.length} tests`, { testCount: allTestIds.length, testIds: allTestIds }, 'TestManager');

    return await this.runTests(allTestIds);
  }

  /**
   * Generate test summary statistics
   */
  getTestSummary(): TestSummary {
    const allTests = Array.from(this.loadedTests.values());

    const summary: TestSummary = {
      total: allTests.length,
      byPriority: {},
      byTag: {},
      files: this.testFiles.length,
    };

    // Count by priority
    allTests.forEach((test) => {
      summary.byPriority[test.priority] = (summary.byPriority[test.priority] || 0) + 1;
    });

    // Count by tags
    allTests.forEach((test) => {
      test.tags.forEach((tag) => {
        summary.byTag[tag] = (summary.byTag[tag] || 0) + 1;
      });
    });

    return summary;
  }

  /**
   * Create a new test file
   */
  async createNewTest(testData: NewTestData): Promise<string> {
    // Generate next QE number
    const existingNumbers = Array.from(this.loadedTests.keys())
      .map((id) => parseInt(id.split('-')[1]))
      .sort((a, b) => a - b);

    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

    const testId = `QE-${nextNumber.toString().padStart(3, '0')}`;
    const filename = `${testId}-${testData.name.toLowerCase().replace(/\s+/g, '-')}.js`;
    const filePath = path.join(this.testsDir, filename);

    const testContent = `// ${testId}: ${testData.name}
// Description: ${testData.description}
// Priority: ${testData.priority || 'Medium'}
// Tags: ${testData.tags ? testData.tags.join(', ') : 'general'}

export default {
  id: "${testId}",
  name: "${testData.name}",
  description: "${testData.description}",
  priority: "${testData.priority || 'Medium'}",
  tags: ${JSON.stringify(testData.tags || ['general'])},
  site: "${testData.site || 'https://qafromla.herokuapp.com/'}",
  data: async () => {
    return ${JSON.stringify(testData.testData || {}, null, 4)};
  },
  task: \`${testData.task}\`
};`;

    fs.writeFileSync(filePath, testContent);
    logSuccess(`Created new test file: ${filename}`, { testId, filename, filePath }, 'TestManager');

    // Reload the test
    await this.loadTestFile(filename);

    return testId;
  }

  // Getter methods
  getTestById(testId: string): LoadedTest | undefined {
    return this.loadedTests.get(testId);
  }

  getTestsByTag(tag: string): LoadedTest[] {
    return Array.from(this.loadedTests.values()).filter(
      (test) => test.tags && test.tags.includes(tag)
    );
  }

  getTestsByPriority(priority: 'High' | 'Medium' | 'Low'): LoadedTest[] {
    return Array.from(this.loadedTests.values()).filter(
      (test) => test.priority && test.priority === priority
    );
  }

  getAllTests(): LoadedTest[] {
    return Array.from(this.loadedTests.values());
  }

  listTests(): void {
    info('Listing available test cases', { testCount: this.getAllTests().length }, 'TestManager');
    for (const test of this.getAllTests()) {
      info(`${test.id}: ${test.name}`, {
        testId: test.id,
        name: test.name,
        description: test.description,
        priority: test.priority,
        tags: test.tags
      }, 'TestManager');
    }
  }

  /**
   * Set the framework instance for test execution
   */
  setFramework(framework: any): void {
    this.framework = framework;
  }

  async close(): Promise<void> {
    // No browser framework to close in test manager
  }

  generateReport(): null {
    // No framework to generate report from in test manager
    return null;
  }
}

/**
 * Test Runner
 * Handles execution of discovered tests
 */

import { performance } from 'perf_hooks';
import { ConsoleReporter } from '../../reporters/console-reporter.js';
import type { DiscoveryResult, FrameworkConfig, TaskResult } from '../../types/index.js';
import { DirectoryManager } from '../../utils/directory-manager.js';
import { info, logWithIcon, LogLevel } from '../../core/logger.js';
import type { DiscoveredTest, TestExecutionOptions } from '../discovery/discovery-types.js';
import { RecommendationsAgent } from '../../ai/recommendations-agent.js';
import { TokenTracker } from '../../core/token-tracker.js';

/**
 * Check if we're running in test environment
 */
function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Check if a test is quarantined (has 'quarantined' tag)
 */
function isTestQuarantined(test: DiscoveredTest): boolean {
  return test.tags && test.tags.includes('quarantined');
}

/**
 * Check if quarantined tests should be run
 */
function shouldRunQuarantined(): boolean {
  return process.env.ENDORPHIN_RUN_QUARANTINED === 'true';
}

/**
 * Check if a test is a multi-user test
 */
function isMultiUserTest(test: DiscoveredTest): boolean {
  return !!(test.users && Array.isArray(test.users) && test.users.length > 0 && test.tasks);
}

/**
 * Safe exit that doesn't break tests
 */
function _safeExit(code: number): never {
  if (isTestEnvironment()) {
    throw new Error(`process.exit called with code ${code}`);
  } else {
    process.exit(code);
  }
}

/**
 * Test Runner class for executing tests
 */
export class TestRunner {
  private config: FrameworkConfig | null;
  private reporter: ConsoleReporter;

  constructor(config: FrameworkConfig | null = null) {
    this.config = config;
    this.reporter = new ConsoleReporter();
  }

  /**
   * Run a single test by ID
   */
  async runSingleTest(
    test: DiscoveredTest
  ): Promise<{ success: boolean; error?: string; session?: any }> {
    // Check if test is quarantined and should be skipped
    if (isTestQuarantined(test) && !shouldRunQuarantined()) {
      console.log(`⚠️ Skipping quarantined test: ${test.id}`);
      return { success: false, error: 'Test is quarantined' };
    }

    // Clean up test results directory before single test run
    const resultBaseDir = this.config?.resultBaseDir || 'test-results';
    info('Cleaning up test results directory before single test', {}, 'TestRunner');
    await DirectoryManager.cleanupDirectories(resultBaseDir);

    // Check if this is a multi-user test
    if (isMultiUserTest(test)) {
      console.log(`🔄 Detected multi-user test: ${test.id}`);
      const { TestFramework } = await import('../../core/test-framework.js');
      const framework = new TestFramework(this.config || undefined);

      try {
        await framework.initialize();
        const result = await framework.runTest(test);
        const returnValue: { success: boolean; error?: string; session?: any } = {
          success: result.status === 'SUCCESS' || result.success === true,
        };
        if (result.error) returnValue.error = result.error;
        if (result.report || result) returnValue.session = result.report || result;
        return returnValue;
      } finally {
        await framework.cleanup();
      }
    } else {
      const { EnhancedBrowserTestFramework } = await import(
        '../../automation/browser/browser-framework.js'
      );
      const framework = new EnhancedBrowserTestFramework(this.config || undefined);

      try {
        await framework.initialize();
        const result = await framework.runSingleTest(test);
        
        // Generate AI recommendations if there were failures
        await this.generateTestRecommendations(framework, test);
        
        return result;
      } finally {
        await framework.cleanup();
      }
    }
  }

  /**
   * Run multiple tests sequentially
   */
  async runTestsSequentially(tests: DiscoveredTest[]): Promise<DiscoveryResult> {
    this.reporter.startSession();

    // Clean up test results directory once before the entire test session
    const resultBaseDir = this.config?.resultBaseDir || 'test-results';
    info('Cleaning up test results directory before test session', {}, 'TestRunner');
    await DirectoryManager.cleanupDirectories(resultBaseDir);

    logWithIcon(LogLevel.INFO, 'rocket', `Running ${tests.length} tests sequentially with fresh browser per test`, { testCount: tests.length }, 'TestRunner');

    const results: Array<{
      test: DiscoveredTest;
      success: boolean;
      duration: number;
      error?: string;
    }> = [];

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      const progress = `${i + 1}/${tests.length}`;
      
      // Skip quarantined tests unless explicitly enabled
      if (isTestQuarantined(test) && !shouldRunQuarantined()) {
        console.log(`⚠️ Skipping quarantined test: ${test.id}`);
        continue;
      }

      // Create a fresh framework instance for each test
      logWithIcon(LogLevel.INFO, 'testTube', `Test ${progress}: ${test.id} - ${test.name}`, { progress, testId: test.id, testName: test.name }, 'TestRunner');
      info(`Creating fresh browser instance for test: ${test.id}`, { testId: test.id }, 'TestRunner');

      const startTime = performance.now();
      this.reporter.startTest(test.id, test.name);

      try {
        // Check if this is a multi-user test
        if (isMultiUserTest(test)) {
          console.log(`🔄 Detected multi-user test: ${test.id}`);
          const { TestFramework } = await import('../../core/test-framework.js');
          const framework = new TestFramework(this.config || undefined);

          await framework.initialize();

          // Add aggressive timeout for sequential execution to prevent blocking
          const testTimeout = 300000; // 5 minutes per test maximum

          const testPromise = framework.runTest(test);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(
                new Error(
                  `Test '${test.id}' exceeded maximum execution time of ${testTimeout / 1000} seconds in sequential execution`
                )
              );
            }, testTimeout);
          });

          console.log(`⏱️ Starting test ${test.id} with ${testTimeout / 1000}s timeout`);
          const result = (await Promise.race([testPromise, timeoutPromise])) as TaskResult;

          const duration = Math.round(performance.now() - startTime);
          const success = result.status === 'SUCCESS' || result.success === true;
          const status = success ? 'SUCCESS' : 'FAILED';

          this.reporter.completeTest(test.id, test.name, status, duration, result.error);
          const testResult: any = { test, success, duration };
          if (result.error) testResult.error = result.error;
          results.push(testResult);

          console.log(`✅ Test ${test.id} completed in ${duration}ms`);

          // Cleanup multi-user test framework
          await framework.cleanup();
        } else {
          // Single-user test - use existing logic
          const { EnhancedBrowserTestFramework } = await import(
            '../../automation/browser/browser-framework.js'
          );
          const framework = new EnhancedBrowserTestFramework(this.config || undefined);

          await framework.initialize();

          // Add aggressive timeout for sequential execution to prevent blocking
          const testTimeout = 300000; // 5 minutes per test maximum

          const testPromise = framework.runSingleTest(test);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(
                new Error(
                  `Test '${test.id}' exceeded maximum execution time of ${testTimeout / 1000} seconds in sequential execution`
                )
              );
            }, testTimeout);
          });

          console.log(`⏱️ Starting test ${test.id} with ${testTimeout / 1000}s timeout`);
          const result = (await Promise.race([testPromise, timeoutPromise])) as any;

          const duration = Math.round(performance.now() - startTime);
          const status = result.success ? 'SUCCESS' : 'FAILED';

          this.reporter.completeTest(test.id, test.name, status, duration, result.error);
          const testResult: any = { test, success: result.success, duration };
          if (result.error) testResult.error = result.error;
          results.push(testResult);

          console.log(`✅ Test ${test.id} completed in ${duration}ms`);

          // Generate AI recommendations if there were failures
          await this.generateTestRecommendations(framework, test);

          // Cleanup single-user test framework
          await framework.cleanup();
        }
      } catch (error) {
        const duration = Math.round(performance.now() - startTime);
        const message = error instanceof Error ? error.message : String(error);

        console.log(`❌ Test ${test.id} failed after ${duration}ms: ${message}`);

        // If this was a timeout, add special handling
        if (message.includes('exceeded maximum execution time')) {
          console.log(`🚨 Test ${test.id} TIMED OUT - continuing with next test`);
          console.log(`🔧 Consider optimizing test ${test.id} or increasing timeout if needed`);
        }

        this.reporter.completeTest(test.id, test.name, 'FAILED', duration, message);
        results.push({ test, success: false, duration, error: message });
      }

      // Brief pause between tests for complete cleanup
      console.log(`⏸️ Waiting between tests for complete cleanup...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const summary = this.reporter.endSession();

    // Generate performance report if monitoring is enabled
    await this.generatePerformanceReport();

    return {
      success: summary.success,
      passed: summary.passedTests,
      failed: summary.failedTests,
      total: summary.totalTests,
    };
  }

  /**
   * Run tests sequentially
   */
  async runTests(
    tests: DiscoveredTest[],
    options: TestExecutionOptions = {}
  ): Promise<DiscoveryResult> {
    const { timeout = 30000 } = options;

    // Apply timeout if specified
    if (timeout && timeout > 0) {
      // Set timeout for framework (this would need to be implemented in the framework)
      if (this.config) {
        this.config.execution = {
          ...this.config.execution,
          timeout, // Override with the new timeout value
        };
      }
    }

    return await this.runTestsSequentially(tests);
  }

  /**
   * Run tests by specific criteria
   */
  async runTestsByCriteria(
    allTests: DiscoveredTest[],
    criteria: {
      tags?: string[];
      priority?: string[];
      testIds?: string[];
      excludeTags?: string[];
      pattern?: string;
    },
    options: TestExecutionOptions = {}
  ): Promise<DiscoveryResult> {
    let filteredTests = allTests;

    // Filter by test IDs
    if (criteria.testIds && criteria.testIds.length > 0) {
      filteredTests = filteredTests.filter((test) => criteria.testIds!.includes(test.id));
    }

    // Filter by tags
    if (criteria.tags && criteria.tags.length > 0) {
      filteredTests = filteredTests.filter(
        (test) => test.tags && criteria.tags!.some((tag) => test.tags!.includes(tag))
      );
    }

    // Exclude by tags
    if (criteria.excludeTags && criteria.excludeTags.length > 0) {
      filteredTests = filteredTests.filter(
        (test) => !test.tags || !criteria.excludeTags!.some((tag) => test.tags!.includes(tag))
      );
    }

    // Filter by priority
    if (criteria.priority && criteria.priority.length > 0) {
      filteredTests = filteredTests.filter((test) => criteria.priority!.includes(test.priority));
    }

    // Filter by name/id pattern
    if (criteria.pattern) {
      const pattern = criteria.pattern.toLowerCase();
      filteredTests = filteredTests.filter(
        (test) =>
          test.id.toLowerCase().includes(pattern) || test.name.toLowerCase().includes(pattern)
      );
    }

    if (filteredTests.length === 0) {
      console.error('❌ No tests match the specified criteria');
      return { success: false, message: 'No tests match criteria' };
    }

    console.log(`\n🎯 Found ${filteredTests.length} test(s) matching criteria`);
    filteredTests.forEach((test) => {
      const tags = test.tags ? `[${test.tags.join(', ')}]` : '';
      console.log(`  📋 ${test.id}: ${test.name} ${tags}`);
    });
    console.log('');

    return await this.runTests(filteredTests, options);
  }

  /**
   * Get test execution statistics
   */
  getExecutionStatistics(
    results: Array<{ test: DiscoveredTest; success: boolean; duration: number; error?: string }>
  ): {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    totalDuration: number;
    averageDuration: number;
    successRate: number;
    failuresByTag: Record<string, number>;
    failuresByPriority: Record<string, number>;
  } {
    const totalTests = results.length;
    const passedTests = results.filter((r) => r.success).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = totalTests > 0 ? totalDuration / totalTests : 0;
    const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    const failedResults = results.filter((r) => !r.success);
    const failuresByTag: Record<string, number> = {};
    const failuresByPriority: Record<string, number> = {};

    failedResults.forEach((result) => {
      // Count failures by tag
      if (result.test.tags) {
        result.test.tags.forEach((tag) => {
          failuresByTag[tag] = (failuresByTag[tag] || 0) + 1;
        });
      }

      // Count failures by priority
      const priority = result.test.priority || 'Unknown';
      failuresByPriority[priority] = (failuresByPriority[priority] || 0) + 1;
    });

    return {
      totalTests,
      passedTests,
      failedTests,
      totalDuration,
      averageDuration,
      successRate,
      failuresByTag,
      failuresByPriority,
    };
  }

  /**
   * Generate performance report if monitoring is enabled
   */
  private async generatePerformanceReport(): Promise<void> {
    try {
      // Check if performance monitoring is enabled
      if (process.env.ENDORPHIN_PERF_MONITORING === 'true') {
        const { ciPerformanceMonitor } = await import('../../core/ci-performance.js');
        await ciPerformanceMonitor.generateHtmlReport();
      }
    } catch (error) {
      console.error('Failed to generate performance report:', error);
    }
  }

  /**
   * Generate AI-powered test recommendations based on failure data
   */
  private async generateTestRecommendations(
    framework: any, 
    test: DiscoveredTest
  ): Promise<void> {
    try {
      // Only generate recommendations for single-user tests with failure data collection
      if (!framework.getFailureData || typeof framework.getFailureData !== 'function') {
        return; // Multi-user tests or frameworks without failure collection
      }

      const failureData = framework.getFailureData();
      
      // Only analyze if there were failures
      if (!failureData || failureData.length === 0) {
        return;
      }

      info(`🔍 Analyzing ${failureData.length} failure(s) for test recommendations`, {
        testId: test.id,
        failureCount: failureData.length
      }, 'TestRunner');

      // Create token tracker for recommendations agent
      const tokenTracker = framework.getConfig ? 
        new TokenTracker(framework.getConfig()) : 
        new TokenTracker();

      const recommendationsAgent = new RecommendationsAgent(tokenTracker);
      await recommendationsAgent.init();

      const recommendations = await recommendationsAgent.analyzeFailures(
        failureData,
        test.name,
        typeof test.task === 'string' ? test.task : 'Complex test task'
      );

      // Display recommendations to user
      const report = recommendationsAgent.formatRecommendationsReport(recommendations, test.name);
      console.log(report);

      // Clear failure data for next test
      if (framework.clearFailureData && typeof framework.clearFailureData === 'function') {
        framework.clearFailureData();
      }

    } catch (error) {
      // Silent failure - don't disrupt test execution
      info(`Failed to generate recommendations for test ${test.id}: ${error}`, {
        testId: test.id,
        error: error instanceof Error ? error.message : String(error)
      }, 'TestRunner');
    }
  }
}

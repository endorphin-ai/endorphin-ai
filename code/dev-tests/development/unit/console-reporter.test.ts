/**
 * Unit Tests for ConsoleReporter - Test Reporting System
 */

describe('ConsoleReporter', () => {
  let originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
  };

  interface TestResult {
    testId: string;
    testName?: string;
    status?: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'RUNNING' | string;
    duration?: number;
    error?: string | null;
  }

  interface SessionSummary {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    duration: number;
    success: boolean;
  }

  interface _ConsoleReporter {
    reportTestResult?: (result: TestResult | null | undefined) => void;
    generateSessionSummary?: (summary: SessionSummary) => void;
    reportTestStart?: (testName: string) => void;
    reportSessionStart?: (totalTests: number) => void;
    reportSessionEnd?: () => void;
    formatDuration?: (ms: number) => string;
    formatStatus?: (status: string) => string;
  }

  beforeEach(() => {
    // Mock console methods
    originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
  });

  describe('Test Result Reporting', () => {
    test('should report successful test', () => {
      const mockReporter = {
        reportTestResult: jest.fn().mockImplementation((result) => {
          if (result.status === 'SUCCESS') {
            console.log(`✅ ${result.testName} - ${result.duration}ms`);
          }
        })
      };

      const testResult = {
        testId: 'TEST-001',
        testName: 'Sample Test',
        status: 'SUCCESS',
        duration: 1500,
        error: null
      };

      mockReporter.reportTestResult(testResult);
      
      expect(mockReporter.reportTestResult).toHaveBeenCalledWith(testResult);
      expect(console.log).toHaveBeenCalledWith('✅ Sample Test - 1500ms');
    });

    test('should report failed test with error', () => {
      const mockReporter = {
        reportTestResult: jest.fn().mockImplementation((result) => {
          if (result.status === 'FAILED') {
            console.error(`❌ ${result.testName} - ${result.error}`);
          }
        })
      };

      const testResult = {
        testId: 'TEST-002',
        testName: 'Failed Test',
        status: 'FAILED',
        duration: 500,
        error: 'Element not found'
      };

      mockReporter.reportTestResult(testResult);
      
      expect(mockReporter.reportTestResult).toHaveBeenCalledWith(testResult);
      expect(console.error).toHaveBeenCalledWith('❌ Failed Test - Element not found');
    });

    test('should report skipped test', () => {
      const mockReporter = {
        reportTestResult: jest.fn().mockImplementation((result) => {
          if (result.status === 'SKIPPED') {
            console.warn(`⏭️ ${result.testName} - Skipped`);
          }
        })
      };

      const testResult = {
        testId: 'TEST-003',
        testName: 'Skipped Test',
        status: 'SKIPPED',
        duration: 0,
        error: null
      };

      mockReporter.reportTestResult(testResult);
      
      expect(mockReporter.reportTestResult).toHaveBeenCalledWith(testResult);
      expect(console.warn).toHaveBeenCalledWith('⏭️ Skipped Test - Skipped');
    });
  });

  describe('Session Summary', () => {
    test('should generate session summary', () => {
      const mockReporter = {
        generateSessionSummary: jest.fn().mockImplementation((summary) => {
          const totalTime = summary.duration / 1000;
          console.log(`\n📊 Test Session Summary:`);
          console.log(`Total Tests: ${summary.totalTests}`);
          console.log(`Passed: ${summary.passedTests}`);
          console.log(`Failed: ${summary.failedTests}`);
          console.log(`Skipped: ${summary.skippedTests}`);
          console.log(`Duration: ${totalTime}s`);
          console.log(`Success Rate: ${((summary.passedTests / summary.totalTests) * 100).toFixed(1)}%`);
        })
      };

      const sessionSummary = {
        totalTests: 10,
        passedTests: 8,
        failedTests: 1,
        skippedTests: 1,
        duration: 15000,
        success: true
      };

      mockReporter.generateSessionSummary(sessionSummary);
      
      expect(mockReporter.generateSessionSummary).toHaveBeenCalledWith(sessionSummary);
      expect(console.log).toHaveBeenCalledWith('\n📊 Test Session Summary:');
      expect(console.log).toHaveBeenCalledWith('Total Tests: 10');
      expect(console.log).toHaveBeenCalledWith('Passed: 8');
      expect(console.log).toHaveBeenCalledWith('Failed: 1');
      expect(console.log).toHaveBeenCalledWith('Success Rate: 80.0%');
    });

    test('should handle zero duration gracefully', () => {
      const mockReporter = {
        generateSessionSummary: jest.fn().mockImplementation((summary) => {
          const totalTime = summary.duration / 1000;
          console.log(`Duration: ${totalTime}s`);
        })
      };

      const sessionSummary = {
        totalTests: 1,
        passedTests: 1,
        failedTests: 0,
        skippedTests: 0,
        duration: 0,
        success: true
      };

      mockReporter.generateSessionSummary(sessionSummary);
      
      expect(console.log).toHaveBeenCalledWith('Duration: 0s');
    });
  });

  describe('Progress Reporting', () => {
    test('should report test start', () => {
      const mockReporter = {
        reportTestStart: jest.fn().mockImplementation((testName) => {
          console.log(`🏃 Running: ${testName}`);
        })
      };

      mockReporter.reportTestStart('Login Test');
      
      expect(mockReporter.reportTestStart).toHaveBeenCalledWith('Login Test');
      expect(console.log).toHaveBeenCalledWith('🏃 Running: Login Test');
    });

    test('should report session start', () => {
      const mockReporter = {
        reportSessionStart: jest.fn().mockImplementation((totalTests) => {
          console.log(`🚀 Starting test session with ${totalTests} tests`);
        })
      };

      mockReporter.reportSessionStart(5);
      
      expect(mockReporter.reportSessionStart).toHaveBeenCalledWith(5);
      expect(console.log).toHaveBeenCalledWith('🚀 Starting test session with 5 tests');
    });

    test('should report session end', () => {
      const mockReporter = {
        reportSessionEnd: jest.fn().mockImplementation(() => {
          console.log('🏁 Test session completed');
        })
      };

      mockReporter.reportSessionEnd();
      
      expect(mockReporter.reportSessionEnd).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('🏁 Test session completed');
    });
  });

  describe('Color and Formatting', () => {
    test('should format durations correctly', () => {
      const mockReporter = {
        formatDuration: jest.fn().mockImplementation((ms) => {
          if (ms < 1000) return `${ms}ms`;
          return `${(ms / 1000).toFixed(1)}s`;
        })
      };

      expect(mockReporter.formatDuration(500)).toBe('500ms');
      expect(mockReporter.formatDuration(1500)).toBe('1.5s');
      expect(mockReporter.formatDuration(2000)).toBe('2.0s');
    });

    test('should format status with colors', () => {
      const mockReporter = {
        formatStatus: jest.fn().mockImplementation((status: string) => {
          const icons: Record<string, string> = {
            SUCCESS: '✅',
            FAILED: '❌',
            SKIPPED: '⏭️',
            RUNNING: '🏃'
          };
          return icons[status] || '❓';
        })
      };

      expect(mockReporter.formatStatus('SUCCESS')).toBe('✅');
      expect(mockReporter.formatStatus('FAILED')).toBe('❌');
      expect(mockReporter.formatStatus('SKIPPED')).toBe('⏭️');
      expect(mockReporter.formatStatus('RUNNING')).toBe('🏃');
      expect(mockReporter.formatStatus('UNKNOWN')).toBe('❓');
    });
  });

  describe('Error Handling', () => {
    test('should handle undefined test results', () => {
      const mockReporter = {
        reportTestResult: jest.fn().mockImplementation((result) => {
          if (!result) {
            console.error('Error: Invalid test result');
            return;
          }
          console.log(`${result.testName} completed`);
        })
      };

      mockReporter.reportTestResult(null);
      mockReporter.reportTestResult(undefined);
      
      expect(console.error).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenCalledWith('Error: Invalid test result');
    });

    test('should handle missing test properties', () => {
      const mockReporter = {
        reportTestResult: jest.fn().mockImplementation((result) => {
          const testName = result.testName || 'Unknown Test';
          const status = result.status || 'UNKNOWN';
          console.log(`${testName}: ${status}`);
        })
      };

      const incompleteResult = {
        testId: 'TEST-001'
        // missing testName and status
      };

      mockReporter.reportTestResult(incompleteResult);
      
      expect(console.log).toHaveBeenCalledWith('Unknown Test: UNKNOWN');
    });
  });
});

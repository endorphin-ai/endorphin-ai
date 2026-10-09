/**
 * ConsoleReporter - Real-time console output for test execution (TypeScript)
 * Provides colorful, formatted test results similar to popular test runners
 */

import { performance } from 'perf_hooks';
import { COLORS } from '../config/colors.js';
import { ICONS } from '../config/icons.js';

interface TestReportResult {
  testId: string;
  testName: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  duration: number;
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

export class ConsoleReporter {
  private startTime: number | null = null;
  private results: TestReportResult[] = [];
  private currentTestId: string | null = null;

  constructor() {
    // Colors and icons are now imported from centralized config
  }

  /**
   * Start the test session
   */
  startSession(): void {
    this.startTime = performance.now();
    this.results = [];

    console.log(
      `${COLORS.brightCyan}${ICONS.testTube} Running Endorphin AI Tests...${COLORS.reset}\n`
    );
  }

  /**
   * Display ASCII art of Endorphin molecular structure
   */
  displayEndorphinMolecule(): void {
    const purple = '\x1b[35m';
    const brightPurple = '\x1b[95m';
    const darkPurple = '\x1b[35m\x1b[2m';
    const magenta = '\x1b[35m\x1b[1m';

    console.log(`${brightPurple}
    ╔═══════════════════════════════════════════════════════════════╗
    ║${magenta}                          ENDORPHIN                            ${brightPurple}║
    ║${darkPurple}                      C₃₁H₃₉N₇O₉S                              ${brightPurple}║
    ╚═══════════════════════════════════════════════════════════════╝${COLORS.reset}`);

    console.log(`${purple}
         ${brightPurple}HO${purple}─┐     ┌─${brightPurple}NH₂${purple}                    ┌─${brightPurple}COOH${purple}
             │     │                       │
         ┌───${brightPurple}C${purple}═══${brightPurple}C${purple}─${brightPurple}C${purple}─${brightPurple}NH${purple}─${brightPurple}CO${purple}─${brightPurple}NH${purple}─${brightPurple}C${purple}─${brightPurple}CO${purple}─${brightPurple}NH${purple}─${brightPurple}C${purple}───${brightPurple}C${purple}─┘
         │   ║   ║   │           │     │   │
         │   ║   ║   │           │     │   └─${brightPurple}NH₂${purple}
    ${brightPurple}H₂N${purple}──${brightPurple}C${purple}───┘   ║   │           │     │
         │       ║   │           │     │
         │   ┌───┘   │           │     │
         │   │       │           │     │
         └─${brightPurple}C${purple}─┘   ┌─${brightPurple}C${purple}─┘       ┌─${brightPurple}C${purple}─┘ ┌─${brightPurple}C${purple}─┘
           ║     │           │     │
           ║ ┌─${brightPurple}C${purple}─┘       ┌─${brightPurple}C${purple}─┘ ┌─${brightPurple}C${purple}─┘
           ║ │           │     │
       ┌─${brightPurple}C${purple}─┘ │       ┌─${brightPurple}C${purple}─┘ ┌─${brightPurple}C${purple}─┘
       │     │       │     │
   ${brightPurple}H${purple}─${brightPurple}C${purple}─┘ ┌─${brightPurple}C${purple}─┘   ${brightPurple}H${purple}─${brightPurple}C${purple}─┘ ${brightPurple}H${purple}─${brightPurple}C${purple}─┘
     │   │         │     │
     │   │         │     │
    ${brightPurple}CH₃${purple}  │        ${brightPurple}CH₃${purple}   ${brightPurple}CH₃${purple}
         │
        ${brightPurple}CH₂${purple}
         │
        ${brightPurple}CH₃${COLORS.reset}`);

    console.log(`${darkPurple}
    ${magenta}♦${darkPurple} Endorphin: Natural opioid peptide neurotransmitter
    ${magenta}♦${darkPurple} Known for: Pain relief, pleasure, and reward pathways  
    ${magenta}♦${darkPurple} Testing with: AI-powered natural language automation${COLORS.reset}\n`);
  }

  /**
   * Report the start of a test
   */
  startTest(testId: string, testName: string): void {
    this.currentTestId = testId;
    process.stdout.write(
      `${COLORS.gray}${ICONS.dot} ${testId}: ${testName}${COLORS.reset}`
    );
  }

  /**
   * Report test completion
   */
  completeTest(
    testId: string,
    testName: string,
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED',
    duration: number = 0,
    error: string | null = null
  ): void {
    // Clear the current line and move cursor to beginning
    process.stdout.write('\r\x1b[K');

    const result: TestReportResult = {
      testId,
      testName,
      status,
      duration,
      error,
    };
    this.results.push(result);

    // Format and display the result
    if (status === 'SUCCESS') {
      console.log(
        `${COLORS.green}     ${ICONS.checkmark} ${testId}: ${testName}${COLORS.reset} ${COLORS.gray}(${duration}ms)${COLORS.reset}`
      );
    } else if (status === 'FAILED') {
      console.log(
        `${COLORS.red}     ${ICONS.cross} ${testId}: ${testName}${COLORS.reset} ${COLORS.gray}(${duration}ms)${COLORS.reset}`
      );
      if (error) {
        console.log(`${COLORS.red}       ${error}${COLORS.reset}`);
      }
    } else if (status === 'SKIPPED') {
      console.log(
        `${COLORS.yellow}     ${ICONS.circle} ${testId}: ${testName}${COLORS.reset} ${COLORS.gray}(skipped)${COLORS.reset}`
      );
    }
  }

  /**
   * Report test failure with error details
   */
  reportError(testId: string, error: string): void {
    if (this.currentTestId === testId) {
      // Clear the current line
      process.stdout.write('\r\x1b[K');
    }
    console.log(
      `${COLORS.red}     ${ICONS.cross} ${testId}: Failed${COLORS.reset}`
    );
    console.log(`${COLORS.red}       ${error}${COLORS.reset}`);
  }

  /**
   * End the test session and display summary
   */
  endSession(): SessionSummary {
    const endTime = performance.now();
    const duration = Math.round(endTime - (this.startTime || 0));

    console.log(''); // Empty line

    // Calculate statistics
    const totalTests = this.results.length;
    const passedTests = this.results.filter((r) => r.status === 'SUCCESS').length;
    const failedTests = this.results.filter((r) => r.status === 'FAILED').length;
    const skippedTests = this.results.filter((r) => r.status === 'SKIPPED').length;

    // Display summary with colors
    this.displaySummary(totalTests, passedTests, failedTests, skippedTests, duration);

    // Display detailed failure information if any
    this.displayFailureDetails();

    return {
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      duration,
      success: failedTests === 0,
    };
  }

  /**
   * Display the test summary in a formatted way
   */
  private displaySummary(
    totalTests: number,
    passedTests: number,
    failedTests: number,
    skippedTests: number,
    duration: number
  ): void {
    const hasFailures = failedTests > 0;

    // Test Files summary
    if (totalTests > 0) {
      console.log(
        `${COLORS.bright} Test Files  ${COLORS.green}${totalTests} passed${COLORS.reset}${COLORS.bright} (${totalTests})${COLORS.reset}`
      );
    }

    // Tests summary with conditional coloring
    let testsSummary = `${COLORS.bright}      Tests  `;

    if (passedTests > 0) {
      testsSummary += `${COLORS.green}${passedTests} passed${COLORS.reset}`;
    }

    if (failedTests > 0) {
      if (passedTests > 0) testsSummary += `${COLORS.bright}, `;
      testsSummary += `${COLORS.red}${failedTests} failed${COLORS.reset}`;
    }

    if (skippedTests > 0) {
      if (passedTests > 0 || failedTests > 0) testsSummary += `${COLORS.bright}, `;
      testsSummary += `${COLORS.yellow}${skippedTests} skipped${COLORS.reset}`;
    }

    testsSummary += `${COLORS.bright} (${totalTests})${COLORS.reset}`;
    console.log(testsSummary);

    // Timing information
    const now = new Date();
    const timeString = now.toTimeString().split(' ')[0]; // HH:MM:SS format
    console.log(`${COLORS.gray}   Start at  ${timeString}${COLORS.reset}`);
    console.log(
      `${COLORS.gray}   Duration  ${this.formatDuration(duration)}${COLORS.reset}`
    );

    // Overall result indicator
    if (hasFailures) {
      console.log(
        `\n${COLORS.bgRed}${COLORS.white}${COLORS.bright} FAILED ${COLORS.reset} ${COLORS.red}${failedTests} test${failedTests === 1 ? '' : 's'} failed${COLORS.reset}`
      );
    } else if (totalTests > 0) {
      console.log(
        `\n${COLORS.bgGreen}${COLORS.white}${COLORS.bright} PASSED ${COLORS.reset} ${COLORS.green}All tests passed!${COLORS.reset}`
      );
    }
  }

  /**
   * Display detailed failure information
   */
  private displayFailureDetails(): void {
    const failedTests = this.results.filter((r) => r.status === 'FAILED');

    if (failedTests.length > 0) {
      console.log(`\n${COLORS.red}${COLORS.bright}Failed Tests:${COLORS.reset}\n`);

      failedTests.forEach((test, index) => {
        console.log(
          `${COLORS.red}${COLORS.bright}${index + 1}. ${test.testId}: ${test.testName}${COLORS.reset}`
        );
        if (test.error) {
          console.log(`${COLORS.red}   ${test.error}${COLORS.reset}`);
        }
        console.log(''); // Empty line between failures
      });
    }
  }

  /**
   * Format duration in a human-readable way
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(1);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Report progress during test execution
   */
  reportProgress(message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info'): void {
    switch (type) {
      case 'info':
        console.log(`${COLORS.blue}ℹ ${message}${COLORS.reset}`);
        break;
      case 'warning':
        console.log(`${COLORS.yellow}${ICONS.warningSimple} ${message}${COLORS.reset}`);
        break;
      case 'error':
        console.log(`${COLORS.red}${ICONS.cross} ${message}${COLORS.reset}`);
        break;
      case 'success':
        console.log(`${COLORS.green}${ICONS.checkmark} ${message}${COLORS.reset}`);
        break;
      default:
        console.log(`${COLORS.gray}${message}${COLORS.reset}`);
    }
  }

  /**
   * Clear the current line (useful for updating progress)
   */
  clearLine(): void {
    process.stdout.write('\r\x1b[K');
  }

  /**
   * Check if we're in a CI environment (disable colors if needed)
   */
  static shouldUseColors(): boolean {
    // Check for CI environment variables that might indicate no color support
    if (process.env.CI && process.env.CI !== 'false') {
      return process.env.FORCE_COLOR !== 'false';
    }

    // Check if stdout is a TTY (terminal)
    return process.stdout.isTTY;
  }

  /**
   * Disable colors for CI/non-terminal environments
   */
  disableColors(): void {
    // Colors are now centralized - this method is deprecated
    // Individual color properties can't be modified from centralized config
    console.warn('disableColors() is deprecated. Colors are now managed centrally.');
  }
}

// Auto-detect color support
const consoleReporter = new ConsoleReporter();
if (!ConsoleReporter.shouldUseColors()) {
  consoleReporter.disableColors();
}

export default consoleReporter;

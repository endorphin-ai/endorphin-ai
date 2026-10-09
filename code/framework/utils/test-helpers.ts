/**
 * Test Helper Utilities
 * Common utilities for test execution, logging, and screenshots
 */

import * as path from 'node:path';
import { BrowserManager } from '../automation/browser/browser-manager.js';
import type { TestSession, TestStep } from '../types/index.js';
import { info, warn, logSuccess, error as logError } from '../core/logger.js';
import { ICONS } from '../config/icons.js';

export class TestHelpers {
  /**
   * Log a test step with detailed information
   */
  static logTestStep(
    description: string,
    tool: string | null,
    params: any,
    result: string,
    isImportant: boolean = false,
    session?: TestSession,
    screenshots: string[] = []
  ): void {
    const timestamp = new Date().toISOString();
    const _stepLog = {
      timestamp,
      description,
      tool,
      params,
      result,
      isImportant,
    };

    // Use logger with proper formatting and combined tool icons
    const toolIconMap: Record<string, string> = {
      'click': `${ICONS.tools} ${ICONS.button}`,
      'fill': `${ICONS.tools} ${ICONS.keyboard}`,
      'navigate': `${ICONS.tools} ${ICONS.web}`,
      'wait': `${ICONS.tools} ${ICONS.hourglass}`,
      'screenshot': `${ICONS.tools} ${ICONS.camera}`,
      'verify': `${ICONS.tools} ${ICONS.checkmark}`,
      'found': `${ICONS.tools} ${ICONS.search}`,
      'default': ICONS.tools
    };
    
    const toolIcon = tool ? (toolIconMap[tool.toLowerCase()] || toolIconMap['default']) : ICONS.tools;
    
    if (isImportant) {
      logSuccess(`${toolIcon} ${description}`, { tool, params: JSON.stringify(params), result }, 'Tool');
    } else {
      info(`${toolIcon} ${description}`, { tool, params: JSON.stringify(params), result }, 'Tool');
    }

    // Add to session if provided
    if (session) {
      const step: TestStep = {
        stepNumber: session.steps.length + 1,
        timestamp,
        description,
        toolName: tool,
        toolArgs: params,
        result,
        status: isImportant ? 'SUCCESS' : 'SUCCESS',
        screenshots: screenshots.map((path) => ({
          filepath: path,
          filename: path.split('/').pop() || 'screenshot.png',
          description: `${description} screenshot`,
          timestamp,
          stepNumber: session.steps.length + 1,
        })),
      };

      session.steps.push(step);
    }
  }

  /**
   * Take a screenshot for a test step
   */
  static async takeStepScreenshot(
    browserManager: BrowserManager,
    description: string | null = null,
    session?: TestSession,
    fullPage: boolean = true
  ): Promise<string | null> {
    try {
      if (!browserManager.isInitialized()) {
        warn(`${ICONS.tools} ${ICONS.warning} Browser not initialized, skipping screenshot`, {}, 'Tool');
        return null;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const stepNumber = session ? session.screenshotCounter + 1 : 1;
      const filename = `step-${stepNumber}-${timestamp}.png`;
      const screenshotPath = session
        ? path.join(session.sessionDir, 'screenshots', filename)
        : path.join('screenshots', filename);

      const _screenshot = await browserManager.takeScreenshot({
        path: screenshotPath,
        fullPage,
      });

      if (session) {
        session.screenshotCounter = stepNumber;

        // Add screenshot to the current step if one exists
        if (session.steps.length > 0) {
          const currentStep = session.steps[session.steps.length - 1];
          if (!currentStep.screenshots) {
            currentStep.screenshots = [];
          }
          currentStep.screenshots.push({
            filename,
            filepath: `screenshots/${filename}`,
            description: description || `Step ${stepNumber} screenshot`,
            timestamp: new Date().toISOString(),
            stepNumber,
          });
        }
      }

      const logDescription = description
        ? `Screenshot: ${description}`
        : `Screenshot step ${stepNumber}`;

      info(`${ICONS.tools} ${ICONS.camera} ${logDescription} -> ${filename}`, { filename, stepNumber }, 'Tool');

      return screenshotPath;
    } catch (error: any) {
      logError(`${ICONS.tools} ${ICONS.failure} Failed to take screenshot`, error instanceof Error ? error : undefined, { message: String(error) }, 'Tool');
      return null;
    }
  }

  /**
   * Format duration for display
   */
  static formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    }

    const seconds = Math.floor(milliseconds / 1000);
    const remainingMs = milliseconds % 1000;

    if (seconds < 60) {
      return remainingMs > 0
        ? `${seconds}.${remainingMs.toString().padStart(3, '0')}s`
        : `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}m ${remainingSeconds}s`;
  }

  /**
   * Create a test step object
   */
  static createTestStep(
    stepNumber: number,
    description: string,
    status: 'SUCCESS' | 'FAILED' = 'SUCCESS',
    toolName?: string,
    toolArgs?: any,
    result?: string
  ): TestStep {
    return {
      stepNumber,
      timestamp: new Date().toISOString(),
      description,
      toolName: toolName || null,
      toolArgs,
      result: result || null,
      status,
      screenshots: [],
    };
  }

  /**
   * Validate test session data
   */
  static validateTestSession(session: TestSession): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!session.sessionId) {
      errors.push('Session ID is required');
    }

    if (!session.testName) {
      errors.push('Test name is required');
    }

    if (!session.testId) {
      errors.push('Test ID is required');
    }

    if (!session.startTime) {
      errors.push('Start time is required');
    }

    if (!Array.isArray(session.steps)) {
      errors.push('Steps must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate test session statistics
   */
  static calculateSessionStats(session: TestSession): {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    avgStepDuration: number;
    totalDuration: number;
  } {
    const totalSteps = session.steps.length;
    const completedSteps = session.steps.filter((step) => step.status === 'SUCCESS').length;
    const failedSteps = session.steps.filter((step) => step.status === 'FAILED').length;

    // Note: TestStep doesn't have duration field, so we'll use 0 for now
    const avgStepDuration = 0;

    const totalDuration = session.duration || 0;

    return {
      totalSteps,
      completedSteps,
      failedSteps,
      avgStepDuration,
      totalDuration,
    };
  }

  /**
   * Generate test summary
   */
  static generateTestSummary(session: TestSession): string {
    const stats = TestHelpers.calculateSessionStats(session);
    const duration = TestHelpers.formatDuration(stats.totalDuration);
    const avgDuration = TestHelpers.formatDuration(stats.avgStepDuration);

    return `
Test Summary: ${session.testName} (${session.testId})
═══════════════════════════════════════════════════
Status: ${session.status}
Duration: ${duration}
Steps: ${stats.totalSteps} (${stats.completedSteps} completed, ${stats.failedSteps} failed)
Average Step Duration: ${avgDuration}
Screenshots: ${session.screenshotCounter}
Session ID: ${session.sessionId}
    `.trim();
  }

  /**
   * Log test summary
   */
  static logTestSummary(session: TestSession): void {
    info(`${ICONS.gear} ${TestHelpers.generateTestSummary(session)}`, { 
      sessionId: session.sessionId,
      testId: session.testId,
      status: session.status,
      duration: session.duration,
      steps: session.steps.length
    }, 'TestHelper');
  }

  /**
   * Create error summary for failed tests
   */
  static createErrorSummary(session: TestSession): string {
    const failedSteps = session.steps.filter((step) => step.status === 'FAILED');

    if (failedSteps.length === 0) {
      return 'No failed steps found.';
    }

    let summary = `❌ ${failedSteps.length} Failed Step(s):\n`;

    failedSteps.forEach((step, index) => {
      summary += `\n${index + 1}. ${step.description}`;
      if (step.result) {
        summary += `\n   Result: ${step.result}`;
      }
      if (step.toolName) {
        summary += `\n   Tool: ${step.toolName}`;
      }
    });

    return summary;
  }

  /**
   * Wait for a specified duration
   */
  static wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}

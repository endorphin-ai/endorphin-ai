/**
 * Utility Tools for Browser Automation
 * Provides LangChain tools for utilities (wait, screenshot)
 */

import type { EnhancedBrowserTestFramework } from '../browser/browser-framework.js';
import { tool } from '@langchain/core/tools';
import * as path from 'path';
import { z } from 'zod';
import { info, logSuccess, error as logError } from '../../core/logger.js';
import { ICONS } from '../../config/icons.js';

/**
 * Creates a wait tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for waiting
 */
export function createWaitTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      milliseconds?: number | undefined;
      reason?: string | undefined;
      selector?: string | undefined;
      state?: 'visible' | 'hidden' | 'attached' | 'detached' | undefined;
    }) => {
      const milliseconds = params.milliseconds ?? 500;
      const reason = params.reason;
      const selector = params.selector;
      const state = params.state ?? 'visible';
      const stepDesc = selector
        ? `Wait for ${selector} to be ${state}`
        : `Wait for ${milliseconds}ms${reason ? ` (${reason})` : ''}`;
      
      info(`${ICONS.tools} ${ICONS.hourglass} ${stepDesc}`, { tool: 'wait', params: { milliseconds, reason, selector, state } }, 'Tool');

      try {
        if (selector) {
          await framework.currentPage!.waitForSelector(selector, { state, timeout: milliseconds });
          const result = `Element ${selector} is now ${state}`;
          logSuccess(`Result: ${result}`, { tool: 'wait', result }, 'Tool');
          framework.logTestStep(
            stepDesc,
            'wait',
            { milliseconds, reason, selector, state },
            result,
            true
          );
          return `✅ ${result}`;
        } else {
          await framework.currentPage!.waitForTimeout(milliseconds);
          const result = `Waited for ${milliseconds}ms${reason ? ` - ${reason}` : ''}`;
          logSuccess(`Result: ${result}`, { tool: 'wait', result }, 'Tool');
          framework.logTestStep(
            stepDesc,
            'wait',
            { milliseconds, reason, selector, state },
            result,
            true
          );
          return result;
        }
      } catch (error: any) {
        logError(`Result: Timeout waiting for ${selector || 'timeout'} to be ${state}`, error instanceof Error ? error : undefined, { tool: 'wait', error: error.message }, 'Tool');
        framework.logTestStep(
          stepDesc,
          'wait',
          { milliseconds, reason, selector, state },
          error.message,
          false
        );
        return `❌ Timeout waiting for ${selector} to be ${state}`;
      }
    },
    {
      name: 'wait',
      description: 'Wait for time or element state.',
      schema: z.object({
        milliseconds: z.number().optional(),
        reason: z.string().optional(),
        selector: z.string().optional(),
        state: z.enum(['visible', 'hidden', 'attached', 'detached']).optional(),
      }),
    }
  );
}

/**
 * Creates a screenshot tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for taking screenshots
 */
export function createScreenshotTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      name?: string | undefined;
      selector?: string | undefined;
      fullPage?: boolean | undefined;
    }) => {
      const name = params.name;
      const selector = params.selector;
      const fullPage = params.fullPage ?? false;

      if (!framework.activeTestSession) {
        // Create a temporary session for screenshot if none exists
        framework.createTestSession('manual-screenshot');
      }

      const filename = name || `manual-screenshot-${Date.now()}`;
      const stepDesc = `Take screenshot: ${filename}`;
      
      info(`${ICONS.tools} ${ICONS.camera} ${stepDesc}`, { tool: 'screenshot', params: { name, selector, fullPage } }, 'Tool');

      try {
        let filePath;
        if (framework.activeTestSession && framework.activeTestSession.screenshotsDir) {
          filePath = path.join(framework.activeTestSession.screenshotsDir, `${filename}.png`);
        } else {
          // Fallback to a simple filename in current directory
          filePath = `${filename}.png`;
        }

        // Ensure we have a valid filename
        if (!filePath || filePath === 'null' || filePath.includes('null')) {
          filePath = `screenshot-${Date.now()}.png`;
        }

        info(`${ICONS.tools} ${ICONS.camera} Screenshot path: ${filePath}`, { filePath }, 'Tool');

        if (selector) {
          await framework.currentPage!.locator(selector).screenshot({ path: filePath });
        } else {
          await framework.currentPage!.screenshot({ path: filePath, fullPage });
        }

        const result = selector
          ? `Screenshot of ${selector} saved as ${filename}`
          : `${fullPage ? 'Full page' : 'Viewport'} screenshot saved as ${filename}`;

        logSuccess(`Result: ${result}`, { tool: 'screenshot', result }, 'Tool');
        framework.logTestStep(stepDesc, 'screenshot', { name, selector, fullPage }, result, true);
        return `📸 ${result}`;
      } catch (error: any) {
        logError(`Result: Error taking screenshot: ${error.message}`, error instanceof Error ? error : undefined, { tool: 'screenshot', error: error.message }, 'Tool');
        framework.logTestStep(
          stepDesc,
          'screenshot',
          { name, selector, fullPage },
          error.message,
          false
        );
        return `❌ Error taking screenshot: ${error.message}`;
      }
    },
    {
      name: 'screenshot',
      description: 'Take screenshot for documentation/debugging.',
      schema: z.object({
        name: z.string().optional().describe('Screenshot filename (without extension)'),
        selector: z.string().optional().describe('CSS selector to screenshot a specific element'),
        fullPage: z.boolean().optional().describe('Capture full page instead of viewport (default: false)'),
      }),
    }
  );
}

/**
 * Creates a resize tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for resizing the browser window
 */
export function createResizeTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      width: number;
      height: number;
    }) => {
      const { width, height } = params;
      const stepDesc = `Resize browser to ${width}x${height}`;

      info(`${ICONS.tools} ${stepDesc}`, { tool: 'resize', params: { width, height } }, 'Tool');

      try {
        const page = framework.currentPage!;
        await page.setViewportSize({ width, height });

        // Wait for layout reflow
        await page.waitForTimeout(300);
        const screenshotPath = await framework.takeStepScreenshot(`Resized to ${width}x${height}`);

        const result = `Successfully resized browser viewport to ${width}x${height}`;
        logSuccess(`Result: ${result}`, { tool: 'resize', result }, 'Tool');
        framework.logTestStep(stepDesc, 'resize', { width, height }, result, true, screenshotPath ? [screenshotPath] : []);
        return `✅ ${result}`;
      } catch (error: any) {
        logError(`Result: Error resizing browser: ${error.message}`, error instanceof Error ? error : undefined, { tool: 'resize', error: error.message }, 'Tool');
        framework.logTestStep(stepDesc, 'resize', { width, height }, error.message, false);
        return `❌ Error resizing browser: ${error.message}`;
      }
    },
    {
      name: 'resize',
      description:
        'Resize the browser viewport to specific dimensions. Useful for testing responsive layouts at different screen sizes.',
      schema: z.object({
        width: z
          .number()
          .describe('Width of the browser viewport in pixels'),
        height: z
          .number()
          .describe('Height of the browser viewport in pixels'),
      }),
    }
  );
}

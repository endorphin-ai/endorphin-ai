/**
 * Navigation Tools for Browser Automation
 * Provides LangChain tools for page navigation
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { EnhancedBrowserTestFramework } from '../browser/browser-framework.js';
import { info, logSuccess, error as logError } from '../../core/logger.js';
import { ICONS } from '../../config/icons.js';

/**
 * Creates a navigation tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for navigation
 */
export function createNavigationTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      location: string;
      waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | undefined;
    }) => {
      const location = params.location;
      const waitUntil = params.waitUntil ?? 'domcontentloaded';

      const stepDesc = `Navigate to: ${location}`;
      
      info(`${ICONS.tools} ${ICONS.web} ${stepDesc}`, { tool: 'navigate', params: { location, waitUntil } }, 'Tool');

      try {
        await framework.currentPage!.goto(location, { waitUntil, timeout: 60000 });
        await framework.takeStepScreenshot(`Page loaded: ${location}`);

        const result = `Successfully navigated to: ${location}`;
        logSuccess(`Result: ${result}`, { tool: 'navigate', result }, 'Tool');
        framework.logTestStep(
          stepDesc,
          'navigate',
          { location, waitUntil },
          result,
          true
        );
        return result;
      } catch (error: any) {
        await framework.takeStepScreenshot(`Navigation failed: ${location}`);
        logError(`Result: Navigation failed: ${error.message}`, error instanceof Error ? error : undefined, { tool: 'navigate', error: error.message }, 'Tool');
        framework.logTestStep(stepDesc, 'navigate', { location, waitUntil }, error.message, false);
        return `❌ Navigation failed: ${error.message}`;
      }
    },
    {
      name: 'navigate',
      description: 'Navigate to a URL with enhanced options.',
      schema: z.object({
        location: z.string().describe('URL to navigate to'),
        waitUntil: z
          .enum(['load', 'domcontentloaded', 'networkidle'])
          .optional()
          .describe('When to consider navigation finished (default: "domcontentloaded")'),
      }),
    }
  );
}

/**
 * Creates a navigate back tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for navigating back in browser history
 */
export function createNavigateBackTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async () => {
      const stepDesc = 'Navigate back to previous page';

      info(`${ICONS.tools} ${ICONS.web} ${stepDesc}`, { tool: 'navigateBack' }, 'Tool');

      try {
        const page = framework.currentPage!;
        const beforeUrl = page.url();
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 60000 });
        const afterUrl = page.url();
        const screenshotPath = await framework.takeStepScreenshot(`Navigated back to ${afterUrl}`);

        const result = `Navigated back from ${beforeUrl} to ${afterUrl}`;
        logSuccess(`Result: ${result}`, { tool: 'navigateBack', result }, 'Tool');
        framework.logTestStep(stepDesc, 'navigateBack', {}, result, true, screenshotPath ? [screenshotPath] : []);
        return `✅ ${result}`;
      } catch (error: any) {
        await framework.takeStepScreenshot('Navigation back failed');
        logError(`Result: Navigation back failed: ${error.message}`, error instanceof Error ? error : undefined, { tool: 'navigateBack', error: error.message }, 'Tool');
        framework.logTestStep(stepDesc, 'navigateBack', {}, error.message, false);
        return `❌ Navigation back failed: ${error.message}`;
      }
    },
    {
      name: 'navigateBack',
      description: 'Go back to the previous page in the browser history, like pressing the browser back button.',
      schema: z.object({}),
    }
  );
}

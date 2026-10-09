/**
 * Scroll Tool for Browser Automation
 * Provides LangChain tool for scrolling page or elements
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { EnhancedBrowserTestFramework } from '../browser/browser-framework.js';
import { info, logSuccess, error as logError } from '../../core/logger.js';
import { ICONS } from '../../config/icons.js';

/**
 * Creates a scroll tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for scrolling
 */
export function createScrollTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      direction?: 'up' | 'down' | 'left' | 'right' | undefined;
      selector?: string | undefined;
      amount?: number | undefined;
      toElement?: string | undefined;
    }) => {
      const direction = params.direction ?? 'down';
      const selector = params.selector;
      const amount = params.amount ?? 500;
      const toElement = params.toElement;

      const stepDesc = toElement
        ? `Scroll to element: ${toElement}`
        : selector
          ? `Scroll ${direction} by ${amount}px in ${selector}`
          : `Scroll ${direction} by ${amount}px`;

      info(`${ICONS.tools} ${stepDesc}`, { tool: 'scroll', params: { direction, selector, amount, toElement } }, 'Tool');

      try {
        const page = framework.currentPage!;

        // If scrolling to a specific element
        if (toElement) {
          const locator = page.locator(toElement);
          const count = await locator.count();
          if (count === 0) {
            const result = `Element ${toElement} not found on page`;
            logError(`Result: ${result}`, undefined, { tool: 'scroll', error: result }, 'Tool');
            framework.logTestStep(stepDesc, 'scroll', { direction, selector, amount, toElement }, result, false);
            return `❌ ${result}`;
          }
          await locator.first().scrollIntoViewIfNeeded();
          const screenshotPath = await framework.takeStepScreenshot(`Scrolled to ${toElement}`);
          const result = `Successfully scrolled to element: ${toElement}`;
          logSuccess(`Result: ${result}`, { tool: 'scroll', result }, 'Tool');
          framework.logTestStep(stepDesc, 'scroll', { direction, selector, amount, toElement }, result, true, screenshotPath ? [screenshotPath] : []);
          return `✅ ${result}`;
        }

        // Calculate scroll deltas
        let deltaX = 0;
        let deltaY = 0;
        switch (direction) {
          case 'up':
            deltaY = -amount;
            break;
          case 'down':
            deltaY = amount;
            break;
          case 'left':
            deltaX = -amount;
            break;
          case 'right':
            deltaX = amount;
            break;
        }

        // Scroll within a container or the page
        if (selector) {
          const locator = page.locator(selector);
          const count = await locator.count();
          if (count === 0) {
            const result = `Container element ${selector} not found on page`;
            logError(`Result: ${result}`, undefined, { tool: 'scroll', error: result }, 'Tool');
            framework.logTestStep(stepDesc, 'scroll', { direction, selector, amount, toElement }, result, false);
            return `❌ ${result}`;
          }
          await locator.first().evaluate(
            (el: Element, { dx, dy }: { dx: number; dy: number }) => {
              el.scrollBy(dx, dy);
            },
            { dx: deltaX, dy: deltaY }
          );
        } else {
          await page.mouse.wheel(deltaX, deltaY);
        }

        // Wait for scroll to complete
        await page.waitForTimeout(300);
        const screenshotPath = await framework.takeStepScreenshot(`After scroll ${direction}`);

        const result = selector
          ? `Scrolled ${direction} by ${amount}px in ${selector}`
          : `Scrolled ${direction} by ${amount}px`;
        logSuccess(`Result: ${result}`, { tool: 'scroll', result }, 'Tool');
        framework.logTestStep(stepDesc, 'scroll', { direction, selector, amount, toElement }, result, true, screenshotPath ? [screenshotPath] : []);
        return `✅ ${result}`;
      } catch (error: any) {
        const screenshotPath = await framework.takeStepScreenshot(`Failed to scroll`);
        logError(`Result: Error scrolling: ${error.message}`, error instanceof Error ? error : undefined, { tool: 'scroll', error: error.message }, 'Tool');
        framework.logTestStep(stepDesc, 'scroll', { direction, selector, amount, toElement }, error.message, false, screenshotPath ? [screenshotPath] : []);
        return `❌ Error scrolling: ${error.message}`;
      }
    },
    {
      name: 'scroll',
      description:
        'Scroll the page or a specific container. Use direction to scroll up/down/left/right by a pixel amount. Use toElement to scroll directly to a specific element.',
      schema: z.object({
        direction: z
          .enum(['up', 'down', 'left', 'right'])
          .optional()
          .describe('Scroll direction (default: "down")'),
        selector: z
          .string()
          .optional()
          .describe('CSS selector of a scrollable container to scroll within (default: page)'),
        amount: z
          .number()
          .optional()
          .describe('Number of pixels to scroll (default: 500)'),
        toElement: z
          .string()
          .optional()
          .describe('CSS selector of an element to scroll into view (overrides direction/amount)'),
      }),
    }
  );
}

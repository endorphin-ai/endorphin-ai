/**
 * Tab Management Tool for Browser Automation
 * Provides LangChain tool for managing browser tabs
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { EnhancedBrowserTestFramework } from '../browser/browser-framework.js';
import { info, logSuccess, error as logError, warn } from '../../core/logger.js';
import { ICONS } from '../../config/icons.js';

/**
 * Creates a tab management tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for managing browser tabs
 */
export function createTabsTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      action: 'list' | 'create' | 'close' | 'switch';
      url?: string | undefined;
      index?: number | undefined;
    }) => {
      const { action, url, index } = params;
      const stepDesc = `Tabs: ${action}${url ? ` (${url})` : ''}${index !== undefined ? ` (index: ${index})` : ''}`;

      info(`${ICONS.tools} ${stepDesc}`, { tool: 'tabs', params: { action, url, index } }, 'Tool');

      try {
        const context = framework.currentPage!.context();
        const pages = context.pages();

        switch (action) {
          case 'list': {
            const tabInfo = await Promise.all(
              pages.map(async (page, i) => {
                const pageTitle = await page.title().catch(() => 'untitled');
                const pageUrl = page.url();
                const isActive = page === framework.currentPage;
                return `${i}: ${pageTitle} — ${pageUrl}${isActive ? ' [ACTIVE]' : ''}`;
              })
            );
            const result = `${pages.length} tab(s) open:\n${tabInfo.join('\n')}`;
            logSuccess(`Result: ${result}`, { tool: 'tabs', result }, 'Tool');
            framework.logTestStep(stepDesc, 'tabs', { action }, result, true);
            return result;
          }

          case 'create': {
            const newPage = await context.newPage();
            if (url) {
              // Security: only allow http/https protocols to prevent file:// and SSRF
              try {
                const parsed = new URL(url);
                if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                  const result = `Blocked navigation to "${url}": only http: and https: protocols are allowed`;
                  logError(`Result: ${result}`, undefined, { tool: 'tabs', error: result }, 'Tool');
                  framework.logTestStep(stepDesc, 'tabs', { action, url }, result, false);
                  await newPage.close();
                  return `❌ ${result}`;
                }
              } catch {
                const result = `Invalid URL: "${url}"`;
                logError(`Result: ${result}`, undefined, { tool: 'tabs', error: result }, 'Tool');
                framework.logTestStep(stepDesc, 'tabs', { action, url }, result, false);
                await newPage.close();
                return `❌ ${result}`;
              }
              await newPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            }
            // Update framework's current page to the new tab
            framework.setCurrentPage(newPage);
            const screenshotPath = await framework.takeStepScreenshot(`Created new tab${url ? `: ${url}` : ''}`);
            const result = url
              ? `Created new tab and navigated to ${url} (tab index: ${context.pages().length - 1})`
              : `Created new empty tab (tab index: ${context.pages().length - 1})`;
            logSuccess(`Result: ${result}`, { tool: 'tabs', result }, 'Tool');
            framework.logTestStep(stepDesc, 'tabs', { action, url }, result, true, screenshotPath ? [screenshotPath] : []);
            return `✅ ${result}`;
          }

          case 'close': {
            const closeIndex = index ?? pages.length - 1;
            if (closeIndex < 0 || closeIndex >= pages.length) {
              const result = `Invalid tab index: ${closeIndex}. Available: 0-${pages.length - 1}`;
              logError(`Result: ${result}`, undefined, { tool: 'tabs', error: result }, 'Tool');
              framework.logTestStep(stepDesc, 'tabs', { action, index }, result, false);
              return `❌ ${result}`;
            }
            const pageToClose = pages[closeIndex];
            const isActive = pageToClose === framework.currentPage;
            await pageToClose.close();

            // If we closed the active tab, switch to the last remaining tab
            if (isActive) {
              const remainingPages = context.pages();
              if (remainingPages.length > 0) {
                framework.setCurrentPage(remainingPages[remainingPages.length - 1]);
                warn('Closed active tab, switched to last remaining tab', { newIndex: remainingPages.length - 1 }, 'Tool');
              }
            }

            const result = `Closed tab at index ${closeIndex}${isActive ? ' (was active, switched to last tab)' : ''}`;
            logSuccess(`Result: ${result}`, { tool: 'tabs', result }, 'Tool');
            framework.logTestStep(stepDesc, 'tabs', { action, index }, result, true);
            return `✅ ${result}`;
          }

          case 'switch': {
            if (index === undefined) {
              const result = 'Tab index is required for "switch" action. Use "list" first to see available indices.';
              logError(`Result: ${result}`, undefined, { tool: 'tabs', error: result }, 'Tool');
              framework.logTestStep(stepDesc, 'tabs', { action, index }, result, false);
              return `❌ ${result}`;
            }
            if (index < 0 || index >= pages.length) {
              const result = `Invalid tab index: ${index}. Available: 0-${pages.length - 1}`;
              logError(`Result: ${result}`, undefined, { tool: 'tabs', error: result }, 'Tool');
              framework.logTestStep(stepDesc, 'tabs', { action, index }, result, false);
              return `❌ ${result}`;
            }
            const targetPage = pages[index];
            framework.setCurrentPage(targetPage);
            await targetPage.bringToFront();
            const screenshotPath = await framework.takeStepScreenshot(`Switched to tab ${index}`);
            const pageTitle = await targetPage.title().catch(() => 'untitled');
            const result = `Switched to tab ${index}: ${pageTitle} — ${targetPage.url()}`;
            logSuccess(`Result: ${result}`, { tool: 'tabs', result }, 'Tool');
            framework.logTestStep(stepDesc, 'tabs', { action, index }, result, true, screenshotPath ? [screenshotPath] : []);
            return `✅ ${result}`;
          }
        }
      } catch (error: any) {
        logError(`Result: Error managing tabs: ${error.message}`, error instanceof Error ? error : undefined, { tool: 'tabs', error: error.message }, 'Tool');
        framework.logTestStep(stepDesc, 'tabs', { action, url, index }, error.message, false);
        return `❌ Error managing tabs: ${error.message}`;
      }
    },
    {
      name: 'tabs',
      description:
        'Manage browser tabs. Actions: "list" shows all open tabs with URLs, "create" opens a new tab (optionally navigating to a URL), "close" closes a tab by index (default: last tab), "switch" brings a tab to the foreground by index.',
      schema: z.object({
        action: z
          .enum(['list', 'create', 'close', 'switch'])
          .describe('Tab action: "list" to see all tabs, "create" to open new tab, "close" to close a tab, "switch" to activate a tab'),
        url: z
          .string()
          .optional()
          .describe('URL to navigate to in the new tab (only used with "create" action)'),
        index: z
          .number()
          .optional()
          .describe('Zero-based tab index for "close" and "switch" actions. Use "list" first to see available indices'),
      }),
    }
  );
}

/**
 * Network Tool for Browser Automation
 * Provides LangChain tool for inspecting network requests
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { EnhancedBrowserTestFramework } from '../browser/browser-framework.js';
import { info, logSuccess, error as logError } from '../../core/logger.js';
import { ICONS } from '../../config/icons.js';


/**
 * Creates a network requests tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for listing network requests
 */
export function createNetworkRequestsTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      includeStatic?: boolean | undefined;
    }) => {
      const includeStatic = params.includeStatic ?? false;
      const stepDesc = `List network requests${includeStatic ? ' (including static)' : ''}`;

      info(`${ICONS.tools} ${stepDesc}`, { tool: 'networkRequests', params: { includeStatic } }, 'Tool');

      try {
        const page = framework.currentPage!;

        // Collect recent network requests by evaluating performance API
        const requests = await page.evaluate((includeStaticRes: boolean) => {
          const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
          const staticExts = [
            '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.avif',
            '.woff', '.woff2', '.ttf', '.eot', '.otf',
            '.css', '.js', '.map',
          ];

          return entries
            .filter(entry => {
              if (includeStaticRes) return true;
              const url = entry.name.toLowerCase();
              return !staticExts.some(ext => url.includes(ext));
            })
            .map(entry => ({
              url: entry.name,
              type: entry.initiatorType,
              duration: Math.round(entry.duration),
              size: entry.transferSize || 0,
              status: entry.responseStatus || 0,
            }));
        }, includeStatic);

        if (requests.length === 0) {
          const result = 'No network requests found';
          logSuccess(`Result: ${result}`, { tool: 'networkRequests', result }, 'Tool');
          framework.logTestStep(stepDesc, 'networkRequests', { includeStatic }, result, true);
          return result;
        }

        // Format the requests into a readable string
        const formatted = requests
          .map((r, i) => `${i + 1}. [${r.type}] ${r.url} (${r.duration}ms, ${r.size}B, status: ${r.status})`)
          .join('\n');

        const result = `Found ${requests.length} network requests:\n${formatted}`;
        logSuccess(`Result: Found ${requests.length} network requests`, { tool: 'networkRequests', requestCount: requests.length }, 'Tool');
        framework.logTestStep(stepDesc, 'networkRequests', { includeStatic }, `Found ${requests.length} requests`, true);
        return result;
      } catch (error: any) {
        logError(`Result: Error listing network requests: ${error.message}`, error instanceof Error ? error : undefined, { tool: 'networkRequests', error: error.message }, 'Tool');
        framework.logTestStep(stepDesc, 'networkRequests', { includeStatic }, error.message, false);
        return `❌ Error listing network requests: ${error.message}`;
      }
    },
    {
      name: 'networkRequests',
      description:
        'List all network requests made since the page was loaded. Useful for verifying API calls, checking loaded resources, or debugging network issues. By default, static resources (images, fonts, CSS, JS) are excluded.',
      schema: z.object({
        includeStatic: z
          .boolean()
          .optional()
          .describe('Whether to include static resources like images, fonts, scripts (default: false)'),
      }),
    }
  );
}

/**
 * Content Tools for Browser Automation
 * Provides LangChain tools for page content analysis
 */

import type { EnhancedBrowserTestFramework } from '../browser/browser-framework.js';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { info, logSuccess, error as logError } from '../../core/logger.js';
import { ICONS } from '../../config/icons.js';
// Content optimization removed - using basic content extraction only

/**
 * Creates a get page content tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for getting page content
 */
export function createGetPageContentTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: { includeTitle?: boolean | undefined; maxLength?: number | undefined }) => {
      const includeTitle = params.includeTitle ?? true;
      const maxLength = params.maxLength ?? 8000;

      const stepDesc = 'Get page content for analysis';
      info(`${ICONS.tools} ${stepDesc}`, { tool: 'getPageContent', params: { includeTitle, maxLength } }, 'Tool');

      try {
        let content = '';

        if (includeTitle) {
          const title = await framework.currentPage!.title();
          const url = framework.currentPage!.url();
          content += `Page Title: ${title}\nURL: ${url}\n\n`;
        }

        const htmlContent = await framework.currentPage!.content();
        const truncatedContent =
          htmlContent.length > maxLength
            ? `${htmlContent.substring(0, maxLength)}\n... (truncated for brevity)`
            : htmlContent;
        content += truncatedContent;

        const result = `Retrieved ${content.length} characters`;
        logSuccess(`Result: ${result}`, { tool: 'getPageContent', result }, 'Tool');
        framework.logTestStep(
          stepDesc,
          'getPageContent',
          { includeTitle, maxLength },
          result,
          true
        );
        return content;
      } catch (error: any) {
        logError(`Result: Error getting page content: ${error.message}`, error instanceof Error ? error : undefined, { tool: 'getPageContent', error: error.message }, 'Tool');
        framework.logTestStep(
          stepDesc,
          'getPageContent',
          { includeTitle, error: error.message },
          error.message,
          false
        );
        throw error;
      }
    },
    {
      name: 'getPageContent',
      description:
        'Get raw HTML page content. Use only when you need information NOT available in the auto-injected accessibility tree (CSS classes, data-* attributes, element IDs, HTML structure). The accessibility tree is auto-injected before every decision.',
      schema: z.object({
        includeTitle: z.boolean().optional(),
        maxLength: z.number().optional(),
      }),
    }
  );
}


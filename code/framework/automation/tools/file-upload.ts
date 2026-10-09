/**
 * File Upload Tool for Browser Automation
 * Provides LangChain tool for uploading files via file inputs
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as path from 'path';
import type { EnhancedBrowserTestFramework } from '../browser/browser-framework.js';
import { info, logSuccess, error as logError } from '../../core/logger.js';
import { ICONS } from '../../config/icons.js';
import { TIMEOUTS } from '../../config/constants.js';

/**
 * Creates a file upload tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for uploading files
 */
export function createFileUploadTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      selector: string;
      files: string[];
      timeout?: number | undefined;
    }) => {
      const { selector, files } = params;
      const timeout = params.timeout ?? TIMEOUTS.ELEMENT_WAIT;
      const stepDesc = `Upload ${files.length} file(s) to ${selector}`;

      info(`${ICONS.tools} ${stepDesc}`, { tool: 'fileUpload', params: { selector, files, timeout } }, 'Tool');

      try {
        const page = framework.currentPage!;

        // Wait for the file input to be available
        await page.waitForSelector(selector, { state: 'attached', timeout });
        const locator = page.locator(selector);

        // Resolve file paths to absolute paths, restricted to cwd
        const cwd = process.cwd();
        const resolvedFiles = files.map(f => {
          const resolved = path.isAbsolute(f) ? path.normalize(f) : path.resolve(cwd, f);
          // Security: ensure resolved path is within cwd to prevent path traversal
          if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
            throw new Error(`File path "${f}" resolves outside the working directory. Only files within ${cwd} are allowed.`);
          }
          return resolved;
        });

        // Set files on the input
        await locator.setInputFiles(resolvedFiles);

        // Wait for upload to process
        await page.waitForTimeout(500);

        const screenshotPath = await framework.takeStepScreenshot(`After uploading files to ${selector}`);
        const fileNames = resolvedFiles.map(f => path.basename(f)).join(', ');
        const result = `Successfully uploaded ${files.length} file(s): ${fileNames}`;
        logSuccess(`Result: ${result}`, { tool: 'fileUpload', result }, 'Tool');
        framework.logTestStep(stepDesc, 'fileUpload', { selector, files }, result, true, screenshotPath ? [screenshotPath] : []);
        return `✅ ${result}`;
      } catch (error: any) {
        const screenshotPath = await framework.takeStepScreenshot(`Failed to upload files`);
        logError(`Result: Error uploading files: ${error.message}`, error instanceof Error ? error : undefined, { tool: 'fileUpload', error: error.message }, 'Tool');
        framework.logTestStep(stepDesc, 'fileUpload', { selector, files }, error.message, false, screenshotPath ? [screenshotPath] : []);
        return `❌ Error uploading files: ${error.message}`;
      }
    },
    {
      name: 'fileUpload',
      description:
        'Upload one or multiple files to a file input element. The selector should point to an input[type="file"] element.',
      schema: z.object({
        selector: z
          .string()
          .describe('CSS selector of the file input element (e.g., "input[type=file]")'),
        files: z
          .array(z.string())
          .describe('Array of file paths to upload (absolute or relative to current working directory)'),
        timeout: z
          .number()
          .optional()
          .describe('Timeout in milliseconds to wait for the file input (default: 45000)'),
      }),
    }
  );
}

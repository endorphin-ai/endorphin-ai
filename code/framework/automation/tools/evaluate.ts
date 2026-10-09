/**
 * Evaluate Tool for Browser Automation
 * Provides LangChain tool for executing JavaScript on the page
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { EnhancedBrowserTestFramework } from '../browser/browser-framework.js';
import { info, logSuccess, error as logError } from '../../core/logger.js';
import { ICONS } from '../../config/icons.js';

/**
 * Creates an evaluate JavaScript tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for evaluating JavaScript
 */
export function createEvaluateTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      expression: string;
      selector?: string | undefined;
    }) => {
      const { expression, selector } = params;
      const stepDesc = selector
        ? `Evaluate JS on element ${selector}`
        : 'Evaluate JS on page';

      info(`${ICONS.tools} ${stepDesc}`, { tool: 'evaluate', params: { expression: expression.substring(0, 200), selector } }, 'Tool');

      try {
        const page = framework.currentPage!;
        let result: any;

        if (selector) {
          // Evaluate in the context of a specific element
          const locator = page.locator(selector);
          const count = await locator.count();
          if (count === 0) {
            const errorResult = `Element ${selector} not found on page`;
            logError(`Result: ${errorResult}`, undefined, { tool: 'evaluate', error: errorResult }, 'Tool');
            framework.logTestStep(stepDesc, 'evaluate', { expression, selector }, errorResult, false);
            return `❌ ${errorResult}`;
          }
          result = await locator.first().evaluate(
            (el: Element, expr: string) => {
              // Function constructor is used here instead of eval() to prevent access to outer scope.
              // This runs inside Playwright's sandboxed browser context, not in Node.js.
              // eslint-disable-next-line no-new-func
              return new Function('el', `return (${expr})`)(el);
            },
            expression
          );
        } else {
          // Evaluate in the page context
          result = await page.evaluate(expression);
        }

        // Serialize result for return
        let resultStr: string;
        if (result === undefined) {
          resultStr = 'undefined';
        } else if (result === null) {
          resultStr = 'null';
        } else if (typeof result === 'object') {
          try {
            resultStr = JSON.stringify(result, null, 2);
          } catch {
            resultStr = String(result);
          }
        } else {
          resultStr = String(result);
        }

        // Truncate very long results
        if (resultStr.length > 5000) {
          resultStr = `${resultStr.substring(0, 5000)}... (truncated)`;
        }

        const successResult = `JavaScript evaluation result: ${resultStr}`;
        logSuccess(`Result: ${successResult}`, { tool: 'evaluate', result: resultStr.substring(0, 200) }, 'Tool');
        framework.logTestStep(stepDesc, 'evaluate', { expression, selector }, successResult, true);
        return `✅ ${successResult}`;
      } catch (error: any) {
        logError(`Result: Error evaluating JavaScript: ${error.message}`, error instanceof Error ? error : undefined, { tool: 'evaluate', error: error.message }, 'Tool');
        framework.logTestStep(stepDesc, 'evaluate', { expression, selector }, error.message, false);
        return `❌ Error evaluating JavaScript: ${error.message}`;
      }
    },
    {
      name: 'evaluate',
      description:
        'Evaluate a JavaScript expression in the browser page context. Use for reading DOM properties, calling page functions, or performing custom operations not covered by other tools. Returns the serialized result.',
      schema: z.object({
        expression: z
          .string()
          .describe('JavaScript expression to evaluate in the browser (e.g., "document.title", "window.innerWidth", "document.querySelectorAll(\'a\').length")'),
        selector: z
          .string()
          .optional()
          .describe('Optional CSS selector — if provided, the expression is evaluated with the element as context'),
      }),
    }
  );
}

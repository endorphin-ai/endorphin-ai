/**
 * Interaction Tools for Browser Automation
 * Provides LangChain tools for element interaction (click, fill, clear)
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { EnhancedBrowserTestFramework } from '../browser/browser-framework.js';
import { TIMEOUTS } from '../../config/constants.js';
import { info, logSuccess, error as logError, warn, logWithIcon, LogLevel } from '../../core/logger.js';
import { ICONS } from '../../config/icons.js';

/**
 * Creates a click tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for clicking elements
 */
export function createClickTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      selector: string;
      strategy?:
        | 'css'
        | 'text'
        | 'exact-text'
        | 'role'
        | 'placeholder'
        | 'label'
        | 'title'
        | 'alt'
        | undefined;
      timeout?: number | undefined;
      force?: boolean | undefined;
    }) => {
      const selector = params.selector;
      const strategy = params.strategy ?? 'css';
      const timeout = params.timeout ?? TIMEOUTS.ELEMENT_WAIT;
      const force = params.force ?? false;

      const stepDesc = `Click ${selector} using ${strategy} strategy`;
      
      info(`${ICONS.tools} ${ICONS.button} ${stepDesc}`, { tool: 'click', params: { selector, strategy, timeout, force } }, 'Tool');

      // Debug logging for tool calls
      if (process.env.ENDORPHIN_DEBUG === 'true' || process.env.ENDORPHIN_DEBUG === 'verbose') {
        logWithIcon(LogLevel.DEBUG, 'debug', `${ICONS.tools} ${ICONS.button} Built-in tool called`, { 
          toolName: 'click', 
          parameters: { selector, strategy, timeout, force }
        }, 'Tool');
      }

      try {
        let locator;

        switch (strategy) {
          case 'text': {
            // First try to find a button with this text to avoid strict mode violations
            const buttonLocator = framework
              .currentPage!.locator('button')
              .filter({ hasText: selector });
            const buttonCount = await buttonLocator.count();
            if (buttonCount > 0) {
              info(
                `${ICONS.tools} ${ICONS.button} Found ${buttonCount} button(s) with text "${selector}", using button strategy`,
                { buttonCount, selector, strategy: 'button' },
                'Tool'
              );
              locator = buttonLocator.first();
            } else {
              // Fallback to general text search
              locator = framework.currentPage!.getByText(selector, { exact: false });
            }
            break;
          }
          case 'exact-text': {
            // First try to find a button with this exact text to avoid strict mode violations
            const buttonLocator = framework.currentPage!.locator('button').filter({
              hasText: new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
            });
            const buttonCount = await buttonLocator.count();
            if (buttonCount > 0) {
              info(
                `${ICONS.tools} ${ICONS.button} Found ${buttonCount} button(s) with exact text "${selector}", using button strategy`,
                { buttonCount, selector, strategy: 'button' },
                'Tool'
              );
              locator = buttonLocator.first();
            } else {
              // Try clickable elements (a, button, input[type=button], etc.)
              const clickableLocator = framework
                .currentPage!.locator(
                  'a, button, input[type="button"], input[type="submit"], [role="button"]'
                )
                .filter({
                  hasText: new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
                });
              const clickableCount = await clickableLocator.count();
              if (clickableCount > 0) {
                info(
                  `${ICONS.tools} ${ICONS.button} Found ${clickableCount} clickable element(s) with exact text "${selector}", using first clickable element`,
                  { clickableCount, selector, strategy: 'clickable' },
                  'Tool'
                );
                locator = clickableLocator.first();
              } else {
                // Fallback to general exact text search (may cause strict mode violation)
                warn(
                  `Using fallback exact text search for "${selector}" - may cause strict mode violation if multiple elements match`,
                  { selector, strategy: 'fallback-exact-text' },
                  'Tool'
                );
                locator = framework.currentPage!.getByText(selector, { exact: true });
              }
            }
            break;
          }
          case 'role': {
            const [role, name] = selector.split(':');
            if (name) {
              // If a name is provided, use it to avoid strict mode violations
              locator = framework.currentPage!.getByRole(role as any, { name });
            } else {
              // If no name provided, get all elements of that role and use first
              warn(
                `Role "${role}" without name may cause strict mode violation - using first match`,
                { role, strategy: 'role-without-name' },
                'Tool'
              );
              locator = framework.currentPage!.getByRole(role as any).first();
            }
            break;
          }
          case 'placeholder':
            locator = framework.currentPage!.getByPlaceholder(selector);
            break;
          case 'label':
            locator = framework.currentPage!.getByLabel(selector);
            break;
          case 'title':
            locator = framework.currentPage!.getByTitle(selector);
            break;
          case 'alt':
            locator = framework.currentPage!.getByAltText(selector);
            break;
          default: {
            // CSS selector strategy - handle multiple matching elements to avoid strict mode violations
            const cssLocator = framework.currentPage!.locator(selector);
            const elementCount = await cssLocator.count();
            
            if (elementCount > 1) {
              warn(
                `CSS selector "${selector}" matches ${elementCount} elements - using first element to avoid strict mode violation`,
                { selector, elementCount, strategy: 'css-multiple' },
                'Tool'
              );
              locator = cssLocator.first();
            } else {
              locator = cssLocator;
            }
            break;
          }
        }

        // Check if element exists first
        const count = await locator.count();
        if (count === 0) {
          const result = `Element ${selector} not found on page`;
          logError(`Result: ${result}`, undefined, { tool: 'click', error: result }, 'Tool');
          framework.logTestStep(
            stepDesc,
            'click',
            { selector, strategy, timeout, force },
            result,
            false
          );
          return `❌ ${result}`;
        }

        await locator.waitFor({ state: 'visible', timeout });
        await locator.click({ force });
        const screenshotPath = await framework.takeStepScreenshot(`After clicking ${selector}`);

        const result = `Successfully clicked ${selector} using ${strategy} strategy`;
        logSuccess(`Result: ${result}`, { tool: 'click', result }, 'Tool');
        framework.logTestStep(
          stepDesc,
          'click',
          { selector, strategy, timeout, force },
          result,
          true,
          screenshotPath ? [screenshotPath] : []
        );

        // Debug logging for successful tool completion
        if (process.env.ENDORPHIN_DEBUG === 'true' || process.env.ENDORPHIN_DEBUG === 'verbose') {
          info(`${ICONS.tools} ${ICONS.button} ${ICONS.success} Built-in tool completed! Name: click, Result: ${result}`, { toolName: 'click', result }, 'Tool');
        }

        return result;
      } catch (error: any) {
        const screenshotPath = await framework.takeStepScreenshot(`Failed to click ${selector}`);
        framework.logTestStep(
          stepDesc,
          'click',
          { selector, strategy, timeout, force },
          error.message,
          false,
          screenshotPath ? [screenshotPath] : []
        );

        // Debug logging for failed tool execution
        if (process.env.ENDORPHIN_DEBUG === 'true' || process.env.ENDORPHIN_DEBUG === 'verbose') {
          logError(`${ICONS.tools} ${ICONS.button} ${ICONS.failure} Built-in tool failed! Name: click, Error: ${error.message}`, error instanceof Error ? error : undefined, { toolName: 'click', error: error.message }, 'Tool');
        }

        return `❌ Error clicking ${selector}: ${error.message}`;
      }
    },
    {
      name: 'click',
      description:
        'Click any element with multiple selection strategies. For buttons with text like "Log In", "Sign In", "Submit", use strategy="text" and selector="Log In". For CSS selectors use strategy="css".',
      schema: z.object({
        selector: z
          .string()
          .describe(
            "Element selector - for buttons use the button text (e.g. 'Log In', 'Sign In'), for CSS use actual selector"
          ),
        strategy: z
          .enum(['css', 'text', 'exact-text', 'role', 'placeholder', 'label', 'title', 'alt'])
          .optional()
          .describe("Selection strategy - use 'text' for button text, 'css' for CSS selectors"),
        timeout: z.number().optional(),
        force: z.boolean().optional(),
      }),
    }
  );
}

/**
 * Creates a fill tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for filling input fields
 */
export function createFillTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      selector: string;
      value: string;
      strategy?: 'fill' | 'type' | undefined;
      clearFirst?: boolean | undefined;
      pressEnter?: boolean | undefined;
    }) => {
      const selector = params.selector;
      const value = params.value;
      const strategy = params.strategy ?? 'fill';
      const clearFirst = params.clearFirst ?? true;
      const pressEnter = params.pressEnter ?? false;

      const stepDesc = `Fill ${selector} with "${value}"`;
      info(`${ICONS.tools} ${ICONS.keyboard} ${stepDesc}`, { tool: 'fill', params: { selector, value, strategy, clearFirst, pressEnter } }, 'Tool');

      try {
        // Try multiple strategies for common field types
        let finalSelector = selector;
        let locator;

        // For email fields, try multiple selectors
        if (selector.includes('email')) {
          const emailSelectors = [
            'input[type="email"]',
            'input[name*="email"]',
            'input[placeholder*="email"]',
            '#email',
            '.email-input',
            selector, // original selector as fallback
          ];

          for (const sel of emailSelectors) {
            try {
              locator = framework.currentPage!.locator(sel);
              if ((await locator.count()) > 0) {
                finalSelector = sel;
                info(`${ICONS.tools} ${ICONS.keyboard} Found email field using selector: ${sel}`, { selector: sel, fieldType: 'email' }, 'Tool');
                break;
              }
            } catch {
              // Ignore selector errors for field detection
            }
          }
        }
        // For password fields, try multiple selectors
        else if (selector.includes('password')) {
          const passwordSelectors = [
            'input[type="password"]',
            'input[name*="password"]',
            'input[placeholder*="password"]',
            '#password',
            '.password-input',
            selector, // original selector as fallback
          ];

          for (const sel of passwordSelectors) {
            try {
              locator = framework.currentPage!.locator(sel);
              if ((await locator.count()) > 0) {
                finalSelector = sel;
                info(`${ICONS.tools} ${ICONS.keyboard} Found password field using selector: ${sel}`, { selector: sel, fieldType: 'password' }, 'Tool');
                break;
              }
            } catch {
              // Ignore selector errors for field detection
            }
          }
        }

        locator = framework.currentPage!.locator(finalSelector);

        await framework.currentPage!.waitForSelector(finalSelector, {
          state: 'visible',
          timeout: TIMEOUTS.ELEMENT_WAIT,
        });

        // Explicit focus before fill — Playwright's .fill() handles focus
        // implicitly but this fails on some SPA frameworks (React, Angular)
        try {
          await locator.scrollIntoViewIfNeeded().catch(() => {});
          await locator.click({ timeout: 5000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 50));
        } catch {
          // Non-blocking: failures here should not prevent the fill attempt
        }

        if (clearFirst) {
          await locator.clear();

          // Wait a moment for the field to clear and verify it's empty
          await framework.currentPage!.waitForTimeout(200);

          // Double-check clearing worked by trying alternative method if needed
          const currentValue = await locator.inputValue();
          if (currentValue && currentValue.length > 0) {
            warn(
              `Field still contains "${currentValue}", trying alternative clearing...`,
              { currentValue, field: finalSelector },
              'Tool'
            );
            await locator.fill(''); // Force empty
            await framework.currentPage!.waitForTimeout(100);
          }
        }

        if (strategy === 'type') {
          await framework.currentPage!.type(finalSelector, value, { delay: 50 });
        } else {
          await framework.currentPage!.fill(finalSelector, value);
        }

        if (pressEnter) {
          await framework.currentPage!.keyboard.press('Enter');
        }

        const screenshotPath = await framework.takeStepScreenshot(`After filling ${finalSelector}`);

        // Verify the value was set correctly
        let actualValue = await locator.inputValue();
        let success = actualValue === value;
        let fillStrategy = 'standard';

        // Retry Fallback 1: triple-clear + character-by-character typing
        if (!success) {
          warn(
            `Value mismatch after standard fill ("${actualValue}" vs "${value}"), trying fallback 1: pressSequentially`,
            { actualValue, expectedValue: value, field: finalSelector },
            'Tool'
          );

          try {
            // Triple-clear: clear(), fill(''), Ctrl+A + Backspace
            await locator.clear();
            await locator.fill('');
            await locator.press('Control+a');
            await locator.press('Backspace');
            await new Promise((r) => setTimeout(r, 50));

            // Type character-by-character
            await locator.pressSequentially(value, { delay: 30 });
            await new Promise((r) => setTimeout(r, 100));

            actualValue = await locator.inputValue();
            success = actualValue === value;
            if (success) {
              fillStrategy = 'pressSequentially';
              info(
                `Fallback 1 (pressSequentially) succeeded for ${finalSelector}`,
                { field: finalSelector },
                'Tool'
              );
            }
          } catch (fallback1Err: any) {
            warn(
              `Fallback 1 failed: ${fallback1Err.message}`,
              { error: fallback1Err.message, field: finalSelector },
              'Tool'
            );
          }
        }

        // Retry Fallback 2: set value via JavaScript using native input setter
        if (!success) {
          warn(
            `Value still mismatched after fallback 1 ("${actualValue}" vs "${value}"), trying fallback 2: JS evaluate`,
            { actualValue, expectedValue: value, field: finalSelector },
            'Tool'
          );

          try {
            await framework.currentPage!.evaluate(
              ({ sel, val }: { sel: string; val: string }) => {
                const el = document.querySelector(sel) as HTMLInputElement | null;
                if (!el) throw new Error(`Element not found: ${sel}`);
                // Use native setter to bypass framework interceptors
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                  window.HTMLInputElement.prototype,
                  'value'
                )?.set;
                if (nativeInputValueSetter) {
                  nativeInputValueSetter.call(el, val);
                } else {
                  el.value = val;
                }
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              },
              { sel: finalSelector, val: value }
            );
            await new Promise((r) => setTimeout(r, 100));

            actualValue = await locator.inputValue();
            success = actualValue === value;
            if (success) {
              fillStrategy = 'jsEvaluate';
              info(
                `Fallback 2 (JS evaluate) succeeded for ${finalSelector}`,
                { field: finalSelector },
                'Tool'
              );
            }
          } catch (fallback2Err: any) {
            warn(
              `Fallback 2 failed: ${fallback2Err.message}`,
              { error: fallback2Err.message, field: finalSelector },
              'Tool'
            );
          }
        }

        const strategyNote = fillStrategy !== 'standard' ? ` (via ${fillStrategy})` : '';
        const result = success
          ? `Successfully filled ${finalSelector} with "${value}"${strategyNote}`
          : `Failed to fill ${finalSelector}: value is "${actualValue}" instead of "${value}" (all strategies exhausted)`;

        if (success) {
          logSuccess(`Result: ${result}`, { tool: 'fill', result, fillStrategy }, 'Tool');
        } else {
          warn(`Result: ${result}`, { tool: 'fill', actualValue, expectedValue: value, fillStrategy }, 'Tool');
        }
        framework.logTestStep(
          stepDesc,
          'fill',
          { selector: finalSelector, value, strategy, clearFirst, pressEnter },
          result,
          success,
          screenshotPath ? [screenshotPath] : []
        );
        return success ? `✅ ${result}` : `❌ ${result}`;
      } catch (error: any) {
        const screenshotPath = await framework.takeStepScreenshot(`Failed to fill ${selector}`);
        logError(`Result: Error filling ${selector}: ${error.message}`, error instanceof Error ? error : undefined, { tool: 'fill', error: error.message }, 'Tool');
        framework.logTestStep(
          stepDesc,
          'fill',
          { selector, value, strategy, clearFirst, pressEnter },
          error.message,
          false,
          screenshotPath ? [screenshotPath] : []
        );
        return `❌ Error filling ${selector}: ${error.message}`;
      }
    },
    {
      name: 'fill',
      description:
        'Fill any input field with text. Use common selectors like input[type="email"], input[name="email"], #email for email fields, input[type="password"], input[name="password"], #password for password fields.',
      schema: z.object({
        selector: z
          .string()
          .describe(
            "CSS selector of input field - use input[type='email'] for email, input[type='password'] for password"
          ),
        value: z.string().describe('Text to enter'),
        strategy: z.enum(['fill', 'type']).optional(),
        clearFirst: z.boolean().optional(),
        pressEnter: z.boolean().optional(),
      }),
    }
  );
}

/**
 * Creates a clear field tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for clearing input fields
 */
export function createClearFieldTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async ({ selector }: { selector: string }) => {
      const stepDesc = `Clear field: ${selector}`;
      info(`${ICONS.tools} ${stepDesc}`, { tool: 'clearField', params: { selector } }, 'Tool');

      try {
        await framework.currentPage!.waitForSelector(selector, {
          state: 'visible',
          timeout: TIMEOUTS.ELEMENT_WAIT,
        });

        // Use Playwright's built-in clear method (much more reliable)
        const locator = framework.currentPage!.locator(selector);
        await locator.clear();

        const screenshotPath = await framework.takeStepScreenshot(`After clearing ${selector}`);

        // Verify field is cleared
        const value = await locator.inputValue();
        const isCleared = value === '';

        const result = isCleared
          ? `Successfully cleared field ${selector}`
          : `Field ${selector} still contains: "${value}"`;

        if (isCleared) {
          logSuccess(`Result: ${result}`, { tool: 'clearField', result }, 'Tool');
        } else {
          warn(`Result: ${result}`, { tool: 'clearField', value }, 'Tool');
        }
        framework.logTestStep(stepDesc, 'clearField', { selector }, result, isCleared, screenshotPath ? [screenshotPath] : []);
        return isCleared ? `✅ ${result}` : `⚠️ ${result}`;
      } catch (error: any) {
        const screenshotPath = await framework.takeStepScreenshot(`Failed to clear ${selector}`);
        logError(`Result: Error clearing field ${selector}: ${error.message}`, error instanceof Error ? error : undefined, { tool: 'clearField', error: error.message }, 'Tool');
        framework.logTestStep(stepDesc, 'clearField', { selector }, error.message, false, screenshotPath ? [screenshotPath] : []);
        return `❌ Error clearing field ${selector}: ${error.message}`;
      }
    },
    {
      name: 'clearField',
      description: 'Clear an input field completely.',
      schema: z.object({
        selector: z.string().describe('CSS selector of the input field to clear'),
      }),
    }
  );
}

/**
 * Creates a describe tool for adding descriptions to locators
 * @param framework - Framework instance
 * @returns LangChain tool for adding descriptions to elements
 */
export function createDescribeTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async ({ selector, description }: { selector: string; description: string }) => {
      const stepDesc = `Describe element: ${selector} as "${description}"`;
      info(`${ICONS.tools} ${stepDesc}`, { tool: 'describe', params: { selector, description } }, 'Tool');

      try {
        // Create locator and add description through logging for better debugging
        const locator = framework.currentPage!.locator(selector);
        info(`${ICONS.tools} Element described: "${description}"`, { selector, description }, 'Tool');
        
        // Verify the element exists
        const count = await locator.count();
        if (count === 0) {
          const result = `Element ${selector} not found on page`;
          logError(`Result: ${result}`, undefined, { tool: 'describe', error: result }, 'Tool');
          framework.logTestStep(
            stepDesc,
            'describe',
            { selector, description },
            result,
            false
          );
          return `❌ ${result}`;
        }

        const result = `Element ${selector} described as "${description}" (found ${count} element${count > 1 ? 's' : ''})`;
        logSuccess(`Result: ${result}`, { tool: 'describe', result }, 'Tool');
        framework.logTestStep(
          stepDesc,
          'describe',
          { selector, description },
          result,
          true
        );
        return `✅ ${result}`;
      } catch (error: any) {
        logError(`Result: Error describing element ${selector}: ${error.message}`, error instanceof Error ? error : undefined, { tool: 'describe', error: error.message }, 'Tool');
        framework.logTestStep(stepDesc, 'describe', { selector, description }, error.message, false);
        return `❌ Error describing element ${selector}: ${error.message}`;
      }
    },
    {
      name: 'describe',
      description: 'Add a description to an element for better debugging and tracing in reports.',
      schema: z.object({
        selector: z.string().describe('CSS selector of the element to describe'),
        description: z.string().describe('Human-readable description of the element'),
      }),
    }
  );
}

/**
 * Creates a press sequentially tool for character-by-character typing
 * @param framework - Framework instance
 * @returns LangChain tool for typing text character by character
 */
export function createPressSequentiallyTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      selector: string;
      text: string;
      delay?: number | undefined;
      strategy?: 'css' | 'placeholder' | 'label' | 'title' | 'alt' | undefined;
    }) => {
      const { selector, text, delay, strategy } = params;
      const actualDelay: number = delay ?? 100;
      const actualStrategy = strategy ?? 'css';
      const stepDesc = `Type sequentially "${text}" into ${selector}`;
      info(`${ICONS.tools} ${stepDesc}`, { tool: 'pressSequentially', params: { selector, text, delay: actualDelay, strategy: actualStrategy } }, 'Tool');

      try {
        // Get locator based on strategy
        let locator;
        switch (actualStrategy) {
          case 'placeholder':
            locator = framework.currentPage!.getByPlaceholder(selector);
            break;
          case 'label':
            locator = framework.currentPage!.getByLabel(selector);
            break;
          case 'title':
            locator = framework.currentPage!.getByTitle(selector);
            break;
          case 'alt':
            locator = framework.currentPage!.getByAltText(selector);
            break;
          default:
            locator = framework.currentPage!.locator(selector);
        }

        // Check if element exists
        const count = await locator.count();
        if (count === 0) {
          const result = `Element ${selector} not found on page`;
          logError(`Result: ${result}`, undefined, { tool: 'pressSequentially', error: result }, 'Tool');
          framework.logTestStep(
            stepDesc,
            'pressSequentially',
            { selector, text, delay: actualDelay, strategy: actualStrategy },
            result,
            false
          );
          return `❌ ${result}`;
        }

        // Focus and type sequentially
        await locator.focus();
        await locator.pressSequentially(text, { delay: actualDelay });
        await framework.takeStepScreenshot(`After typing sequentially into ${selector}`);

        const result = `Successfully typed "${text}" sequentially into ${selector} with ${actualDelay}ms delay`;
        logSuccess(`Result: ${result}`, { tool: 'pressSequentially', result }, 'Tool');
        framework.logTestStep(
          stepDesc,
          'pressSequentially',
          { selector, text, delay: actualDelay, strategy: actualStrategy },
          result,
          true
        );
        return `✅ ${result}`;
      } catch (error: any) {
        await framework.takeStepScreenshot(`Failed to type sequentially into ${selector}`);
        logError(`Result: Error typing sequentially into ${selector}: ${error.message}`, error instanceof Error ? error : undefined, { tool: 'pressSequentially', error: error.message }, 'Tool');
        framework.logTestStep(
          stepDesc,
          'pressSequentially',
          { selector, text, delay: actualDelay, strategy: actualStrategy },
          error.message,
          false
        );
        return `❌ Error typing sequentially into ${selector}: ${error.message}`;
      }
    },
    {
      name: 'pressSequentially',
      description: 'Type text character by character with a delay between each character. Useful for forms with special keyboard handling.',
      schema: z.object({
        selector: z.string().describe('Element selector to type into'),
        text: z.string().describe('Text to type character by character'),
        delay: z.number().optional().describe('Delay in milliseconds between characters (default: 100ms)'),
        strategy: z.enum(['css', 'placeholder', 'label', 'title', 'alt']).optional().describe('Selection strategy (default: css)'),
      }),
    }
  );
}

/**
 * Creates a hover tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for hovering over elements
 */
export function createHoverTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      selector: string;
      strategy?: 'css' | 'text' | 'role' | undefined;
      timeout?: number | undefined;
    }) => {
      const { selector } = params;
      const strategy = params.strategy ?? 'css';
      const timeout = params.timeout ?? TIMEOUTS.ELEMENT_WAIT;
      const stepDesc = `Hover over ${selector} using ${strategy} strategy`;

      info(`${ICONS.tools} ${stepDesc}`, { tool: 'hover', params: { selector, strategy, timeout } }, 'Tool');

      try {
        const page = framework.currentPage!;
        let locator;

        switch (strategy) {
          case 'text':
            locator = page.getByText(selector).first();
            break;
          case 'role': {
            const [role, name] = selector.split(':');
            locator = name
              ? page.getByRole(role as any, { name })
              : page.getByRole(role as any).first();
            break;
          }
          default:
            locator = page.locator(selector).first();
        }

        await locator.waitFor({ state: 'visible', timeout });
        await locator.hover();

        // Wait briefly for hover effects
        await page.waitForTimeout(300);
        const screenshotPath = await framework.takeStepScreenshot(`After hovering ${selector}`);

        const result = `Successfully hovered over ${selector}`;
        logSuccess(`Result: ${result}`, { tool: 'hover', result }, 'Tool');
        framework.logTestStep(stepDesc, 'hover', { selector, strategy, timeout }, result, true, screenshotPath ? [screenshotPath] : []);
        return `✅ ${result}`;
      } catch (error: any) {
        const screenshotPath = await framework.takeStepScreenshot(`Failed to hover ${selector}`);
        logError(`Result: Error hovering ${selector}: ${error.message}`, error instanceof Error ? error : undefined, { tool: 'hover', error: error.message }, 'Tool');
        framework.logTestStep(stepDesc, 'hover', { selector, strategy, timeout }, error.message, false, screenshotPath ? [screenshotPath] : []);
        return `❌ Error hovering ${selector}: ${error.message}`;
      }
    },
    {
      name: 'hover',
      description:
        'Hover the mouse over an element. Useful for triggering tooltips, dropdown menus, or hover effects.',
      schema: z.object({
        selector: z
          .string()
          .describe('Element selector to hover over'),
        strategy: z
          .enum(['css', 'text', 'role'])
          .optional()
          .describe('Selection strategy (default: "css")'),
        timeout: z
          .number()
          .optional()
          .describe('Timeout in milliseconds to wait for element (default: 45000)'),
      }),
    }
  );
}

/**
 * Creates a press key tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for pressing keyboard keys
 */
export function createPressKeyTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      key: string;
      selector?: string | undefined;
    }) => {
      const { key, selector } = params;
      const stepDesc = selector
        ? `Press key "${key}" on ${selector}`
        : `Press key "${key}"`;

      info(`${ICONS.tools} ${ICONS.keyboard} ${stepDesc}`, { tool: 'pressKey', params: { key, selector } }, 'Tool');

      try {
        const page = framework.currentPage!;

        if (selector) {
          const locator = page.locator(selector);
          const count = await locator.count();
          if (count === 0) {
            const result = `Element ${selector} not found on page`;
            logError(`Result: ${result}`, undefined, { tool: 'pressKey', error: result }, 'Tool');
            framework.logTestStep(stepDesc, 'pressKey', { key, selector }, result, false);
            return `❌ ${result}`;
          }
          await locator.first().press(key);
        } else {
          await page.keyboard.press(key);
        }

        // Wait briefly for key effects
        await page.waitForTimeout(200);
        const screenshotPath = await framework.takeStepScreenshot(`After pressing ${key}`);

        const result = selector
          ? `Successfully pressed "${key}" on ${selector}`
          : `Successfully pressed "${key}"`;
        logSuccess(`Result: ${result}`, { tool: 'pressKey', result }, 'Tool');
        framework.logTestStep(stepDesc, 'pressKey', { key, selector }, result, true, screenshotPath ? [screenshotPath] : []);
        return `✅ ${result}`;
      } catch (error: any) {
        logError(`Result: Error pressing key "${key}": ${error.message}`, error instanceof Error ? error : undefined, { tool: 'pressKey', error: error.message }, 'Tool');
        framework.logTestStep(stepDesc, 'pressKey', { key, selector }, error.message, false);
        return `❌ Error pressing key "${key}": ${error.message}`;
      }
    },
    {
      name: 'pressKey',
      description:
        'Press a key on the keyboard. Can target a specific element or press globally. Supports keys like "Enter", "Tab", "Escape", "ArrowDown", "Backspace", "Control+a", "Shift+Tab", etc.',
      schema: z.object({
        key: z
          .string()
          .describe('Key to press (e.g., "Enter", "Tab", "Escape", "ArrowDown", "Control+a", "Shift+Tab")'),
        selector: z
          .string()
          .optional()
          .describe('Optional CSS selector to focus before pressing the key'),
      }),
    }
  );
}

/**
 * Creates a select option tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for selecting dropdown options
 */
export function createSelectOptionTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      selector: string;
      value?: string | undefined;
      label?: string | undefined;
      index?: number | undefined;
      timeout?: number | undefined;
    }) => {
      const { selector, value, label, index } = params;
      const timeout = params.timeout ?? TIMEOUTS.ELEMENT_WAIT;
      const optionDesc = value ?? label ?? (index !== undefined ? `index ${index}` : 'unknown');
      const stepDesc = `Select option "${optionDesc}" in ${selector}`;

      info(`${ICONS.tools} ${stepDesc}`, { tool: 'selectOption', params: { selector, value, label, index, timeout } }, 'Tool');

      try {
        const page = framework.currentPage!;
        await page.waitForSelector(selector, { state: 'visible', timeout });
        const locator = page.locator(selector);

        let selectedValues: string[];

        if (value !== undefined) {
          selectedValues = await locator.selectOption({ value });
        } else if (label !== undefined) {
          selectedValues = await locator.selectOption({ label });
        } else if (index !== undefined) {
          selectedValues = await locator.selectOption({ index });
        } else {
          const result = 'Must provide one of: value, label, or index to select an option';
          logError(`Result: ${result}`, undefined, { tool: 'selectOption', error: result }, 'Tool');
          framework.logTestStep(stepDesc, 'selectOption', { selector, value, label, index }, result, false);
          return `❌ ${result}`;
        }

        const screenshotPath = await framework.takeStepScreenshot(`After selecting option in ${selector}`);
        const result = `Successfully selected option "${optionDesc}" in ${selector} (value: ${selectedValues.join(', ')})`;
        logSuccess(`Result: ${result}`, { tool: 'selectOption', result }, 'Tool');
        framework.logTestStep(stepDesc, 'selectOption', { selector, value, label, index }, result, true, screenshotPath ? [screenshotPath] : []);
        return `✅ ${result}`;
      } catch (error: any) {
        const screenshotPath = await framework.takeStepScreenshot(`Failed to select option in ${selector}`);
        logError(`Result: Error selecting option in ${selector}: ${error.message}`, error instanceof Error ? error : undefined, { tool: 'selectOption', error: error.message }, 'Tool');
        framework.logTestStep(stepDesc, 'selectOption', { selector, value, label, index }, error.message, false, screenshotPath ? [screenshotPath] : []);
        return `❌ Error selecting option in ${selector}: ${error.message}`;
      }
    },
    {
      name: 'selectOption',
      description:
        'Select an option in a <select> dropdown element. Provide one of: value (option value attribute), label (visible text), or index (zero-based position).',
      schema: z.object({
        selector: z
          .string()
          .describe('CSS selector of the <select> element'),
        value: z
          .string()
          .optional()
          .describe('Option value attribute to select'),
        label: z
          .string()
          .optional()
          .describe('Option visible text to select'),
        index: z
          .number()
          .optional()
          .describe('Zero-based index of the option to select'),
        timeout: z
          .number()
          .optional()
          .describe('Timeout in milliseconds to wait for the select element (default: 45000)'),
      }),
    }
  );
}

/**
 * Creates a drag tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for drag and drop
 */
export function createDragTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      sourceSelector: string;
      targetSelector: string;
      timeout?: number | undefined;
    }) => {
      const { sourceSelector, targetSelector } = params;
      const timeout = params.timeout ?? TIMEOUTS.ELEMENT_WAIT;
      const stepDesc = `Drag from ${sourceSelector} to ${targetSelector}`;

      info(`${ICONS.tools} ${stepDesc}`, { tool: 'drag', params: { sourceSelector, targetSelector, timeout } }, 'Tool');

      try {
        const page = framework.currentPage!;

        // Wait for both elements to be visible
        const sourceLocator = page.locator(sourceSelector).first();
        const targetLocator = page.locator(targetSelector).first();

        await sourceLocator.waitFor({ state: 'visible', timeout });
        await targetLocator.waitFor({ state: 'visible', timeout });

        // Perform drag and drop
        await sourceLocator.dragTo(targetLocator);

        // Wait for any animations
        await page.waitForTimeout(500);
        const screenshotPath = await framework.takeStepScreenshot(`After drag from ${sourceSelector} to ${targetSelector}`);

        const result = `Successfully dragged ${sourceSelector} to ${targetSelector}`;
        logSuccess(`Result: ${result}`, { tool: 'drag', result }, 'Tool');
        framework.logTestStep(stepDesc, 'drag', { sourceSelector, targetSelector, timeout }, result, true, screenshotPath ? [screenshotPath] : []);
        return `✅ ${result}`;
      } catch (error: any) {
        const screenshotPath = await framework.takeStepScreenshot(`Failed to drag`);
        logError(`Result: Error dragging ${sourceSelector} to ${targetSelector}: ${error.message}`, error instanceof Error ? error : undefined, { tool: 'drag', error: error.message }, 'Tool');
        framework.logTestStep(stepDesc, 'drag', { sourceSelector, targetSelector, timeout }, error.message, false, screenshotPath ? [screenshotPath] : []);
        return `❌ Error dragging ${sourceSelector} to ${targetSelector}: ${error.message}`;
      }
    },
    {
      name: 'drag',
      description:
        'Perform drag and drop between two elements. The source element will be dragged and dropped onto the target element.',
      schema: z.object({
        sourceSelector: z
          .string()
          .describe('CSS selector of the element to drag'),
        targetSelector: z
          .string()
          .describe('CSS selector of the drop target element'),
        timeout: z
          .number()
          .optional()
          .describe('Timeout in milliseconds to wait for elements (default: 45000)'),
      }),
    }
  );
}

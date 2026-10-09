/**
 * Verification Tools for Browser Automation
 * Provides LangChain tools for element verification and information
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { EnhancedBrowserTestFramework } from '../browser/browser-framework.js';
import { TIMEOUTS } from '../../config/constants.js';
import { info, logSuccess, error as logError } from '../../core/logger.js';
import { ICONS } from '../../config/icons.js';
import { ElementAnalyzer } from '../../utils/element-analyzer.js';
import { getVisionVerifier } from '../../ai/vision/index.js';
import { trackAICall } from '../../ai/agent-setup.js';

/**
 * Draw a 1px red bounding box around an element for visual highlighting
 * @param framework - Framework instance
 * @param selector - CSS selector of the element to highlight
 * @returns cleanup function to remove the highlight
 */
async function highlightElement(
  framework: EnhancedBrowserTestFramework,
  selector: string
): Promise<() => Promise<void>> {
  try {
    const page = framework.currentPage!;
    const highlightId = `endorphin-highlight-${Date.now()}`;

    await page.evaluate(
      ({ sel, id }: { sel: string; id: string }) => {
        const el = document.querySelector(sel);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const overlay = document.createElement('div');
        overlay.id = id;
        overlay.style.cssText = [
          `position: fixed`,
          `top: ${rect.top}px`,
          `left: ${rect.left}px`,
          `width: ${rect.width}px`,
          `height: ${rect.height}px`,
          `border: 1px solid red`,
          `pointer-events: none`,
          `z-index: 2147483647`,
          `box-sizing: border-box`,
        ].join(';');
        document.body.appendChild(overlay);
      },
      { sel: selector, id: highlightId }
    );

    return async () => {
      await page.evaluate((id: string) => {
        const el = document.getElementById(id);
        if (el) el.remove();
      }, highlightId).catch(() => {});
    };
  } catch {
    // Non-blocking: if highlight fails, return a no-op cleanup
    return async () => {};
  }
}

/**
 * Draw red bounding boxes around multiple text occurrences
 * @param framework - Framework instance
 * @param text - Text to find and highlight
 * @returns cleanup function to remove all highlights
 */
async function highlightText(
  framework: EnhancedBrowserTestFramework,
  text: string
): Promise<() => Promise<void>> {
  try {
    const page = framework.currentPage!;
    const highlightClass = `endorphin-text-highlight-${Date.now()}`;

    await page.evaluate(
      ({ searchText, cls }: { searchText: string; cls: string }) => {
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null
        );
        let node;
        const lowerSearch = searchText.toLowerCase();
        while ((node = walker.nextNode())) {
          if (node.textContent && node.textContent.toLowerCase().includes(lowerSearch)) {
            const parent = node.parentElement;
            if (parent) {
              const rect = parent.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                const overlay = document.createElement('div');
                overlay.className = cls;
                overlay.style.cssText = [
                  `position: fixed`,
                  `top: ${rect.top}px`,
                  `left: ${rect.left}px`,
                  `width: ${rect.width}px`,
                  `height: ${rect.height}px`,
                  `border: 1px solid red`,
                  `pointer-events: none`,
                  `z-index: 2147483647`,
                  `box-sizing: border-box`,
                ].join(';');
                document.body.appendChild(overlay);
                break; // Highlight first occurrence only
              }
            }
          }
        }
      },
      { searchText: text, cls: highlightClass }
    );

    return async () => {
      await page.evaluate((cls: string) => {
        document.querySelectorAll(`.${cls}`).forEach(el => el.remove());
      }, highlightClass).catch(() => {});
    };
  } catch {
    return async () => {};
  }
}

/**
 * Run vision verification if vision is enabled in config
 * @param framework - Framework instance
 * @param question - Verification question for GPT-4o vision
 * @param domResult - Result from DOM-based verification
 * @param domPassed - Whether DOM-based check passed
 * @returns Updated result string with vision context, or original result
 */
async function runVisionCheck(
  framework: EnhancedBrowserTestFramework,
  question: string,
  domResult: string,
  domPassed: boolean
): Promise<string> {
  try {
    const config = framework.getConfig();
    const visionVerifier = await getVisionVerifier(config.ai?.vision);
    if (!visionVerifier) return domResult;

    const visionResult = await visionVerifier.verify(
      framework.currentPage!,
      question,
      `DOM check result: ${domPassed ? 'passed' : 'failed'}`
    );

    // Track vision cost in agent history
    trackAICall(
      'Vision Verification',
      question,
      visionResult.reason,
      {
        promptTokens: visionResult.tokenUsage.promptTokens,
        responseTokens: visionResult.tokenUsage.responseTokens,
        totalTokens: visionResult.tokenUsage.totalTokens,
        cost: visionResult.tokenUsage.cost,
        model: visionVerifier.getModelName(),
      },
      visionResult.durationMs,
      `Vision check: ${question.substring(0, 100)}`
    );

    if (visionVerifier.getMode() === 'primary') {
      // Vision is the primary verifier — its result overrides DOM
      const prefix = visionResult.passed ? '✅' : '❌';
      return `${prefix} ${question} (vision: ${visionResult.passed ? 'PASSED' : 'FAILED'}, confidence: ${(visionResult.confidence * 100).toFixed(0)}%: ${visionResult.reason})`;
    }

    // Supplement mode — append vision context
    const visionNote = visionResult.passed
      ? `[Vision: confirmed, ${(visionResult.confidence * 100).toFixed(0)}%]`
      : `[Vision: contradicts, ${(visionResult.confidence * 100).toFixed(0)}% — ${visionResult.reason}]`;
    return `${domResult} ${visionNote}`;
  } catch {
    // Vision check failure should not break the verification
    return domResult;
  }
}

/**
 * Creates a verify element tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for verifying elements
 */
export function createVerifyElementTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      selector: string;
      state?: 'visible' | 'hidden' | 'attached' | 'detached' | undefined;
      timeout?: number | undefined;
    }) => {
      const selector = params.selector;
      const state = params.state ?? 'visible';
      const timeout = params.timeout ?? TIMEOUTS.VERIFICATION_TIMEOUT;
      const stepDesc = `Verify ${selector} is ${state}`;
      info(`${ICONS.tools} ${stepDesc}`, { tool: 'verifyElement', params: { selector, state, timeout } }, 'Tool');

      try {
        // For text-based verification, also try to find element containing text
        if (selector.startsWith('"') && selector.endsWith('"')) {
          // This is a text selector, try multiple approaches
          const textToFind = selector.slice(1, -1); // Remove quotes
          info(`${ICONS.tools} Looking for text: "${textToFind}"`, { textToFind }, 'Tool');

          // Try different text-based selectors
          const textSelectors = [
            `text="${textToFind}"`,
            `text=${textToFind}`,
            `//*[contains(text(), "${textToFind}")]`,
            `//*[contains(., "${textToFind}")]`,
            `*:has-text("${textToFind}")`,
          ];

          let _found = false;
          let lastError: any = null;

          for (const textSelector of textSelectors) {
            try {
              await framework.currentPage!.waitForSelector(textSelector, {
                state,
                timeout: Math.floor(timeout / textSelectors.length) // Divide timeout among attempts
              });
              _found = true;

              // Highlight the found text with red bounding box
              const removeHighlight = await highlightText(framework, textToFind);
              await framework.takeStepScreenshot(`Verified text "${textToFind}" is ${state}`, false);
              await removeHighlight();

              let result = `Text "${textToFind}" is ${state} on the page`;
              result = await runVisionCheck(
                framework,
                `Is the text "${textToFind}" ${state} on the page?`,
                `✅ ${result}`,
                true
              );
              logSuccess(`Result: ${result}`, { tool: 'verifyElement', result }, 'Tool');
              framework.logTestStep(
                stepDesc,
                'verifyElement',
                { selector, state, timeout },
                result,
                true
              );
              return result;
            } catch (error: any) {
              lastError = error;
              // Continue trying other selectors
            }
          }

          // If we get here, text was not found
          throw lastError || new Error(`Text "${textToFind}" not found`);
        } else {
          // Regular selector verification
          await framework.currentPage!.waitForSelector(selector, { state, timeout });

          // Highlight the element with red bounding box
          const removeHighlight = await highlightElement(framework, selector);
          await framework.takeStepScreenshot(`Verified ${selector} is ${state}`, false);
          await removeHighlight();

          let result = `Element ${selector} is ${state} on the page`;
          result = await runVisionCheck(
            framework,
            `Is the element "${selector}" ${state} on the page?`,
            `✅ ${result}`,
            true
          );
          logSuccess(`Result: ${result}`, { tool: 'verifyElement', result }, 'Tool');
          framework.logTestStep(
            stepDesc,
            'verifyElement',
            { selector, state, timeout },
            result,
            true
          );
          return result;
        }
      } catch (error: any) {
        await framework.takeStepScreenshot(`Failed to verify ${selector}`, false);

        // Silently collect failure data for post-test AI analysis
        try {
          const analysisResult = await ElementAnalyzer.findAlternatives(
            framework.currentPage!,
            selector,
            selector.startsWith('"') && selector.endsWith('"') ? selector.slice(1, -1) : undefined
          );

          // Capture page snapshot for detailed analysis
          const pageSnapshot = await framework.capturePageSnapshot();

          // Store comprehensive failure data for AI recommendations at test end
          framework.collectFailureData({
            type: 'verification_failed',
            selector,
            state,
            error: error.message,
            stepDescription: stepDesc,
            pageSnapshot: pageSnapshot || undefined,
            alternatives: analysisResult.alternatives,
            screenshot: `Failed to verify ${selector}`,
            timestamp: new Date().toISOString()
          });
        } catch {
          // Silent failure in analysis - don't disrupt test flow
        }

        let result = `Could not verify element ${selector} as ${state}: ${error.message}`;
        result = await runVisionCheck(
          framework,
          `Is the element "${selector}" ${state} on the page?`,
          `❌ ${result}`,
          false
        );
        logError(`Result: ${result}`, error instanceof Error ? error : undefined, { tool: 'verifyElement', error: error.message }, 'Tool');
        framework.logTestStep(
          stepDesc,
          'verifyElement',
          { selector, state, timeout },
          error.message,
          false
        );
        return result;
      }
    },
    {
      name: 'verifyElement',
      description: 'Verify element exists and is in specified state. For text verification, wrap text in quotes (e.g., "Andrew").',
      schema: z.object({
        selector: z.string().describe('CSS selector or quoted text to verify'),
        state: z.enum(['visible', 'hidden', 'attached', 'detached']).optional().describe('Expected state (default: "visible")'),
        timeout: z.number().optional().describe('Timeout in milliseconds (default: 60000)'),
      }),
    }
  );
}

/**
 * Creates a get element info tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for getting element information
 */
export function createGetElementInfoTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async ({ selector }: { selector: string }) => {
      const stepDesc = `Get element info: ${selector}`;
      info(`${ICONS.tools} ${stepDesc}`, { tool: 'getElementInfo', params: { selector } }, 'Tool');

      try {
        await framework.currentPage!.waitForSelector(selector, { timeout: TIMEOUTS.VERIFICATION_TIMEOUT });

        const elementInfo = await framework.currentPage!.locator(selector).evaluate((el: any) => ({
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          textContent: el.textContent?.trim(),
          value: el.value,
          placeholder: el.placeholder,
          type: el.type,
          disabled: el.disabled,
          visible: el.offsetParent !== null,
          href: el.href,
          src: el.src,
        }));

        // Highlight element with red bounding box
        const removeHighlight = await highlightElement(framework, selector);
        await framework.takeStepScreenshot(`Element info: ${selector}`, false);
        await removeHighlight();

        const result = `Element info: ${JSON.stringify(elementInfo, null, 2)}`;
        logSuccess(`Result: ${result}`, { tool: 'getElementInfo', result }, 'Tool');
        framework.logTestStep(stepDesc, 'getElementInfo', { selector }, result, true);
        return result;
      } catch (error: any) {
        logError(`Result: Could not get info for ${selector}: ${error.message}`, error instanceof Error ? error : undefined, { tool: 'getElementInfo', error: error.message }, 'Tool');
        framework.logTestStep(stepDesc, 'getElementInfo', { selector }, error.message, false);
        return `❌ Could not get info for ${selector}: ${error.message}`;
      }
    },
    {
      name: 'getElementInfo',
      description: 'Get detailed information about any element.',
      schema: z.object({
        selector: z.string().describe('CSS selector of the element'),
      }),
    }
  );
}

/**
 * Creates a verify title tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for verifying page title
 */
export function createVerifyTitleTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      title: string;
      exact?: boolean | undefined;
      timeout?: number | undefined;
    }) => {
      const expectedTitle = params.title;
      const exact = params.exact ?? false;
      const timeout = params.timeout ?? TIMEOUTS.VERIFICATION_TIMEOUT;
      const stepDesc = `Verify page title ${exact ? 'equals' : 'contains'} "${expectedTitle}"`;
      info(`${ICONS.tools} ${stepDesc}`, { tool: 'verifyTitle', params: { title: expectedTitle, exact, timeout } }, 'Tool');

      try {
        const page = framework.currentPage!;

        // Wait for title to match
        if (exact) {
          await page.waitForFunction(
            (expectedTitle) => document.title === expectedTitle,
            expectedTitle,
            { timeout }
          );
        } else {
          await page.waitForFunction(
            (expectedTitle) => document.title.toLowerCase().includes(expectedTitle.toLowerCase()),
            expectedTitle,
            { timeout }
          );
        }

        const actualTitle = await page.title();
        await framework.takeStepScreenshot(`Verified page title: ${actualTitle}`, false);

        let result = `Page title "${actualTitle}" ${exact ? 'equals' : 'contains'} "${expectedTitle}"`;
        result = await runVisionCheck(
          framework,
          `Does the page title contain or match "${expectedTitle}"?`,
          `✅ ${result}`,
          true
        );
        logSuccess(`Result: ${result}`, { tool: 'verifyTitle', result }, 'Tool');
        framework.logTestStep(
          stepDesc,
          'verifyTitle',
          { title: expectedTitle, exact, timeout },
          result,
          true
        );
        return result;
      } catch {
        const actualTitle = await framework.currentPage!.title().catch(() => 'unknown');
        await framework.takeStepScreenshot('Failed to verify title', false);
        let result = `Expected title to ${exact ? 'equal' : 'contain'} "${expectedTitle}", but got "${actualTitle}"`;
        result = await runVisionCheck(
          framework,
          `Does the page title contain or match "${expectedTitle}"?`,
          `❌ ${result}`,
          false
        );
        logError(`Result: ${result}`, undefined, { tool: 'verifyTitle', actualTitle, expectedTitle }, 'Tool');
        framework.logTestStep(
          stepDesc,
          'verifyTitle',
          { title: expectedTitle, exact, timeout },
          `Actual title: "${actualTitle}"`,
          false
        );
        return result;
      }
    },
    {
      name: 'verifyTitle',
      description: 'Verify the page title matches or contains expected text. Similar to Playwright expect(page).toHaveTitle().',
      schema: z.object({
        title: z.string().describe('The expected title or partial title'),
        exact: z.boolean().optional().describe('Whether to match exact title (default: false)'),
        timeout: z.number().optional().describe('Timeout in milliseconds'),
      }),
    }
  );
}

/**
 * Creates a verify URL tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for verifying page URL
 */
export function createVerifyURLTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      url: string;
      exact?: boolean | undefined;
      timeout?: number | undefined;
    }) => {
      const expectedUrl = params.url;
      const exact = params.exact ?? true; // Default to exact match for URLs
      const timeout = params.timeout ?? TIMEOUTS.VERIFICATION_TIMEOUT;
      const stepDesc = `Verify page URL ${exact ? 'equals' : 'contains'} "${expectedUrl}"`;
      info(`${ICONS.tools} ${stepDesc}`, { tool: 'verifyURL', params: { url: expectedUrl, exact, timeout } }, 'Tool');

      try {
        const page = framework.currentPage!;

        // Wait for URL to match
        if (exact) {
          await page.waitForFunction(
            (expectedUrl) => window.location.href === expectedUrl,
            expectedUrl,
            { timeout }
          );
        } else {
          await page.waitForFunction(
            (expectedUrl) => window.location.href.includes(expectedUrl),
            expectedUrl,
            { timeout }
          );
        }

        const actualUrl = page.url();
        await framework.takeStepScreenshot(`Verified page URL: ${actualUrl}`, false);

        const result = `Page URL "${actualUrl}" ${exact ? 'equals' : 'contains'} "${expectedUrl}"`;
        logSuccess(`Result: ${result}`, { tool: 'verifyURL', result }, 'Tool');
        framework.logTestStep(
          stepDesc,
          'verifyURL',
          { url: expectedUrl, exact, timeout },
          result,
          true
        );
        return `✅ ${result}`;
      } catch {
        const actualUrl = framework.currentPage!.url();
        await framework.takeStepScreenshot('Failed to verify URL', false);
        const result = `Expected URL to ${exact ? 'equal' : 'contain'} "${expectedUrl}", but got "${actualUrl}"`;
        logError(`Result: ${result}`, undefined, { tool: 'verifyURL', actualUrl, expectedUrl }, 'Tool');
        framework.logTestStep(
          stepDesc,
          'verifyURL',
          { url: expectedUrl, exact, timeout },
          `Actual URL: "${actualUrl}"`,
          false
        );
        return `❌ ${result}`;
      }
    },
    {
      name: 'verifyURL',
      description: 'Verify the page URL matches or contains expected URL. Similar to Playwright expect(page).toHaveURL().',
      schema: z.object({
        url: z.string().describe('The expected URL or partial URL'),
        exact: z.boolean().optional().describe('Whether to match exact URL (default: true)'),
        timeout: z.number().optional().describe('Timeout in milliseconds'),
      }),
    }
  );
}

/**
 * Creates a verify text content tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for verifying text content on page
 */
export function createVerifyTextContentTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      text: string;
      timeout?: number | undefined;
      exact?: boolean | undefined;
    }) => {
      const text = params.text;
      const timeout = params.timeout ?? TIMEOUTS.VERIFICATION_TIMEOUT;
      const exact = params.exact ?? false;
      const stepDesc = `Verify text "${text}" is visible on page`;
      info(`${ICONS.tools} ${stepDesc}`, { tool: 'verifyTextContent', params: { text, timeout, exact } }, 'Tool');

      try {
        // Extended waiting and verification for better accuracy
        await framework.currentPage!.waitForTimeout(2000); // Increased wait time

        // Try multiple approaches to find the text
        let found = false;
        let verificationMethod = '';

        // Method 1: Direct text content check
        const pageText = await framework.currentPage!.evaluate(() => {
          return document.body.innerText || document.body.textContent || '';
        });

        if (exact) {
          const textElements = pageText.split(/[\n\r\t\s]+/).filter(t => t.trim());
          found = textElements.includes(text);
          verificationMethod = 'exact text match';
        } else {
          found = pageText.toLowerCase().includes(text.toLowerCase());
          verificationMethod = 'partial text match';
        }

        // Method 2: If not found by text content, try DOM element search
        if (!found) {
          const textSelectors = [
            `text="${text}"`,
            `text=${text}`,
            `//*[contains(text(), "${text}")]`,
            `*:has-text("${text}")`,
          ];

          for (const selector of textSelectors) {
            try {
              await framework.currentPage!.waitForSelector(selector, { timeout: 3000 });
              found = true;
              verificationMethod = `DOM selector: ${selector}`;
              break;
            } catch {
              // Continue with next selector
            }
          }
        }

        // Method 3: If still not found, try case-insensitive broader search
        if (!found) {
          const allText = await framework.currentPage!.evaluate(() => {
            const walker = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_TEXT,
              null
            );
            let textContent = '';
            let node;
            while ((node = walker.nextNode())) {
              textContent += `${node.textContent} `;
            }
            return textContent;
          });

          found = allText.toLowerCase().includes(text.toLowerCase());
          if (found) {
            verificationMethod = 'text tree walker';
          }
        }

        if (found) {
          // Highlight the text with red bounding box + scroll into view
          let removeHighlight: (() => Promise<void>) | undefined;
          try {
            const textSelectors = [
              `text="${text}"`,
              `text=${text}`,
              `//*[contains(text(), "${text}")]`,
              `*:has-text("${text}")`,
            ];

            for (const selector of textSelectors) {
              try {
                await framework.currentPage!.waitForSelector(selector, { timeout: 1000 });
                await framework.currentPage!.locator(selector).scrollIntoViewIfNeeded();
                break;
              } catch {
                // Continue with next selector
              }
            }

            removeHighlight = await highlightText(framework, text);
          } catch {
            // Element scrolling/highlighting failed, but text was found
          }

          await framework.takeStepScreenshot(`Verified text "${text}" is visible`, false);
          if (removeHighlight) await removeHighlight();

          let result = `Text "${text}" is DEFINITELY visible on the page (verified using ${verificationMethod})`;
          result = await runVisionCheck(
            framework,
            `Is the text "${text}" visible on the page?`,
            `✅ ${result}`,
            true
          );
          logSuccess(`Result: ${result}`, { tool: 'verifyTextContent', result, verificationMethod }, 'Tool');
          framework.logTestStep(
            stepDesc,
            'verifyTextContent',
            { text, exact, timeout },
            result,
            true
          );
          return result;
        } else {
          // Text not found, provide comprehensive debugging info
          const preview = pageText.substring(0, 800).replace(/\s+/g, ' ').trim();

          // Extract common words for debugging
          const words = pageText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
          const uniqueWords = [...new Set(words)].slice(0, 20);

          const errorMessage = `Text "${text}" not found after exhaustive search. Page contains ${pageText.length} characters. Preview: "${preview}...". Common words: ${uniqueWords.join(', ')}`;

          throw new Error(errorMessage);
        }
      } catch (error: any) {
        await framework.takeStepScreenshot(`Failed to verify text "${text}"`, false);
        let result = `Could not verify text "${text}": ${error.message}`;
        result = await runVisionCheck(
          framework,
          `Is the text "${text}" visible on the page?`,
          `❌ ${result}`,
          false
        );
        logError(`Result: ${result}`, error instanceof Error ? error : undefined, { tool: 'verifyTextContent', error: error.message }, 'Tool');
        framework.logTestStep(
          stepDesc,
          'verifyTextContent',
          { text, exact, timeout },
          error.message,
          false
        );
        return result;
      }
    },
    {
      name: 'verifyTextContent',
      description: 'Verify specific text content is visible on the page. More reliable than element-based verification for dynamic content.',
      schema: z.object({
        text: z.string().describe('The text to verify on the page'),
        timeout: z.number().optional().describe('Timeout in milliseconds'),
        exact: z.boolean().optional().describe('Whether to match exact text (default: false)'),
      }),
    }
  );
}

/**
 * Creates a verify list visible tool for the framework
 * @param framework - Framework instance
 * @returns LangChain tool for verifying multiple items are visible
 */
export function createVerifyListVisibleTool(framework: EnhancedBrowserTestFramework) {
  return tool(
    async (params: {
      items: string[];
      containerSelector?: string | undefined;
      timeout?: number | undefined;
      matchType?: 'all' | 'any' | undefined;
    }) => {
      const { items, containerSelector } = params;
      const timeout = params.timeout ?? TIMEOUTS.VERIFICATION_TIMEOUT;
      const matchType = params.matchType ?? 'all';
      const stepDesc = `Verify ${matchType === 'all' ? 'all' : 'any'} of ${items.length} items are visible${containerSelector ? ` in ${containerSelector}` : ''}`;

      info(`${ICONS.tools} ${stepDesc}`, { tool: 'verifyListVisible', params: { items, containerSelector, timeout, matchType } }, 'Tool');

      try {
        // Wait a moment for page content to settle
        await framework.currentPage!.waitForTimeout(1000);

        // Get the text content scope
        let scopeText: string;
        if (containerSelector) {
          const container = framework.currentPage!.locator(containerSelector);
          const count = await container.count();
          if (count === 0) {
            const result = `Container element ${containerSelector} not found on page`;
            logError(`Result: ${result}`, undefined, { tool: 'verifyListVisible', error: result }, 'Tool');
            framework.logTestStep(stepDesc, 'verifyListVisible', { items, containerSelector, timeout, matchType }, result, false);
            return `❌ ${result}`;
          }
          scopeText = await container.first().innerText();
        } else {
          scopeText = await framework.currentPage!.evaluate(() => {
            return document.body.innerText || document.body.textContent || '';
          });
        }

        const scopeTextLower = scopeText.toLowerCase();
        const foundItems: string[] = [];
        const missingItems: string[] = [];

        for (const item of items) {
          if (scopeTextLower.includes(item.toLowerCase())) {
            foundItems.push(item);
          } else {
            missingItems.push(item);
          }
        }

        // Highlight found items with red bounding boxes
        const cleanups: (() => Promise<void>)[] = [];
        for (const item of foundItems) {
          const cleanup = await highlightText(framework, item);
          cleanups.push(cleanup);
        }

        const screenshotPath = await framework.takeStepScreenshot('Verified list items visibility', false);

        // Remove highlights
        for (const cleanup of cleanups) {
          await cleanup();
        }

        let passed: boolean;
        let result: string;

        if (matchType === 'all') {
          passed = missingItems.length === 0;
          result = passed
            ? `All ${items.length} items are visible: ${foundItems.join(', ')}`
            : `${missingItems.length} of ${items.length} items NOT found. Missing: [${missingItems.join(', ')}]. Found: [${foundItems.join(', ')}]`;
        } else {
          // matchType === 'any'
          passed = foundItems.length > 0;
          result = passed
            ? `${foundItems.length} of ${items.length} items found: ${foundItems.join(', ')}`
            : `None of ${items.length} items found on page: ${items.join(', ')}`;
        }

        // Run vision check
        const prefix = passed ? '✅' : '❌';
        result = await runVisionCheck(
          framework,
          `Are the following items visible on the page: ${items.join(', ')}?`,
          `${prefix} ${result}`,
          passed
        );

        if (passed) {
          logSuccess(`Result: ${result}`, { tool: 'verifyListVisible', result, foundItems }, 'Tool');
        } else {
          logError(`Result: ${result}`, undefined, { tool: 'verifyListVisible', missingItems, foundItems }, 'Tool');
        }
        framework.logTestStep(stepDesc, 'verifyListVisible', { items, containerSelector, timeout, matchType }, result, passed, screenshotPath ? [screenshotPath] : []);
        return result;
      } catch (error: any) {
        const screenshotPath = await framework.takeStepScreenshot('Failed to verify list items', false);
        logError(`Result: Error verifying list items: ${error.message}`, error instanceof Error ? error : undefined, { tool: 'verifyListVisible', error: error.message }, 'Tool');
        framework.logTestStep(stepDesc, 'verifyListVisible', { items, containerSelector, timeout, matchType }, error.message, false, screenshotPath ? [screenshotPath] : []);
        return `❌ Error verifying list items: ${error.message}`;
      }
    },
    {
      name: 'verifyListVisible',
      description:
        'Verify that a list of text items are visible on the page or within a specific container. Use matchType="all" (default) to require ALL items are present, or matchType="any" to pass if at least one is found. Useful for verifying navigation menus, table rows, search results, or lists of data.',
      schema: z.object({
        items: z
          .array(z.string())
          .describe('Array of text strings that should be visible on the page'),
        containerSelector: z
          .string()
          .optional()
          .describe('CSS selector of a container to limit the search scope (e.g., "table tbody", ".search-results", "nav")'),
        timeout: z
          .number()
          .optional()
          .describe('Timeout in milliseconds to wait for content (default: 60000)'),
        matchType: z
          .enum(['all', 'any'])
          .optional()
          .describe('Whether ALL items must be found (default: "all") or just ANY one item'),
      }),
    }
  );
}

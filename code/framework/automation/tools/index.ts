/**
 * Browser Automation Tools Collection
 * Provides all LangChain tools for browser automation
 */

import { createGetPageContentTool } from './content.js';
import {
  createClearFieldTool,
  createClickTool,
  createFillTool,
  createDescribeTool,
  createPressSequentiallyTool,
  createHoverTool,
  createPressKeyTool,
  createSelectOptionTool,
  createDragTool,
} from './interaction.js';
import { createNavigationTool, createNavigateBackTool } from './navigation.js';
import { createScreenshotTool, createWaitTool, createResizeTool } from './utilities.js';
import { createScrollTool } from './scroll.js';
import { createFileUploadTool } from './file-upload.js';
import { createEvaluateTool } from './evaluate.js';
import { createNetworkRequestsTool } from './network.js';
import { createTabsTool } from './tabs.js';
import {
  createGetElementInfoTool,
  createVerifyElementTool,
  createVerifyTextContentTool,
  createVerifyTitleTool,
  createVerifyURLTool,
  createVerifyListVisibleTool,
} from './verification.js';
import { info } from '../../core/logger.js';
import { ICONS } from '../../config/icons.js';

/**
 * Create all browser automation tools for the framework
 * @param framework - Framework instance
 * @returns Array of all configured LangChain tools
 */
export function createAllTools(framework: any): any[] {
  // Built-in browser automation tools
  const builtInTools = [
    // Navigation tools
    createNavigationTool(framework),
    createNavigateBackTool(framework),

    // Content analysis tools
    createGetPageContentTool(framework), // Raw HTML content (for CSS classes, data attributes, IDs not in accessibility tree)

    // Interaction tools
    createClickTool(framework),
    createFillTool(framework),
    createClearFieldTool(framework),
    createDescribeTool(framework),
    createPressSequentiallyTool(framework),
    createHoverTool(framework),
    createPressKeyTool(framework),
    createSelectOptionTool(framework),
    createDragTool(framework),

    // Scroll tool
    createScrollTool(framework),

    // File upload tool
    createFileUploadTool(framework),

    // Evaluate tool
    createEvaluateTool(framework),

    // Network inspection tool
    createNetworkRequestsTool(framework),

    // Tab management tool
    createTabsTool(framework),

    // Verification tools
    createVerifyElementTool(framework),
    createGetElementInfoTool(framework),
    createVerifyTextContentTool(framework),
    createVerifyTitleTool(framework),
    createVerifyURLTool(framework),
    createVerifyListVisibleTool(framework),

    // Utility tools
    createWaitTool(framework),
    createScreenshotTool(framework),
    createResizeTool(framework),
  ];

  info(`${ICONS.tools} Total built-in tools available: ${builtInTools.length}`, { toolCount: builtInTools.length }, 'Tool');

  return builtInTools;
}

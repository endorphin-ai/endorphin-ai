/**
 * Endorphin AI Framework - Main Entry Point
 * Copyright (C) 2025 Redstudio Agency
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 */

// Core framework exports
export { setupAgent } from './ai/agent-setup.js';
export { EnhancedBrowserTestFramework } from './automation/browser/browser-framework.js';
export { TestFramework } from './core/test-framework.js';
export { TestManager } from './core/test-manager.js';
export { createTestSession, generateSessionSummary, saveTestSession } from './core/test-session.js';
export { TokenTracker } from './core/token-tracker.js';
export { runTask, runTaskSequence } from './execution/tasks/task-executor.js';
export { createAllTools } from './automation/tools/index.js';

// Service managers for advanced usage
export { BrowserManager } from './automation/browser/browser-manager.js';
export { ConfigManager } from './core/config-manager.js';
export { SessionManager } from './core/session-manager.js';
export { ToolManager } from './core/tool-manager.js';

// Dependency injection system
export {
  createContainer,
  DependencyContainer,
  globalContainer,
  Inject,
  Injectable,
  ServiceLifetime,
} from './core/dependency-container.js';
export {
  createServiceRegistry,
  registerFrameworkServices,
  SERVICE_NAMES,
  ServiceRegistry,
} from './core/service-registry.js';
export { TestFrameworkDI } from './core/test-framework-di.js';

// Configuration exports
export { AGENT_CONFIG } from './ai/config/agent-config.js';
export { BROWSER_CONFIG } from './automation/config/browser-config.js';
export { PATHS } from './config/paths.js';

// Reporters and Results
export { ConsoleReporter } from './reporters/console-reporter.js';
export { HtmlReporter } from './reporters/html-reporter.js';
export { TestResultsManager } from './results/test-results-manager.js';
export { TestResultsParser } from './results/test-results-parser.js';

// Test Recorder
export { runInteractiveRecorder, TestRecorder } from './test-recorder/index.js';

// CLI
export { initProject } from './cli/init-command.js';

// Utilities
export { generateData, generateDataArray } from './utils/index.js';
export { getPage, getCurrentUserId, getUserIds, isMultiUserMode } from './utils/user-utils.js';

// Individual tool creators for custom setups
export { createGetPageContentTool } from './automation/tools/content.js';
export { 
  createClearFieldTool, 
  createClickTool, 
  createFillTool, 
  createDescribeTool, 
  createPressSequentiallyTool 
} from './automation/tools/interaction.js';
export { createNavigationTool } from './automation/tools/navigation.js';
export { createScreenshotTool, createWaitTool } from './automation/tools/utilities.js';
export { createGetElementInfoTool, createVerifyElementTool } from './automation/tools/verification.js';

// Page snapshot system
export { PageSnapshotManager } from './managers/content/snapshot-manager.js';
export type { PageDelta, PageSnapshot } from './content/types/snapshot-types.js';

// Type exports
export type * from './types/index.js';

// Default export for simple usage: import EndorphinAI from 'endorphin-ai'
import { TestFramework } from './core/test-framework.js';
export default TestFramework;

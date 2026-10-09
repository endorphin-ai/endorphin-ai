/**
 * Main type exports for Endorphin AI Framework
 * Re-exports all types from individual modules
 */

// Agent and AI types
export type { AIConfig, BrowserTool, LangChainTool, ToolCall, ToolParams } from './agent.js';

// Browser types
export type {
  BrowserConfig,
  BrowserTools,
  ClickParams,
  FillParams,
  NavigateParams,
  Screenshot,
  ScreenshotParams,
  ViewportSize,
} from './browser.js';

// CLI types
export type { CLIFlags } from './cli.js';

// Configuration types
export type {
  ExecutionConfig,
  FrameworkConfig,
  GlobalSetupFunction,
  GlobalSetupModule,
  GlobalSetupResult,
  ResultsConfig,
} from './config.js';

// Error types
export { BrowserError, ConfigurationError, FrameworkError, TestExecutionError } from './errors.js';

// Recorder types
export type {
  RecorderCommand,
  RecorderSession,
  CreateSessionParams,
  CreateSessionResult,
  AddStepParams,
  AddStepResult,
  GenerateTestParams,
  GenerateTestResult,
  SessionStatusInfo,
  ListSessionsResult,
  RecorderSessionState,
} from './recorder.js';

// Reporter types
export type { ReportOptions, TestReport, TestSummary } from './reporter.js';

// Test types
export type {
  DataGenerationResult,
  DiscoveryResult,
  NaturalLanguageResult,
  TaskResult,
  TestCase,
  TestConfig,
  TestDataFunction,
  TestResult,
  TestSession,
  TestSetupFunction,
  TestSetupResult,
  TestStep,
  TestTaskFunction,
  TestTasksFunction,
} from './test.js';

// Accessibility types
export type {
  AccessibilityNode,
  AccessibilitySnapshot,
  DiffEntry,
  InteractiveElement,
  InjectionResult,
  NodeIdentity,
  PageContextInjectorConfig,
  TreeDiffResult,
} from './accessibility.js';

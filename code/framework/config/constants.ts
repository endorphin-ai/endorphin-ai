/**
 * Framework Constants
 * Centralized constants to replace magic numbers throughout the codebase
 */

// Timeout configurations (in milliseconds)
export const TIMEOUTS = {
  DEFAULT_WAIT: 2000,
  LONG_WAIT: 5000,
  ELEMENT_WAIT: 45000, // Extended from 30s to 45s for verification operations
  PAGE_LOAD: 60000,
  AGENT_TIMEOUT: 900000, // 15 minutes - allow more time for step-by-step execution
  NETWORK_TIMEOUT: 30000,
  FILE_OPERATION_TIMEOUT: 10000,
  SCREENSHOT_TIMEOUT: 5000,
  STEP_DELAY: 1000,
  VERIFICATION_TIMEOUT: 60000, // New: 60 seconds specifically for verification operations
} as const;

// Resource limits
export const LIMITS = {
  MAX_CONTENT_LENGTH: 8000,
  MAX_SNAPSHOTS: 50,
  MAX_TOKENS: 8000,
  MAX_SCREENSHOTS: 100,
  MAX_SESSION_DURATION: 3600000, // 1 hour
  MAX_CONCURRENT_TESTS: 10,
  MAX_FILE_SIZE: 10485760, // 10MB
  MAX_ERROR_STACK_DEPTH: 20,
} as const;

// Common CSS selectors
export const SELECTORS = {
  EMAIL_INPUTS: 'input[type="email"], input[name*="email"], input[id*="email"], #email',
  PASSWORD_INPUTS:
    'input[type="password"], input[name*="password"], input[id*="password"], #password',
  USERNAME_INPUTS: 'input[name*="username"], input[id*="username"], #username',
  SUBMIT_BUTTONS:
    'button[type="submit"], input[type="submit"], button:has-text("Log"), button:has-text("Sign")',
  FORM_ELEMENTS: 'form, [role="form"]',
  NAVIGATION_LINKS: 'a, [role="link"]',
  BUTTONS: 'button, [role="button"], input[type="button"]',
  TEXT_INPUTS: 'input[type="text"], input:not([type]), textarea',
  CLICKABLE_ELEMENTS:
    'a, button, [role="button"], [role="link"], input[type="submit"], input[type="button"]',
} as const;

// Content optimization thresholds
export const CONTENT_LIMITS = {
  MIN_TEXT_LENGTH: 10,
  MAX_TEXT_LENGTH: 1000,
  MAX_ELEMENTS_PER_TYPE: 20,
  MAX_NAVIGATION_ITEMS: 15,
  MAX_FORM_FIELDS: 25,
  TOKEN_ESTIMATION_RATIO: 4, // 1 token ≈ 4 characters
  OPTIMIZATION_THRESHOLD: 0.7, // 70% content reduction target
} as const;

// Snapshot and memory management
export const SNAPSHOT_CONFIG = {
  MAX_SNAPSHOTS: 50,
  MAX_AGE: 300000, // 5 minutes
  CLEANUP_INTERVAL: 60000, // 1 minute
  MAX_SNAPSHOT_SIZE: 1048576, // 1MB
  RETENTION_POLICY: 'lru', // least recently used
} as const;

// Logging levels and formats
export const LOGGING = {
  LEVELS: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  },
  MAX_LOG_LENGTH: 1000,
  MAX_CONTEXT_SIZE: 500,
} as const;

// Network and API configuration
export const NETWORK = {
  MAX_REDIRECTS: 5,
  USER_AGENT: 'Endorphin-AI-Framework/0.8.0',
  DEFAULT_HEADERS: {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
  },
} as const;

// Test execution configuration
export const TEST_EXECUTION = {
  DEFAULT_PRIORITY: 'medium',
  VALID_PRIORITIES: ['low', 'medium', 'high', 'critical'] as const,
  VALID_STATUSES: ['pending', 'running', 'passed', 'failed', 'skipped'] as const,
  MAX_TEST_NAME_LENGTH: 100,
  MAX_TEST_DESCRIPTION_LENGTH: 500,
} as const;

// File system configuration
export const FILE_SYSTEM = {
  MAX_PATH_LENGTH: 260,
  ALLOWED_EXTENSIONS: ['.ts', '.js', '.json', '.html', '.css', '.png', '.jpg', '.jpeg'],
  SCREENSHOT_FORMAT: 'png',
  REPORT_FORMAT: 'html',
  ENCODING: 'utf8',
  BACKUP_RETENTION: 7, // days
} as const;

// Error handling configuration
export const ERROR_HANDLING = {
  MAX_STACK_TRACE_LENGTH: 1000,
  MAX_ERROR_MESSAGE_LENGTH: 500,
} as const;

// Performance thresholds
export const PERFORMANCE = {
  SLOW_OPERATION_THRESHOLD: 1000, // 1 second
  MEMORY_WARNING_THRESHOLD: 100 * 1024 * 1024, // 100MB
  CPU_WARNING_THRESHOLD: 80, // 80% CPU usage
  DISK_WARNING_THRESHOLD: 90, // 90% disk usage
  // CI-specific optimizations
  CI_MEMORY_THRESHOLD: process.env.CI ? 512 * 1024 * 1024 : 100 * 1024 * 1024, // 512MB in CI, 100MB locally
  CI_CLEANUP_INTERVAL: process.env.CI ? 30000 : 60000, // 30s in CI, 60s locally
  GC_THRESHOLD: 80, // Trigger GC when memory usage > 80%
} as const;

// Browser configuration defaults
export const BROWSER_DEFAULTS = {
  VIEWPORT: {
    WIDTH: 1280,
    HEIGHT: 720,
  },
  TIMEOUT: 30000,
  SLOW_MO: 0,
  HEADLESS: true,
  ARGS: ['--start-maximized', '--disable-dev-shm-usage', '--no-sandbox'],
} as const;

// Token and AI configuration
export const AI_CONFIG = {
  DEFAULT_MODEL: 'gpt-4o',
  DEFAULT_TEMPERATURE: 0.1,
  DEFAULT_MAX_TOKENS: 8000,
  TOKEN_BUFFER: 500, // Reserve tokens for response
  ESTIMATION_BUFFER: 0.1, // 10% buffer for token estimation
} as const;

// Regular expressions for common patterns
export const PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/,
  PHONE: /^[+]?[1-9][\d]{0,15}$/,
  SELECTOR: /^[#.]?[\w-]+(?:\[[\w-]+(?:=["']?[\w-\s]*["']?)?\])*$/,
  XPATH: /^\/\/|^\/|\.|^\.\.|\[@|^\(|\[/,
} as const;

// Type guards for constants
export type TimeoutKey = keyof typeof TIMEOUTS;
export type LimitKey = keyof typeof LIMITS;
export type SelectorKey = keyof typeof SELECTORS;
export type Priority = (typeof TEST_EXECUTION.VALID_PRIORITIES)[number];
export type TestStatus = (typeof TEST_EXECUTION.VALID_STATUSES)[number];

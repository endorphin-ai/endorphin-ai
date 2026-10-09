/**
 * Browser Configuration for Endorphin AI
 * Provides default configuration for browser behavior and options
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Browser configuration settings
 */
export const BROWSER_CONFIG = {
  // Browser launch options
  launchOptions: {
    headless: process.env.HEADLESS === 'true' ? true : false,
    args: ['--start-maximized'],
  },

  // Browser context options
  contextOptions: {
    viewport: { width: 1920, height: 1080 },
  },

  // Default timeouts (in milliseconds)
  timeouts: {
    navigation: 60000,
    element: 45000, // Extended from 10s to 45s for verification operations
    screenshot: 5000,
    testExecution: 5 * 60 * 1000, // 5 minutes
    verification: 60000, // New: 60 seconds for verification operations
  },

  // Screenshot options
  screenshot: {
    fullPage: false,
    type: 'png' as const,
  },

  // Base URL for testing
  baseUrl: process.env.BASE_URL || 'https://qafromla.herokuapp.com/',
} as const;

export default BROWSER_CONFIG;

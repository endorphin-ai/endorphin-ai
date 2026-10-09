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
    args: [
      '--window-size=1300,750',  // Small window size (slightly bigger than viewport for window chrome)
      '--disable-web-security',  // Help with some testing scenarios
    ],
  },

  // Browser context options
  contextOptions: {
    viewport: { width: 1280, height: 720 },  // Match viewport to window size
  },

  // Default timeouts (in milliseconds)
  timeouts: {
    navigation: 60000,
    element: 10000,
    screenshot: 5000,
    testExecution: 5 * 60 * 1000, // 5 minutes
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

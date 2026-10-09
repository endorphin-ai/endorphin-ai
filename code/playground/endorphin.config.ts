// Endorphin AI Configuration
// This file controls how your tests run

export default {
  // Browser Configuration
  browser: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    timeout: 30000,
  },

  // AI Configuration
  ai: {
    model: 'gpt-4o',
    temperature: 0.1,
    maxRetries: 3,
  },

  // Results configuration
  results: {
    directory: './test-results',
    keepHistory: 10,
    format: ['json', 'html'],
    screenshots: true,
    recordVideo: false,
  },

  // Test Settings
  testsDirectory: 'tests',
  environment: 'development',

  globalSetup: './global-setup.ts',

  jira: {
    url: 'https://qafromla.atlassian.net',
    email: 'papapin777@gmail.com',
    apiToken: process.env.JIRA_API_TOKEN,
    projectId: '10001',
    issueTypeId: '10013',
    label: 'ai-test-case',
  },
};

// 🎯 Configuration Tips:
// - Set headless: true for faster execution
// - Increase timeout for slow websites
// - Change viewport for mobile testing
// - Add your own custom settings here

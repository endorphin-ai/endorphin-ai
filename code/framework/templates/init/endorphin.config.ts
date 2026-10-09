export default {
  // Browser configuration
  browser: {
    type: 'chromium',
    headless: false, // Set to true for faster execution, automatically forced to true in CI environments
    viewport: { width: 1280, height: 720 },
    timeout: 30000,
    devtools: false,
  },

  // AI configuration
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      modelName: 'gpt-4o',
      temperature: 0.1,
      maxTokens: 8000,
    },
    agent: {
      recursionLimit: 10,
      stopPhrases: ['test completed', 'task finished', 'done'],
    },
  },

  // Custom token pricing configuration (optional)
  // Uncomment and customize if you have special pricing
  pricing: {
    // Override default model pricing
    'gpt-4o': {
      input: 0.0025, // Default: $0.0025 per 1K input tokens
      output: 0.01, // Default: $0.01 per 1K output tokens
    },

    // Add custom models
    // 'my-custom-model': {
    //   input: 0.001,
    //   output: 0.003
    // },

    // Local/free models
    // 'local-model': {
    //   input: 0,
    //   output: 0
    // }
  },

  // JIRA integration configuration (optional)
  // Uncomment to enable JIRA test synchronization
  // jira: {
  //   url: 'https://yourcompany.atlassian.net',
  //   email: 'your-email@company.com',
  //   apiToken: 'your-api-token', // Create at: Account Settings > Security > API tokens
  //   projectId: '10001', // Your JIRA project ID (numeric)
  //   issueTypeId: '10013', // Issue type ID for test cases (e.g., "Test Case")
  //   label: 'ai-test-case' // Label to filter test tickets
  // },

  // Custom tools configuration
  customTools: [
    './tools', // Load all tools from the tools directory
  ],

  // Global setup configuration (optional)
  // globalSetup: './global-setup.ts', // Path to global setup file

  // Results configuration
  results: {
    directory: './test-results',
  },

  // Execution configuration
  execution: {
    timeout: 30000,
  },

  // Directory configuration
  testsDirectory: 'tests',
  dataDirectory: 'test-data',
  resultsDirectory: 'test-results',

  // Environment
  environment: 'development',

  // Base URL for relative navigation (optional)
  // baseUrl: 'https://your-app.com',
};

// 🎯 Configuration Tips:
//
// Browser Settings:
// - Set headless: true for faster execution (automatically enabled in CI/CD)
// - Increase timeout for slow websites
// - Change viewport for mobile testing
// - Use 'firefox' or 'webkit' for cross-browser testing
//
// AI Settings:
// - Adjust temperature (0.0-1.0) for response consistency
// - Increase maxTokens for complex tasks
// - Add stop phrases for early termination
//
// Custom Pricing:
// - Override default pricing with your negotiated rates
// - Add custom/private model pricing
// - Set free pricing for local models
// - Prices are per 1,000 tokens in USD
//
// JIRA Integration:
// - Sync test cases from JIRA tickets automatically
// - Use --jira-sync flag to fetch tests before running
// - Tickets must contain @GENERATE.DATA and @USER1.PHASE1 blocks
// - Tests are saved to tests/jira/ directory
// - Alternative: use environment variables (JIRA_URL, JIRA_EMAIL, etc.)
//
// Custom Tools:
// - Use './tools' to load all tools from directory
// - Add specific tool files: './tools/my-tool.ts'
// - Tools should export createXxxTool functions
//
// Global Setup:
// - Optional setup script that runs before all tests
// - Use for environment setup, authentication, data seeding
// - Must export a default async function
// - If setup fails, test execution is stopped
//
// Results:
// - Change directory to customize output location
// - Screenshots and videos saved automatically

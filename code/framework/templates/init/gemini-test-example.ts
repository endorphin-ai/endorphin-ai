/**
 * Example test using Google Gemini AI
 * Shows how to configure Endorphin AI to use Gemini instead of OpenAI
 */

import type { TestCase } from 'endorphin-ai';

// Example 1: Basic Gemini test
export const GEMINI_BASIC_TEST: TestCase = {
  id: 'GEMINI-001',
  name: 'Basic Gemini Test',
  description: 'Tests browser automation using Google Gemini AI',
  priority: 'High',
  tags: ['gemini', 'example'],
  url: 'https://www.google.com',
  task: 'Navigate to Google, search for "Gemini AI", and verify the search results page loads'
};

// Example 2: Gemini with dynamic data
export const GEMINI_DYNAMIC_TEST: TestCase = {
  id: 'GEMINI-002',
  name: 'Gemini Dynamic Test',
  description: 'Dynamic test using Gemini with setup and data generation',
  priority: 'Medium',
  tags: ['gemini', 'dynamic'],
  
  setup: async () => ({
    searchEngine: 'https://www.google.com',
    timestamp: new Date().toISOString()
  }),
  
  data: async () => ({
    searchQuery: `AI testing ${Date.now()}`,
    expectedResult: 'automation'
  }),
  
  task: async (data, setupData) => `
    Navigate to ${setupData.searchEngine}
    Search for "${data.searchQuery}"
    Verify search results contain "${data.expectedResult}"
    Take a screenshot of the results
  `
};

// Example 3: Cost-optimized test with Gemini Flash
export const GEMINI_FLASH_TEST: TestCase = {
  id: 'GEMINI-003',
  name: 'Gemini Flash Test',
  description: 'Using Gemini 1.5 Flash for faster and cheaper execution',
  priority: 'Low',
  tags: ['gemini', 'flash', 'cost-optimized'],
  url: 'https://example.com',
  task: `
    Navigate to the page
    Click on "More information"
    Verify the content loads
    Report success
  `
};

/**
 * Configuration to use these tests with Gemini:
 * 
 * In your endorphin.config.ts:
 * ```typescript
 * export default {
 *   ai: {
 *     // For standard Gemini Pro
 *     model: 'gemini-1.5-pro',
 *     
 *     // For faster/cheaper Gemini Flash
 *     // model: 'gemini-1.5-flash',
 *     
 *     // For latest experimental features
 *     // model: 'gemini-2.0-flash',
 *     
 *     temperature: 0.1,
 *     maxRetries: 3,
 *   },
 *   // ... rest of your config
 * }
 * ```
 * 
 * Environment setup:
 * ```bash
 * export GOOGLE_API_KEY=your_api_key_here
 * # or
 * export GEMINI_API_KEY=your_api_key_here
 * ```
 * 
 * Running tests:
 * ```bash
 * npx endorphin run test GEMINI-001
 * npx endorphin run test --tag gemini
 * ```
 */
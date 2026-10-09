/**
 * Sample Test - Getting Started with Endorphin AI
 * This test demonstrates basic navigation, interaction, setup, and data generation
 * Development version with relative imports
 */

import type { TestCase } from '../framework/types/index.js';
import { generateData } from '../framework/utils/index.js';

export const HEALTH_001: TestCase = {
  id: 'HEALTH-001',
  name: 'Sample Health Check Test',
  description: 'A simple test to verify the framework is working correctly',
  priority: 'High',
  tags: ['health-check', 'sample'],

  // Optional setup function that runs before the test
  setup: async () => {
    console.log('Setting up test environment...');
    return {
      timestamp: new Date().toISOString(),
      environment: 'test',
      testUrl: 'https://qafromla.herokuapp.com/',
    };
  },

  // Optional async data generation function using AI
  data: async () => {
    console.log('Generating test data...');

    // Use AI to generate realistic user data
    const userData = await generateData(
      {
        email: 'string - valid email address for testing',
        password: 'string - simple password for testing',
        username: 'string - expected username after login',
      },
      'Generate realistic test user credentials for a sample application'
    );

    // Override with known working credentials for this specific test

    console.log('Generated test data...', userData);

    return {
      user: {
        email: 'papapin888@gmail.com',
        password: 'lalalend',
        expectedUsername: 'Andrew',
      },
    };
  },

  task: async (data, setupData) => {
    return `
      STEP 1: Navigate to ${setupData?.testUrl || 'https://qafromla.herokuapp.com/'}
      STEP 2: Click on "LogIn" button
      STEP 3: Wait 2 seconds for page load
      STEP 4: Enter "${data?.user?.email}" in the email field
      STEP 5: Wait 1 seconds 
      STEP 6: Enter "${data?.user?.password}" in the password field
      STEP 7: Click "Sign In" button
      STEP 8: Wait 3 seconds for page load
      STEP 9: Verify login was successful by checking username ${data?.user?.expectedUsername || 'Andrew'} is visible
    `;
  },
};

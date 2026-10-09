/**
 * Sample Test - Getting Started with Endorphin AI
 * This test demonstrates basic navigation, interaction, setup, and data generation
 * Development version with relative imports
 */

import type { TestCase } from 'endorphin-ai';

export const HEALTH_002: TestCase = {
  id: 'HEALTH-002',
  name: 'Second Health Check Test',
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

  // Optional async data generation function
  data: async () => {
    console.log('Generating test data...');
    return {
      user: {
        email: 'papapin888@gmail.com',
        password: 'lalalend',
      },
    };
  },

  task: async (data, setupData) => {
    return `
      STEP 1: Navigate to ${setupData?.testUrl || 'https://qafromla.herokuapp.com/'}
      STEP 2: Click on "LogIn" button
      STEP 3: Wait 2 seconds for page load
      STEP 4: Enter "${data?.user?.email}" in the email field
      STEP 5: Enter "${data?.user?.password}" in the password field
      STEP 6: Click "Sign In" button
      STEP 7: Wait 3 seconds for page load
      STEP 8: Verify login was successful by checking username MAXIMUS is visible
    `;
  },
};

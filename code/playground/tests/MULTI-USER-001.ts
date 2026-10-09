/**
 * Multi-User Test Example - Login with Multiple Users
 * This test demonstrates how to use multi-user support in Endorphin AI
 */

import type { TestCase } from '../framework/types/index.js';

export const MULTI_USER_001: TestCase = {
  id: 'MULTI-USER-001',
  name: 'Multi-User Login Test',
  description: 'Test login functionality with multiple users simultaneously',
  priority: 'High',
  tags: ['multi-user', 'login', 'authentication'],

  // Define the users for this test (max 5 users)
  users: ['user-1', 'user-2'],

  // Optional setup function that runs before the test
  setup: async () => {
    console.log('Setting up multi-user test environment...');

    // Note: getPage() is only available during test execution, not during setup definition
    // You can use getPage() inside the setup function when it's actually executed

    return {
      timestamp: new Date().toISOString(),
      environment: 'test',
      testUrl: 'https://qafromla.herokuapp.com/',
    };
  },

  // Optional data generation function
  data: async () => {
    console.log('Generating test data for multi-user test...');

    return {
      users: {
        'user-1': {
          email: 'papapin888@gmail.com',
          password: 'lalalend',
          expectedUsername: 'Andrew',
        },
        'user-2': {
          email: 'user-2@gmail.com',
          password: 'user2password',
          expectedUsername: 'user-2',
        },
      },
    };
  },

  // Multi-user tasks function that returns user-specific task instructions
  tasks: async (data, setupData, users) => {
    console.log('Generating user-specific tasks...', { users });

    return {
      'user-1.phase1': `
        STEP 1: Navigate to ${setupData?.testUrl || 'https://qafromla.herokuapp.com/'}
        STEP 2: Click on "LogIn" button
        STEP 3: Wait 2 seconds for page load
        STEP 4: Enter "${data?.users?.['user-1']?.email}" in the email field
        STEP 5: Wait 2 seconds 
        STEP 6: Enter "${data?.users?.['user-1']?.password}" in the password field
        STEP 7: Click "Sign In" button
        STEP 8: Wait 3 seconds for page load
        STEP 9: Verify login was successful by checking username "${data?.users?.['user-1']?.expectedUsername}" is visible on page  
      `,

      'user-2.phase1': `
        STEP 1: Navigate to ${setupData?.testUrl || 'https://qafromla.herokuapp.com/'}
        STEP 2: Click on "LogIn" button
        STEP 3: Wait 2 seconds for page load
        STEP 4: Enter "${data?.users?.['user-2']?.email}" in the email field
        STEP 5: Wait 2 seconds 
        STEP 6: Enter "${data?.users?.['user-2']?.password}" in the password field
        STEP 7: Click "Sign In" button
        STEP 8: Wait 3 seconds for page load
        STEP 9: Verify login was successful by checking username "${data?.users?.['user-2']?.expectedUsername}" is visible     
      `,

      'user-1.phase2': `STEP 1: Click on "Global Feed" button`,
    };
  },
};

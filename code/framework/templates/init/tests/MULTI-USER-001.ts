/**
 * Multi-User Test Example - Login with Multiple Users
 * This test demonstrates how to use multi-user support in Endorphin AI
 */

import type { TestCase } from 'endorphin-ai';

export const MULTI_USER_001: TestCase = {
  id: 'MULTI-USER-001',
  name: 'Multi-User Login Test',
  description: 'Test login functionality with multiple users simultaneously',
  priority: 'High',
  tags: ['multi-user', 'login', 'authentication'],

  // Define the users for this test (max 5 users)  
  users: ['user1', 'user2'], // Simplified naming for phase-based workflow

  // Optional setup function that runs before the test
  setup: async () => {
    console.log('Setting up multi-user test environment...');
    
    // You can use getPage() to access specific user pages in setup
    // const user1Page = getPage('user-1');
    // const user2Page = getPage('user-2');
    
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
        'user1': {
          email: 'papapin888@gmail.com',
          password: 'lalalend',
          expectedUsername: 'Andrew',
        },
        'user2': {
          email: 'user2@gmail.com',
          password: 'user2password',
          expectedUsername: 'user2',
        },
      },
    };
  },

  // Multi-user tasks function that returns user-specific task instructions
  tasks: async (data, setupData, _users) => {
    console.log('Generating user-specific tasks...', { users });

    return {
      'user1': `
        STEP 1: Navigate to ${setupData?.testUrl || 'https://qafromla.herokuapp.com/'}
        STEP 2: Click on "LogIn" button
        STEP 3: Wait 2 seconds for page load
        STEP 4: Enter "${data?.users?.['user1']?.email}" in the email field
        STEP 5: Wait 2 seconds 
        STEP 6: Enter "${data?.users?.['user1']?.password}" in the password field
        STEP 7: Click "Sign In" button
        STEP 8: Wait 5 seconds for page load and user data to appear
        STEP 9: Verify login was successful by using verifyTextContent tool to check that username "${data?.users?.['user1']?.expectedUsername || 'Andrew'}" is visible on the page
      `,

      'user2': `
        STEP 1: Navigate to ${setupData?.testUrl || 'https://qafromla.herokuapp.com/'}
        STEP 2: Click on "LogIn" button
        STEP 3: Wait 2 seconds for page load
        STEP 4: Enter "${data?.users?.['user2']?.email}" in the email field
        STEP 5: Wait 2 seconds 
        STEP 6: Enter "${data?.users?.['user2']?.password}" in the password field
        STEP 7: Click "Sign In" button
        STEP 8: Wait 5 seconds for page load and user data to appear
        STEP 9: Verify login was successful by using verifyTextContent tool to check that username "${data?.users?.['user2']?.expectedUsername}" is visible on the page
      `,
    };
  },
};

/**
 * Example of using getPage() utility in setup function
 */
export const MULTI_USER_002: TestCase = {
  id: 'MULTI-USER-002',
  name: 'Multi-User Page Interaction Test',
  description: 'Test direct page interaction with multiple users',
  priority: 'Medium',
  tags: ['multi-user', 'page-interaction'],

  users: ['admin', 'regular-user'],

  setup: async () => {
    console.log('Setting up with direct page access...');

    // Example of using getPage() to directly interact with user pages
    // This would be available during test execution
    /*
    const adminPage = getPage('admin');
    const regularUserPage = getPage('regular-user');
    
    // You can perform setup actions on specific pages
    await adminPage.goto('https://example.com/admin');
    await regularUserPage.goto('https://example.com/user');
    */

    return {
      adminUrl: 'https://qafromla.herokuapp.com/admin',
      userUrl: 'https://qafromla.herokuapp.com/user',
    };
  },

  tasks: async (data, setupData, _users) => {
    return {
      'admin': `
        STEP 1: Navigate to ${setupData?.adminUrl || 'https://qafromla.herokuapp.com/'}
        STEP 2: Perform admin-specific actions
        STEP 3: Verify admin functionality
      `,
      
      'regular-user': `
        STEP 1: Navigate to ${setupData?.userUrl || 'https://qafromla.herokuapp.com/'}
        STEP 2: Perform regular user actions
        STEP 3: Verify user functionality
      `,
    };
  },
};
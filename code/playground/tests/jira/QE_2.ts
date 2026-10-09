import type { TestCase } from '../../framework/types/index.js';

export const QE_2: TestCase = {
  id: 'QE-2',
  name: 'Login with Credentials | 2 Users',
  description: 'JIRA test case: Login with Credentials | 2 Users',
  priority: 'Medium',
  tags: ["jira","automated","ai-test-case"],
  users: ["user1","admin-1"],
  data: async () => {
    console.log('Generating test data...');

    // Use AI to generate realistic user data
    const { generateData } = await import('../../framework/utils/generate-data.js');
    const userData = await generateData(
      {
            "email": "valid email address for testing",
            "password": "simple password for testing",
            "username": "simple for username testing"
      },
      'Generate realistic test user credentials'
    );

    console.log('Generated test data...', userData);
    return userData;
  },
  tasks: async (data) => {
    const tasks = {
    "user1.phase1": "Navigate to <https://qafromla.herokuapp.com/>\\nClick on \"LogIn\" button\\nWait 2 seconds for page load\\nEnter ${data.email} in the email field\\nWait 2 seconds\\nEnter ${data.password} in the password field\\nClick \"Sign In\" button\\nVerify “Email not found sign in first” is visible on page",
    "admin-1.phase1": "Navigate to <https://tesla.com/>"
};
    
    // Substitute variables in all tasks
    const substitutedTasks: Record<string, string> = {};
    for (const [key, value] of Object.entries(tasks)) {
      substitutedTasks[key] = value.replace(/\$\{data\.(\w+)\}/g, (match, fieldName) => {
        return data[fieldName] || match;
      });
    }
    
    return substitutedTasks;
  }
};

import type { TestCase } from '../../framework/types/index.js';

export const QE_1: TestCase = {
  id: 'QE-1',
  name: 'Login with Credentials',
  description: 'JIRA test case: Login with Credentials',
  priority: 'Medium',
  tags: ["jira","automated","ai-test-case"],
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
  task: async (data) => {
    if (!data) {
      throw new Error('Data is required but not provided');
    }
    
    const taskSteps = [
      "Navigate to <https://qafromla.herokuapp.com/>",
      "Click on \"LogIn\" button",
      "Wait 2 seconds for page load",
      "Enter ${data.email} in the email field",
      "Wait 2 seconds",
      "Enter ${data.password} in the password field",
      "Click \"Sign In\" button",
      "Verify “Email not found sign in first” is visible on page"
];
    
    // Join steps and replace variables with actual data values
    let taskContent = taskSteps.join('\n');
    taskContent = taskContent.replace(/\$\{data\.(\w+)\}/g, (match, fieldName) => {
      if (data && Object.prototype.hasOwnProperty.call(data, fieldName)) {
        return data[fieldName];
      }
      console.warn(`Warning: Variable ${match} not found in data object`);
      return match;
    });
    
    return taskContent;
  }
};

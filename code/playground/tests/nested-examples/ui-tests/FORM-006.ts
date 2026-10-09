import type { TestCase } from '../../../framework/types/index.js';

export const FORM_006: TestCase = {
  id: 'FORM-006',
  name: 'Conduit Login Form Test 006',
  description: 'Test login form with invalid credentials',
  priority: 'Medium',
  tags: ['nested', 'forms', 'login'],
  task: 'Navigate to https://qafromla.herokuapp.com/, click "Login" button, fill email with "test006@example.com", fill password with "wrongpass", click "Sign In" button, and verify the text "Email not found sign in first" is visible on page'
};

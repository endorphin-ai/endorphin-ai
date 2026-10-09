import type { TestCase } from '../../../framework/types/index.js';

export const COMP_001: TestCase = {
  id: 'COMP-001',
  name: 'Conduit Component Test 001',
  description: 'Verify Conduit Home button component is visible',
  priority: 'Medium',
  tags: ['demo', 'components', 'conduit'],
  task: 'Navigate to https://qafromla.herokuapp.com/ and verify the "Home" button is visible on page'
};
import type { TestCase } from '../../../framework/types/index.js';

export const VALID_010: TestCase = {
  id: 'VALID-010',
  name: 'Conduit Validation Test 010',
  description: 'Conduit validation test number 010',
  priority: 'Medium',
  tags: ['sample', 'validation', 'conduit'],
  task: 'Navigate to https://qafromla.herokuapp.com/ and verify the text "Global Feed" is visible on page'
};

import type { TestCase } from '../../../framework/types/index.js';

export const VALID_001: TestCase = {
  id: 'VALID-001',
  name: 'Conduit Validation Element Check Test',
  description: 'Validate specific elements are visible on Conduit',
  priority: 'Medium',
  tags: ['sample', 'validation', 'elements', 'conduit'],
  task: 'Navigate to https://qafromla.herokuapp.com/ and verify the text "Global Feed" is visible on page'
};
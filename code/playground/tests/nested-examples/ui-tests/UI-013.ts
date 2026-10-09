import type { TestCase } from '../../../framework/types/index.js';

export const UI_013: TestCase = {
  id: 'UI-013',
  name: 'Conduit UI Test 013',
  description: 'Navigate to Conduit and verify Global Feed',
  priority: 'Medium',
  tags: ['nested', 'ui', 'conduit'],
  task: 'Navigate to https://qafromla.herokuapp.com/ and verify the text "Global Feed" is visible on page'
};

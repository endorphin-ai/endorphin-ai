import type { TestCase } from '../../../framework/types/index.js';

export const UI_015: TestCase = {
  id: 'UI-015',
  name: 'Conduit UI Test 015',
  description: 'Navigate to Conduit and verify Global Feed',
  priority: 'Medium',
  tags: ['nested', 'ui', 'conduit'],
  task: 'Navigate to https://qafromla.herokuapp.com/ and verify the text "Global Feed" is visible on page'
};

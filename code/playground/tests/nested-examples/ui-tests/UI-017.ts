import type { TestCase } from '../../../framework/types/index.js';

export const UI_017: TestCase = {
  id: 'UI-017',
  name: 'Conduit UI Test 017',
  description: 'Navigate to Conduit and verify Global Feed',
  priority: 'Medium',
  tags: ['nested', 'ui', 'conduit'],
  task: 'Navigate to https://qafromla.herokuapp.com/ and verify the text "Global Feed" is visible on page'
};

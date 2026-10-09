import type { TestCase } from '../../../framework/types/index.js';

export const UI_005: TestCase = {
  id: 'UI-005',
  name: 'Conduit Global Feed Check Test',
  description: 'Navigate to Conduit and verify Global Feed text is visible',
  priority: 'Medium',
  tags: ['nested', 'ui', 'conduit'],
  task: 'Navigate to https://qafromla.herokuapp.com/ and verify the text "Global Feed" is visible on page'
};
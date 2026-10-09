import type { TestCase } from '../../../framework/types/index.js';

export const UI_002: TestCase = {
  id: 'UI-002',
  name: 'Conduit Global Feed Visibility Test',
  description: 'Navigate to Conduit and verify Global Feed text',
  priority: 'High',
  tags: ['nested', 'ui', 'conduit'],
  task: 'Navigate to https://qafromla.herokuapp.com/ and verify the text "Global Feed" is visible on page'
};
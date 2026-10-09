import type { TestCase } from '../../../framework/types/index.js';

export const UI_003: TestCase = {
  id: 'UI-003',
  name: 'Conduit Global Feed Text Test',
  description: 'Navigate to Conduit and verify Global Feed text is visible',
  priority: 'Medium',
  tags: ['nested', 'ui', 'conduit'],
  task: 'Navigate to https://qafromla.herokuapp.com/ and verify the text "Global Feed" is visible on page'
};
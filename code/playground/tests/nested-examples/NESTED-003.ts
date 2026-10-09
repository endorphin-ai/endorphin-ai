import type { TestCase } from '../../framework/types/index.js';

export const NESTED_003: TestCase = {
  id: 'NESTED-003',
  name: 'Conduit Global Feed Test',
  description: 'Navigate to Conduit and verify Global Feed visibility',
  priority: 'High',
  tags: ['nested', 'navigation', 'feed'],
  task: 'Navigate to https://qafromla.herokuapp.com/ and verify the text "Global Feed" is visible on page'
};
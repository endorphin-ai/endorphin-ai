import type { TestCase } from '../../../framework/types/index.js';

export const UI_001: TestCase = {
  id: 'UI-001',
  name: 'Conduit Page Load Test',
  description: 'Navigate to Conduit page and verify Global Feed is visible',
  priority: 'High',
  tags: ['nested', 'ui', 'conduit'],
  task: 'Navigate to https://qafromla.herokuapp.com/ and verify the text "Global Feed" is visible on page'
};
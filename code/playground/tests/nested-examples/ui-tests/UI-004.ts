import type { TestCase } from '../../../framework/types/index.js';

export const UI_004: TestCase = {
  id: 'UI-004',
  name: 'Conduit Page Verification Test',
  description: 'Navigate to Conduit and verify Global Feed text is visible',
  priority: 'Medium',
  tags: ['nested', 'ui', 'conduit'],
  task: 'Navigate to https://qafromla.herokuapp.com/ and verify the text "Global Feed" is visible on page'
};
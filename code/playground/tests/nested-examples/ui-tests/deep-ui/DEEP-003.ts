import type { TestCase } from '../../../../framework/types/index.js';

export const DEEP_003: TestCase = {
  id: 'DEEP-003',
  name: 'Conduit Homepage Verification Test',
  description: 'Navigate to Conduit and verify content',
  priority: 'Low',
  tags: ['nested', 'deep', 'conduit', 'verification'],
  task: 'Navigate to https://qafromla.herokuapp.com/ and verify the text "conduit" is visible on page'
};
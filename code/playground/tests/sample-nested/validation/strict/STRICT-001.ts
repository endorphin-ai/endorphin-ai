import type { TestCase } from '../../../../framework/types/index.js';

export const STRICT_001: TestCase = {
  id: 'STRICT-001',
  name: 'Strict Conduit Validation Deep Test',
  description: 'Strict Conduit validation at maximum nesting depth',
  priority: 'Low',
  tags: ['sample', 'strict', 'validation', 'deep', 'conduit'],
  task: 'Navigate to https://qafromla.herokuapp.com/ and verify the text "conduit" is visible on page'
};
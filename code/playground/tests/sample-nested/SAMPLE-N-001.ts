import type { TestCase } from '../../framework/types/index.js';

export const SAMPLE_N_001: TestCase = {
  id: 'SAMPLE-N-001',
  name: 'Sample Nested Conduit Test',
  description: 'Basic sample nested Conduit navigation test',
  priority: 'High',
  tags: ['sample', 'nested', 'basic', 'conduit'],
  task: 'Navigate to https://qafromla.herokuapp.com/ and verify the text "conduit" is visible on page'
};
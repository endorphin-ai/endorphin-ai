import type { TestCase } from '../../framework/types/index.js';

export const NESTED_001: TestCase = {
  id: 'NESTED-001',
  name: 'Conduit Homepage Navigation Test',
  description: 'Navigate and verify conduit heading visibility',
  priority: 'High',
  tags: ['nested', 'navigation', 'basic'],
  task: 'Navigate to https://qafromla.herokuapp.com/ and verify the text "conduit" is visible on page'
};
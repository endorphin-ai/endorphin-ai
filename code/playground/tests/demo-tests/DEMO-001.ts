import type { TestCase } from '../../framework/types/index.js';

export const DEMO_001: TestCase = {
  id: 'DEMO-001',
  name: 'Conduit Demo Test 001',
  description: 'Demo navigation test for Conduit tagline',
  priority: 'High',
  tags: ['demo', 'navigation', 'conduit'],
  task: 'Navigate to https://qafromla.herokuapp.com/ and verify the text "A place to share your knowledge." is visible on page'
};
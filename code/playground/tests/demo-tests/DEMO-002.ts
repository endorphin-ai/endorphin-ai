import type { TestCase } from '../../framework/types/index.js';

export const DEMO_002: TestCase = {
  id: 'DEMO-002',
  name: 'Conduit Demo Test 002',
  description: 'Demo navigation test for Conduit tagline',
  priority: 'High',
  tags: ['demo', 'navigation', 'conduit'],
  task: 'Navigate to https://qafromla.herokuapp.com/ and verify the text "A place to share your knowledge." is visible on page'
};
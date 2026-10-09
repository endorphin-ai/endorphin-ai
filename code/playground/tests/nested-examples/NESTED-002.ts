import type { TestCase } from '../../framework/types/index.js';

export const NESTED_002: TestCase = {
  id: 'NESTED-002',
  name: 'Conduit Tagline Verification',
  description: 'Navigate and verify conduit tagline visibility',
  priority: 'High',
  tags: ['nested', 'navigation', 'text'],
  task: 'Navigate to https://qafromla.herokuapp.com/ and verify the text "A place to share your knowledge." is visible on page'
};
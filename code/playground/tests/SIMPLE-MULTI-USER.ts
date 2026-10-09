import type { TestCase } from '../framework/types/index.js';

export const SIMPLE_MULTI_USER: TestCase = {
  id: 'SIMPLE-MULTI-USER',
  name: 'Simple Multi-User Test',
  description: 'Complex multi-phase user workflow',
  priority: 'High',
  tags: ['multi-user', 'test'],
  users: ['user1', 'user2'], // Only 2 browser sessions
  tasks: async () => ({
    'user1.phase1': 'STEP 1: Navigate to google.com',
    'user2.phase1': 'STEP 1: Navigate to tesla.com',
    'user1.phase2': 'STEP 2: Navigate to tesla.com',
    'user2.phase2': 'STEP 2: Navigate to google.com',
  }),
};

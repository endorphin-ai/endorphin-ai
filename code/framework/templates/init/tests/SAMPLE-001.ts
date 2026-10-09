// Example Endorphin AI Test
// This is a sample test to help you get started
import type { TestCase } from 'endorphin-ai';

export const SAMPLE_001: TestCase = {
  id: 'SAMPLE-001',
  name: 'Health Check Test',
  description: 'Basic health check to verify the testing framework is working',
  priority: 'High',
  tags: ['health', 'smoke'],
  url: 'https://example.com', // Use 'url' instead of 'site' for consistency
  data: async () => {
    return {};
  },
  task: 'Navigate to the homepage and verify that the page loads successfully. Check that the page title contains "Example Domain" and that there are no console errors.',
};

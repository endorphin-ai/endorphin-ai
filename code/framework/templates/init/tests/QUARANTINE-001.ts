/**
 * Quarantined Test Example
 * This test demonstrates the quarantine functionality
 */

import type { TestCase } from 'endorphin-ai';

const quarantinedTest: TestCase = {
  id: 'QUARANTINE-001',
  name: 'Example Quarantined Test',
  description: 'This test is quarantined and will be skipped during normal execution',
  priority: 'Medium',
  tags: ['example', 'quarantined'], // The 'quarantined' tag will cause this test to be skipped

  task: `
    Navigate to https://example.com
    Verify the page loads successfully
    This test would normally fail, but it's quarantined
  `,
};

export default quarantinedTest;

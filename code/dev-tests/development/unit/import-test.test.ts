/**
 * Test TypeScript import
 */

import { describe, expect, it } from '@jest/globals';

describe('TypeScript Import Test', () => {
  it('should import initProject function', async () => {
    const { initProject } = await import('../../../framework/cli/init-command');
    expect(typeof initProject).toBe('function');
  });
});

/**
 * Tests for quarantine functionality in test discovery
 */

import { runSingleTestById, runTestsByTag, runAllTests, clearDiscoveryCache } from '../../../framework/execution/discovery/cli-functions.js';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';

describe('Test Discovery Quarantine Functionality', () => {
  let testDir: string;
  let originalCwd: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Store original values
    originalCwd = process.cwd();
    originalEnv = process.env.ENDORPHIN_RUN_QUARANTINED;
    
    // Set test environment
    process.env.NODE_ENV = 'test';
    delete process.env.ENDORPHIN_RUN_QUARANTINED;

    // Clear discovery cache
    clearDiscoveryCache();

    // Create test directory structure
    testDir = resolve(__dirname, '../../../tmp/quarantine-tests');
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    // Change to test directory
    process.chdir(testDir);

    // Create tests directory
    const testsDir = resolve(testDir, 'tests');
    mkdirSync(testsDir, { recursive: true });

    // Create test files
    createTestFiles(testsDir);
    
    // Debug: Log created files
    if (process.env.NODE_ENV === 'test') {
      const fs = require('fs');
      console.log('Working directory:', process.cwd());
      console.log('Tests directory:', testsDir);
      console.log('Files created:', fs.readdirSync(testsDir));
    }
  });

  afterEach(() => {
    // Restore original values
    process.chdir(originalCwd);
    if (originalEnv !== undefined) {
      process.env.ENDORPHIN_RUN_QUARANTINED = originalEnv;
    } else {
      delete process.env.ENDORPHIN_RUN_QUARANTINED;
    }
    
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  function createTestFiles(testsDir: string): void {
    // Normal test
    writeFileSync(resolve(testsDir, 'normal-test.ts'), `
      const normalTest = {
        id: 'NORMAL-001',
        name: 'Normal Test',
        description: 'A normal test',
        priority: 'High',
        tags: ['integration'],
        task: 'Navigate to example.com'
      };
      export default normalTest;
    `);

    // Quarantined test
    writeFileSync(resolve(testsDir, 'quarantined-test.ts'), `
      const quarantinedTest = {
        id: 'QUARANTINE-001',
        name: 'Quarantined Test',
        description: 'A quarantined test',
        priority: 'Medium',
        tags: ['integration', 'quarantined'],
        task: 'Navigate to broken-site.com'
      };
      export default quarantinedTest;
    `);

    // Another quarantined test
    writeFileSync(resolve(testsDir, 'another-quarantined.ts'), `
      const anotherQuarantined = {
        id: 'QUARANTINE-002',
        name: 'Another Quarantined Test',
        description: 'Another quarantined test',
        priority: 'Low',
        tags: ['e2e', 'quarantined'],
        task: 'Test unstable feature'
      };
      export default anotherQuarantined;
    `);

    // Test with both integration and quarantined tags
    writeFileSync(resolve(testsDir, 'mixed-tags.ts'), `
      const mixedTest = {
        id: 'MIXED-001',
        name: 'Mixed Tags Test',
        description: 'Test with multiple tags including quarantined',
        priority: 'High',
        tags: ['integration', 'quarantined', 'ui'],
        task: 'Test mixed functionality'
      };
      export default mixedTest;
    `);
  }

  describe('runSingleTestById with quarantine', () => {
    it('should skip quarantined test by default', async () => {
      const result = await runSingleTestById('QUARANTINE-001');
      
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.message).toContain('was skipped (quarantined)');
    });

    it('should run quarantined test when ENDORPHIN_RUN_QUARANTINED=true', async () => {
      process.env.ENDORPHIN_RUN_QUARANTINED = 'true';
      
      const result = await runSingleTestById('QUARANTINE-001');
      
      expect(result.success).toBe(true);
      expect(result.skipped).toBeUndefined();
      expect(result.test).toBeDefined();
      expect(result.test!.id).toBe('QUARANTINE-001');
    });

    it('should run normal test normally', async () => {
      const result = await runSingleTestById('NORMAL-001');
      
      expect(result.success).toBe(true);
      expect(result.skipped).toBeUndefined();
      expect(result.test).toBeDefined();
      expect(result.test!.id).toBe('NORMAL-001');
    });
  });

  describe('runTestsByTag with quarantine', () => {
    it('should skip quarantined tests with integration tag by default', async () => {
      const result = await runTestsByTag('integration');
      
      expect(result.success).toBe(true);
      expect(result.tests).toBeDefined();
      
      // Should only include non-quarantined tests
      const testIds = result.tests!.map(t => t.id);
      expect(testIds).toContain('NORMAL-001');
      expect(testIds).not.toContain('QUARANTINE-001');
      expect(testIds).not.toContain('MIXED-001');
    });

    it('should include quarantined tests when ENDORPHIN_RUN_QUARANTINED=true', async () => {
      process.env.ENDORPHIN_RUN_QUARANTINED = 'true';
      
      const result = await runTestsByTag('integration');
      
      expect(result.success).toBe(true);
      expect(result.tests).toBeDefined();
      
      // Should include all tests with integration tag
      const testIds = result.tests!.map(t => t.id);
      expect(testIds).toContain('NORMAL-001');
      expect(testIds).toContain('QUARANTINE-001');
      expect(testIds).toContain('MIXED-001');
    });

    it('should run quarantined tests when specifically searching for quarantined tag', async () => {
      const result = await runTestsByTag('quarantined');
      
      expect(result.success).toBe(true);
      expect(result.tests).toBeDefined();
      
      // Should include all quarantined tests
      const testIds = result.tests!.map(t => t.id);
      expect(testIds).toContain('QUARANTINE-001');
      expect(testIds).toContain('QUARANTINE-002');
      expect(testIds).toContain('MIXED-001');
      expect(testIds).not.toContain('NORMAL-001');
    });

    it('should return error when all tests with tag are quarantined', async () => {
      const result = await runTestsByTag('e2e');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain("All tests with tag 'e2e' are quarantined");
    });
  });

  describe('runAllTests with quarantine', () => {
    it('should skip quarantined tests by default', async () => {
      const result = await runAllTests();
      
      expect(result.success).toBe(true);
      expect(result.tests).toBeDefined();
      
      // Should only include non-quarantined tests
      const testIds = result.tests!.map(t => t.id);
      expect(testIds).toContain('NORMAL-001');
      expect(testIds).not.toContain('QUARANTINE-001');
      expect(testIds).not.toContain('QUARANTINE-002');
      expect(testIds).not.toContain('MIXED-001');
    });

    it('should include quarantined tests when ENDORPHIN_RUN_QUARANTINED=true', async () => {
      process.env.ENDORPHIN_RUN_QUARANTINED = 'true';
      
      const result = await runAllTests();
      
      expect(result.success).toBe(true);
      expect(result.tests).toBeDefined();
      
      // Should include all tests
      const testIds = result.tests!.map(t => t.id);
      expect(testIds).toContain('NORMAL-001');
      expect(testIds).toContain('QUARANTINE-001');
      expect(testIds).toContain('QUARANTINE-002');
      expect(testIds).toContain('MIXED-001');
    });

    it('should return error when all tests are quarantined', async () => {
      // Remove the normal test file to make all tests quarantined
      const normalTestPath = resolve(testDir, 'tests', 'normal-test.ts');
      if (existsSync(normalTestPath)) {
        rmSync(normalTestPath);
      }
      
      const result = await runAllTests();
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('All tests are quarantined');
    });
  });

  describe('environment variable handling', () => {
    it('should respect ENDORPHIN_RUN_QUARANTINED=false', async () => {
      process.env.ENDORPHIN_RUN_QUARANTINED = 'false';
      
      const result = await runSingleTestById('QUARANTINE-001');
      
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });

    it('should respect ENDORPHIN_RUN_QUARANTINED=1', async () => {
      process.env.ENDORPHIN_RUN_QUARANTINED = '1';
      
      const result = await runSingleTestById('QUARANTINE-001');
      
      // Should still skip since it's not exactly 'true'
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });

    it('should only accept exactly "true" value', async () => {
      process.env.ENDORPHIN_RUN_QUARANTINED = 'TRUE';
      
      const result = await runSingleTestById('QUARANTINE-001');
      
      // Should skip since it's not exactly 'true'
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });
  });

  describe('quarantine detection', () => {
    it('should detect quarantined tag in any position', async () => {
      // Test with quarantined tag at the end
      const result1 = await runSingleTestById('QUARANTINE-001');
      expect(result1.skipped).toBe(true);

      // Test with quarantined tag in the middle
      const result2 = await runSingleTestById('MIXED-001');
      expect(result2.skipped).toBe(true);
    });

    it('should be case sensitive for quarantined tag', async () => {
      // Create a test with different case
      const testsDir = resolve(testDir, 'tests');
      writeFileSync(resolve(testsDir, 'case-test.ts'), `
        const caseTest = {
          id: 'CASE-001',
          name: 'Case Test',
          priority: 'Medium',
          tags: ['QUARANTINED'], // Wrong case
          task: 'Test case sensitivity'
        };
        export default caseTest;
      `);

      const result = await runSingleTestById('CASE-001');
      
      // Should not be skipped since tag is wrong case
      expect(result.success).toBe(true);
      expect(result.skipped).toBeUndefined();
    });
  });
});
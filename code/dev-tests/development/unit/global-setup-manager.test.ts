/**
 * Tests for Global Setup Manager
 */

import { GlobalSetupManager } from '../../../framework/core/global-setup-manager';
import { resolve, join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';

describe('GlobalSetupManager', () => {
  let manager: GlobalSetupManager;
  let testDir: string;

  beforeEach(() => {
    manager = new GlobalSetupManager();
    testDir = resolve(__dirname, '../../../tmp/global-setup-tests');
    
    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    manager.clear();
    
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('loadSetup', () => {
    test('should load valid global setup file', async () => {
      const setupFile = join(testDir, 'valid-setup.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          console.log('Setup executed');
        }
      `);

      await manager.loadSetup(setupFile);
      expect(manager.isLoaded()).toBe(true);
      expect(manager.getSetupFile()).toBe(setupFile);
    });

    test('should handle absolute paths', async () => {
      const setupFile = join(testDir, 'absolute-setup.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          console.log('Setup executed');
        }
      `);

      await manager.loadSetup(setupFile);
      expect(manager.isLoaded()).toBe(true);
    });

    test('should handle relative paths', async () => {
      const setupFile = join(testDir, 'relative-setup.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          console.log('Setup executed');
        }
      `);

      const relativePath = `./tmp/global-setup-tests/relative-setup.ts`;
      await manager.loadSetup(relativePath);
      expect(manager.isLoaded()).toBe(true);
    });

    test('should throw error for non-existent file', async () => {
      const nonExistentFile = join(testDir, 'non-existent.ts');

      await expect(manager.loadSetup(nonExistentFile))
        .rejects.toThrow('Global setup file not found');
    });

    test('should throw error for file without default export', async () => {
      const setupFile = join(testDir, 'no-default.ts');
      writeFileSync(setupFile, `
        export function someFunction(): void {
          console.log('Not a default export');
        }
      `);

      await expect(manager.loadSetup(setupFile))
        .rejects.toThrow('must export a default function');
    });

    test('should throw error for file with non-function default export', async () => {
      const setupFile = join(testDir, 'non-function.ts');
      writeFileSync(setupFile, `
        export default "not a function";
      `);

      await expect(manager.loadSetup(setupFile))
        .rejects.toThrow('must export a default function');
    });
  });

  describe('executeSetup', () => {
    test('should execute successful setup function', async () => {
      const setupFile = join(testDir, 'success-setup.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          // Successful setup
        }
      `);

      await manager.loadSetup(setupFile);
      const result = await manager.executeSetup();

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.setupFile).toBe(setupFile);
    });

    test('should handle setup function that throws error', async () => {
      const setupFile = join(testDir, 'error-setup.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          throw new Error('Setup failed');
        }
      `);

      await manager.loadSetup(setupFile);
      const result = await manager.executeSetup();

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Setup failed');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    test('should handle setup function with async operations', async () => {
      const setupFile = join(testDir, 'async-setup.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      `);

      await manager.loadSetup(setupFile);
      const result = await manager.executeSetup();

      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThanOrEqual(5);
    });

    test('should throw error when no setup is loaded', async () => {
      await expect(manager.executeSetup())
        .rejects.toThrow('No global setup function loaded');
    });
  });

  describe('loadAndExecute', () => {
    test('should load and execute in one call', async () => {
      const setupFile = join(testDir, 'load-execute.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          console.log('Load and execute test');
        }
      `);

      const result = await manager.loadAndExecute(setupFile);

      expect(result.success).toBe(true);
      expect(manager.isLoaded()).toBe(true);
    });

    test('should return error result for failed setup', async () => {
      const setupFile = join(testDir, 'fail-setup.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          throw new Error('Load and execute failed');
        }
      `);

      const result = await manager.loadAndExecute(setupFile);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Load and execute failed');
    });
  });

  describe('state management', () => {
    test('should track loaded state correctly', () => {
      expect(manager.isLoaded()).toBe(false);
      expect(manager.getSetupFile()).toBeUndefined();
    });

    test('should clear loaded setup', async () => {
      const setupFile = join(testDir, 'clear-test.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {}
      `);

      await manager.loadSetup(setupFile);
      expect(manager.isLoaded()).toBe(true);

      manager.clear();
      expect(manager.isLoaded()).toBe(false);
      expect(manager.getSetupFile()).toBeUndefined();
    });
  });

  describe('validateSetupFile', () => {
    test('should validate correct setup file', async () => {
      const setupFile = join(testDir, 'valid-validation.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          console.log('Valid setup');
        }
      `);

      const result = await GlobalSetupManager.validateSetupFile(setupFile);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should reject non-existent file', async () => {
      const nonExistentFile = join(testDir, 'does-not-exist.ts');

      const result = await GlobalSetupManager.validateSetupFile(nonExistentFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File does not exist');
    });

    test('should reject file without default export', async () => {
      const setupFile = join(testDir, 'no-default-validation.ts');
      writeFileSync(setupFile, `
        export function notDefault(): void {}
      `);

      const result = await GlobalSetupManager.validateSetupFile(setupFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must have a default export');
    });

    test('should reject file with non-function default export', async () => {
      const setupFile = join(testDir, 'non-function-validation.ts');
      writeFileSync(setupFile, `
        export default { notAFunction: true };
      `);

      const result = await GlobalSetupManager.validateSetupFile(setupFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be a function');
    });
  });

  describe('real-world scenarios', () => {
    test('should handle environment variable setup', async () => {
      const setupFile = join(testDir, 'env-setup.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          process.env.TEST_VARIABLE = 'setup-value';
          
          if (!process.env.NODE_ENV) {
            throw new Error('NODE_ENV is required');
          }
        }
      `);

      const result = await manager.loadAndExecute(setupFile);
      expect(result.success).toBe(true);
      expect(process.env.TEST_VARIABLE).toBe('setup-value');
    });

    test('should handle async API calls', async () => {
      const setupFile = join(testDir, 'api-setup.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, 5));
          
          // Simulate setting up auth token
          process.env.API_TOKEN = 'mock-token-123';
        }
      `);

      const result = await manager.loadAndExecute(setupFile);
      expect(result.success).toBe(true);
      expect(process.env.API_TOKEN).toBe('mock-token-123');
    });

    test('should handle database setup simulation', async () => {
      const setupFile = join(testDir, 'db-setup.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          // Simulate database connection check
          const canConnect = true; // Mock check
          
          if (!canConnect) {
            throw new Error('Database connection failed');
          }
          
          // Simulate seeding data
          global.testData = { users: ['user1', 'user2'] };
        }
      `);

      const result = await manager.loadAndExecute(setupFile);
      expect(result.success).toBe(true);
      expect((global as any).testData).toEqual({ users: ['user1', 'user2'] });
    });

    test('should handle complex setup with multiple steps', async () => {
      const setupFile = join(testDir, 'complex-setup.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          // Step 1: Validate environment
          if (!process.env.NODE_ENV) {
            process.env.NODE_ENV = 'test';
          }
          
          // Step 2: Setup auth
          process.env.AUTH_TOKEN = 'complex-token';
          
          // Step 3: Initialize test data
          global.setupData = {
            step1: 'completed',
            step2: 'completed',
            step3: 'completed'
          };
          
          // Step 4: Async validation
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      `);

      const result = await manager.loadAndExecute(setupFile);
      expect(result.success).toBe(true);
      expect((global as any).setupData).toEqual({
        step1: 'completed',
        step2: 'completed',
        step3: 'completed'
      });
    });
  });
});
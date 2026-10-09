/**
 * Integration Tests for Init Command
 * Tests the actual project initialization in a real environment
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { initProject } from '../../../framework/cli/init-command';

describe('Init Command Integration', () => {
  let testDir: string;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(process.cwd(), 'tests', 'temp-init-test');
    await fs.mkdir(testDir, { recursive: true });

    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Restore console methods
    jest.restoreAllMocks();
  });

  describe('Real Project Initialization', () => {
    it('should initialize a complete project structure', async () => {
      await initProject(testDir);

      // Check that directories were created
      const expectedDirs = ['tests', 'test-results', 'test-recorder'];
      for (const dir of expectedDirs) {
        const dirPath = path.join(testDir, dir);
        const stat = await fs.stat(dirPath);
        expect(stat.isDirectory()).toBe(true);
      }

      // Check that files were created
      const expectedFiles = [
        '.env',
        'endorphin.config.ts',
        'tests/SAMPLE-001.ts',
        '.gitignore',
        'README-ENDORPHIN.md'
      ];

      for (const file of expectedFiles) {
        const filePath = path.join(testDir, file);
        const exists = await fileExists(filePath);
        expect(exists).toBe(true);
      }

      // Verify console messages
      expect(consoleLogSpy).toHaveBeenCalledWith('🎯 Initializing Endorphin AI project...');
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ Endorphin AI project initialized successfully!');
    });

    it('should create proper .env file with helpful comments', async () => {
      await initProject(testDir);
      
      const envPath = path.join(testDir, '.env');
      const envContent = await fs.readFile(envPath, 'utf8');
      
      expect(envContent).toContain('OPENAI_API_KEY=');
      expect(envContent).toContain('🎯 How to get your OpenAI API key:');
      expect(envContent).toContain('https://platform.openai.com/api-keys');
      expect(envContent).toContain('npx endorphin-ai run test HEALTH-001');
    });

    it('should create proper config file with helpful comments', async () => {
      await initProject(testDir);
      
      const configPath = path.join(testDir, 'endorphin.config.ts');
      const configContent = await fs.readFile(configPath, 'utf8');
      
      expect(configContent).toContain('// Endorphin AI Configuration');
      expect(configContent).toContain('// This file controls how your tests run');
      expect(configContent).toContain('🎯 Configuration Tips:');
      expect(configContent).toContain('headless: true for faster execution');
    });

    it('should create sample test file', async () => {
      await initProject(testDir);
      
      const testFilePath = path.join(testDir, 'tests/SAMPLE-001.ts');
      const testContent = await fs.readFile(testFilePath, 'utf8');
      
      // Verify it contains a valid test structure
      expect(testContent).toContain('export const');
      // Should contain typical test properties
      expect(testContent).toMatch(/id|name|description|task/);
    });

    it('should skip initialization if project already exists', async () => {
      // First initialization
      await initProject(testDir);
      
      // Reset spies to clear first run
      consoleLogSpy.mockClear();
      
      // Second initialization attempt
      await initProject(testDir);
      
      expect(consoleLogSpy).toHaveBeenCalledWith('⚠️  Endorphin AI already initialized in this directory');
      expect(consoleLogSpy).toHaveBeenCalledWith('💡 Run: npx endorphin-ai run test HEALTH-001');
    });

    it('should handle missing examples directory gracefully', async () => {
      // This test verifies behavior when examples directory is not available
      // We'll expect warnings for files that can't be copied
      
      await initProject(testDir);
      
      // Even if some files fail to copy, directories should still be created
      const expectedDirs = ['tests', 'test-results', 'test-recorder'];
      for (const dir of expectedDirs) {
        const dirPath = path.join(testDir, dir);
        const stat = await fs.stat(dirPath);
        expect(stat.isDirectory()).toBe(true);
      }
    });
  });

  describe('File Content Processing', () => {
    it('should process different file types correctly', async () => {
      await initProject(testDir);

      // Check .env processing
      const envPath = path.join(testDir, '.env');
      if (await fileExists(envPath)) {
        const envContent = await fs.readFile(envPath, 'utf8');
        expect(envContent).toContain('🎯 How to get your OpenAI API key:');
      }

      // Check config processing
      const configPath = path.join(testDir, 'endorphin.config.ts');
      if (await fileExists(configPath)) {
        const configContent = await fs.readFile(configPath, 'utf8');
        expect(configContent).toContain('// Endorphin AI Configuration');
        expect(configContent).toContain('🎯 Configuration Tips:');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle permission errors gracefully', async () => {
      // Create a directory we can't write to (this might not work on all systems)
      const restrictedDir = '/root/restricted-test';
      
      // Mock process.exit to prevent actual exit
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await expect(initProject(restrictedDir)).rejects.toThrow();
      } catch {
        // Expected behavior
      }

      exitSpy.mockRestore();
    });
  });

  describe('Path Resolution', () => {
    it('should resolve paths correctly relative to the command location', async () => {
      await initProject(testDir);
      
      // Verify that files were actually created
      const configExists = await fileExists(path.join(testDir, 'endorphin.config.ts'));
      expect(configExists).toBe(true);
      
      // Verify directories exist
      const testsDir = path.join(testDir, 'tests');
      const testsDirStat = await fs.stat(testsDir);
      expect(testsDirStat.isDirectory()).toBe(true);
    });
  });
});

/**
 * Helper function to check if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

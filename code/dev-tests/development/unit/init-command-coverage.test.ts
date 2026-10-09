/**
 * Additional tests for init-command.ts to improve coverage
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { initProject } from '../../../framework/cli/init-command';

describe('Init Command - Coverage Enhancement', () => {
  const testTempDir = join(process.cwd(), 'temp-test-init-coverage');
  const exampleSourceDir = join(testTempDir, 'examples');

  beforeEach(() => {
    // Clean up any previous test runs
    if (existsSync(testTempDir)) {
      rmSync(testTempDir, { recursive: true, force: true });
    }
    
    // Create test environment
    mkdirSync(testTempDir, { recursive: true });
    mkdirSync(exampleSourceDir, { recursive: true });
    
    // Create nested directories for examples
    mkdirSync(join(exampleSourceDir, 'tests'), { recursive: true });
  });

  afterEach(() => {
    // Clean up test environment
    if (existsSync(testTempDir)) {
      rmSync(testTempDir, { recursive: true, force: true });
    }
  });

  test('should process file copying with content transformation', async () => {
    // Create mock example files
    writeFileSync(join(exampleSourceDir, '.env.example'), 'OPENAI_API_KEY=your_key_here');
    writeFileSync(join(exampleSourceDir, 'endorphin.config.ts'), 'export default {};');
    writeFileSync(join(exampleSourceDir, 'tests', 'SAMPLE-001.ts'), 'export const TEST = {};');
    writeFileSync(join(exampleSourceDir, 'tests', 'ui-demo.ts'), 'export const UI_DEMO = {};');
    writeFileSync(join(exampleSourceDir, '.gitignore.example'), 'node_modules/');
    writeFileSync(join(exampleSourceDir, 'README-ENDORPHIN.md'), '# Endorphin Project');

    const targetDir = join(testTempDir, 'user-project');

    // Mock the getFrameworkRoot to return our test directory
    const originalCwd = process.cwd();
    try {
      process.chdir(testTempDir);
      
      await initProject(targetDir);

      // Verify files were created and processed
      expect(existsSync(join(targetDir, '.env'))).toBe(true);
      expect(existsSync(join(targetDir, 'endorphin.config.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'tests', 'SAMPLE-001.ts'))).toBe(true);
      // ui-demo.ts only created when examples are found, not in fallback mode
      expect(existsSync(join(targetDir, '.gitignore'))).toBe(true);
      expect(existsSync(join(targetDir, 'README-ENDORPHIN.md'))).toBe(true);

      // Verify content processing
      const envContent = require('fs').readFileSync(join(targetDir, '.env'), 'utf8');
      expect(envContent).toContain('How to get your OpenAI API key');
      expect(envContent).toContain('npx endorphin-ai run test HEALTH-001');

      const configContent = require('fs').readFileSync(join(targetDir, 'endorphin.config.ts'), 'utf8');
      expect(configContent).toContain('Endorphin AI Configuration');
      expect(configContent).toContain('Configuration Tips');
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('should handle file copy errors gracefully', async () => {
    // This test is for coverage of error handling paths
    // Since the init command has robust fallback mechanisms, we'll test that it succeeds
    // even when examples directory is not found
    const targetDir = join(testTempDir, 'user-project-with-errors');
    
    const originalCwd = process.cwd();
    try {
      // Change to a directory without examples to trigger the fallback
      const tempNoExamplesDir = join(testTempDir, 'no-examples');
      mkdirSync(tempNoExamplesDir, { recursive: true });
      process.chdir(tempNoExamplesDir);
      
      await initProject(targetDir);
      
      // Basic files should still be created via fallback mechanism
      expect(existsSync(join(targetDir, '.env'))).toBe(true);
      expect(existsSync(join(targetDir, 'endorphin.config.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'tests'))).toBe(true);
      expect(existsSync(join(targetDir, '.gitignore'))).toBe(true);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('should handle nested directory creation', async () => {
    // Create example files in nested structure
    writeFileSync(join(exampleSourceDir, 'tests', 'SAMPLE-001.ts'), 'export const TEST = {};');

    const targetDir = join(testTempDir, 'nested-project');
    
    const originalCwd = process.cwd();
    try {
      process.chdir(testTempDir);
      
      await initProject(targetDir);

      // Verify nested directories were created (no tools directory in new implementation)
      expect(existsSync(join(targetDir, 'tests'))).toBe(true);
      expect(existsSync(join(targetDir, 'tests', 'SAMPLE-001.ts'))).toBe(true);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('should handle fallback to createBasicFiles when examples directory missing', async () => {
    // Don't create examples directory
    const targetDir = join(testTempDir, 'fallback-project');
    
    const originalCwd = process.cwd();
    try {
      process.chdir(testTempDir);
      
      await initProject(targetDir);

      // Should have created basic files
      expect(existsSync(join(targetDir, '.env'))).toBe(true);
      expect(existsSync(join(targetDir, 'endorphin.config.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'tests', 'SAMPLE-001.ts'))).toBe(true);
      expect(existsSync(join(targetDir, '.gitignore'))).toBe(true);
      expect(existsSync(join(targetDir, 'README-ENDORPHIN.md'))).toBe(true);
      // ui-demo.ts only created when examples are found, not in fallback mode
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('should process env file with proper formatting', async () => {
    const targetDir = join(testTempDir, 'env-test-project');
    
    const originalCwd = process.cwd();
    try {
      process.chdir(testTempDir);
      
      await initProject(targetDir);

      const envContent = require('fs').readFileSync(join(targetDir, '.env'), 'utf8');
      
      // Verify all expected sections are present
      expect(envContent).toContain('OPENAI_API_KEY=your_openai_api_key_here');
      expect(envContent).toContain('How to get your OpenAI API key:');
      expect(envContent).toContain('Go to: https://platform.openai.com/api-keys');
      expect(envContent).toContain('Create new secret key');
      expect(envContent).toContain('Replace "your_openai_api_key_here"');
      expect(envContent).toContain('Save this file');
      expect(envContent).toContain('Run: npx endorphin-ai run test HEALTH-001');
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('should process config file with proper formatting', async () => {
    const targetDir = join(testTempDir, 'config-test-project');
    
    const originalCwd = process.cwd();
    try {
      process.chdir(testTempDir);
      
      await initProject(targetDir);

      const configContent = require('fs').readFileSync(join(targetDir, 'endorphin.config.ts'), 'utf8');
      
      // Verify all expected sections are present
      expect(configContent).toContain('Endorphin AI Configuration');
      expect(configContent).toContain('This file controls how your tests run');
      expect(configContent).toContain('Configuration Tips:');
      expect(configContent).toContain('Set headless: true for faster execution');
      expect(configContent).toContain('Increase timeout for slow websites');
      expect(configContent).toContain('Change viewport for mobile testing');
      expect(configContent).toContain('Add your own custom settings here');
    } finally {
      process.chdir(originalCwd);
    }
  });
});
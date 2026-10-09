/**
 * CLI Functionality Integration Tests
 * Tests real CLI command execution and functionality
 */

import { execSync, spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

describe('CLI Functionality Integration Tests', () => {
  let testDir: string;
  let originalCwd: string;

  beforeAll(() => {
    originalCwd = process.cwd();
    testDir = path.join(__dirname, '../../../tmp/cli-functionality-tests');
  });

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('CLI Init Command', () => {
    it('should create project structure correctly', async () => {
      const projectDir = path.join(testDir, 'test-init-project');
      
      try {
        // Create project directory and cd into it
        await fs.mkdir(projectDir, { recursive: true });
        
        // Test the init command from within the project directory
        const initOutput = execSync(`npx tsx ${path.join(originalCwd, 'bin/endorphin.ts')} init`, {
          cwd: projectDir,
          encoding: 'utf8',
          timeout: process.platform === 'win32' ? 60000 : 30000 // Longer timeout for Windows
        });

        expect(initOutput).toBeDefined();

        // Verify project structure was created
        const expectedFiles = [
          'package.json',
          'endorphin.config.ts',
          'tests/sample-test.ts',
          'README-ENDORPHIN.md'
        ];

        for (const file of expectedFiles) {
          const filePath = path.join(projectDir, file);
          const exists = await fs.access(filePath).then(() => true).catch(() => false);
          expect(exists).toBe(true);
        }

        // Verify package.json has correct dependencies
        const packageJson = JSON.parse(await fs.readFile(path.join(projectDir, 'package.json'), 'utf8'));
        expect(packageJson.dependencies).toHaveProperty('endorphin-ai');
        expect(packageJson.devDependencies).toHaveProperty('@types/node');

        // Verify sample test uses new data format
        const sampleTest = await fs.readFile(path.join(projectDir, 'tests/sample-test.ts'), 'utf8');
        expect(sampleTest).toMatch(/["']?data["']?\s*:\s*async\s*\(\)\s*=>/);
        expect(sampleTest).not.toContain('testData: {');

      } catch (error) {
        throw new Error(`CLI init command failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, 60000);
  });

  describe('CLI Help Command', () => {
    it('should display help information', async () => {
      try {
        const helpOutput = execSync('npx tsx bin/endorphin.ts --help', {
          cwd: originalCwd,
          encoding: 'utf8',
          timeout: process.platform === 'win32' ? 30000 : 15000 // Longer timeout for Windows
        });

        expect(helpOutput).toBeDefined();
        expect(helpOutput).toContain('endorphin');
        expect(helpOutput).toContain('Commands:');
        expect(helpOutput).toContain('init');
        expect(helpOutput).toContain('run');
        expect(helpOutput).toContain('generate');

      } catch (error) {
        throw new Error(`CLI help command failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, 30000);
  });

  describe('CLI Run Command Validation', () => {
    it('should validate test existence before running', async () => {
      try {
        // Try to run a non-existent test
        let output = '';
        
        try {
          output = execSync(`npx tsx ${path.join(originalCwd, 'bin/endorphin.ts')} run test NONEXISTENT-001`, {
            cwd: originalCwd,
            encoding: 'utf8',
            timeout: process.platform === 'win32' ? 45000 : 15000, // Longer timeout for Windows
            stdio: 'pipe',
            env: {
              ...process.env,
              OPENAI_API_KEY: 'test-api-key-for-validation',
              NO_COLOR: '1' // Disable colors for cleaner test output
            }
          });
        } catch (error: any) {
          // CLI might exit with error code, capture output from error
          output = (error.stdout || '') + (error.stderr || '') + (error.message || '');
        }

        // Check for test not found message in output (CLI handles this gracefully)
        expect(output).toMatch(/(NONEXISTENT-001|Test not found|not.*found)/i);

      } catch (error) {
        throw new Error(`CLI run command validation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, process.platform === 'win32' ? 60000 : 30000); // Longer timeout for Windows
  });

  describe('CLI Generate Report Command', () => {
    it.skip('should handle empty test results gracefully', async () => {
      try {
        let output = '';
        
        try {
          output = execSync(`npx tsx ${path.join(originalCwd, 'bin/endorphin.ts')} generate report`, {
            cwd: originalCwd,
            encoding: 'utf8',
            timeout: 15000,
            stdio: 'pipe',
            env: {
              ...process.env,
              NO_COLOR: '1' // Disable colors for cleaner test output
            }
          });
        } catch (error: any) {
          // Mark that we caught an error
          output = (error.stdout || '') + (error.stderr || '') + (error.message || '');
        }

        // Debug: Log what we actually got
        console.log('Generate report output:', JSON.stringify(output));
        
        // Should either succeed with empty report or give helpful error message  
        expect(output).toMatch(/No test results|Report generated|report.*generated|Generating.*report|Run some tests first/i);

      } catch (error) {
        throw new Error(`CLI generate report command failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, 30000);
  });

  describe('CLI Test Recorder Validation', () => {
    it('should validate test recorder accessibility', async () => {
      try {
        // Test that test recorder can be invoked and starts properly
        // Use a short timeout to avoid hanging, expect it to timeout
        let output = '';
        let didTimeout = false;
        
        try {
          output = execSync(`npx tsx ${path.join(originalCwd, 'bin/endorphin.ts')} run test-recorder`, {
            cwd: originalCwd,
            encoding: 'utf8',
            timeout: 3000, // Short timeout - we expect this to timeout
            env: {
              ...process.env,
              OPENAI_API_KEY: 'test-api-key-for-validation'
            }
          });
        } catch (error: any) {
          didTimeout = error.signal === 'SIGTERM' || error.code === 'ETIMEDOUT';
          output = error.stdout || error.stderr || '';
        }

        // Should either timeout (expected) or start successfully
        // The key is that it shouldn't have import/module errors
        expect(output).not.toMatch(/Cannot find module|Module not found|SyntaxError|ENOENT/i);
        
        // If it started, should contain recorder startup messages or endorphin CLI output
        if (output) {
          expect(output).toMatch(/Interactive Test Recorder|Test Data Collection|Initializing|Starting|🎬|ENDORPHIN|endorphin/i);
        }

        // Timeout is expected and acceptable for this test
        expect(didTimeout || output.length > 0).toBe(true);

      } catch (error) {
        throw new Error(`CLI test recorder validation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, 30000);
  });

  describe('CLI Command Error Handling', () => {
    it('should handle invalid commands gracefully', async () => {
      try {
        let errorThrown = false;
        let errorOutput = '';
        
        try {
          execSync('npx tsx bin/endorphin.ts invalid-command', {
            cwd: originalCwd,
            encoding: 'utf8',
            timeout: 15000
          });
        } catch (error: any) {
          errorThrown = true;
          errorOutput = error.stdout || error.stderr || error.message;
        }

        expect(errorThrown).toBe(true);
        expect(errorOutput).toMatch(/Unknown command|Invalid command|help/i);

      } catch (error) {
        throw new Error(`CLI error handling test failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, 30000);
  });

  describe('CLI Environment Validation', () => {
    it.skip('should validate Node.js environment and dependencies', async () => {
      try {
        // Test that CLI can check environment
        let versionOutput = '';
        
        try {
          versionOutput = execSync(`npx tsx ${path.join(originalCwd, 'bin/endorphin.ts')} --version`, {
            cwd: originalCwd,
            encoding: 'utf8',
            timeout: 15000,
            stdio: 'pipe',
            env: {
              ...process.env,
              NO_COLOR: '1' // Disable colors for cleaner test output
            }
          });
        } catch (error: any) {
          // Capture output even if command exits with error code
          versionOutput = (error.stdout || '') + (error.stderr || '') + (error.message || '');
        }

        expect(versionOutput).toBeDefined();
        expect(versionOutput.trim()).toMatch(/Endorphin AI v\d+\.\d+\.\d+/i); // Full version format

      } catch (error) {
        throw new Error(`CLI environment validation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, 30000);
  });
});
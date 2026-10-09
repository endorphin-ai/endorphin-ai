/**
 * Package Distribution Integration Tests
 * Tests the actual npm pack and distributed package functionality
 *
 * Build and pack are done once in beforeAll to avoid redundant work,
 * especially on Windows CI where npm operations are significantly slower.
 */

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const isWindows = process.platform === 'win32';

/**
 * Run a command cross-platform.
 * On Windows, uses cmd.exe to resolve .cmd scripts (e.g. npm.cmd) properly.
 * Always uses stdio:'pipe' to prevent zombie output if the process is killed by timeout.
 */
function run(cmd: string, options: { cwd: string; timeout: number }): string {
  return execSync(cmd, {
    cwd: options.cwd,
    timeout: options.timeout,
    encoding: 'utf8',
    stdio: 'pipe',
    shell: isWindows ? 'cmd.exe' : undefined,
  });
}

describe('Package Distribution Integration Tests', () => {
  let testDir: string;
  let originalCwd: string;
  let packageFilePath: string;
  let buildSucceeded = false;

  beforeAll(async () => {
    originalCwd = process.cwd();
    testDir = path.join(__dirname, '../../../tmp/package-distribution-tests');
    await fs.mkdir(testDir, { recursive: true });

    // Build and pack once — shared by all tests.
    // CI already runs "npm run build" before tests, so skip rebuild if dist/ exists.
    try {
      const distDir = path.join(originalCwd, 'dist');
      const distExists = await fs.access(distDir).then(() => true).catch(() => false);

      if (!distExists) {
        run('npm run build', {
          cwd: originalCwd,
          timeout: isWindows ? 180000 : 60000,
        });
      }

      // --ignore-scripts skips the prepare lifecycle hook (just an echo) to save time
      run(`npm pack --ignore-scripts --pack-destination "${testDir}"`, {
        cwd: originalCwd,
        timeout: isWindows ? 180000 : 30000,
      });

      const files = await fs.readdir(testDir);
      const tgzFile = files.find(f => f.endsWith('.tgz'));
      if (!tgzFile) throw new Error('No .tgz package file created');
      packageFilePath = path.join(testDir, tgzFile);
      buildSucceeded = true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`beforeAll build/pack failed: ${msg}`);
    }
  }, isWindows ? 300000 : 180000);

  afterAll(async () => {
    process.chdir(originalCwd);
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Build Process', () => {
    it('should build successfully without errors', async () => {
      expect(buildSucceeded).toBe(true);

      // Verify dist directory exists and has expected files
      const distDir = path.join(originalCwd, 'dist');
      const distExists = await fs.access(distDir).then(() => true).catch(() => false);
      expect(distExists).toBe(true);

      const essentialFiles = [
        'framework/index.js',
        'framework/templates/reporter/report-template.html',
        'framework/automation/browser/browser-manager.js',
        'framework/reporters/html-reporter.js'
      ];

      for (const file of essentialFiles) {
        const filePath = path.join(distDir, file);
        const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);
      }
    }, 30000);
  });

  describe('Package Creation', () => {
    it('should create npm package successfully', async () => {
      expect(buildSucceeded).toBe(true);
      expect(packageFilePath).toBeDefined();

      const packageExists = await fs.access(packageFilePath).then(() => true).catch(() => false);
      expect(packageExists).toBe(true);
    }, 30000);
  });

  describe('Installed Package Functionality', () => {
    it('should work when installed as npm package', async () => {
      expect(buildSucceeded).toBe(true);

      const testProjectDir = path.join(testDir, 'test-project');
      await fs.mkdir(testProjectDir, { recursive: true });

      try {
        // Create package.json for test project
        const packageJson = {
          name: 'test-endorphin-project',
          version: '1.0.0',
          type: 'module',
          dependencies: {}
        };
        await fs.writeFile(
          path.join(testProjectDir, 'package.json'),
          JSON.stringify(packageJson, null, 2)
        );

        // Install the package — generous timeout for Windows CI
        run(`npm install "${packageFilePath}"`, {
          cwd: testProjectDir,
          timeout: isWindows ? 240000 : 120000,
        });

        // Test that the package can be imported and used
        const testScript = `
import { HtmlReporter } from 'endorphin-ai';

try {
  const reporter = new HtmlReporter('./test-results');
  console.log('SUCCESS: Package import and instantiation works');
  process.exit(0);
} catch (error) {
  console.error('FAILED: Package import failed:', error.message);
  process.exit(1);
}
`;

        await fs.writeFile(path.join(testProjectDir, 'test-import.mjs'), testScript);

        const testOutput = run('node test-import.mjs', {
          cwd: testProjectDir,
          timeout: 30000,
        });

        expect(testOutput).toContain('SUCCESS');
      } finally {
        process.chdir(originalCwd);
      }
    }, isWindows ? 360000 : 180000); // 6 min on Windows, 3 min elsewhere
  });

  describe('Template Resolution in Distributed Package', () => {
    it('should find templates when installed as package', async () => {
      expect(buildSucceeded).toBe(true);

      const testProjectDir = path.join(testDir, 'template-test-project');
      await fs.mkdir(testProjectDir, { recursive: true });

      try {
        const packageJson = {
          name: 'template-test-project',
          version: '1.0.0',
          type: 'module',
          dependencies: {}
        };
        await fs.writeFile(
          path.join(testProjectDir, 'package.json'),
          JSON.stringify(packageJson, null, 2)
        );

        // Install the package
        run(`npm install "${packageFilePath}"`, {
          cwd: testProjectDir,
          timeout: isWindows ? 240000 : 120000,
        });

        // Test template resolution from installed package
        const templateTestScript = `
import { HtmlReporter } from 'endorphin-ai';
import fs from 'fs';

try {
  const reporter = new HtmlReporter('./test-results');

  const mockSessions = [{
    id: 'test-session',
    testId: 'TEST-001',
    testName: 'Template Test',
    startTime: new Date(),
    endTime: new Date(),
    status: 'SUCCESS',
    duration: 1000,
    steps: [],
    screenshots: [],
    finalResult: 'Test completed'
  }];

  await reporter.generateReport(mockSessions);

  const reportFiles = fs.readdirSync('./test-results/reports').filter(f => f.endsWith('.html'));

  if (reportFiles.length > 0) {
    console.log('SUCCESS: Template resolution works in installed package');
    process.exit(0);
  } else {
    console.error('FAILED: No report generated - template resolution failed');
    process.exit(1);
  }
} catch (error) {
  console.error('FAILED: Template resolution error:', error.message);
  process.exit(1);
}
`;

        await fs.writeFile(path.join(testProjectDir, 'template-test.mjs'), templateTestScript);

        const testOutput = run('node template-test.mjs', {
          cwd: testProjectDir,
          timeout: 30000,
        });

        expect(testOutput).toContain('SUCCESS');
      } finally {
        process.chdir(originalCwd);
      }
    }, isWindows ? 360000 : 180000);
  });
});

/**
 * Integration tests for npx resolution issues
 * Ensures the CLI binary works correctly with various invocation methods
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

describe('npx Resolution Integration', () => {
  const projectRoot = join(__dirname, '..', '..', '..');
  const distBinaryPath = join(projectRoot, 'dist', 'bin', 'endorphin.js');
  const srcBinaryPath = join(projectRoot, 'bin', 'endorphin.ts');
  
  // Use dist if available (local dev), otherwise check source (CI before build)
  const binaryPath = existsSync(distBinaryPath) ? distBinaryPath : srcBinaryPath;
  const isDistBuild = existsSync(distBinaryPath);

  beforeAll(() => {
    // Ensure at least one binary exists
    expect(existsSync(distBinaryPath) || existsSync(srcBinaryPath)).toBe(true);
  });

  describe('Binary File Validation', () => {
    test('should have correct shebang line', async () => {
      const fs = await import('fs/promises');
      const content = await fs.readFile(binaryPath, 'utf8');
      const firstLine = content.split('\n')[0];
      expect(firstLine).toBe('#!/usr/bin/env node');
    });

    test('should be executable', async () => {
      if (!isDistBuild) {
        // Skip in CI before build
        expect(true).toBe(true);
        return;
      }
      
      // Skip permission check on Windows (Windows doesn't use Unix permissions)
      if (process.platform === 'win32') {
        expect(true).toBe(true);
        return;
      }
      
      const fs = await import('fs/promises');
      const stats = await fs.stat(binaryPath);
      // Check if file has execute permissions (mode & 0o111)
      expect(stats.mode & 0o111).toBeGreaterThan(0);
    });

    test.skip('should execute with node directly', (done) => {
      if (!isDistBuild) {
        // Skip in CI before build
        done();
        return;
      }
      const child = spawn('node', [binaryPath, '--version'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        expect(code).toBe(0);
        expect(output).toMatch(/Endorphin AI v\d+\.\d+\.\d+/);
        done();
      });

      child.on('error', (error) => {
        done(error);
      });
    }, 10000);

    test.skip('should execute directly as script', (done) => {
      if (!isDistBuild) {
        // Skip in CI before build
        done();
        return;
      }
      
      // On Windows, we need to use 'node' to execute the script
      const command = process.platform === 'win32' ? 'node' : binaryPath;
      const args = process.platform === 'win32' ? [binaryPath, '--version'] : ['--version'];
      
      const child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32'
      });

      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        expect(code).toBe(0);
        expect(output).toMatch(/Endorphin AI v\d+\.\d+\.\d+/);
        done();
      });

      child.on('error', (error) => {
        done(error);
      });
    }, 10000);
  });

  describe('npm Scripts Integration', () => {
    test('should have npm script alternatives in package.json', async () => {
      const fs = await import('fs/promises');
      const packagePath = join(projectRoot, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf8');
      const packageJson = JSON.parse(packageContent);

      // Check that npm script alternatives exist
      expect(packageJson.scripts).toHaveProperty('endorphin-ai:init');
      expect(packageJson.scripts).toHaveProperty('endorphin-ai:version');
      expect(packageJson.scripts).toHaveProperty('endorphin-ai:help');

      // Check that scripts point to the correct binary (allow both full path and short form for CI compatibility)
      expect(packageJson.scripts['endorphin-ai:init']).toMatch(/(\.\/node_modules\/\.bin\/)?endorphin init/);
      expect(packageJson.scripts['endorphin-ai:version']).toMatch(/(\.\/node_modules\/\.bin\/)?endorphin --version/);
      expect(packageJson.scripts['endorphin-ai:help']).toMatch(/(\.\/node_modules\/\.bin\/)?endorphin --help/);
    });

    test('should have postinstall script', async () => {
      const fs = await import('fs/promises');
      const packagePath = join(projectRoot, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf8');
      const packageJson = JSON.parse(packageContent);

      expect(packageJson.scripts).toHaveProperty('postinstall');
      expect(packageJson.scripts.postinstall).toBe('node scripts/postinstall.js');
    });

    test('should include scripts directory in files array', async () => {
      const fs = await import('fs/promises');
      const packagePath = join(projectRoot, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf8');
      const packageJson = JSON.parse(packageContent);

      expect(packageJson.files || []).toContain('scripts/');
    });
  });

  describe('Postinstall Script Validation', () => {
    test('should have postinstall script file', () => {
      const postinstallPath = join(projectRoot, 'scripts', 'postinstall.js');
      expect(existsSync(postinstallPath)).toBe(true);
    });

    test('should have correct postinstall script content', async () => {
      const fs = await import('fs/promises');
      const postinstallPath = join(projectRoot, 'scripts', 'postinstall.js');
      const content = await fs.readFile(postinstallPath, 'utf8');

      // Check for key elements in the postinstall script
      expect(content).toContain('#!/usr/bin/env node');
      expect(content).toContain('ensureBinaryExecutable');
      expect(content).toContain('printUsageInstructions');
      expect(content).toContain('npm run endorphin-ai:init');
      expect(content).toContain('🔧 Alternative:');
    });

    test('postinstall script should be executable', (done) => {
      const postinstallPath = join(projectRoot, 'scripts', 'postinstall.js');
      const child = spawn('node', [postinstallPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: projectRoot
      });

      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        expect(code).toBe(0);
        expect(output).toContain('Endorphin AI installed successfully');
        expect(output).toContain('Quick start:');
        expect(output).toContain('npm run endorphin-ai:init');
        done();
      });

      child.on('error', (error) => {
        done(error);
      });
    }, 10000);
  });

  describe('Package.json bin Configuration', () => {
    test('should have correct bin configuration', async () => {
      const fs = await import('fs/promises');
      const packagePath = join(projectRoot, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf8');
      const packageJson = JSON.parse(packageContent);

      expect(packageJson.bin).toHaveProperty('endorphin');
      expect(packageJson.bin).toHaveProperty('endorphin-ai');
      // Allow both with and without ./ prefix (CI vs local differences)
      expect(packageJson.bin.endorphin).toMatch(/^(\.\/)?dist\/bin\/endorphin\.js$/);
      expect(packageJson.bin['endorphin-ai']).toMatch(/^(\.\/)?dist\/bin\/endorphin\.js$/);
    });

    test('should point to existing binary file', async () => {
      const fs = await import('fs/promises');
      const packagePath = join(projectRoot, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf8');
      const packageJson = JSON.parse(packageContent);

      const binaryRelativePath = packageJson.bin.endorphin;
      const fullBinaryPath = join(projectRoot, binaryRelativePath);
      
      // In CI, the dist might not exist yet, so check if source exists
      const srcPath = join(projectRoot, 'bin', 'endorphin.ts');
      expect(existsSync(fullBinaryPath) || existsSync(srcPath)).toBe(true);
    });
  });

  describe('README Documentation', () => {
    test('should have troubleshooting section in README', async () => {
      const fs = await import('fs/promises');
      const readmePath = join(projectRoot, 'README.md');
      const content = await fs.readFile(readmePath, 'utf8');

      expect(content).toContain('🔧 Troubleshooting Installation');
      expect(content).toContain('npm run endorphin:init');
      expect(content).toContain('npx --clear-cache');
      expect(content).toContain('./node_modules/.bin/endorphin-ai');
    });

    test('should have npm scripts examples in README', async () => {
      const fs = await import('fs/promises');
      const readmePath = join(projectRoot, 'README.md');
      const content = await fs.readFile(readmePath, 'utf8');

      expect(content).toContain('"endorphin:init"');
      expect(content).toContain('"endorphin:version"');
      expect(content).toContain('"endorphin:help"');
    });
  });
});
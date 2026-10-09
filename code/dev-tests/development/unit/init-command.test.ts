/**
 * Unit Tests for Init Command
 * Tests the project initialization functionality
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { initProject } from '../../../framework/cli/init-command';

// Mock fs/promises
jest.mock('fs/promises');
const mockFs = jest.mocked(fs);

describe('Init Command', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;
  
  const mockTargetDir = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Project Initialization', () => {
    it('should initialize a new project successfully', async () => {
      // Mock file system operations
      mockFs.access.mockRejectedValue(new Error('File not found')); // Config doesn't exist
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('mock file content');
      mockFs.writeFile.mockResolvedValue();

      await initProject(mockTargetDir);

      // Verify initialization message
      expect(consoleLogSpy).toHaveBeenCalledWith('🎯 Initializing Endorphin AI project...');
      
      // Verify directories are created
      expect(mockFs.mkdir).toHaveBeenCalledWith(path.join(mockTargetDir, 'tests'), { recursive: true });
      expect(mockFs.mkdir).toHaveBeenCalledWith(path.join(mockTargetDir, 'test-results'), { recursive: true });
      expect(mockFs.mkdir).toHaveBeenCalledWith(path.join(mockTargetDir, 'test-recorder'), { recursive: true });
      
      // Verify success message
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ Endorphin AI project initialized successfully!');
      expect(consoleLogSpy).toHaveBeenCalledWith('🚀 Next steps:');
    });

    it('should skip initialization if project already exists', async () => {
      // Mock config file exists
      mockFs.access.mockResolvedValue(undefined);

      await initProject(mockTargetDir);

      expect(consoleLogSpy).toHaveBeenCalledWith('⚠️  Endorphin AI already initialized in this directory');
      expect(consoleLogSpy).toHaveBeenCalledWith('💡 Run: npx endorphin-ai run test HEALTH-001');
      
      // Should not create directories or files
      expect(mockFs.mkdir).not.toHaveBeenCalled();
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should use current working directory when no target provided', async () => {
      const originalCwd = process.cwd();
      mockFs.access.mockRejectedValue(new Error('File not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('mock content');
      mockFs.writeFile.mockResolvedValue();

      await initProject(); // No target dir provided

      // Should use process.cwd()
      expect(mockFs.access).toHaveBeenCalledWith(path.join(originalCwd, 'endorphin.config.ts'));
    });

    it('should handle initialization errors gracefully', async () => {
      const error = new Error('Permission denied');
      mockFs.access.mockRejectedValue(new Error('File not found')); // Config doesn't exist
      mockFs.mkdir.mockRejectedValue(error); // Fail on directory creation

      try {
        await initProject(mockTargetDir);
      } catch (exitError) {
        // Expected to throw due to process.exit mock
        expect(exitError).toEqual(new Error('process.exit called'));
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Failed to initialize project:', error.message);
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Directory Creation', () => {
    it('should create all required directories', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('content');
      mockFs.writeFile.mockResolvedValue();

      await initProject(mockTargetDir);

      const expectedDirs = ['tests', 'test-results', 'test-recorder'];
      expectedDirs.forEach(dir => {
        expect(mockFs.mkdir).toHaveBeenCalledWith(path.join(mockTargetDir, dir), { recursive: true });
        expect(consoleLogSpy).toHaveBeenCalledWith(`📁 Created directory: ${dir}/`);
      });
    });
  });

  describe('File Processing', () => {
    beforeEach(() => {
      mockFs.access.mockRejectedValue(new Error('File not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();
    });

    it('should process .env file with helpful comments', async () => {
      const mockEnvContent = 'OPENAI_API_KEY=your_openai_api_key_here';
      mockFs.readFile.mockImplementation(((filePath: string) => {
        if (filePath.toString().includes('.env.example')) {
          return Promise.resolve(mockEnvContent);
        }
        return Promise.resolve('other content');
      }) as any);

      await initProject(mockTargetDir);

      const _expectedEnvContent = `${mockEnvContent}

# 🎯 How to get your OpenAI API key:
# 1. Go to: https://platform.openai.com/api-keys
# 2. Create new secret key
# 3. Replace "your_openai_api_key_here" above with your actual key
# 4. Save this file
# 5. Run: npx endorphin-ai run test HEALTH-001`;

      // Since examples directory doesn't exist, it should create basic files
      // Check that the basic .env file was created
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(mockTargetDir, '.env'),
        expect.stringContaining('OPENAI_API_KEY=your_openai_api_key_here')
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(mockTargetDir, '.env'),
        expect.stringContaining('🎯 How to get your OpenAI API key:')
      );
    });

    it('should process config file with helpful comments', async () => {
      const mockConfigContent = 'export default { browser: { headless: false } };';
      mockFs.readFile.mockImplementation(((filePath: any) => {
        if (filePath.toString().includes('endorphin.config.js')) {
          return Promise.resolve(mockConfigContent);
        }
        return Promise.resolve('other content');
      }) as any);

      await initProject(mockTargetDir);

      const _expectedConfigContent = `// Endorphin AI Configuration
// This file controls how your tests run

${mockConfigContent}

// 🎯 Configuration Tips:
// - Set headless: true for faster execution
// - Increase timeout for slow websites
// - Change viewport for mobile testing
// - Add your own custom settings here`;

      // Since examples directory doesn't exist, it should create basic files
      // Check that the basic config file was created
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(mockTargetDir, 'endorphin.config.ts'),
        expect.stringContaining('// Endorphin AI Configuration')
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(mockTargetDir, 'endorphin.config.ts'),
        expect.stringContaining('export default {')
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(mockTargetDir, 'endorphin.config.ts'),
        expect.stringContaining('🎯 Configuration Tips:')
      );
    });

    it('should handle file copy errors gracefully', async () => {
      // Mock examples directory not found
      mockFs.access.mockRejectedValue(new Error('Examples directory not found'));
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await initProject(mockTargetDir);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/⚠️ {2}Init templates not found at:/)
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '⚠️  Creating basic configuration files instead...'
      );
      
      consoleWarnSpy.mockRestore();
    });

    it('should create all expected files', async () => {
      mockFs.readFile.mockResolvedValue('mock content');

      await initProject(mockTargetDir);

      const expectedFiles = [
        '.env',
        'endorphin.config.ts',
        'tests/sample-test.ts',
        '.gitignore',
        'README-ENDORPHIN.md'
      ];

      expectedFiles.forEach(file => {
        expect(mockFs.writeFile).toHaveBeenCalledWith(
          path.join(mockTargetDir, file),
          expect.any(String)
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(`📄 Created: ${file}`);
      });
    });
  });

  describe('File Existence Check', () => {
    it('should correctly detect existing files', async () => {
      // Mock the first call (.js) to fail, second call (.ts) to succeed
      mockFs.access
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce(undefined);

      await initProject(mockTargetDir);

      expect(mockFs.access).toHaveBeenCalledWith(path.join(mockTargetDir, 'endorphin.config.js'));
      expect(mockFs.access).toHaveBeenCalledWith(path.join(mockTargetDir, 'endorphin.config.ts'));
      expect(consoleLogSpy).toHaveBeenCalledWith('⚠️  Endorphin AI already initialized in this directory');
    });

    it('should correctly detect non-existing files', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('content');
      mockFs.writeFile.mockResolvedValue();

      await initProject(mockTargetDir);

      expect(mockFs.access).toHaveBeenCalledWith(path.join(mockTargetDir, 'endorphin.config.ts'));
      expect(consoleLogSpy).toHaveBeenCalledWith('🎯 Initializing Endorphin AI project...');
    });
  });
});

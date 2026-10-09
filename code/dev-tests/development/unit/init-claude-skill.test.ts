/**
 * Unit Tests for Init Claude Skill Command
 * Tests that initClaudeSkill() performs the correct file system operations.
 *
 * Strategy: Mock fs/promises and fs modules, call the actual initClaudeSkill(),
 * and verify it calls the correct fs operations with expected arguments.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';

// Mock logger
jest.mock('../../../framework/core/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock fs/promises
const mockMkdir = jest.fn<() => Promise<undefined>>().mockResolvedValue(undefined);
const mockWriteFile = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockReadFile = jest.fn<() => Promise<string>>().mockResolvedValue('');
const mockAccess = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

jest.mock('fs/promises', () => ({
  default: {
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
    access: (...args: unknown[]) => mockAccess(...args),
  },
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  access: (...args: unknown[]) => mockAccess(...args),
}));

// Mock fs (sync operations for template discovery)
const mockAccessSync = jest.fn();
jest.mock('fs', () => ({
  default: {
    accessSync: (...args: unknown[]) => mockAccessSync(...args),
  },
  accessSync: (...args: unknown[]) => mockAccessSync(...args),
}));

// Import the function under test AFTER mocks are set up
import { initClaudeSkill } from '../../../framework/cli/init-claude-skill-command.js';

describe('InitClaudeSkill', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Spy on console methods (the function uses console.log for user output)
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Default: template directory exists (accessSync succeeds)
    mockAccessSync.mockImplementation(() => undefined);

    // Default: templates directory is accessible
    mockAccess.mockResolvedValue(undefined);

    // Default: template files contain content
    mockReadFile.mockImplementation((filePath: unknown) => {
      const p = String(filePath);
      if (p.endsWith('write-test.md')) return Promise.resolve('# Write Test\n\nContent');
      if (p.endsWith('fix-test.md')) return Promise.resolve('# Fix Test\n\nContent');
      if (p.endsWith('record-test.md')) return Promise.resolve('# Record Test\n\nContent');
      if (p.endsWith('CLAUDE.md')) return Promise.resolve('# Endorphin AI — Test Recorder API\n\nAPI docs');
      return Promise.reject(new Error('ENOENT: no such file'));
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Directory Creation', () => {
    it('should create .claude directory', async () => {
      await initClaudeSkill('/test/project');

      expect(mockMkdir).toHaveBeenCalledWith(
        path.join('/test/project', '.claude'),
        { recursive: true }
      );
    });

    it('should create .claude/commands directory', async () => {
      await initClaudeSkill('/test/project');

      expect(mockMkdir).toHaveBeenCalledWith(
        path.join('/test/project', '.claude', 'commands'),
        { recursive: true }
      );
    });
  });

  describe('Skill File Copying', () => {
    it('should read and write all three skill templates', async () => {
      await initClaudeSkill('/test/project');

      // Should read source templates
      expect(mockReadFile).toHaveBeenCalledWith(expect.stringContaining('write-test.md'), 'utf8');
      expect(mockReadFile).toHaveBeenCalledWith(expect.stringContaining('fix-test.md'), 'utf8');
      expect(mockReadFile).toHaveBeenCalledWith(expect.stringContaining('record-test.md'), 'utf8');

      // Should write to destination
      const commandsDir = path.join('/test/project', '.claude', 'commands');
      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(commandsDir, 'write-test.md'),
        '# Write Test\n\nContent'
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(commandsDir, 'fix-test.md'),
        '# Fix Test\n\nContent'
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(commandsDir, 'record-test.md'),
        '# Record Test\n\nContent'
      );
    });

    it('should warn when a skill file cannot be copied', async () => {
      mockReadFile.mockImplementation((filePath: unknown) => {
        const p = String(filePath);
        if (p.endsWith('write-test.md')) return Promise.reject(new Error('Permission denied'));
        if (p.endsWith('CLAUDE.md')) return Promise.resolve('# Endorphin AI — Test Recorder API\n\nDocs');
        return Promise.resolve('content');
      });

      await initClaudeSkill('/test/project');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not create write-test.md')
      );
    });
  });

  describe('CLAUDE.md Handling', () => {
    it('should create new CLAUDE.md when it does not exist', async () => {
      // First readFile call for existing CLAUDE.md fails (doesn't exist)
      const readFileMock = mockReadFile.mockImplementation((filePath: unknown) => {
        const p = String(filePath);
        if (p === path.join('/test/project', '.claude', 'CLAUDE.md')) {
          return Promise.reject(new Error('ENOENT'));
        }
        if (p.endsWith('write-test.md')) return Promise.resolve('# Write Test');
        if (p.endsWith('fix-test.md')) return Promise.resolve('# Fix Test');
        if (p.endsWith('record-test.md')) return Promise.resolve('# Record Test');
        // Template CLAUDE.md (source)
        if (p.includes('templates') && p.endsWith('CLAUDE.md')) {
          return Promise.resolve('# Endorphin AI — Test Recorder API\n\nAPI docs');
        }
        return Promise.reject(new Error('ENOENT'));
      });

      await initClaudeSkill('/test/project');

      // Should write CLAUDE.md with template content (no separator since no existing content)
      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join('/test/project', '.claude', 'CLAUDE.md'),
        '# Endorphin AI — Test Recorder API\n\nAPI docs'
      );
    });

    it('should append to existing CLAUDE.md with separator', async () => {
      mockReadFile.mockImplementation((filePath: unknown) => {
        const p = String(filePath);
        if (p === path.join('/test/project', '.claude', 'CLAUDE.md')) {
          return Promise.resolve('# My Project\n\nExisting docs.');
        }
        if (p.includes('templates') && p.endsWith('CLAUDE.md')) {
          return Promise.resolve('# Endorphin AI — Test Recorder API\n\nAPI docs');
        }
        if (p.endsWith('.md')) return Promise.resolve('template content');
        return Promise.reject(new Error('ENOENT'));
      });

      await initClaudeSkill('/test/project');

      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join('/test/project', '.claude', 'CLAUDE.md'),
        '# My Project\n\nExisting docs.\n\n---\n\n# Endorphin AI — Test Recorder API\n\nAPI docs'
      );
    });

    it('should skip update when Endorphin content already exists (idempotency)', async () => {
      mockReadFile.mockImplementation((filePath: unknown) => {
        const p = String(filePath);
        if (p === path.join('/test/project', '.claude', 'CLAUDE.md')) {
          return Promise.resolve('# Endorphin AI — Test Recorder API\n\nAlready present.');
        }
        if (p.includes('templates') && p.endsWith('CLAUDE.md')) {
          return Promise.resolve('# Endorphin AI — Test Recorder API\n\nAPI docs');
        }
        if (p.endsWith('.md')) return Promise.resolve('template content');
        return Promise.reject(new Error('ENOENT'));
      });

      await initClaudeSkill('/test/project');

      // Should NOT write to CLAUDE.md since content is already present
      const claudeMdWriteCalls = mockWriteFile.mock.calls.filter(
        (call) => String(call[0]).endsWith('.claude/CLAUDE.md')
      );
      expect(claudeMdWriteCalls).toHaveLength(0);

      // Should log that it was skipped
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('already contains Endorphin AI documentation')
      );
    });
  });

  describe('Template Discovery', () => {
    it('should warn when templates directory is not accessible', async () => {
      // accessSync succeeds (template dir found), but access() rejects (dir doesn't actually exist)
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      await initClaudeSkill('/test/project');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skill templates not found')
      );
    });
  });

  describe('Console Output', () => {
    it('should log initialization progress', async () => {
      await initClaudeSkill('/test/project');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Initializing Claude Code integration')
      );
    });

    it('should log success message on completion', async () => {
      await initClaudeSkill('/test/project');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Claude Code integration initialized')
      );
    });

    it('should log created file paths', async () => {
      await initClaudeSkill('/test/project');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('.claude/commands/write-test.md')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('.claude/commands/fix-test.md')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('.claude/commands/record-test.md')
      );
    });
  });

  describe('Default Target Directory', () => {
    it('should use process.cwd() when no targetDir provided', async () => {
      const originalCwd = process.cwd();

      await initClaudeSkill();

      // Should create .claude in cwd
      expect(mockMkdir).toHaveBeenCalledWith(
        path.join(originalCwd, '.claude'),
        { recursive: true }
      );
    });
  });
});

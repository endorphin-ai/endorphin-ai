/**
 * Snapshot Store Tests
 * Tests for YAML persistence of accessibility snapshots
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock node:fs before importing the module under test
jest.mock('node:fs', () => ({
  existsSync: jest.fn(),
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readdir: jest.fn().mockResolvedValue([]),
    unlink: jest.fn().mockResolvedValue(undefined),
    rmdir: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock the logger (use relative path to avoid moduleNameMapper resolution issues)
jest.mock('../../../framework/core/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  logWithIcon: jest.fn(),
  LogLevel: { DEBUG: 'DEBUG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' },
}));

import { existsSync, promises as fs } from 'node:fs';
import {
  persistSnapshot,
  cleanupSnapshotDir,
  ensureSnapshotDir,
} from '../../../framework/ai/context/snapshot-store';
import type { AccessibilitySnapshot } from '../../../framework/types/accessibility';

const mockedExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockedMkdir = fs.mkdir as jest.MockedFunction<typeof fs.mkdir>;
const mockedWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;
const mockedReaddir = fs.readdir as jest.MockedFunction<typeof fs.readdir>;
const mockedUnlink = fs.unlink as jest.MockedFunction<typeof fs.unlink>;
const mockedRmdir = fs.rmdir as jest.MockedFunction<typeof fs.rmdir>;

/**
 * Helper to create a test snapshot.
 */
function makeTestSnapshot(overrides: Partial<AccessibilitySnapshot> = {}): AccessibilitySnapshot {
  return {
    id: '2025-01-15T10:30:00.000Z',
    url: 'https://example.com',
    title: 'Test Page',
    timestamp: '2025-01-15T10:30:00.000Z',
    trigger: 'initial',
    tree: { role: 'WebArea', name: 'Test' },
    treeHash: 'abc123',
    serializedTree: '- WebArea "Test"',
    interactiveSummary: [
      { role: 'button', name: 'Submit', depth: 1 },
    ],
    ...overrides,
  };
}

/**
 * Helper to flush the internal write queue by waiting for microtasks.
 * persistSnapshot chains onto an internal writePromise, so we need
 * to give the event loop a chance to process it.
 */
async function flushWriteQueue(): Promise<void> {
  // Allow multiple microtask ticks for the chained promise to resolve
  await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('SnapshotStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: directory does not exist
    mockedExistsSync.mockReturnValue(false);
    mockedMkdir.mockResolvedValue(undefined);
    mockedWriteFile.mockResolvedValue(undefined);
  });

  describe('persistSnapshot()', () => {
    it('should create directory if it does not exist', async () => {
      mockedExistsSync.mockReturnValue(false);

      persistSnapshot(makeTestSnapshot(), '/tmp/test-snapshots');
      await flushWriteQueue();

      expect(mockedMkdir).toHaveBeenCalledWith('/tmp/test-snapshots', { recursive: true });
    });

    it('should not create directory if it already exists', async () => {
      mockedExistsSync.mockReturnValue(true);

      persistSnapshot(makeTestSnapshot(), '/tmp/test-snapshots');
      await flushWriteQueue();

      expect(mockedMkdir).not.toHaveBeenCalled();
    });

    it('should write YAML file with correct content', async () => {
      mockedExistsSync.mockReturnValue(true);

      const snapshot = makeTestSnapshot({
        url: 'https://example.com/page',
        title: 'My Page',
        treeHash: 'hash123',
        serializedTree: '- WebArea "My Page"\n  - button "Click"',
        interactiveSummary: [
          { role: 'button', name: 'Click', depth: 1 },
        ],
      });

      persistSnapshot(snapshot, '/tmp/snapshots');
      await flushWriteQueue();

      expect(mockedWriteFile).toHaveBeenCalledTimes(1);

      const [filepath, content, encoding] = mockedWriteFile.mock.calls[0];

      // Verify filepath format
      expect(filepath).toMatch(/\/tmp\/snapshots\/page-.*\.yml$/);

      // Verify content structure
      const contentStr = content as string;
      expect(contentStr).toContain('url: "https://example.com/page"');
      expect(contentStr).toContain('title: "My Page"');
      expect(contentStr).toContain('treeHash: "hash123"');
      expect(contentStr).toContain('tree: |');
      expect(contentStr).toContain('interactive_summary:');
      expect(contentStr).toContain('role: "button"');
      expect(contentStr).toContain('name: "Click"');
      expect(encoding).toBe('utf-8');
    });

    it('should handle write error gracefully (no throw)', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedWriteFile.mockRejectedValue(new Error('Disk full'));

      // Should not throw
      expect(() => {
        persistSnapshot(makeTestSnapshot(), '/tmp/snapshots');
      }).not.toThrow();

      await flushWriteQueue();

      // The logger.warn should have been called
      const { warn } = require('../../../framework/core/logger');
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to persist snapshot'),
        expect.any(Object),
        'SnapshotStore'
      );
    });

    it('should include interactive element value when present', async () => {
      mockedExistsSync.mockReturnValue(true);

      const snapshot = makeTestSnapshot({
        interactiveSummary: [
          { role: 'textbox', name: 'Email', value: 'test@test.com', depth: 1 },
        ],
      });

      persistSnapshot(snapshot, '/tmp/snapshots');
      await flushWriteQueue();

      const content = mockedWriteFile.mock.calls[0][1] as string;
      expect(content).toContain('value: "test@test.com"');
    });

    it('should include disabled flag when true', async () => {
      mockedExistsSync.mockReturnValue(true);

      const snapshot = makeTestSnapshot({
        interactiveSummary: [
          { role: 'button', name: 'Submit', disabled: true, depth: 1 },
        ],
      });

      persistSnapshot(snapshot, '/tmp/snapshots');
      await flushWriteQueue();

      const content = mockedWriteFile.mock.calls[0][1] as string;
      expect(content).toContain('disabled: true');
    });
  });

  describe('cleanupSnapshotDir()', () => {
    it('should delete all files in directory', async () => {
      mockedExistsSync.mockReturnValue(true);
      (mockedReaddir as jest.Mock).mockResolvedValue(['file1.yml', 'file2.yml', 'file3.yml']);

      await cleanupSnapshotDir('/tmp/test-snapshots');

      expect(mockedUnlink).toHaveBeenCalledTimes(3);
      expect(mockedUnlink).toHaveBeenCalledWith('/tmp/test-snapshots/file1.yml');
      expect(mockedUnlink).toHaveBeenCalledWith('/tmp/test-snapshots/file2.yml');
      expect(mockedUnlink).toHaveBeenCalledWith('/tmp/test-snapshots/file3.yml');
      expect(mockedRmdir).toHaveBeenCalledWith('/tmp/test-snapshots');
    });

    it('should handle non-existent directory gracefully', async () => {
      mockedExistsSync.mockReturnValue(false);

      // Should not throw
      await expect(cleanupSnapshotDir('/tmp/nonexistent')).resolves.toBeUndefined();

      expect(mockedReaddir).not.toHaveBeenCalled();
      expect(mockedUnlink).not.toHaveBeenCalled();
    });

    it('should handle unlink errors gracefully per file', async () => {
      mockedExistsSync.mockReturnValue(true);
      (mockedReaddir as jest.Mock).mockResolvedValue(['good.yml', 'bad.yml']);
      mockedUnlink.mockResolvedValueOnce(undefined);
      mockedUnlink.mockRejectedValueOnce(new Error('Permission denied'));

      // Should not throw even if a file fails to delete
      await expect(cleanupSnapshotDir('/tmp/test-snapshots')).resolves.toBeUndefined();

      const { warn } = require('../../../framework/core/logger');
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete snapshot file'),
        expect.any(Object),
        'SnapshotStore'
      );
    });

    it('should handle readdir error gracefully', async () => {
      mockedExistsSync.mockReturnValue(true);
      (mockedReaddir as jest.Mock).mockRejectedValue(new Error('Access denied'));

      // Should not throw
      await expect(cleanupSnapshotDir('/tmp/test-snapshots')).resolves.toBeUndefined();
    });
  });

  describe('ensureSnapshotDir()', () => {
    it('should create directory if it does not exist', async () => {
      mockedExistsSync.mockReturnValue(false);

      await ensureSnapshotDir('/tmp/new-dir');

      expect(mockedMkdir).toHaveBeenCalledWith('/tmp/new-dir', { recursive: true });
    });

    it('should not create directory if it already exists', async () => {
      mockedExistsSync.mockReturnValue(true);

      await ensureSnapshotDir('/tmp/existing-dir');

      expect(mockedMkdir).not.toHaveBeenCalled();
    });
  });
});

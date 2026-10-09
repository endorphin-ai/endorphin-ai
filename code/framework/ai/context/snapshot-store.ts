/**
 * Snapshot Store
 * Manages YAML persistence of accessibility snapshots to .endorphin-tmp/
 * with async, non-blocking I/O. Write operations are fire-and-forget.
 */

import { existsSync, promises as fs } from 'node:fs';
import * as path from 'node:path';
import { warn, logWithIcon, LogLevel } from '../../core/logger.js';
import type { AccessibilitySnapshot } from '../../types/accessibility.js';

const DEFAULT_DIR = '.endorphin-tmp';

// Write queue to prevent concurrent writes
let writePromise: Promise<void> = Promise.resolve();

/**
 * Convert a snapshot to a YAML-like string representation.
 * Using a simple serializer to avoid adding js-yaml as a dependency.
 * The format is valid YAML but produced with template literals for simplicity.
 */
function snapshotToYaml(snapshot: AccessibilitySnapshot): string {
  const lines: string[] = [
    `url: "${snapshot.url}"`,
    `title: "${snapshot.title}"`,
    `timestamp: "${snapshot.timestamp}"`,
    `trigger: "${snapshot.trigger}"`,
    `treeHash: "${snapshot.treeHash}"`,
    `tree: |`,
  ];

  // Indent the serialized tree under the YAML block scalar
  const treeLines = snapshot.serializedTree.split('\n');
  for (const line of treeLines) {
    lines.push(`  ${line}`);
  }

  // Add interactive summary
  lines.push('interactive_summary:');
  for (const elem of snapshot.interactiveSummary) {
    lines.push(`  - role: "${elem.role}"`);
    lines.push(`    name: "${elem.name}"`);
    if (elem.value !== undefined) {
      lines.push(`    value: "${elem.value}"`);
    }
    if (elem.disabled) {
      lines.push(`    disabled: true`);
    }
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Persist a snapshot to disk as a YAML file.
 * This is fire-and-forget: the returned promise is handled internally.
 * Errors are logged at WARN level and never propagated.
 *
 * @param snapshot - The snapshot to persist
 * @param dir     - The directory to write to (default: '.endorphin-tmp')
 */
export function persistSnapshot(
  snapshot: AccessibilitySnapshot,
  dir: string = DEFAULT_DIR
): void {
  // Chain writes to prevent concurrent file operations
  writePromise = writePromise.then(async () => {
    try {
      // Ensure directory exists
      if (!existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
      }

      // Generate filename from timestamp
      const safeTimestamp = snapshot.timestamp.replace(/[:.]/g, '-');
      const filename = `page-${safeTimestamp}.yml`;
      const filepath = path.join(dir, filename);

      const content = snapshotToYaml(snapshot);
      await fs.writeFile(filepath, content, 'utf-8');

      logWithIcon(
        LogLevel.DEBUG,
        'debug',
        `Snapshot persisted: ${filename}`,
        { filepath },
        'SnapshotStore'
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      warn(
        `Failed to persist snapshot: ${message}`,
        { error: message },
        'SnapshotStore'
      );
    }
  });
}

/**
 * Clean up the snapshot directory by deleting all files.
 * Called during session teardown.
 *
 * @param dir - The directory to clean (default: '.endorphin-tmp')
 * @returns Promise that resolves when cleanup is complete
 */
export async function cleanupSnapshotDir(dir: string = DEFAULT_DIR): Promise<void> {
  try {
    if (!existsSync(dir)) {
      return;
    }

    const entries = await fs.readdir(dir);
    const deletePromises = entries.map(async (entry) => {
      const entryPath = path.join(dir, entry);
      try {
        await fs.unlink(entryPath);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        warn(
          `Failed to delete snapshot file: ${entryPath}: ${message}`,
          { filepath: entryPath, error: message },
          'SnapshotStore'
        );
      }
    });

    await Promise.all(deletePromises);

    // Try to remove the directory itself
    try {
      await fs.rmdir(dir);
    } catch {
      // Directory might not be empty or might have been removed already
    }

    logWithIcon(
      LogLevel.DEBUG,
      'debug',
      `Snapshot directory cleaned: ${dir}`,
      { dir },
      'SnapshotStore'
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    warn(
      `Failed to cleanup snapshot directory: ${message}`,
      { dir, error: message },
      'SnapshotStore'
    );
  }
}

/**
 * Ensure the snapshot directory exists. Creates it if needed.
 *
 * @param dir - The directory path (default: '.endorphin-tmp')
 */
export async function ensureSnapshotDir(dir: string = DEFAULT_DIR): Promise<void> {
  if (!existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }
}

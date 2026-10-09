/**
 * Directory Management Utilities
 * Handles cleanup and management of test directories
 */

import { existsSync, promises as fs } from 'node:fs';
import * as path from 'node:path';
import { info, logSuccess } from '../core/logger.js';

export class DirectoryManager {
  /**
   * Clean up test result directories
   */
  static async cleanupDirectories(resultBaseDir: string): Promise<void> {
    // Skip cleanup in test environment
    if (process.env.NODE_ENV === 'test') {
      info('Skipping cleanup in test environment', { nodeEnv: process.env.NODE_ENV }, 'DirectoryManager');
      return;
    }

    info('Cleaning up previous test results', { resultBaseDir }, 'DirectoryManager');

    if (existsSync(resultBaseDir)) {
      const files = await fs.readdir(resultBaseDir);
      for (const file of files) {
        const filePath = path.join(resultBaseDir, file);
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
          await fs.rm(filePath, { recursive: true, force: true });
        } else {
          await fs.unlink(filePath);
        }
      }
      logSuccess('Cleaned test-result directory', { resultBaseDir }, 'DirectoryManager');
    }
  }

  /**
   * Clean up test recorder directory for interactive mode
   */
  static async cleanupRecorderDirectory(recorderBaseDir: string): Promise<void> {
    if (existsSync(recorderBaseDir)) {
      const files = await fs.readdir(recorderBaseDir);
      for (const file of files) {
        const filePath = path.join(recorderBaseDir, file);
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
          await fs.rm(filePath, { recursive: true, force: true });
        } else {
          await fs.unlink(filePath);
        }
      }
      logSuccess('Cleaned test-recorder directory (interactive mode)', { recorderBaseDir }, 'DirectoryManager');
    }
  }

  /**
   * Clean up a specific directory
   */
  static async cleanupDirectory(dirPath: string, description?: string): Promise<void> {
    if (existsSync(dirPath)) {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
          await fs.rm(filePath, { recursive: true, force: true });
        } else {
          await fs.unlink(filePath);
        }
      }
      if (description) {
        logSuccess(`Cleaned ${description}`, { dirPath }, 'DirectoryManager');
      }
    }
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  static async ensureDirectory(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Get directory size in bytes
   */
  static async getDirectorySize(dirPath: string): Promise<number> {
    if (!existsSync(dirPath)) {
      return 0;
    }

    let size = 0;
    const files = await fs.readdir(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fs.stat(filePath);

      if (stat.isDirectory()) {
        size += await DirectoryManager.getDirectorySize(filePath);
      } else {
        size += stat.size;
      }
    }

    return size;
  }

  /**
   * Get directory file count
   */
  static async getDirectoryFileCount(dirPath: string): Promise<number> {
    if (!existsSync(dirPath)) {
      return 0;
    }

    let count = 0;
    const files = await fs.readdir(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fs.stat(filePath);

      if (stat.isDirectory()) {
        count += await DirectoryManager.getDirectoryFileCount(filePath);
      } else {
        count++;
      }
    }

    return count;
  }
}

/**
 * Path Configuration for Endorphin AI
 * Provides standardized paths for the framework
 */

import path from 'path';
import { fileURLToPath } from 'url';

// Handle Jest environment where import.meta.url might not be available
let __filename: string = '';
let __dirname: string = process.cwd();

try {
  __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch {
  // Fallback for Jest or other environments without import.meta
  __dirname = process.cwd();
}

// Get project root directory (go up from framework/config/ to project root)
const projectRoot = path.resolve(__dirname, '..', '..');

/**
 * Standardized paths for the framework
 */
export const PATHS = {
  // Project directories
  PROJECT_ROOT: projectRoot,
  TEST_RESULT_DIR: path.join(projectRoot, 'test-result'),
  TEST_RECORDER_DIR: path.join(projectRoot, 'test-recorder'),
  TESTS_DIR: path.join(projectRoot, 'tests'),

  // Framework directories
  FRAMEWORK_DIR: path.join(projectRoot, 'framework'),
  TOOLS_DIR: path.join(projectRoot, 'framework', 'tools'),
  CORE_DIR: path.join(projectRoot, 'framework', 'core'),
  CONFIG_DIR: path.join(projectRoot, 'framework', 'config'),
} as const;

export default PATHS;

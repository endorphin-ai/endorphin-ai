#!/usr/bin/env node

/**
 * Cross-platform post-build script
 * Copies templates, package.json, and sets executable permissions.
 * Replaces Unix-only cp/mkdir/chmod commands for Windows CI compatibility.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

function copyFileSync(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyGlob(dir, pattern, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const file of fs.readdirSync(dir)) {
    if (pattern.test(file)) {
      fs.copyFileSync(path.join(dir, file), path.join(dest, file));
    }
  }
}

function chmodSafe(filePath, mode) {
  try {
    fs.chmodSync(filePath, mode);
  } catch {
    // chmod is a no-op on Windows — ignore errors
  }
}

// 1. Copy package.json to dist/
copyFileSync(
  path.join(root, 'package.json'),
  path.join(root, 'dist', 'package.json')
);
console.log('✅ Copied package.json → dist/');

// 2. Copy reporter templates (*.html, *.css, *.js)
const reporterSrc = path.join(root, 'framework', 'templates', 'reporter');
const reporterDest = path.join(root, 'dist', 'framework', 'templates', 'reporter');
copyGlob(reporterSrc, /\.(html|css|js)$/, reporterDest);
console.log('✅ Copied reporter templates → dist/');

// 3. Copy init templates (entire directory)
const initSrc = path.join(root, 'framework', 'templates', 'init');
const initDest = path.join(root, 'dist', 'framework', 'templates', 'init');
copyDirSync(initSrc, initDest);
console.log('✅ Copied init templates → dist/');

// 4. Copy Claude Code skill templates (entire directory)
const claudeSkillsSrc = path.join(root, 'framework', 'templates', 'claude-skills');
const claudeSkillsDest = path.join(root, 'dist', 'framework', 'templates', 'claude-skills');
copyDirSync(claudeSkillsSrc, claudeSkillsDest);
console.log('✅ Copied Claude Code skill templates → dist/');

// 5. Set executable permissions on CLI entry points
chmodSafe(path.join(root, 'dist', 'bin', 'endorphin.js'), 0o755);
chmodSafe(path.join(root, 'dist', 'bin', 'cli-handlers.js'), 0o755);
console.log('✅ Set executable permissions on CLI files');

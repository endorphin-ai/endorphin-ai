#!/usr/bin/env node

/**
 * Post-build script to fix TypeScript path aliases in compiled JavaScript
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distFrameworkDir = path.join(__dirname, '..', 'dist', 'framework');
const distBinDir = path.join(__dirname, '..', 'dist', 'bin');

// Path alias mappings
const pathMappings = {
  '@/': '../',
  '@core/': '../core/',
  '@ai/': '../ai/',
  '@automation/': '../automation/',
  '@tools/': '../tools/',
  '@config/': '../config/',
  '@types/': '../types/',
  '@runner/': '../runner/',
  '@test-recorder/': '../test-recorder/',
  '@templates/': '../templates/',
  '@reporters/': '../reporters/',
  '@results/': '../results/',
  '@cli/': '../cli/'
};

/**
 * Fix imports in a JavaScript file
 */
function fixImportsInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let newContent = content;

  // Find all import statements that use path aliases
  for (const [alias, replacement] of Object.entries(pathMappings)) {
    const regex = new RegExp(`from ['"]${alias.replace('/', '\\/')}([^'"]*?)['"]`, 'g');
    const matches = [...content.matchAll(regex)];
    
    if (matches.length > 0) {
      console.log(`Fixing ${matches.length} import(s) in ${path.relative(process.cwd(), filePath)}`);
      modified = true;
      
      newContent = newContent.replace(regex, (match, importPath) => {
        let relativePath = replacement + importPath;
        // Add appropriate extension if not present
        if (!relativePath.endsWith('.js') && !relativePath.endsWith('.json') && !relativePath.endsWith('.d.ts')) {
          // For .d.ts files, add .js extension (TypeScript expects .js for compiled modules)
          relativePath += '.js';
        }
        return `from '${relativePath}'`;
      });
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, newContent, 'utf8');
  }
}

/**
 * Recursively process all JS files in a directory
 */
function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.d.ts'))) {
      fixImportsInFile(fullPath);
    }
  }
}

console.log('🔧 Fixing TypeScript path aliases in compiled JavaScript...');

// Process framework directory
if (fs.existsSync(distFrameworkDir)) {
  processDirectory(distFrameworkDir);
}

// Process bin directory  
if (fs.existsSync(distBinDir)) {
  processDirectory(distBinDir);
}

console.log('✅ Import paths fixed!');
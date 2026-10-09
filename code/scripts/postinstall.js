#!/usr/bin/env node

/**
 * Post-install script to ensure Endorphin AI CLI works properly
 * Fixes common npx resolution issues
 */

import { existsSync, chmodSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const binaryPath = join(projectRoot, 'dist', 'bin', 'endorphin.js');

function log(message) {
  console.log(`🔧 Endorphin AI setup: ${message}`);
}

function ensureBinaryExecutable() {
  if (!existsSync(binaryPath)) {
    log('Binary not found - will be created during build');
    return;
  }

  try {
    // Ensure binary is executable
    chmodSync(binaryPath, '755');
    log('Binary permissions set correctly');

    // Verify shebang
    const firstLine = readFileSync(binaryPath, 'utf8').split('\n')[0];
    if (!firstLine.startsWith('#!/usr/bin/env node')) {
      console.warn('⚠️  Warning: Binary missing proper shebang');
    } else {
      log('Binary shebang verified');
    }
  } catch (error) {
    console.warn('⚠️  Warning: Could not verify binary setup:', error.message);
  }
}

function printUsageInstructions() {
  console.log(`
✅ Endorphin AI installed successfully!

🚀 Quick start:
  npx endorphin-ai init                    # Initialize new project (recommended)
  ./node_modules/.bin/endorphin init       # Direct method

📚 More commands:
  npx endorphin-ai --version               # Check version
  ./node_modules/.bin/endorphin --version  # Direct method
  
  npx endorphin-ai --help                  # Get help
  ./node_modules/.bin/endorphin --help     # Direct method

⚠️  Note: Use 'endorphin-ai' with npx to avoid conflicts with other packages

🔧 Alternative: Add these scripts to your package.json:
  {
    "scripts": {
      "endorphin-ai:init": "./node_modules/.bin/endorphin init",
      "endorphin-ai:version": "./node_modules/.bin/endorphin --version",
      "endorphin-ai:help": "./node_modules/.bin/endorphin --help"
    }
  }
  
  Then use: npm run endorphin-ai:init
  
📖 Documentation: https://github.com/andrewnovykov/endorphin-ai#readme
`);
}

// Main execution
try {
  ensureBinaryExecutable();
  printUsageInstructions();
} catch (error) {
  console.error('❌ Post-install setup failed:', error.message);
  console.log('📖 See troubleshooting: https://github.com/andrewnovykov/endorphin-ai#troubleshooting');
}
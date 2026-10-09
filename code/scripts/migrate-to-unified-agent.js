#!/usr/bin/env node
/**
 * Migration script to update agent-setup.ts to use the new unified provider system
 * This creates a wrapper that maintains backward compatibility
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Create a backward-compatible wrapper for agent-setup.ts
const wrapperContent = `/**
 * Agent Setup Wrapper - Maintains backward compatibility while using new unified system
 * Auto-generated migration wrapper
 */

import { setupAgent as setupUnifiedAgent, setCurrentTestSession as setUnifiedSession, trackAICall as trackUnifiedCall } from './agent-setup-unified.js';
import { AGENT_CONFIG } from './config/agent-config.js';

// Export the unified version with backward compatibility
export const setupAgent = setupUnifiedAgent;
export const setCurrentTestSession = setUnifiedSession;
export const trackAICall = trackUnifiedCall;

// Re-export for backward compatibility
export { AGENT_CONFIG } from './config/agent-config.js';
`;

// Backup the original agent-setup.ts
const originalPath = resolve(__dirname, '../framework/ai/agent-setup.ts');
const backupPath = resolve(__dirname, '../framework/ai/agent-setup.original.ts');
const wrapperPath = resolve(__dirname, '../framework/ai/agent-setup.wrapper.ts');

if (existsSync(originalPath)) {
  // Read original content
  const originalContent = readFileSync(originalPath, 'utf-8');
  
  // Save backup
  writeFileSync(backupPath, originalContent);
  console.log('✅ Created backup: agent-setup.original.ts');
  
  // Write wrapper
  writeFileSync(wrapperPath, wrapperContent);
  console.log('✅ Created wrapper: agent-setup.wrapper.ts');
  
  console.log('\n📝 Migration Notes:');
  console.log('1. The original agent-setup.ts has been backed up to agent-setup.original.ts');
  console.log('2. A wrapper has been created at agent-setup.wrapper.ts');
  console.log('3. To complete migration, rename agent-setup.wrapper.ts to agent-setup.ts');
  console.log('\n🚀 To use Gemini, update your endorphin.config.ts:');
  console.log(`
export default {
  ai: {
    model: 'gemini-1.5-pro',  // or 'gemini-2.0-flash' for faster/cheaper
    temperature: 0.1,
    maxRetries: 3,
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  },
  // ... rest of config
}
`);
  console.log('\n🔑 Set your API key:');
  console.log('export GEMINI_API_KEY=your_google_api_key_here');
  console.log('# or');
  console.log('export GOOGLE_API_KEY=your_google_api_key_here');
} else {
  console.error('❌ Could not find agent-setup.ts');
}
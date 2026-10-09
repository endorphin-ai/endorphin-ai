/**
 * Global Setup Manager
 * Handles loading and executing global setup files
 */

import type { GlobalSetupFunction, GlobalSetupModule, GlobalSetupResult } from '../types/config.js';
import { existsSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import { pathToFileURL } from 'url';

// Simple console logging to avoid circular dependencies
const log = {
  info: (msg: string, data?: any) => console.log(`[GlobalSetup] ${msg}`, data || ''),
  debug: (msg: string, data?: any) => console.debug(`🐞 [GlobalSetup] ${msg}`, data || ''),
  warn: (msg: string, data?: any) => console.warn(`[GlobalSetup] ${msg}`, data || ''),
  error: (msg: string, error?: any) => console.error(`[GlobalSetup] ${msg}`, error || ''),
};

export class GlobalSetupManager {
  private setupFunction?: GlobalSetupFunction;
  private setupFile?: string;

  /**
   * Load global setup from file path
   */
  async loadSetup(setupPath: string): Promise<void> {
    const absolutePath = isAbsolute(setupPath) ? setupPath : resolve(process.cwd(), setupPath);

    if (!existsSync(absolutePath)) {
      throw new Error(`Global setup file not found: ${absolutePath}`);
    }

    this.setupFile = absolutePath;
    log.info(`Loading global setup from: ${absolutePath}`);

    try {
      // Convert file path to file URL for ESM import
      const fileUrl = pathToFileURL(absolutePath).href;

      // For TypeScript files, check if tsx is available
      if (absolutePath.endsWith('.ts')) {
        await this.loadTypeScriptSetup(fileUrl);
      } else {
        // Dynamic import the setup module
        const module = (await import(fileUrl)) as GlobalSetupModule;
        this.validateAndSetModule(module, absolutePath);
      }
    } catch (error: any) {
      log.error(`Failed to load global setup file: ${absolutePath}`, error);
      throw new Error(`Failed to load global setup: ${error.message}`);
    }
  }

  /**
   * Load TypeScript setup file using tsx or other TypeScript loaders
   */
  private async loadTypeScriptSetup(fileUrl: string): Promise<void> {
    try {
      // Try direct import first (works in development with tsx)
      const module = (await import(fileUrl)) as GlobalSetupModule;
      this.validateAndSetModule(module, this.setupFile!);
    } catch (error: any) {
      // If direct import fails, provide helpful error message
      if (error.message.includes('Unknown file extension ".ts"') || error.message.includes('Cannot resolve')) {
        throw new Error(
          `Cannot load TypeScript global setup file. Please either:\n` +
          `  1. Use a .js file instead: ${this.setupFile!.replace('.ts', '.js')}\n` +
          `  2. Run with tsx: npx tsx node_modules/endorphin-ai/dist/bin/endorphin.js\n` +
          `  3. Compile your TypeScript files to JavaScript first\n` +
          `  Original error: ${error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Validate and set the imported module
   */
  private validateAndSetModule(module: GlobalSetupModule, filePath: string): void {
    if (!module.default || typeof module.default !== 'function') {
      throw new Error(`Global setup file must export a default function: ${filePath}`);
    }

    this.setupFunction = module.default;
    log.debug(`Global setup function loaded successfully`);
  }

  /**
   * Execute the loaded global setup function
   */
  async executeSetup(): Promise<GlobalSetupResult> {
    if (!this.setupFunction) {
      throw new Error('No global setup function loaded. Call loadSetup() first.');
    }

    const startTime = Date.now();
    log.info('🚀 Executing global setup...');
    if (process.env.ENDORPHIN_DEBUG === 'true' || process.env.ENDORPHIN_DEBUG === 'verbose') {
      console.log('🔧 Global setup starting execution...');
    }

    try {
      // Execute the setup function
      await this.setupFunction();

      const executionTime = Date.now() - startTime;
      log.info(`✅ Global setup completed successfully in ${executionTime}ms`);
      if (process.env.ENDORPHIN_DEBUG === 'true' || process.env.ENDORPHIN_DEBUG === 'verbose') {
        console.log(`✅ Global setup completed successfully!`);
        console.log(`⏱️ Execution time: ${executionTime}ms`);
      }

      return {
        success: true,
        executionTime,
        setupFile: this.setupFile || '',
      } as GlobalSetupResult;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      log.error(`❌ Global setup failed after ${executionTime}ms`, error);
      if (process.env.ENDORPHIN_DEBUG === 'true' || process.env.ENDORPHIN_DEBUG === 'verbose') {
        console.error(`❌ Global setup failed!`);
        console.error(`⏱️ Failed after: ${executionTime}ms`);
        console.error(`💥 Error:`, error);
      }

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        executionTime,
        setupFile: this.setupFile || '',
      } as GlobalSetupResult;
    }
  }

  /**
   * Load and execute global setup in one call
   */
  async loadAndExecute(setupPath: string): Promise<GlobalSetupResult> {
    await this.loadSetup(setupPath);
    return await this.executeSetup();
  }

  /**
   * Check if a global setup is loaded
   */
  isLoaded(): boolean {
    return !!this.setupFunction;
  }

  /**
   * Get the path of the loaded setup file
   */
  getSetupFile(): string | undefined {
    return this.setupFile;
  }

  /**
   * Clear the loaded setup
   */
  clear(): void {
    (this as any).setupFunction = undefined;
    (this as any).setupFile = undefined;
    log.debug('Global setup cleared');
  }

  /**
   * Validate that a file looks like a valid global setup file
   */
  static async validateSetupFile(setupPath: string): Promise<{ valid: boolean; error?: string }> {
    const absolutePath = isAbsolute(setupPath) ? setupPath : resolve(process.cwd(), setupPath);

    if (!existsSync(absolutePath)) {
      return { valid: false, error: `File does not exist: ${absolutePath}` };
    }

    try {
      const fileUrl = pathToFileURL(absolutePath).href;
      const module = (await import(fileUrl)) as any;

      if (!module.default) {
        return { valid: false, error: 'File must have a default export' };
      }

      if (typeof module.default !== 'function') {
        return { valid: false, error: 'Default export must be a function' };
      }

      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: `Failed to load file: ${error.message}` };
    }
  }
}

// Export a singleton instance for convenience
export const globalSetupManager = new GlobalSetupManager();

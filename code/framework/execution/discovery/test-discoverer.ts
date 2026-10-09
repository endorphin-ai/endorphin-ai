/**
 * Test Discoverer
 * Discovers and loads tests from user's tests/ directory
 */

import { readdir, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import type { TestConfig } from '../../types/index.js';
import { info, logSuccess, warn, error as logError, logWithIcon, LogLevel, debug } from '../../core/logger.js';
import type {
  DiscoveredTest,
  DiscoveryConfig,
  TestDiscoveryResult,
  TestFileResult,
} from './discovery-types.js';

/**
 * Check if we're running in test environment
 */
function _isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Check if a test is quarantined (has 'quarantined' tag)
 */
function isTestQuarantined(test: DiscoveredTest): boolean {
  return test.tags && test.tags.includes('quarantined');
}

/**
 * Test Discovery class for finding and loading test files
 */
export class TestDiscoverer {
  private tests: Map<string, DiscoveredTest> = new Map();
  private config: DiscoveryConfig;
  public testsDirectory: string;

  constructor(config: DiscoveryConfig = {}) {
    this.config = {
      testsDirectory: 'tests',
      includePatterns: ['**/*.js', '**/*.mjs', '**/*.ts'],
      excludePatterns: ['**/*.test.js', '**/*.test.ts', '**/node_modules/**'],
      maxConcurrency: 5,
      enableTypeScript: true,
      ...config,
    };
    this.testsDirectory = resolve(process.cwd(), this.config.testsDirectory!);
  }

  /**
   * Discover and load all test files from configured tests directory
   */
  async discoverTests(): Promise<TestDiscoveryResult> {
    const startTime = Date.now();
    const errors: Array<{ file: string; error: string }> = [];
    let totalFiles = 0;

    try {
      logWithIcon(LogLevel.DEBUG, 'debug', `Discovering tests recursively in: ${this.testsDirectory}`, {}, 'TestDiscoverer');
      
      const allTestFiles: { file: string, directory: string }[] = [];

      // Recursively scan the tests directory
      await this.scanDirectoryRecursively(this.testsDirectory, allTestFiles, 0, 3);

      if (allTestFiles.length > 0) {
        logWithIcon(LogLevel.DEBUG, 'debug', `Found ${allTestFiles.length} test file(s) across all directories:`, { fileCount: allTestFiles.length }, 'TestDiscoverer');
        
        // Show detailed list only in debug mode
        if (process.env.ENDORPHIN_DEBUG === 'true' || process.env.ENDORPHIN_DEBUG === 'verbose' || process.env.ENDORPHIN_LOG_LEVEL === 'DEBUG') {
          allTestFiles.forEach(({ file, directory }) => {
            const relativePath = directory.replace(this.testsDirectory, '').replace(/^\//, '');
            const displayPath = relativePath ? `${relativePath}/${file}` : file;
            logWithIcon(LogLevel.DEBUG, 'debug', `📄 ${displayPath}`, { file, directory: relativePath || 'root' }, 'TestDiscoverer');
          });
        }
      }

      totalFiles = allTestFiles.length;

      if (allTestFiles.length === 0) {
        info(`📝 No test files found in ${this.testsDirectory} directory`, { testsDirectory: this.testsDirectory }, 'TestDiscoverer');
        info('💡 Add .js, .mjs, or .ts files with exported test objects', {}, 'TestDiscoverer');
        return {
          tests: this.tests,
          totalTests: 0,
          totalFiles: 0,
          errors: [],
          duration: Date.now() - startTime,
        };
      }

      logWithIcon(LogLevel.DEBUG, 'debug', `Found ${allTestFiles.length} test file(s) to load`, { fileCount: allTestFiles.length }, 'TestDiscoverer');

      // Load files concurrently with limited concurrency
      const results = await this.loadTestFilesConcurrentlyFromMultipleDirs(allTestFiles);

      // Collect errors
      results.forEach((result) => {
        if (!result.success && result.error) {
          errors.push({ file: result.filename, error: result.error });
        }
      });

      const successCount = this.tests.size;
      const failureCount = allTestFiles.length - successCount;
      
      if (failureCount > 0) {
        warn(`Successfully loaded ${successCount} test(s), ${failureCount} failed to load`, { successCount, failureCount }, 'TestDiscoverer');
        // Show which files failed to load with detailed errors
        logWithIcon(LogLevel.DEBUG, 'debug', 'Failed test files:', { failedCount: errors.length }, 'TestDiscoverer');
        errors.forEach(error => {
          logWithIcon(LogLevel.DEBUG, 'debug', `❌ ${error.file}: ${error.error}`, { file: error.file, error: error.error }, 'TestDiscoverer');
        });
      } else {
        logSuccess(`Successfully loaded ${successCount} test(s)`, { successCount }, 'TestDiscoverer');
      }
      // Empty line removed - using structured logging instead

      return {
        tests: this.tests,
        totalTests: this.tests.size,
        totalFiles,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError('❌ Error discovering tests', error instanceof Error ? error : undefined, { message }, 'TestDiscoverer');

      return {
        tests: this.tests,
        totalTests: 0,
        totalFiles,
        errors: [{ file: 'discovery', error: message }],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Load test files concurrently with limited concurrency
   */
  private async loadTestFilesConcurrently(testFiles: string[]): Promise<TestFileResult[]> {
    const results: TestFileResult[] = [];
    const maxConcurrency = this.config.maxConcurrency || 5;

    for (let i = 0; i < testFiles.length; i += maxConcurrency) {
      const batch = testFiles.slice(i, i + maxConcurrency);
      const batchPromises = batch.map((file) => this.loadTestFileWithResult(file));
      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            filename: batch[index],
            tests: [],
            success: false,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
        }
      });
    }

    return results;
  }

  /**
   * Load test files from multiple directories concurrently with limited concurrency
   */
  private async loadTestFilesConcurrentlyFromMultipleDirs(testFiles: { file: string, directory: string }[]): Promise<TestFileResult[]> {
    const results: TestFileResult[] = [];
    const maxConcurrency = this.config.maxConcurrency || 5;

    for (let i = 0; i < testFiles.length; i += maxConcurrency) {
      const batch = testFiles.slice(i, i + maxConcurrency);
      const batchPromises = batch.map((fileInfo) => this.loadTestFileWithResultFromDir(fileInfo.file, fileInfo.directory));
      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            filename: batch[index].file,
            tests: [],
            success: false,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
        }
      });
    }

    return results;
  }

  /**
   * Load a specific test file and return result
   */
  private async loadTestFileWithResult(filename: string): Promise<TestFileResult> {
    try {
      logWithIcon(LogLevel.DEBUG, 'debug', `Loading test file: ${filename}`, { filename }, 'TestDiscoverer');
      const tests = await this.loadTestFile(filename);
      return {
        filename,
        tests,
        success: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(`Error loading ${filename}`, error instanceof Error ? error : undefined, { filename, message }, 'TestDiscoverer');
      return {
        filename,
        tests: [],
        success: false,
        error: message,
      };
    }
  }

  /**
   * Load a specific test file from a specific directory and return result
   */
  private async loadTestFileWithResultFromDir(filename: string, directory: string): Promise<TestFileResult> {
    try {
      logWithIcon(LogLevel.DEBUG, 'debug', `Loading test file: ${filename} from ${directory}`, { filename, directory }, 'TestDiscoverer');
      const tests = await this.loadTestFileFromDir(filename, directory);
      logWithIcon(LogLevel.DEBUG, 'debug', `${filename} loaded successfully with ${tests.length} test(s)`, { filename, testCount: tests.length }, 'TestDiscoverer');
      return {
        filename,
        tests,
        success: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(`Error loading ${filename}`, error instanceof Error ? error : undefined, { filename, message }, 'TestDiscoverer');
      logWithIcon(LogLevel.DEBUG, 'debug', `Full error details for ${filename}`, { filename, error: String(error) }, 'TestDiscoverer');
      return {
        filename,
        tests: [],
        success: false,
        error: message,
      };
    }
  }

  /**
   * Load a specific test file and extract test objects
   */
  async loadTestFile(filename: string): Promise<DiscoveredTest[]> {
    const filePath = join(this.testsDirectory, filename);
    const testsFound: DiscoveredTest[] = [];

    // Handle TypeScript files by checking if tsx is available and using it
    if (filename.endsWith('.ts') && this.config.enableTypeScript) {
      await this.loadTypeScriptFile(filePath, filename, testsFound);
    } else {
      await this.loadJavaScriptFile(filePath, filename, testsFound);
    }

    return testsFound;
  }

  /**
   * Load a specific test file from a specific directory and extract test objects
   */
  async loadTestFileFromDir(filename: string, directory: string): Promise<DiscoveredTest[]> {
    const filePath = join(directory, filename);
    const testsFound: DiscoveredTest[] = [];

    // Handle TypeScript files by checking if tsx is available and using it
    if (filename.endsWith('.ts') && this.config.enableTypeScript) {
      await this.loadTypeScriptFile(filePath, filename, testsFound);
    } else {
      await this.loadJavaScriptFile(filePath, filename, testsFound);
    }

    return testsFound;
  }

  /**
   * Load JavaScript file using dynamic import
   */
  private async loadJavaScriptFile(
    filePath: string,
    filename: string,
    testsFound: DiscoveredTest[]
  ): Promise<void> {
    const fileUrl = pathToFileURL(filePath).href;
    const module = await import(`${fileUrl}?t=${Date.now()}`);
    this.extractTestsFromModule(module, filename, testsFound);
  }

  /**
   * Load TypeScript file using tsx or dynamic compilation
   */
  private async loadTypeScriptFile(
    filePath: string,
    filename: string,
    testsFound: DiscoveredTest[]
  ): Promise<void> {
    // Try to register tsx loader if not already registered
    if (typeof (globalThis as any).__tsx_registered === 'undefined') {
        try {
          // Try to dynamically import tsx
          const { register } = await import('tsx/esm/api');
          register();
          (globalThis as any).__tsx_registered = true;
          debug(`Successfully registered tsx loader for TypeScript file loading`, {}, 'TestDiscoverer');
        } catch (tsxError) {
          // Log the actual tsx error for debugging
          warn(`TypeScript loader (tsx) failed to register: ${tsxError}`, {}, 'TestDiscoverer');
          
          // Try alternative TypeScript loading approaches
          try {
            // Check if we're in a compiled environment where TypeScript files should be JavaScript
            const jsFilePath = filePath.replace('.ts', '.js');
            if (await this.fileExists(jsFilePath)) {
              debug(`Found compiled JavaScript version, loading ${jsFilePath}`, {}, 'TestDiscoverer');
              return this.loadJavaScriptFile(jsFilePath, filename.replace('.ts', '.js'), testsFound);
            }
            
            // If no compiled version, suggest solutions
            throw new Error(
              `TypeScript file cannot be loaded: ${filename}. ` +
              `tsx loader failed (${tsxError}). ` +
              `Please ensure 'tsx' is installed: npm install tsx, or compile TypeScript to JavaScript first.`
            );
          } catch (fallbackError) {
            throw new Error(
              `Failed to load TypeScript file ${filename}: ${fallbackError}. ` +
              `Original tsx error: ${tsxError}`
            );
          }
        }
    }

    // Now load the TypeScript file
    const fileUrl = pathToFileURL(filePath).href;
    debug(`Attempting to import TypeScript file: ${fileUrl}`, {}, 'TestDiscoverer');
    
    try {
      const module = await import(`${fileUrl}?t=${Date.now()}`);
      this.extractTestsFromModule(module, filename, testsFound);
    } catch (importError) {
      // Handle specific TypeScript/syntax errors
      const errorMessage = String(importError);
      
      if (errorMessage.includes('Unexpected token') || errorMessage.includes('SyntaxError')) {
        throw new Error(
          `Syntax error in TypeScript file ${filename}: ${importError}. ` +
          `This usually means the TypeScript loader is not working properly. ` +
          `Please ensure 'tsx' is installed and your test file has valid TypeScript syntax. ` +
          `Check your imports and exports - they should use ES module syntax (import/export).`
        );
      } else {
        throw new Error(`Failed to import TypeScript file ${filename}: ${importError}`);
      }
    }
  }

  /**
   * Extract test objects from loaded module
   */
  private extractTestsFromModule(
    module: any,
    filename: string,
    testsFound: DiscoveredTest[]
  ): void {
    // Check default export first
    if (module.default && this.isValidTest(module.default)) {
      const test = module.default as TestConfig;
      const discoveredTest: DiscoveredTest = {
        ...test,
        sourceFile: filename,
        exportName: 'default',
      };

      this.tests.set(test.id, discoveredTest);
      testsFound.push(discoveredTest);
      logWithIcon(LogLevel.DEBUG, 'debug', `✓ ${test.id}: ${test.name}`, { testId: test.id, testName: test.name, exportName: 'default' }, 'TestDiscoverer');
    }

    // Check named exports
    for (const [exportName, exportValue] of Object.entries(module)) {
      if (exportName !== 'default' && this.isValidTest(exportValue)) {
        const test = exportValue as TestConfig;
        const discoveredTest: DiscoveredTest = {
          ...test,
          sourceFile: filename,
          exportName,
        };

        this.tests.set(test.id, discoveredTest);
        testsFound.push(discoveredTest);
        logWithIcon(LogLevel.DEBUG, 'debug', `✓ ${test.id}: ${test.name}`, { testId: test.id, testName: test.name, exportName }, 'TestDiscoverer');
      }
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await import('fs').then((fs) => fs.promises.access(filePath));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a file is a test file based on patterns
   */
  private isTestFile(filename: string): boolean {
    // Check exclude patterns first
    if (this.config.excludePatterns) {
      for (const pattern of this.config.excludePatterns) {
        if (this.matchesPattern(filename, pattern)) {
          return false;
        }
      }
    }

    // Check include patterns
    if (this.config.includePatterns) {
      for (const pattern of this.config.includePatterns) {
        if (this.matchesPattern(filename, pattern)) {
          return true;
        }
      }
    }

    // Default: check common test file extensions
    return filename.endsWith('.js') || filename.endsWith('.mjs') || filename.endsWith('.ts');
  }

  /**
   * Simple pattern matching (supports * wildcard)
   */
  private matchesPattern(filename: string, pattern: string): boolean {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filename);
    }
    return filename.includes(pattern);
  }

  /**
   * Validate if an object is a valid test
   */
  private isValidTest(obj: unknown): obj is TestConfig {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      typeof (obj as any).id === 'string' &&
      typeof (obj as any).name === 'string' &&
      (
        // Single-user test (traditional format)
        typeof (obj as any).task === 'string' || 
        typeof (obj as any).task === 'function' || 
        typeof (obj as any).execute === 'function' ||
        // Multi-user test (new format)
        (Array.isArray((obj as any).users) && 
         ((obj as any).users).length > 0 && 
         (typeof (obj as any).tasks === 'function' || 
          typeof (obj as any).tasks === 'object'))
      )
    );
  }

  /**
   * Get test by ID
   */
  getTest(id: string): DiscoveredTest | undefined {
    return this.tests.get(id);
  }

  /**
   * Get all tests
   */
  getAllTests(): DiscoveredTest[] {
    return Array.from(this.tests.values());
  }

  /**
   * Get tests by tag
   */
  getTestsByTag(tag: string): DiscoveredTest[] {
    return this.getAllTests().filter((test) => test.tags && test.tags.includes(tag));
  }

  /**
   * Get tests by priority
   */
  getTestsByPriority(priority: string): DiscoveredTest[] {
    return this.getAllTests().filter((test) => test.priority === priority);
  }

  /**
   * Get non-quarantined tests
   */
  getNonQuarantinedTests(): DiscoveredTest[] {
    return this.getAllTests().filter((test) => !isTestQuarantined(test));
  }

  /**
   * Get quarantined tests
   */
  getQuarantinedTests(): DiscoveredTest[] {
    return this.getAllTests().filter((test) => isTestQuarantined(test));
  }

  /**
   * Filter tests based on criteria
   */
  filterTests(criteria: {
    tags?: string[];
    priority?: string[];
    excludeTags?: string[];
    pattern?: string;
    includeQuarantined?: boolean;
  }): DiscoveredTest[] {
    let tests = this.getAllTests();

    // Filter by quarantine status
    if (!criteria.includeQuarantined) {
      tests = tests.filter((test) => !isTestQuarantined(test));
    }

    // Filter by tags
    if (criteria.tags && criteria.tags.length > 0) {
      tests = tests.filter(
        (test) => test.tags && criteria.tags!.some((tag) => test.tags!.includes(tag))
      );
    }

    // Exclude by tags
    if (criteria.excludeTags && criteria.excludeTags.length > 0) {
      tests = tests.filter(
        (test) => !test.tags || !criteria.excludeTags!.some((tag) => test.tags!.includes(tag))
      );
    }

    // Filter by priority
    if (criteria.priority && criteria.priority.length > 0) {
      tests = tests.filter((test) => criteria.priority!.includes(test.priority));
    }

    // Filter by name/id pattern
    if (criteria.pattern) {
      const pattern = criteria.pattern.toLowerCase();
      tests = tests.filter(
        (test) =>
          test.id.toLowerCase().includes(pattern) || test.name.toLowerCase().includes(pattern)
      );
    }

    return tests;
  }

  /**
   * List all available tests
   */
  listTests(): void {
    const tests = this.getAllTests();

    if (tests.length === 0) {
      console.log('📝 No tests found');
      console.log('💡 Create test files in the tests/ directory');
      return;
    }

    console.log('\n📋 Available Tests:');
    console.log('══════════════════════════════════════');

    const grouped: Record<string, DiscoveredTest[]> = {};
    tests.forEach((test) => {
      const priority = test.priority || 'Unknown';
      if (!grouped[priority]) grouped[priority] = [];
      grouped[priority].push(test);
    });

    for (const [priority, priorityTests] of Object.entries(grouped)) {
      console.log(`\n🎯 ${priority} Priority:`);
      priorityTests.forEach((test) => {
        const tags = test.tags ? `[${test.tags.join(', ')}]` : '';
        const quarantineIndicator = isTestQuarantined(test) ? ' ⚠️ QUARANTINED' : '';
        console.log(`  ${test.id}: ${test.name} ${tags}${quarantineIndicator}`);
        console.log(`    📄 File: ${test.sourceFile}`);
        if (test.description) {
          console.log(`    📝 ${test.description}`);
        }
      });
    }

    // Show quarantine summary
    const totalTests = tests.length;
    const quarantinedTests = tests.filter((test) => isTestQuarantined(test));
    if (quarantinedTests.length > 0) {
      console.log(`\n⚠️ ${quarantinedTests.length} of ${totalTests} test(s) are quarantined`);
      console.log('💡 Set ENDORPHIN_RUN_QUARANTINED=true to run quarantined tests');
    }
    console.log('');
  }

  /**
   * Recursively scan directory for test files up to maxDepth levels
   */
  private async scanDirectoryRecursively(
    directory: string,
    allTestFiles: { file: string, directory: string }[],
    currentDepth: number,
    maxDepth: number
  ): Promise<void> {
    try {
      await stat(directory);
      const files = await readdir(directory);
      
      // Process files in current directory
      const testFiles = files.filter((file) => this.isTestFile(file));
      testFiles.forEach(file => {
        allTestFiles.push({ file, directory });
      });
      
      // If we haven't reached max depth, scan subdirectories
      if (currentDepth < maxDepth) {
        for (const file of files) {
          const fullPath = join(directory, file);
          try {
            const fileStat = await stat(fullPath);
            if (fileStat.isDirectory()) {
              await this.scanDirectoryRecursively(fullPath, allTestFiles, currentDepth + 1, maxDepth);
            }
          } catch {
            // Skip files that can't be accessed
          }
        }
      }
    } catch {
      // Directory doesn't exist or can't be accessed
    }
  }

  /**
   * Clear all discovered tests
   */
  clear(): void {
    this.tests.clear();
  }

  /**
   * Get discovery statistics
   */
  getStatistics() {
    const tests = this.getAllTests();
    const quarantinedTests = tests.filter((test) => isTestQuarantined(test));

    const priorities = tests.reduce(
      (acc, test) => {
        const priority = test.priority || 'Unknown';
        acc[priority] = (acc[priority] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const tags = tests.reduce(
      (acc, test) => {
        if (test.tags) {
          test.tags.forEach((tag) => {
            acc[tag] = (acc[tag] || 0) + 1;
          });
        }
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalTests: tests.length,
      quarantinedTests: quarantinedTests.length,
      activeTests: tests.length - quarantinedTests.length,
      priorities,
      tags,
      testsDirectory: this.testsDirectory,
    };
  }
}

#!/usr/bin/env node

/**
 * Endorphin AI CLI - E2E Testing Reinvented with AI
 */

// Configure Node.js event system to handle more listeners (prevents memory leak warnings)
import { EventEmitter } from 'node:events';
EventEmitter.defaultMaxListeners = 50;

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getConfig } from '../framework/core/config-loader.js';
import {
  handleGenerateCommand,
  handleHelpAndVersion,
  handleInitCommand,
  handleListCommand,
  handleOpenCommand,
  handleTestCommand,
  handleTestRecorderCommand,
} from './cli-handlers.js';
import { info, logSuccess, error as logError } from '../framework/core/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get package info
const packagePath = join(__dirname, '..', 'package.json');
const packageInfo = JSON.parse(readFileSync(packagePath, 'utf8'));

const args = process.argv.slice(2);

/**
 * Flag parsing utilities
 */
interface FlagResult {
  [key: string]: any;
  consumed?: number;
}

type FlagParser = (nextArg?: string) => FlagResult;

const FLAG_PARSERS: Record<string, FlagParser> = {
  '--headless': () => ({ headless: true }),
  '--no-headless': () => ({ headless: false }),
  '--viewport': (nextArg) => {
    if (nextArg?.includes('x')) {
      const [width, height] = nextArg.split('x').map(Number);
      return { viewport: { width, height }, consumed: 1 };
    }
    return {};
  },
  '--timeout': (nextArg) => {
    if (nextArg && !isNaN(Number(nextArg))) {
      return { timeout: parseInt(nextArg, 10), consumed: 1 };
    }
    return {};
  },
  '--model': (nextArg) => {
    if (nextArg) {
      return { model: nextArg, consumed: 1 };
    }
    return {};
  },
  '--env': (nextArg) => {
    if (nextArg) {
      return { environment: nextArg, consumed: 1 };
    }
    return {};
  },
  '--environment': (nextArg) => {
    if (nextArg) {
      return { environment: nextArg, consumed: 1 };
    }
    return {};
  },
  '--base-url': (nextArg) => {
    if (nextArg) {
      return { baseUrl: nextArg, consumed: 1 };
    }
    return {};
  },
  '--temperature': (nextArg) => {
    if (nextArg && !isNaN(Number(nextArg))) {
      return { temperature: parseFloat(nextArg), consumed: 1 };
    }
    return {};
  },
  '--tests-dir': (nextArg) => {
    if (nextArg) {
      return { testsDirectory: nextArg, consumed: 1 };
    }
    return {};
  },
  '--data-dir': (nextArg) => {
    if (nextArg) {
      return { dataDirectory: nextArg, consumed: 1 };
    }
    return {};
  },
  '--jira-sync': () => ({ jiraSync: true }),
};

/**
 * Parse CLI flags into configuration overrides
 */
function parseCliFlags(args: string[]): Record<string, any> {
  const flags: Record<string, any> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    const parser = FLAG_PARSERS[arg];

    if (parser) {
      const result = parser(nextArg);
      Object.assign(flags, result);

      // Skip consumed arguments
      if (result.consumed) {
        i += result.consumed;
      }
    }
  }

  return flags;
}

/**
 * Show help
 */
function showHelp(): void {
  console.log(`
🎉 Endorphin AI v${packageInfo.version} - E2E Testing Reinvented with AI

Usage:
  endorphin-ai <command> [options]

Commands:
  init                           Initialize new project with examples
  init-claude-skill              Initialize Claude Code integration (skills + config)
  run test <test-id>             Run a specific test (e.g., QE-001)
  run test all                   Run all tests
  run test --tag <tag>           Run tests by tag (e.g., authentication)
  run test --priority <level>    Run tests by priority (High, Medium, Low)
  run test --jira-sync           Sync tests from JIRA before running
  run test-recorder              Start interactive test recorder
  run jira-sync                  Sync tests from JIRA to tests/jira
  recorder create                Create a new recording session (CLI API)
  recorder add-step              Add a step to a recording session (CLI API)
  recorder generate              Generate test file from recording session (CLI API)
  recorder list                  List all recording sessions (CLI API)
  recorder status                Get status of a recording session (CLI API)
  list                           List all available tests
  list tools                     List all available built-in tools
  generate report                Generate HTML test report
  generate report --summary      Generate lightweight summary report
  open report [file]             Open latest (or specific) test report in browser
  cleanup results [count]        Clean up old test results (keep N per test, default: 10)
  cleanup reports [days]         Clean up old report files (older than N days, default: 30)
  help                           Show this help message

Options:
  --headless             Run browser in headless mode
  --no-headless          Run browser with visible UI
  --viewport <WxH>       Set browser viewport (e.g., 1920x1080)
  --timeout <ms>         Set test timeout in milliseconds
  --model <n>         Set AI model to use (e.g., gpt-4o-mini)
  --env <environment>    Set environment (development/staging/production)
  --jira-sync            Sync tests from JIRA before running

Examples:
  endorphin-ai init                               # Set up new project
  endorphin-ai init-claude-skill                  # Initialize Claude Code integration
  endorphin-ai run test HEALTH-001                # Run example test
  endorphin-ai run test all --headless            # Run all tests headless
  endorphin-ai run test --tag smoke               # Run smoke tests
  endorphin-ai run test --priority High --env staging # Run high priority tests on staging
  endorphin-ai run test --jira-sync               # Sync JIRA tests and run all
  endorphin-ai run test-recorder                  # Start test recorder
  endorphin-ai recorder create --id TEST-001 --name "Login Test" --url https://example.com
  endorphin-ai recorder add-step --session <id> --step "Click login button"
  endorphin-ai recorder generate --session <id> --output-dir tests/
  endorphin-ai recorder list                      # List all recording sessions
  endorphin-ai recorder status --session <id>     # Get session status
  endorphin-ai list                               # Show all available tests
  endorphin-ai list tools                         # Show all available built-in tools
  endorphin-ai generate report                    # Generate interactive HTML report
  endorphin-ai generate report --summary          # Generate lightweight summary report
  endorphin-ai generate report --file custom.html # Generate report with custom filename
  endorphin-ai open report                        # Open latest report in browser
  endorphin-ai cleanup results 5                  # Keep only 5 recent results per test
  endorphin-ai cleanup reports 7                  # Remove reports older than 7 days

Configuration:
  Create endorphin.config.ts in your project root for default settings
  CLI flags override configuration file settings
  Set OPENAI_API_KEY in your .env file or environment variables

Documentation: https://github.com/andrewnovykov/endorphin-ai#readme
`);
}

/**
 * Handle cleanup command
 */
async function handleCleanupCommand(subcommand: string, target?: string): Promise<void> {
  const { HtmlReporter } = await import('../framework/reporters/html-reporter.js');
  const reporter = new HtmlReporter();

  if (subcommand === 'results') {
    info('Cleaning up old test results', {}, 'CLI');
    const keepCount = parseInt(target ?? '10', 10);
    const cleanup = await reporter.cleanupResults(keepCount);
    logSuccess(`Cleanup completed: ${cleanup.deletedReports} reports removed`, { deletedReports: cleanup.deletedReports }, 'CLI');
    process.exit(0);
  }

  if (subcommand === 'reports') {
    info('Cleaning up old report files', {}, 'CLI');
    const maxAge = parseInt(target ?? '30', 10);
    const cleanup = await reporter.cleanupOldReports(maxAge);
    logSuccess(`Cleanup completed: ${cleanup.deleted} report files removed`, { deleted: cleanup.deleted }, 'CLI');
    process.exit(0);
  }

  logError(`Unknown cleanup command: ${subcommand}`, undefined, { subcommand }, 'CLI');
  info('Available: cleanup results [count], cleanup reports [days]', {}, 'CLI');
  process.exit(1);
}

/**
 * Main CLI handler
 */
export async function main(): Promise<void> {
  try {
    // Handle help and version first (these should always work)
    handleHelpAndVersion(args, packageInfo, showHelp);

    const command = args[0];
    const subcommand = args[1];
    const target = args[2];

    // Handle init command early (before config loading)
    if (command === 'init') {
      await handleInitCommand();
      return;
    }

    // Handle init-claude-skill command early (before config loading)
    if (command === 'init-claude-skill') {
      const { handleInitClaudeSkillCommand } = await import('./cli-handlers.js');
      await handleInitClaudeSkillCommand();
      return;
    }

    // Display molecular structure for test commands
    if (command === 'run' && (subcommand === 'test' || subcommand === 'test-recorder')) {
      const { ConsoleReporter } = await import('../framework/reporters/console-reporter.js');
      const reporter = new ConsoleReporter();
      reporter.displayEndorphinMolecule();
    }

    // Parse CLI flags
    const cliFlags = parseCliFlags(args);

    // Route commands
    switch (command) {
      case 'list': {
        // List command doesn't need AI validation
        const listConfig = await getConfig({ cwd: process.cwd(), cliFlags, validateAI: false });
        if (subcommand === 'tools') {
          const { handleListToolsCommand } = await import('../framework/cli/builtin-tools-command.js');
          await handleListToolsCommand({ verbose: args.includes('--verbose') });
        } else {
          await handleListCommand(listConfig);
        }
        break;
      }
      case 'recorder': {
        // Recorder commands don't need AI validation until recording starts
        const recorderConfig = await getConfig({
          cwd: process.cwd(),
          cliFlags,
          validateAI: false
        });
        const { handleRecorderCommand } = await import('./cli-handlers.js');
        await handleRecorderCommand(subcommand, args, recorderConfig);
        break;
      }
      case 'run': {
        if (subcommand === 'test-recorder') {
          // Test recorder doesn't need AI validation until recording starts
          const recorderConfig = await getConfig({
            cwd: process.cwd(),
            cliFlags,
            validateAI: false
          });
          await handleTestRecorderCommand(recorderConfig);
        } else if (subcommand === 'jira-sync') {
          // JIRA sync doesn't need AI validation
          const jiraConfig = await getConfig({ cwd: process.cwd(), cliFlags, validateAI: false });
          const { handleJiraSyncCommand } = await import('./cli-handlers.js');
          await handleJiraSyncCommand(jiraConfig);
        } else {
          // Other run commands need full AI validation
          const runConfig = await getConfig({ cwd: process.cwd(), cliFlags });
          if (args.includes('--debug')) {
            info('Loaded configuration', { config: runConfig }, 'CLI');
          }
          if (subcommand === 'test') {
            await handleTestCommand(args, target, runConfig);
          } else {
            logError(`Unknown run command: ${subcommand}`, undefined, { subcommand }, 'CLI');
            info('Use "endorphin-ai help" for usage information', {}, 'CLI');
            process.exit(1);
          }
        }
        break;
      }
      case 'generate':
        await handleGenerateCommand(subcommand, args);
        break;
      case 'open':
        await handleOpenCommand(subcommand, target);
        break;
      case 'cleanup':
        await handleCleanupCommand(subcommand, target);
        break;
      default:
        logError(`Unknown command: ${command}`, undefined, { command }, 'CLI');
        info('Use "endorphin help" for usage information', {}, 'CLI');
        process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(`Error: ${message}`, error instanceof Error ? error : undefined, { message }, 'CLI');

    if (message.includes('OPENAI_API_KEY')) {
      info('Tip: Make sure to set your OPENAI_API_KEY in your .env file or environment variables', {}, 'CLI');
    }

    process.exit(1);
  }
}

// Run CLI when executed directly
// This works for both direct execution and npm package execution
const isMainModule = () => {
  // Check if this is the main module being executed
  try {
    // For ES modules, check if the current file matches the entry point
    const currentFile = fileURLToPath(import.meta.url);
    const entryFile = process.argv[1];

    // Handle both direct execution and symlinked npm binaries
    return (
      currentFile === entryFile ||
      entryFile.includes('endorphin-ai') ||
      entryFile.includes('endorphin')
    );
  } catch {
    return true; // Default to running if we can't determine
  }
};

if (isMainModule()) {
  main();
}

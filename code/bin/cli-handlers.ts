/**
 * CLI Command Handlers
 * Separated command handlers to reduce complexity in main CLI file
 */

import type { FrameworkConfig } from '../framework/types/config';
import { info, logSuccess, logWithIcon, LogLevel, error as logError } from '../framework/core/logger.js';

/**
 * Handle help and version commands
 */
export function handleHelpAndVersion(
  args: string[],
  packageInfo: { version: string },
  showHelp: () => void
): void {
  if (
    args.length === 0 ||
    args.includes('--help') ||
    args.includes('-h') ||
    args.includes('help')
  ) {
    showHelp();
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    info(`Endorphin AI v${packageInfo.version}`, {}, 'CLI');
    process.exit(0);
  }
}

/**
 * Handle list command
 */
export async function handleListCommand(config: FrameworkConfig): Promise<void> {
  info('Available Tests:', {}, 'CLI');
  const { listAllTests } = await import('../framework/execution/discovery/cli-functions.js');
  await listAllTests(config);
  process.exit(0);
}

/**
 * Handle init command
 */
export async function handleInitCommand(): Promise<void> {
  logWithIcon(LogLevel.INFO, 'target', 'Initializing Endorphin AI project', {}, 'CLI');
  try {
    const { initProject } = await import('../framework/cli/init-command.js');
    await initProject(process.cwd());
    process.exit(0);
  } catch (error: any) {
    logError('Failed to initialize project', error, { message: error.message }, 'CLI');
    info('Try running: npm install endorphin-ai --save-dev', {}, 'CLI');
    process.exit(1);
  }
}

/**
 * Handle test recorder command
 */
export async function handleTestRecorderCommand(config: FrameworkConfig): Promise<void> {
  info('Starting Interactive Test Recorder', {}, 'CLI');
  const { runInteractiveRecorder } = await import(
    '../framework/test-recorder/interactive-recorder.js'
  );
  await runInteractiveRecorder(config);
  process.exit(0);
}

/**
 * Handle recorder command
 */
export async function handleRecorderCommand(
  subcommand: string,
  args: string[],
  _config: FrameworkConfig
): Promise<void> {
  const { RecorderCLI } = await import('../framework/test-recorder/recorder-cli.js');
  const cli = new RecorderCLI();

  try {
    await cli.handleCommand(subcommand, args);
    process.exit(0);
  } catch (error: any) {
    // Error output as JSON
    const errorOutput = {
      error: error.message || 'Unknown error',
      command: subcommand,
    };
    console.log(JSON.stringify(errorOutput, null, 2));
    process.exit(1);
  }
}

/**
 * Handle init-claude-skill command
 */
export async function handleInitClaudeSkillCommand(): Promise<void> {
  logWithIcon(LogLevel.INFO, 'target', 'Initializing Claude Code integration', {}, 'CLI');
  try {
    const { initClaudeSkill } = await import('../framework/cli/init-claude-skill-command.js');
    await initClaudeSkill(process.cwd());
    process.exit(0);
  } catch (error: any) {
    logError('Failed to initialize Claude Code integration', error, { message: error.message }, 'CLI');
    process.exit(1);
  }
}

/**
 * Handle JIRA sync command
 */
export async function handleJiraSyncCommand(_config: FrameworkConfig): Promise<void> {
  const { JiraSyncCommand } = await import('../framework/cli/jira-sync-command.js');
  const result = await JiraSyncCommand.execute();
  process.exit(result.success ? 0 : 1);
}

/**
 * Handle test command with different options
 */
export async function handleTestCommand(
  args: string[],
  target: string | undefined,
  config: FrameworkConfig,
  options: Record<string, any> = {}
): Promise<void> {
  // Handle JIRA sync if requested
  if (args.includes('--jira-sync')) {
    info('JIRA sync requested, syncing tests first', {}, 'CLI');
    const { JiraSyncCommand } = await import('../framework/cli/jira-sync-command.js');
    const syncResult = await JiraSyncCommand.execute();
    
    if (!syncResult.success) {
      logError('JIRA sync failed, aborting test run', undefined, { errors: syncResult.errors }, 'CLI');
      process.exit(1);
    }
    
    logSuccess(`JIRA sync completed: ${syncResult.testsGenerated} tests generated`, { testsGenerated: syncResult.testsGenerated }, 'CLI');
    info('Proceeding with test execution', {}, 'CLI');
  }

  if (args.includes('--tag')) {
    return handleTestByTag(args, config, options);
  }

  if (args.includes('--priority')) {
    return handleTestByPriority(args, config, options);
  }

  if (target === 'all') {
    logWithIcon(LogLevel.INFO, 'rocket', 'Running all tests', {}, 'CLI');
    const { runAllTests } = await import('../framework/execution/discovery/cli-functions.js');
    await runAllTests(config);
    process.exit(0);
  }

  if (target) {
    info(`Running test: ${target}`, { testId: target }, 'CLI');
    const { runSingleTestById } = await import('../framework/execution/discovery/cli-functions.js');
    const result = await runSingleTestById(target, config);
    
    // Check if the test execution was successful
    if (result && !result.success) {
      process.exit(1);
    }
    process.exit(0);
  }

  logError('Error: Please specify a test ID or "all" (e.g., endorphin run test QE-001)', undefined, {}, 'CLI');
  process.exit(1);
}

/**
 * Handle generate command
 */
export async function handleGenerateCommand(subcommand: string, args: string[]): Promise<void> {
  if (subcommand === 'report') {
    info('Generating HTML test report', {}, 'CLI');
    
    try {
      // Always use current working directory for test results
      const testResultsDir = `${process.cwd()}/test-results`;
      
      // Check if test-results directory exists
      const fs = await import('fs');
      if (!fs.existsSync(testResultsDir)) {
        logError('No test-results directory found in current folder', undefined, { testResultsDir }, 'CLI');
        info('Run some tests first: npx endorphin-ai run test HEALTH-001', {}, 'CLI');
        info('Or check that you\'re in the right directory', {}, 'CLI');
        process.exit(1);
      }

      const { HtmlReporter } = await import('../framework/reporters/html-reporter.js');
      const reporter = new HtmlReporter(testResultsDir);
      const options: { filename?: string } = {};

      const fileIndex = args.indexOf('--file');
      if (fileIndex !== -1 && args[fileIndex + 1]) {
        options.filename = args[fileIndex + 1];
      }

      info(`Looking for test results in: ${testResultsDir}`, { testResultsDir }, 'CLI');
      const reportPath = await reporter.generateReport(options);

      if (args.includes('--summary')) {
        logSuccess(`Summary report generated: ${reportPath}`, { reportPath }, 'CLI');
      } else {
        logSuccess(`Report generated: ${reportPath}`, { reportPath }, 'CLI');
        info(`To open the report: npx endorphin-ai open report`, {}, 'CLI');
        info(`Or open directly: open "${reportPath}"`, {}, 'CLI');
      }
      process.exit(0);
    } catch (error: any) {
      logError(`Failed to generate report: ${error.message}`, error, { error: error.message }, 'CLI');
      info('Troubleshooting:', {}, 'CLI');
      info('1. Make sure you have run some tests first', {}, 'CLI');
      info('2. Check that test-results/ directory exists', {}, 'CLI');
      info('3. Try: ls -la test-results/', {}, 'CLI');
      process.exit(1);
    }
  }

  logError(`Unknown generate command: ${subcommand}`, undefined, { subcommand }, 'CLI');
  info('Use "endorphin help" for usage information', {}, 'CLI');
  process.exit(1);
}

/**
 * Handle open command
 */
export async function handleOpenCommand(subcommand: string, target?: string): Promise<void> {
  if (subcommand === 'report') {
    info('Opening latest test report', {}, 'CLI');
    
    try {
      // Always use current working directory for test results
      const testResultsDir = `${process.cwd()}/test-results`;
      
      // Check if test-results directory exists
      const fs = await import('fs');
      if (!fs.existsSync(testResultsDir)) {
        logError('No test-results directory found in current folder', undefined, { testResultsDir }, 'CLI');
        info('Generate a report first: npx endorphin-ai generate report', {}, 'CLI');
        info('Or check that you\'re in the right directory', {}, 'CLI');
        process.exit(1);
      }

      const { HtmlReporter } = await import('../framework/reporters/html-reporter.js');
      const reporter = new HtmlReporter(testResultsDir);
      const reportPath = target ?? null;
      await reporter.openReport(reportPath);
      process.exit(0);
    } catch (error: any) {
      logError(`Failed to open report: ${error.message}`, error, { error: error.message }, 'CLI');
      info('Try generating a report first: npx endorphin-ai generate report', {}, 'CLI');
      process.exit(1);
    }
  }

  logError(`Unknown open command: ${subcommand}`, undefined, { subcommand }, 'CLI');
  info('Use "endorphin help" for usage information', {}, 'CLI');
  process.exit(1);
}

/**
 * Handle test by tag command
 */
async function handleTestByTag(
  args: string[],
  config: FrameworkConfig,
  _options: Record<string, any> = {}
): Promise<void> {
  const tagIndex = args.indexOf('--tag');
  if (tagIndex === -1 || !args[tagIndex + 1]) {
    logError('Error: --tag requires a tag value', undefined, {}, 'CLI');
    process.exit(1);
  }

  const tag = args[tagIndex + 1];
  info(`Running tests with tag: ${tag}`, { tag }, 'CLI');

  const { runTestsByTag } = await import('../framework/execution/discovery/cli-functions.js');
  await runTestsByTag(tag, config);
  process.exit(0);
}

/**
 * Handle test by priority command
 */
async function handleTestByPriority(
  args: string[],
  config: FrameworkConfig,
  _options: Record<string, any> = {}
): Promise<void> {
  const priorityIndex = args.indexOf('--priority');
  if (priorityIndex === -1 || !args[priorityIndex + 1]) {
    logError('Error: --priority requires a priority value', undefined, {}, 'CLI');
    process.exit(1);
  }

  const priority = args[priorityIndex + 1];
  logWithIcon(LogLevel.INFO, 'target', `Running tests with priority: ${priority}`, { priority }, 'CLI');

  const { runTestsByPriority } = await import('../framework/execution/discovery/cli-functions.js');
  await runTestsByPriority(priority, config);
  process.exit(0);
}

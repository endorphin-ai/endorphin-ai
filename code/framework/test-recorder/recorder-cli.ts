/**
 * CLI handler for recorder commands
 * Routes subcommands to RecorderAPI and formats output
 */

import { RecorderAPI } from './recorder-api.js';
import type { CreateSessionParams, AddStepParams, GenerateTestParams } from './recorder-api.js';

/**
 * CLI handler for recorder commands
 * Routes subcommands to RecorderAPI and formats output
 */
export class RecorderCLI {
  private api: RecorderAPI;

  constructor() {
    this.api = new RecorderAPI();
  }

  async handleCommand(subcommand: string, args: string[]): Promise<void> {
    switch (subcommand) {
      case 'create':
        await this.handleCreate(args);
        break;
      case 'add-step':
        await this.handleAddStep(args);
        break;
      case 'generate':
        await this.handleGenerate(args);
        break;
      case 'list':
        await this.handleList();
        break;
      case 'status':
        await this.handleStatus(args);
        break;
      case 'close-browser':
        await this.handleCloseBrowser(args);
        break;
      default:
        throw new Error(`Unknown recorder command: ${subcommand}`);
    }
  }

  private async handleCreate(args: string[]): Promise<void> {
    const flags = this.parseCreateFlags(args);

    console.error('🎬 Creating recording session...');

    const result = await this.api.createSession(flags);

    // Warn if initial navigation failed (page stayed at about:blank)
    if (result.pageState && result.pageState.url === 'about:blank') {
      console.error(`⚠️ Session created but navigation may have failed (page is about:blank)`);
    } else {
      console.error('✅ Session created successfully!');
    }
    console.log(JSON.stringify(result, null, 2));
  }

  private async handleAddStep(args: string[]): Promise<void> {
    const flags = this.parseAddStepFlags(args);

    console.error(`🤖 Processing step: "${flags.stepDescription}"`);

    const result = await this.api.addStep(flags);

    if (result.success) {
      console.error(`✅ Step ${result.stepNumber} recorded successfully!`);
    } else {
      console.error(`❌ Step ${result.stepNumber} failed: ${result.result}`);
    }
    console.log(JSON.stringify(result, null, 2));
  }

  private async handleGenerate(args: string[]): Promise<void> {
    const flags = this.parseGenerateFlags(args);

    console.error('📝 Generating test file...');

    const result = await this.api.generateTest(flags);

    console.error(`✅ Test file created: ${result.testFilePath}`);
    console.log(JSON.stringify(result, null, 2));
  }

  private async handleList(): Promise<void> {
    const result = await this.api.listSessions();
    console.log(JSON.stringify(result, null, 2));
  }

  private async handleStatus(args: string[]): Promise<void> {
    const flags = this.parseStatusFlags(args);
    const result = await this.api.getSessionStatus(flags.sessionId);
    console.log(JSON.stringify(result, null, 2));
  }

  private async handleCloseBrowser(args: string[]): Promise<void> {
    const flags = this.parseStatusFlags(args);

    console.error('Closing persistent browser for session...');

    await this.api.closePersistentBrowser(flags.sessionId);

    console.error('Browser closed successfully.');
    console.log(JSON.stringify({ sessionId: flags.sessionId, browserClosed: true }, null, 2));
  }

  // Flag parsing methods
  private parseCreateFlags(args: string[]): CreateSessionParams {
    const flags: any = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--id' && args[i + 1]) {
        flags.testId = args[++i];
      } else if (arg === '--name' && args[i + 1]) {
        flags.testName = args[++i];
      } else if (arg === '--description' && args[i + 1]) {
        flags.testDescription = args[++i];
      } else if (arg === '--priority' && args[i + 1]) {
        flags.priority = args[++i];
      } else if (arg === '--tags' && args[i + 1]) {
        flags.tags = args[++i].split(',').map((t: string) => t.trim());
      } else if (arg === '--url' && args[i + 1]) {
        flags.url = args[++i];
      } else if (arg === '--data' && args[i + 1]) {
        const dataStr = args[++i];
        const eqIndex = dataStr.indexOf('=');
        if (eqIndex > 0) {
          const key = dataStr.substring(0, eqIndex);
          const value = dataStr.substring(eqIndex + 1);
          if (!flags.testData) flags.testData = {};
          flags.testData[key] = value;
        }
      }
    }

    if (!flags.testId || !flags.testName) {
      throw new Error('Required flags: --id, --name');
    }

    return flags as CreateSessionParams;
  }

  private parseAddStepFlags(args: string[]): AddStepParams {
    const flags: any = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--session' && args[i + 1]) {
        flags.sessionId = args[++i];
      } else if (arg === '--step' && args[i + 1]) {
        flags.stepDescription = args[++i];
      }
    }

    if (!flags.sessionId || !flags.stepDescription) {
      throw new Error('Required flags: --session, --step');
    }

    return flags as AddStepParams;
  }

  private parseGenerateFlags(args: string[]): GenerateTestParams {
    const flags: any = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--session' && args[i + 1]) {
        flags.sessionId = args[++i];
      } else if (arg === '--output-dir' && args[i + 1]) {
        flags.outputDir = args[++i];
      }
    }

    if (!flags.sessionId) {
      throw new Error('Required flag: --session');
    }

    return flags as GenerateTestParams;
  }

  private parseStatusFlags(args: string[]): { sessionId: string } {
    const flags: any = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--session' && args[i + 1]) {
        flags.sessionId = args[++i];
      }
    }

    if (!flags.sessionId) {
      throw new Error('Required flag: --session');
    }

    return flags;
  }
}

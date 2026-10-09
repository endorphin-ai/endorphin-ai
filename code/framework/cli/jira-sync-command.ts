/**
 * JIRA Sync Command for Endorphin AI CLI
 * Handles the --jira-sync flag functionality
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import type { JiraConfig, JiraSyncResult } from '../types/config.js';
import { JiraClient } from '../jira/jira-client.js';
import { JiraConverter } from '../jira/jira-converter.js';
import { JiraStorage } from '../jira/jira-storage.js';

export class JiraSyncCommand {
  /**
   * Execute JIRA sync operation
   */
  static async execute(): Promise<JiraSyncResult> {
    console.log('🔄 Starting JIRA sync...');
    
    try {
      // 1. Load JIRA configuration
      const config = await this.loadJiraConfig();
      console.log(`📋 Connected to JIRA: ${config.url}`);
      console.log(`🎯 Project: ${config.projectId}, Issue Type: ${config.issueTypeId}, Label: ${config.label}`);

      // 2. Validate configuration
      const validationErrors = JiraClient.validateConfig(config);
      if (validationErrors.length > 0) {
        throw new Error(`JIRA configuration errors:\n${validationErrors.join('\n')}`);
      }

      // 3. Initialize clients
      const client = new JiraClient(config);
      const storage = new JiraStorage();

      // 4. Test connection
      console.log('🔌 Testing JIRA connection...');
      const connectionOk = await client.testConnection();
      if (!connectionOk) {
        throw new Error('Failed to connect to JIRA. Please check your credentials and URL.');
      }
      console.log('✅ JIRA connection successful');

      // 5. Fetch tickets from JIRA
      console.log('📥 Fetching tickets from JIRA...');
      const remoteTickets = await client.fetchTickets();
      console.log(`📊 Found ${remoteTickets.length} tickets in JIRA`);

      if (remoteTickets.length === 0) {
        console.log('ℹ️  No tickets found matching the criteria');
        return {
          success: true,
          ticketsFetched: 0,
          testsGenerated: 0,
          errors: []
        };
      }

      // 6. Determine which tickets need updating
      const ticketsToUpdate = await storage.getTicketsNeedingUpdate(remoteTickets);
      console.log(`🔄 ${ticketsToUpdate.length} tickets need updating`);

      // 7. Save raw ticket data
      if (ticketsToUpdate.length > 0) {
        console.log('💾 Saving raw ticket data...');
        await storage.saveTicketsBatch(ticketsToUpdate);
      }

      // 8. Clean up old tickets
      const currentTicketKeys = remoteTickets.map(t => t.key);
      const deletedCount = await storage.cleanupOldTickets(currentTicketKeys);
      if (deletedCount > 0) {
        console.log(`🗑️  Cleaned up ${deletedCount} old tickets`);
      }

      // 9. Convert tickets to test cases and generate files
      console.log('🔧 Converting tickets to test cases...');
      const testsDir = join(process.cwd(), 'tests', 'jira');
      await this.ensureDirectoryExists(testsDir);

      let testsGenerated = 0;
      const errors: string[] = [];

      for (const ticket of remoteTickets) {
        try {
          // Validate ticket format
          const validationErrors = JiraConverter.validateTicketFormat(ticket);
          if (validationErrors.length > 0) {
            errors.push(`${ticket.key}: ${validationErrors.join(', ')}`);
            continue;
          }

          // Convert to test case
          const conversionResult = JiraConverter.convertTicketToTestCase(ticket);
          if (!conversionResult.success || !conversionResult.testCase) {
            errors.push(conversionResult.error || `Failed to convert ${ticket.key}`);
            continue;
          }

          // Generate test file
          const testFileContent = JiraConverter.generateTestFileContent(conversionResult.testCase);
          const testFileName = `${ticket.key.replace('-', '_')}.ts`;
          const testFilePath = join(testsDir, testFileName);

          await fs.writeFile(testFilePath, testFileContent, 'utf8');
          testsGenerated++;

          console.log(`✅ Generated test: ${testFileName}`);

        } catch (error) {
          const errorMsg = `${ticket.key}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          console.error(`❌ Error processing ${ticket.key}:`, error);
        }
      }

      // 10. Show summary
      console.log('\n📊 JIRA Sync Summary:');
      console.log(`   Tickets fetched: ${remoteTickets.length}`);
      console.log(`   Tests generated: ${testsGenerated}`);
      console.log(`   Errors: ${errors.length}`);
      
      if (errors.length > 0) {
        console.log('\n⚠️  Errors encountered:');
        errors.forEach(error => console.log(`   • ${error}`));
      }

      // 11. Show storage stats
      const stats = await storage.getStorageStats();
      console.log(`\n💾 Storage: ${stats.totalTickets} tickets, ${(stats.totalSize / 1024).toFixed(1)}KB`);
      
      console.log(`\n🎉 JIRA sync completed! Generated tests are in: tests/jira/`);
      console.log(`   Run tests with: npx endorphin run test --pattern "tests/jira/**/*.ts"`);

      return {
        success: true,
        ticketsFetched: remoteTickets.length,
        testsGenerated,
        errors
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ JIRA sync failed:', errorMsg);
      
      return {
        success: false,
        ticketsFetched: 0,
        testsGenerated: 0,
        errors: [errorMsg]
      };
    }
  }

  /**
   * Load JIRA configuration from environment and config file
   */
  private static async loadJiraConfig(): Promise<JiraConfig> {
    const config: Partial<JiraConfig> = {};

    // Try to load from environment variables first
    config.url = process.env.JIRA_URL || '';
    config.email = process.env.JIRA_EMAIL || '';
    config.apiToken = process.env.JIRA_API_TOKEN || '';
    config.projectId = process.env.JIRA_PROJECT_ID || '';
    config.issueTypeId = process.env.JIRA_ISSUE_TYPE_ID || '';
    config.label = process.env.JIRA_LABEL || '';

    // Try to load from config file if any values are missing
    try {
      const configModule = await import(join(process.cwd(), 'endorphin.config.js'));
      const fileConfig = configModule.default;
      
      if (fileConfig.jira) {
        config.url = config.url || fileConfig.jira.url;
        config.email = config.email || fileConfig.jira.email;
        config.apiToken = config.apiToken || fileConfig.jira.apiToken;
        config.projectId = config.projectId || fileConfig.jira.projectId;
        config.issueTypeId = config.issueTypeId || fileConfig.jira.issueTypeId;
        config.label = config.label || fileConfig.jira.label;
      }
    } catch {
      // Config file not found or doesn't have JIRA config, rely on env vars
    }

    // Validate all required fields are present
    const requiredFields: (keyof JiraConfig)[] = ['url', 'email', 'apiToken', 'projectId', 'issueTypeId', 'label'];
    const missingFields = requiredFields.filter(field => !config[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing JIRA configuration. Please set the following:\n${missingFields.map(field => {
        const envVar = `JIRA_${field.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
        return `  • Environment variable: ${envVar}`;
      }).join('\n')}\n\nOr add to endorphin.config.ts:\n  jira: {\n${missingFields.map(field => `    ${field}: 'your_${field}'`).join(',\n')}\n  }`);
    }

    return config as JiraConfig;
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  private static async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Show JIRA configuration help
   */
  static showHelp(): void {
    console.log(`
🔧 JIRA Sync Configuration

Environment Variables:
  JIRA_URL           - Your JIRA instance URL (e.g., https://yourcompany.atlassian.net)
  JIRA_EMAIL         - Your JIRA account email
  JIRA_API_TOKEN     - Your JIRA API token (create at: Account Settings > Security > API tokens)
  JIRA_PROJECT_ID    - JIRA project ID (numeric, e.g., 10001)
  JIRA_ISSUE_TYPE_ID - Issue type ID for test cases (numeric, e.g., 10013)
  JIRA_LABEL         - Label to filter tickets (e.g., ai-test-case)

Configuration File (endorphin.config.ts):
  export default {
    jira: {
      url: 'https://yourcompany.atlassian.net',
      email: 'your-email@company.com',
      apiToken: 'your-api-token',
      projectId: '10001',
      issueTypeId: '10013',
      label: 'ai-test-case'
    }
  };

Ticket Format:
  Your JIRA tickets should contain test specifications in the description field:

  @GENERATE.DATA('Generate test user credentials') {
    email: 'string - valid email address for testing'
    password: 'string - simple password for testing'
    username: 'string - username for testing'
  }

  @USER1.PHASE1 {
    STEP 1: Navigate to https://qafromla.herokuapp.com/
    STEP 2: Click on "Login" button
    STEP 3: Enter \${data.email} in the email field
    STEP 4: Enter \${data.password} in the password field
    STEP 5: Click "Sign In" button
    STEP 6: Verify login success
  }

Usage:
  npx endorphin run test --jira-sync
`);
  }
}
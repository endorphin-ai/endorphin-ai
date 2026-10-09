/**
 * JIRA Test Case Converter for Endorphin AI
 * Converts JIRA tickets with custom test format to Endorphin AI test cases
 */

import type { JiraTicket } from '../types/config.js';
import type { TestCase } from '../types/test.js';
import { warn } from '../core/logger.js';

export interface ConversionResult {
  success: boolean;
  testCase?: TestCase;
  error?: string;
}

export class JiraConverter {
  /**
   * Convert a JIRA ticket to an Endorphin AI test case
   */
  static convertTicketToTestCase(ticket: JiraTicket): ConversionResult {
    try {
      const dataBlock = this.extractDataBlock(ticket.description);
      const declaredUsers = this.extractUsersSection(ticket.description);
      const userPhases = this.extractUserPhases(ticket.description, declaredUsers);

      if (Object.keys(userPhases).length === 0) {
        return {
          success: false,
          error: `No @USER.PHASE blocks found in ticket ${ticket.key}`
        };
      }

      // Use declared users if available, otherwise extract from phase keys
      let usersArray: string[];
      if (declaredUsers && declaredUsers.length > 0) {
        usersArray = declaredUsers;
      } else {
        // Extract unique users from phase keys (legacy mode)
        const uniqueUsers = new Set<string>();
        const phaseKeys = Object.keys(userPhases);
        
        phaseKeys.forEach(key => {
          // Extract user from patterns like 'user1.phase1' or 'user.phase1'
          const userMatch = key.match(/^(user\d*)/);
          if (userMatch) {
            const user = userMatch[1] === 'user' ? 'user1' : userMatch[1];
            uniqueUsers.add(user);
          }
        });

        usersArray = Array.from(uniqueUsers).sort();
      }

      const hasMultipleUsers = usersArray.length > 1;

      const testCase: any = {
        id: ticket.key,
        name: ticket.summary,
        description: `JIRA test case: ${ticket.summary}`,
        priority: 'Medium' as const,
        tags: ['jira', 'automated', ...ticket.labels],
      };

      // Add users array for multi-user tests
      if (hasMultipleUsers) {
        testCase.users = usersArray;
      }

      // Add data function if dataBlock exists
      if (dataBlock) {
        testCase.data = this.createDataFunction(dataBlock.fields, dataBlock.prompt);
      }

      // Use tasks for multiple users, task for single user
      if (hasMultipleUsers) {
        testCase.tasks = this.createTasksFunction(userPhases, !!dataBlock);
      } else {
        // For single user, use all phases combined
        const phaseKeys = Object.keys(userPhases);
        if (phaseKeys.length === 1) {
          testCase.task = this.createTaskFunction(userPhases[phaseKeys[0]], !!dataBlock);
        } else {
          // Single user with multiple phases - combine them
          testCase.task = this.createSingleUserMultiPhaseTask(userPhases, !!dataBlock);
        }
      }

      return {
        success: true,
        testCase
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to convert ticket ${ticket.key}: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Extract @USERS section from description
   */
  private static extractUsersSection(description: string): string[] | null {
    const usersMatch = description.match(/@USERS\s*\[(.*?)\]/);
    if (!usersMatch) return null;

    const usersString = usersMatch[1];
    
    // Parse user declarations like [@ADMIN, @SELLER, @USER]
    const users = usersString
      .split(',')
      .map(user => user.trim())
      .filter(user => user)
      .map(user => {
        // Remove @ prefix but keep hyphens and original case for pattern matching
        const cleanUser = user.startsWith('@') ? user.substring(1) : user;
        return cleanUser.toLowerCase(); // Keep hyphens: admin-1, user1, etc.
      })
      .filter(user => user); // Remove empty strings

    return users.length > 0 ? users : null;
  }

  /**
   * Extract @DATA block from description
   */
  private static extractDataBlock(description: string): { prompt: string; fields: Record<string, string> } | null {
    const dataMatch = description.match(/@DATA\('([^']+)'\)([\s\S]*?)@STEPS/);
    if (!dataMatch) return null;

    const prompt = dataMatch[1];
    const fieldsContent = dataMatch[2].trim();
    const fields: Record<string, string> = {};

    // Split on actual newlines (not escaped ones)
    const lines = fieldsContent.split('\n').map(line => line.trim()).filter(line => line);
    
    // Check if we have properly separated lines or concatenated fields
    if (lines.length === 1 && lines[0].includes(':')) {
      // Fallback: Handle concatenated fields in a single line
      // Pattern: "field1: description1field2: description2field3: description3"
      const concatenatedLine = lines[0];
      
      // Look for common field names and their boundaries in the concatenated text
      // Order is important - put longer field names first to avoid conflicts
      const knownFields = ['username', 'email', 'password', 'phone', 'address'];
      const fieldBoundaries: Array<{ name: string; start: number; end: number }> = [];
      
      // Find all known field names in the text
      for (const fieldName of knownFields) {
        const fieldIndex = concatenatedLine.toLowerCase().indexOf(`${fieldName  }:`);
        if (fieldIndex !== -1) {
          fieldBoundaries.push({
            name: fieldName,
            start: fieldIndex,
            end: fieldIndex + fieldName.length + 1 // +1 for the colon
          });
        }
      }
      
      // Sort by position in the text
      fieldBoundaries.sort((a, b) => a.start - b.start);
      
      // Extract field descriptions between boundaries
      for (let i = 0; i < fieldBoundaries.length; i++) {
        const currentField = fieldBoundaries[i];
        const nextField = fieldBoundaries[i + 1];
        
        const startPos = currentField.end;
        const endPos = nextField ? nextField.start : concatenatedLine.length;
        
        let fieldDescription = concatenatedLine.substring(startPos, endPos).trim();
        
        // Remove any trailing text that might be part of the next field
        if (nextField) {
          // Clean up any partial text from the next field that got included
          const nextFieldName = nextField.name;
          const regex = new RegExp(`\\s*${nextFieldName}$`, 'i');
          fieldDescription = fieldDescription.replace(regex, '').trim();
        }
        
        // Special handling for the username field since it can contain the word "username" in the description
        if (currentField.name === 'username' && fieldDescription.startsWith('name:')) {
          // Extract the actual username description from after "name:"
          fieldDescription = fieldDescription.substring(5).trim(); // Remove "name:" prefix
        }
        
        if (fieldDescription) {
          fields[currentField.name] = fieldDescription;
        }
      }
    } else {
      // Normal line-by-line parsing
      for (const line of lines) {
        const fieldMatch = line.match(/^(\w+):\s*(.+)$/);
        if (fieldMatch) {
          const [, fieldName, fieldDescription] = fieldMatch;
          fields[fieldName] = fieldDescription.trim();
        }
      }
    }

    return { prompt, fields };
  }

  /**
   * Extract @USER.PHASE blocks from @STEPS section
   */
  private static extractUserPhases(description: string, declaredUsers?: string[] | null): Record<string, string> {
    const stepsMatch = description.match(/@STEPS([\s\S]*?)$/);
    if (!stepsMatch) return {};

    let stepsContent = stepsMatch[1];
    const userPhases: Record<string, string> = {};
    
    // Convert literal \n strings to actual newlines (for JSON-stored data)
    // Handle both single and double-escaped newlines
    stepsContent = stepsContent.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
    
    // If we have declared users, look for role-based patterns like @ADMIN.PHASE1, @SELLER.PHASE1
    if (declaredUsers && declaredUsers.length > 0) {
      // Create pattern for declared user roles - need to escape special regex characters like hyphens
      const userRolePattern = declaredUsers.map(user => {
        // Escape special regex characters but preserve the original case and hyphens
        return user.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('|');
      const roleRegex = new RegExp(`@(${userRolePattern})(?:\\.PHASE(\\d+))?([\\s\\S]*?)(?=@(?:${userRolePattern})|$)`, 'gi');
      
      let match;
      while ((match = roleRegex.exec(stepsContent)) !== null) {
        const roleName = match[1].toLowerCase();
        const phaseNumber = match[2] || '1'; // Default to phase 1 if no phase specified
        const content = match[3].trim();
        
        if (content) {
          const key = `${roleName}.phase${phaseNumber}`;
          userPhases[key] = content;
        }
      }
    } else {
      // Legacy format support: @USER.PHASE1, @USER1.PHASE1, and @USER1
      // First try to match patterns with explicit phase numbers
      let phaseMatches = Array.from(stepsContent.matchAll(/@USER(\d*)\.PHASE(\d+)([\s\S]*?)(?=@USER\d*(?:\.PHASE\d+)?(?:\s|$)|$)/g));
      
      // If no phase matches found, try simpler @USER1 format
      if (phaseMatches.length === 0) {
        const simpleMatches = Array.from(stepsContent.matchAll(/@USER(\d+)([\s\S]*?)(?=@USER\d+(?:\s|$)|$)/g));
        phaseMatches = simpleMatches.map(match => {
          // Convert to phase format with default phase 1
          const result = [match[0], match[1], '1', match[2]] as any;
          result.index = match.index;
          result.input = match.input;
          result.groups = match.groups;
          return result;
        });
      }
      
      for (const match of phaseMatches) {
        const userNum = match[1] || ''; // Empty string if no user number
        const phaseNumber = match[2] || '1'; // Default to phase 1
        const content = match[3].trim();
        
        // Generate key based on format
        const key = userNum 
          ? `user${userNum}.phase${phaseNumber}`  // @USER1 or @USER1.PHASE1 -> user1.phase1
          : `user.phase${phaseNumber}`;            // @USER.PHASE1 -> user.phase1
          
        userPhases[key] = content;
      }
    }

    return userPhases;
  }

  /**
   * Create a data function from the @DATA block
   */
  private static createDataFunction(fields: Record<string, string>, prompt: string): string {
    // Return a function string that will be written to the test file
    return `async () => {
    info('Generating test data for JIRA ticket', {}, 'JiraConverter');

    // Use AI to generate realistic user data
    const { generateData } = await import('../../framework/utils/generate-data.js');
    const userData = await generateData(
      ${JSON.stringify(fields, null, 6).split('\n').map((line, i) => i === 0 ? line : `      ${  line}`).join('\n')},
      '${prompt}'
    );

    info('Generated test data for JIRA ticket', { userData }, 'JiraConverter');
    return userData;
  }`;
  }

  /**
   * Create tasks function for multiple phases
   */
  private static createTasksFunction(phaseBlocks: Record<string, string>, hasData: boolean): string {
    const tasksObj: Record<string, string> = {};
    
    for (const [phaseKey, phaseContent] of Object.entries(phaseBlocks)) {
      const steps = this.extractStepsFromPhase(phaseContent);
      tasksObj[phaseKey] = steps.join('\\n');
    }

    // If the tasks contain variable substitution, return a function
    const tasksString = JSON.stringify(tasksObj, null, 4);
    if (hasData && tasksString.includes('${data.')) {
      return `async (data) => {
    const tasks = ${tasksString};
    
    // Substitute variables in all tasks
    const substitutedTasks: Record<string, string> = {};
    for (const [key, value] of Object.entries(tasks)) {
      substitutedTasks[key] = value.replace(/\\$\\{data\\.(\\w+)\\}/g, (match, fieldName) => {
        return data[fieldName] || match;
      });
    }
    
    return substitutedTasks;
  }`;
    }

    // Otherwise, return the tasks object directly
    return `async () => (${tasksString})`;
  }

  /**
   * Create a task function for single user with multiple phases
   */
  private static createSingleUserMultiPhaseTask(phaseBlocks: Record<string, string>, hasData: boolean): string {
    // Combine all phases into a single task
    const allSteps: string[] = [];
    const sortedPhases = Object.keys(phaseBlocks).sort();
    
    sortedPhases.forEach(phaseKey => {
      const steps = this.extractStepsFromPhase(phaseBlocks[phaseKey]);
      allSteps.push(...steps);
    });

    if (hasData) {
      const stepsJson = JSON.stringify(allSteps, null, 6);
      
      return `async (data) => {
    if (!data) {
      throw new Error('Data is required but not provided');
    }
    
    const taskSteps = ${stepsJson};
    
    // Join steps and replace variables with actual data values
    let taskContent = taskSteps.join('\\n');
    taskContent = taskContent.replace(/\\$\\{data\\.(\\w+)\\}/g, (match, fieldName) => {
      if (data && data.hasOwnProperty(fieldName)) {
        return data[fieldName];
      }
      console.warn(\`Warning: Variable \${match} not found in data object\`);
      return match;
    });
    
    return taskContent;
  }`;
    }

    // Otherwise, return the task string directly
    return JSON.stringify(allSteps.join('\n'));
  }

  /**
   * Create a task function from the @USER.PHASE block
   */
  private static createTaskFunction(phaseBlock: string, hasData: boolean): string {
    // Extract steps from the phase block (line by line, no STEP prefix needed)
    const steps = this.extractStepsFromPhase(phaseBlock);

    // If the task contains data variables, return a function
    if (hasData) {
      // Store steps as JSON array to avoid escaping issues
      const stepsJson = JSON.stringify(steps, null, 6);
      
      return `async (data) => {
    if (!data) {
      throw new Error('Data is required but not provided');
    }
    
    const taskSteps = ${stepsJson};
    
    // Join steps and replace variables with actual data values
    let taskContent = taskSteps.join('\\n');
    taskContent = taskContent.replace(/\\$\\{data\\.(\\w+)\\}/g, (match, fieldName) => {
      if (data && data.hasOwnProperty(fieldName)) {
        return data[fieldName];
      }
      console.warn(\`Warning: Variable \${match} not found in data object\`);
      return match;
    });
    
    return taskContent;
  }`;
    }

    // Otherwise, return the task string directly
    return steps.join('\n');
  }

  /**
   * Extract and clean up step instructions from phase block
   */
  private static extractStepsFromPhase(phaseBlock: string): string[] {
    const steps: string[] = [];
    const lines = phaseBlock.split('\n').map(line => line.trim()).filter(line => line);

    for (const line of lines) {
      // All non-empty lines are considered steps in the new format
      if (line) {
        steps.push(line);
      }
    }

    return steps;
  }

  /**
   * Substitute variables in task string with actual data values
   */
  private static substituteVariables(taskString: string, data: any): string {
    let result = taskString;
    
    // Replace ${data.fieldName} patterns
    const variableRegex = /\$\{data\.(\w+)\}/g;
    result = result.replace(variableRegex, (match, fieldName) => {
      if (Object.prototype.hasOwnProperty.call(data, fieldName)) {
        return data[fieldName];
      }
      warn(`Variable ${match} not found in data object`, { variable: match }, 'JiraConverter');
      return match; // Keep the original if not found
    });

    return result;
  }

  /**
   * Generate TypeScript test file content
   */
  static generateTestFileContent(testCase: TestCase & { tasks?: any; users?: string[] }): string {
    const imports = `import type { TestCase } from '../../framework/types/index.js';`;
    
    const testId = testCase.id.replace(/-/g, '_');
    
    // Build the test case object dynamically
    let testCaseString = `export const ${testId}: TestCase = {\n`;
    testCaseString += `  id: '${testCase.id}',\n`;
    testCaseString += `  name: '${testCase.name.replace(/'/g, "\\'")}',\n`;
    testCaseString += `  description: '${testCase.description.replace(/'/g, "\\'")}',\n`;
    testCaseString += `  priority: '${testCase.priority}',\n`;
    testCaseString += `  tags: ${JSON.stringify(testCase.tags)},\n`;
    
    // Add users array if present (for multi-user tests)
    if (testCase.users && testCase.users.length > 0) {
      testCaseString += `  users: ${JSON.stringify(testCase.users)},\n`;
    }
    
    // Add data if present
    if (testCase.data) {
      if (typeof testCase.data === 'string') {
        testCaseString += `  data: ${testCase.data},\n`;
      } else {
        testCaseString += `  data: ${JSON.stringify(testCase.data)},\n`;
      }
    }
    
    // Add task or tasks
    if (testCase.tasks) {
      if (typeof testCase.tasks === 'string') {
        testCaseString += `  tasks: ${testCase.tasks}\n`;
      } else {
        testCaseString += `  tasks: ${JSON.stringify(testCase.tasks)}\n`;
      }
    } else if (testCase.task) {
      if (typeof testCase.task === 'string' && testCase.task.includes('async')) {
        // This is a function string, don't wrap in quotes
        testCaseString += `  task: ${testCase.task}\n`;
      } else {
        // This is a simple string task, wrap in quotes
        testCaseString += `  task: '${String(testCase.task).replace(/'/g, "\\'")}'\n`;
      }
    }
    
    testCaseString += '};';

    return `${imports}\n\n${testCaseString}\n`;
  }


  /**
   * Validate JIRA ticket format
   */
  static validateTicketFormat(ticket: JiraTicket): string[] {
    const errors: string[] = [];

    if (!ticket.description) {
      errors.push('Ticket description is empty');
      return errors;
    }

    // Check for @STEPS section
    const hasSteps = /@STEPS/.test(ticket.description);
    if (!hasSteps) {
      errors.push('Missing @STEPS section in description');
    }

    // Check for @USER blocks within @STEPS (support role-based and legacy formats)
    const hasUserPhase = /@USER\d*(?:\.PHASE\d+)?/.test(ticket.description) || /@[A-Z][A-Z_]*(?:\.PHASE\d+)?/.test(ticket.description);
    if (!hasUserPhase) {
      errors.push('Missing @USER blocks in @STEPS section (e.g., @USER1, @USER.PHASE1, @USER1.PHASE1, @ADMIN.PHASE1, or @SELLER)');
    }

    // Validate @USERS section if present
    const hasUsersSection = /@USERS/.test(ticket.description);
    if (hasUsersSection) {
      const usersMatch = ticket.description.match(/@USERS\s*\[(.*?)\]/);
      if (!usersMatch) {
        errors.push('Malformed @USERS section - should be @USERS [@ADMIN, @SELLER, @USER]');
      } else {
        // Validate that declared users have corresponding phases in @STEPS
        const declaredUsers = this.extractUsersSection(ticket.description);
        if (declaredUsers && declaredUsers.length > 0) {
          for (const user of declaredUsers) {
            // Escape special regex characters in user names (like hyphens)
            const escapedUser = user.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const userPattern = new RegExp(`@${escapedUser}(?:\\.PHASE\\d+)?`, 'i');
            if (!userPattern.test(ticket.description)) {
              errors.push(`Declared user @${user.toUpperCase()} not found in @STEPS section`);
            }
          }
        }
      }
    }

    // Check @DATA format if present
    const hasData = /@DATA\(/.test(ticket.description);
    if (hasData) {
      const dataBlockMatch = ticket.description.match(/@DATA\('([^']+)'\)/);
      if (!dataBlockMatch) {
        errors.push('Malformed @DATA block - should be @DATA(\'prompt\')');
      }
    }

    return errors;
  }
}
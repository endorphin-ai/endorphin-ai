/**
 * Endorphin AI Claude Code Integration Initialization
 * Scaffolds Claude Code skills and configuration
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

/**
 * Resolve the claude-skills templates directory
 */
const getClaudeSkillsTemplatesDir = (): string => {
  const candidates: string[] = [];

  // CJS (Jest): __dirname is available
  if (typeof __dirname !== 'undefined') {
    candidates.push(path.resolve(__dirname, '../templates/claude-skills'));
  }

  // ESM: Get directory from import.meta.url
  // Use indirect eval to avoid parse-time SyntaxError in CJS/Jest environments
  try {
    // eslint-disable-next-line no-eval
    const metaUrl = eval('import.meta.url') as string;
    const currentFileUrl = new URL(metaUrl);
    const currentDir = path.dirname(currentFileUrl.pathname);
    candidates.push(path.resolve(currentDir, '../templates/claude-skills'));
  } catch {
    // Ignore if import.meta.url is not available (CJS/Jest)
  }

  // Installed package: node_modules/endorphin-ai/dist/framework/templates/claude-skills
  candidates.push(
    path.resolve(process.cwd(), 'node_modules/endorphin-ai/dist/framework/templates/claude-skills')
  );

  // Development: running from project root
  candidates.push(path.resolve(process.cwd(), 'framework/templates/claude-skills'));

  for (const candidate of candidates) {
    try {
      fsSync.accessSync(candidate);
      return candidate;
    } catch {
      // Continue
    }
  }

  return candidates[0];
};

/**
 * Initialize Claude Code integration
 */
export async function initClaudeSkill(targetDir: string = process.cwd()): Promise<void> {
  console.log('🎯 Initializing Claude Code integration...');

  try {
    // Create .claude directory if needed
    const claudeDir = path.join(targetDir, '.claude');
    await fs.mkdir(claudeDir, { recursive: true });
    console.log('📁 Created .claude/');

    // Create .claude/commands directory if needed
    const commandsDir = path.join(claudeDir, 'commands');
    await fs.mkdir(commandsDir, { recursive: true });
    console.log('📁 Created .claude/commands/');

    // Get path to skill templates
    const templatesDir = getClaudeSkillsTemplatesDir();
    console.log(`🔍 Looking for skill templates at: ${templatesDir}`);

    // Check if templates directory exists
    try {
      await fs.access(templatesDir);
      console.log(`✅ Found skill templates at: ${templatesDir}`);
    } catch {
      console.warn(`⚠️  Skill templates not found at: ${templatesDir}`);
      console.warn('⚠️  Skill templates could not be copied.');
      return;
    }

    // Copy skill files
    const skillFiles = ['write-test.md', 'fix-test.md', 'record-test.md'];
    for (const file of skillFiles) {
      const srcPath = path.join(templatesDir, file);
      const destPath = path.join(commandsDir, file);

      try {
        const content = await fs.readFile(srcPath, 'utf8');
        await fs.writeFile(destPath, content);
        console.log(`📄 Created .claude/commands/${file}`);
      } catch (error: any) {
        console.warn(`⚠️  Could not create ${file}: ${error.message}`);
      }
    }

    // Update or create .claude/CLAUDE.md
    const claudeMdPath = path.join(claudeDir, 'CLAUDE.md');
    const templateClaudeMdPath = path.join(templatesDir, 'CLAUDE.md');

    try {
      const templateContent = await fs.readFile(templateClaudeMdPath, 'utf8');

      // Check if CLAUDE.md already exists
      let existingContent = '';
      try {
        existingContent = await fs.readFile(claudeMdPath, 'utf8');
      } catch {
        // File doesn't exist, will create new
      }

      // Check if template content is already present (idempotency)
      if (existingContent.includes('# Endorphin AI — Test Recorder API')) {
        console.log('📝 .claude/CLAUDE.md already contains Endorphin AI documentation (skipping)');
      } else {
        // Append template content
        const separator = existingContent ? '\n\n---\n\n' : '';
        const newContent = existingContent + separator + templateContent;
        await fs.writeFile(claudeMdPath, newContent);

        if (existingContent) {
          console.log('📝 Updated .claude/CLAUDE.md');
        } else {
          console.log('📝 Created .claude/CLAUDE.md');
        }
      }
    } catch (error: any) {
      console.warn(`⚠️  Could not update CLAUDE.md: ${error.message}`);
    }

    // Success message
    console.log('');
    console.log('✅ Claude Code integration initialized!');
    console.log('');
    console.log('📁 Created:');
    console.log('  .claude/commands/write-test.md');
    console.log('  .claude/commands/fix-test.md');
    console.log('  .claude/commands/record-test.md');
    console.log('');
    console.log('📝 Updated:');
    console.log('  .claude/CLAUDE.md');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('  1. Open this project in Claude Code (claude.ai/code)');
    console.log('  2. Try: /write-test Create a login test');
    console.log('  3. Try: /fix-test HEALTH-001');
    console.log('  4. Read: .claude/CLAUDE.md for full documentation');
    console.log('');
    console.log('📚 Learn more: https://github.com/andrewnovykov/endorphin-ai/docs/claude-code-integration.md');
    console.log('');

  } catch (error: any) {
    console.error('❌ Failed to initialize Claude Code integration:', error.message);
    process.exit(1);
  }
}

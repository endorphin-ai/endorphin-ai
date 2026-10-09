# Endorphin AI Test Project

Welcome to your Endorphin AI test project!

## Quick Start

### 1. Configure AI Provider

Edit `.env` file and add your API key:

```bash
# OpenAI (default)
OPENAI_API_KEY=your_openai_api_key_here

# OR Google Gemini (cheaper, faster)
GOOGLE_API_KEY=your_google_api_key_here
```

Get your keys from:
- OpenAI: https://platform.openai.com/api-keys
- Google AI: https://aistudio.google.com/apikey

### 2. Run Example Test

```bash
npx endorphin-ai run test HEALTH-001
```

### 3. Generate Report

```bash
npx endorphin-ai generate report
npx endorphin-ai open report
```

### 4. Record Your Own Test

```bash
npx endorphin-ai run test-recorder
```

### 5. List All Tests

```bash
npx endorphin-ai list
```

## Claude Code Integration

### Initialize Claude Skills

```bash
npx endorphin-ai init-claude-skill
```

This creates `.claude/commands/` with three AI-powered skills:

| Skill | Description |
|-------|-------------|
| `/write-test` | Autonomously creates tests — analyzes page, generates steps, handles failures |
| `/fix-test` | Diagnoses and repairs failing tests — detects renamed elements, timing issues |
| `/record-test` | Launches the interactive test recorder |

### Usage in Claude Code

```bash
# Create a test autonomously
/write-test Create a login test at https://app.com with user@test.com / password123

# Fix a failing test
/fix-test HEALTH-001

# Start interactive recorder
/record-test
```

### Recorder CLI API (used by Claude skills)

```bash
# Create session (launches browser, navigates to URL)
npx endorphin-ai recorder create \
  --id TEST-001 --name "Login Test" --url https://app.com

# Add steps (browser persists between commands)
npx endorphin-ai recorder add-step \
  --session <sessionId> --step "Click the Login button"

# Generate test file
npx endorphin-ai recorder generate \
  --session <sessionId> --output-dir tests/

# Close browser when done
npx endorphin-ai recorder close-browser --session <sessionId>
```

All commands output JSON with `pageState` (URL, title, accessibility tree) so Claude can make autonomous decisions.

## Project Structure

```
├── .env                    # API keys and environment variables
├── endorphin.config.ts     # Framework configuration
├── global-setup.ts         # Global setup functions (optional)
├── .gitignore              # Git ignore patterns
├── tests/                  # Your test files (TypeScript)
│   ├── HEALTH-001.ts       # Health check test
│   ├── HEALTH-002.ts       # Secondary health test
│   ├── SAMPLE-001.ts       # Sample test template
│   ├── QUARANTINE-001.ts   # Example quarantined test
│   └── MULTI-USER-001.ts   # Multi-user test example
├── .claude/                # Claude Code integration (after init-claude-skill)
│   ├── commands/
│   │   ├── write-test.md   # /write-test skill
│   │   ├── fix-test.md     # /fix-test skill
│   │   └── record-test.md  # /record-test skill
│   └── CLAUDE.md           # Project context for Claude
├── test-results/           # Test execution results
└── test-recorder/          # Recorded test artifacts
```

## Common Commands

### Test Execution

```bash
# Run specific test
npx endorphin-ai run test HEALTH-001

# Run all tests
npx endorphin-ai run test all

# Run tests by tag
npx endorphin-ai run test --tag smoke
npx endorphin-ai run test --tag authentication

# Run tests by priority
npx endorphin-ai run test --priority High
```

### Test Management

```bash
# List all available tests
npx endorphin-ai list

# Start interactive test recorder
npx endorphin-ai run test-recorder

# Get help and see all commands
npx endorphin-ai --help
```

### Browser Options

```bash
# Run with visible browser (default)
npx endorphin-ai run test HEALTH-001 --no-headless

# Run in headless mode (faster)
npx endorphin-ai run test HEALTH-001 --headless

# Set custom viewport size
npx endorphin-ai run test HEALTH-001 --viewport 1920x1080
```

## Configuration

Your `endorphin.config.ts` file controls framework behavior:

```typescript
export default {
  browser: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    timeout: 30000,
  },

  results: {
    directory: './test-results',
    screenshots: true,
    recordVideo: false,
  },

  ai: {
    model: 'gpt-4o',        // or 'gemini-2.0-flash'
    maxRetries: 3,
    temperature: 0.1,
  },
};
```

### Multi-Provider AI Support

Endorphin auto-detects the provider from the model name:

| Model | Provider | API Key |
|-------|----------|---------|
| `gpt-4o` | OpenAI | `OPENAI_API_KEY` |
| `gpt-4o-mini` | OpenAI | `OPENAI_API_KEY` |
| `gemini-2.0-flash` | Google Gemini | `GOOGLE_API_KEY` |
| `gemini-1.5-pro` | Google Gemini | `GOOGLE_API_KEY` |

```typescript
// Use Gemini Flash (fast and cheap)
ai: {
  model: 'gemini-2.0-flash',
}
```

### Vision Verification

AI-powered screenshot verification catches visual issues that DOM checks miss (overlapping elements, CSS visibility, rendering bugs):

```typescript
export default {
  ai: {
    model: 'gpt-4o',
    vision: {
      enabled: true,
      model: 'gpt-4o',          // vision model (can differ from main model)
      mode: 'supplement',        // 'supplement' (augments DOM) or 'primary' (overrides DOM)
    },
  },
};
```

**Modes:**
- `supplement` — DOM check is primary, vision adds confirmation note (e.g., `[Vision: confirmed, 95%]`)
- `primary` — Vision result overrides DOM check (catches visually hidden elements)

**Example test with vision verification:**

```typescript
import type { TestCase } from 'endorphin-ai';

export const VISUAL_001: TestCase = {
  id: 'VISUAL-001',
  name: 'Login Form Visibility',
  description: 'Verify login form elements are truly visible to users',
  priority: 'High',
  tags: ['visual', 'login'],

  task: async () => {
    return `
      STEP 1: Navigate to https://app.com/login
      STEP 2: Verify the email input field is visible
      STEP 3: Verify the password input field is visible
      STEP 4: Verify the "Sign In" button is visible and enabled
    `;
  },
};
```

With vision enabled, each verify step automatically takes a screenshot with a red bounding box around the element, sends it to the vision model, and includes the result in the report.

## Writing Tests

Create test files in the `tests/` directory:

```typescript
// tests/LOGIN-001.ts
import type { TestCase } from 'endorphin-ai';

export const LOGIN_001: TestCase = {
  id: 'LOGIN-001',
  name: 'Login Flow',
  description: 'Test login functionality',
  priority: 'High',
  tags: ['login', 'smoke'],

  data: async () => ({
    email: 'test@example.com',
    password: 'password123',
  }),

  task: async (data) => {
    return `
      STEP 1: Navigate to https://example.com/login
      STEP 2: Enter "${data.email}" in the email field
      STEP 3: Enter "${data.password}" in the password field
      STEP 4: Click the "Sign In" button
      STEP 5: Verify login was successful by checking the dashboard is visible
    `;
  },
};
```

## Staying Updated

```bash
# Check your current version
npx endorphin-ai --version

# Update to the latest version
npm update endorphin-ai

# Or install specific version
npm install endorphin-ai@latest
```

## Troubleshooting

### API Key Issues

```bash
# Check if API key is set
cat .env

# Test with a simple health check
npx endorphin-ai run test HEALTH-001
```

### Test Discovery Issues

```bash
# List all discovered tests
npx endorphin-ai list

# Enable debug mode for detailed logs
ENDORPHIN_DEBUG=verbose npx endorphin-ai list
```

### Version Issues

```bash
# Clear npm cache and reinstall
npm cache clean --force
npm install endorphin-ai@latest

# Check Node.js version (requires 18+)
node --version
```

## Next Steps

1. **Run the sample test**: `npx endorphin-ai run test HEALTH-001`
2. **Set up Claude Code**: `npx endorphin-ai init-claude-skill`
3. **Record your first test**: `npx endorphin-ai run test-recorder`
4. **Write custom tests**: Add new files to `tests/` directory
5. **Enable vision**: Add `vision: { enabled: true }` to your config
6. **Set up CI/CD**: Add Endorphin tests to your pipeline

## Learn More

- **Main Documentation**: https://github.com/endorphin-ai/endorphin-ai/tree/develop/doc
- **Quick Start Guide**: https://github.com/endorphin-ai/endorphin-ai/blob/develop/doc/user-guide/Quick-Start-Guide.md
- **Test Recorder Guide**: https://github.com/endorphin-ai/endorphin-ai/blob/develop/doc/user-guide/Test-Recorder.md
- **Claude Code Integration**: https://github.com/endorphin-ai/endorphin-ai/blob/develop/doc/user-guide/Claude-Code-Integration.md
- **Vision Verification Guide**: https://github.com/endorphin-ai/endorphin-ai/blob/develop/doc/user-guide/Vision-Verification-Guide.md
- **Test Writing Tips**: https://github.com/endorphin-ai/endorphin-ai/blob/develop/doc/user-guide/Test-Writing-Tips.md
- **Multi-User Testing**: https://github.com/endorphin-ai/endorphin-ai/blob/develop/doc/user-guide/Multi-User-Testing-Guide.md
- **CI/CD Setup**: https://github.com/endorphin-ai/endorphin-ai/blob/develop/doc/user-guide/CI-CD-Setup-Guide.md
- **Changelog**: https://github.com/endorphin-ai/endorphin-ai/blob/develop/doc/Changelog.md
- **Roadmap**: https://github.com/endorphin-ai/endorphin-ai/blob/develop/doc/ROADMAP.md

## Need Help?

- **GitHub Issues**: https://github.com/endorphin-ai/endorphin-ai/issues
- **Documentation**: https://github.com/endorphin-ai/endorphin-ai/tree/develop/doc
- **Examples**: Check the `tests/` directory for sample tests

Happy Testing!

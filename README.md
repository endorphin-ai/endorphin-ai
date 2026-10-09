<div align="center">
  <img src="./doc/images/endorphin-ai-logo-no-bg.png" alt="Endorphin Logo" width="200" />
  
  # 💜 ENDORPHIN
  
  ## E2E Testing Reinvented with AI

Write tests in plain English. Let AI generate, validate, and fix them
automatically.

🌐 https://endorphinai.dev

</div>

📂 **The source code is open:** see the [`code/`](./code) folder.

🚀 **Endorphin V2 is coming in late November 2026.**

<div align="center">
  <img src="./doc/images/playwright-logo.png" alt="Playwright" height="30" />
  &nbsp;&nbsp;&nbsp;<strong>+</strong>&nbsp;&nbsp;&nbsp;
  <img src="./doc/images/langchain-logo.png" alt="LangChain" height="30" />
</div>

A powerful, modular browser automation framework using AI-powered testing with
LangChain, multi-provider AI (OpenAI GPT-4o, Google Gemini), and Playwright.
Provides intelligent browser automation with automatic element detection,
AI-powered visual validation, and comprehensive test management.

## 🎬 Watch Demo

<div align="center">
  <a href="https://youtu.be/X7fe1FI67gE?si=-rCvzNZKcHSGyEAR" target="_blank">
    <img src="https://img.shields.io/badge/🎬_WATCH_DEMO-FF0000?style=for-the-badge&logo=youtube&logoColor=white&labelColor=000000&scale=1.5" alt="Watch Demo" style="transform: scale(1.5); margin: 20px 0;" width="300" />
  </a>
  <br />
  <p style="font-size: 18px; font-weight: bold; margin: 15px 0;">🎯 See Endorphin AI in Action - Complete Walkthrough</p>
  <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
    ✨ Watch how AI writes and executes your tests<br />
    🔍 See intelligent element detection in real-time<br />
    📊 Explore beautiful HTML reports with screenshots<br />
    ⚡ From setup to test execution in 10 minutes
  </p>
  <p style="margin-top: 20px;">
    <a href="https://endorphinai.dev" style="color: #007bff; text-decoration: none; font-size: 18px; font-weight: bold;">
      🌐 Visit our website for more examples and tutorials
    </a>
  </p>
</div>

---

## 🌐 Read in Your Language

<div align="center">
  <a href="doc/languages/ua/README-UA.md">🇺🇦 Українська</a>
  <a href="doc/languages/de/README-DE.md">🇩🇪 Deutsch</a> • 
  <a href="doc/languages/fr/README-FR.md">🇫🇷 Français</a> • 
  <a href="doc/languages/es/README-ES.md">🇪🇸 Español</a> • 
  <a href="doc/languages/it/README-IT.md">🇮🇹 Italiano</a> • 
  <a href="doc/languages/pt/README-PT.md">🇵🇹 Português</a> • 
  <a href="doc/languages/ja/README-JA.md">🇯🇵 日本語</a> • 
  <a href="doc/languages/ko/README-KO.md">🇰🇷 한국어</a> • 
  <a href="doc/languages/zh/README-ZH.md">🇨🇳 中文</a> • 
  <a href="doc/languages/tr/README-TR.md">🇹🇷 Türkçe</a> • 
  <a href="doc/languages/nl/README-NL.md">🇳🇱 Nederlands</a> • 
  <a href="doc/languages/sv/README-SV.md">🇸🇪 Svenska</a> • 
  <a href="doc/languages/no/README-NO.md">🇳🇴 Norsk</a> • 
  <a href="doc/languages/da/README-DA.md">🇩🇰 Dansk</a> • 
  <a href="doc/languages/fi/README-FI.md">🇫🇮 Suomi</a> • 
  <a href="doc/languages/pl/README-PL.md">🇵🇱 Polski</a> • 
  <a href="doc/languages/ar/README-AR.md">🇸🇦 العربية</a> • 
  <a href="doc/languages/he/README-HE.md">🇮🇱 עברית</a> • 
  <a href="doc/languages/id/README-ID.md">🇮🇩 Indonesia</a> • 
  
</div>

---

## 🚀 Quick Start

### 📦 Installation & Setup

Get started in under 30 seconds:

```bash
# ⚡ Quick setup (recommended)
npx create-endorphin-ai@latest my-ai-tests
cd my-ai-tests
```

**Or manual setup:**

```bash
# 1. Create your project
mkdir my-ai-tests && cd my-ai-tests

# 2. Install Endorphin AI
npm install endorphin-ai@latest --save-dev

# 3. Initialize with everything you need
npx endorphin-ai init
```

**What you get:**

- ✅ Sample test ready to run
- ✅ Configuration files
- ✅ Project structure
- ✅ Environment setup

### 🔑 Add Your AI Provider API Key

```bash
# OpenAI (default)
echo "OPENAI_API_KEY=your-openai-api-key-here" > .env

# Or Google Gemini
echo "GOOGLE_API_KEY=your-gemini-api-key-here" > .env
```

_Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys) or [Google AI Studio](https://aistudio.google.com/apikey)_

### ▶️ Run Your First Test

```bash
# Run the sample health check test
npx endorphin-ai run test HEALTH-001

# Generate a beautiful HTML report
npx endorphin-ai generate report && npx endorphin-ai open report
```

**🎉 That's it!** You now have:

- A working AI-powered test
- Interactive HTML reports with screenshots
- Complete project structure for scaling

### 🎬 Demo Video

https://github.com/user-attachments/assets/166b27d5-5da8-4aab-baaa-6924435f07a9

### 📋 System Requirements

**Node.js Compatibility:**
- ✅ **Node.js 16.0.0+** (Minimum supported)
- ✅ **Node.js 18.x** (LTS - Recommended)
- ✅ **Node.js 20.x** (Current LTS)
- ✅ **Node.js 22.x** (Latest stable)
- ✅ **Node.js 22.18.0** (Explicitly tested on CI)

**Platforms:**
- ✅ Windows 10/11
- ✅ macOS 10.15+
- ✅ Linux (Ubuntu 18.04+)

**Test Node.js 22.18.0 compatibility:**
```bash
# Local testing script
./scripts/test-node-22.18.0.sh

# Or manual test
npm run test:node-22
```

📖 **[Full Node.js Compatibility Guide](./doc/NODEJS-COMPATIBILITY.md)**

### 🔧 Troubleshooting Installation

If `npx endorphin-ai` doesn't work, try these **guaranteed solutions**:

```bash
# Option 1: Use npm scripts (always works)
npm run endorphin:init                # Initialize project
npm run endorphin:version             # Check version
npm run endorphin:help                # Get help

# Option 2: Clear npx cache and retry
npx --clear-cache
npx endorphin-ai init

# Option 3: Use direct path
./node_modules/.bin/endorphin-ai init

# Option 4: Global installation
npm install -g endorphin-ai
endorphin-ai init
```

**Why this happens:** This is a known npm/npx issue with local binary
resolution, not a problem with Endorphin AI. The npm scripts above always work
regardless of npx behavior.

**Alternative npm scripts in package.json:**
```json
{
  "scripts": {
    "endorphin:init": "./node_modules/.bin/endorphin init",
    "endorphin:version": "./node_modules/.bin/endorphin --version",
    "endorphin:help": "./node_modules/.bin/endorphin --help"
  }
}
```

### Manual Setup (Alternative)

If you prefer manual setup:

1. Create your project directory:

   ```bash
   mkdir my-test-project && cd my-test-project
   ```

2. Initialize with ES modules:

   ```bash
   npm init -y
   npm pkg set type="module"
   ```

3. Install Endorphin AI:

   ```bash
   npm install endorphin-ai
   ```

4. Set up your `.env` file with your AI provider API key:

   ```env
   OPENAI_API_KEY=your_api_key_here
   # Or for Google Gemini:
   # GOOGLE_API_KEY=your_gemini_api_key_here
   ```

5. Create tests directory:

   ```bash
   mkdir tests
   ```

6. Create your first test file `tests/login-test.ts`:

   ```typescript
   import type { TestCase } from 'endorphin-ai';

   export const QE001: TestCase = {
     id: 'QE-001',
     name: 'Basic Login Test',
     description: 'Test the login functionality with valid credentials',
     priority: 'High',
     tags: ['authentication', 'login', 'smoke'],
     site: 'https://qafromla.herokuapp.com/',
     data: async () => {
       return {
         originalEmail: 'papapin888@gmail.com',
         originalPassword: 'lalalend',
       };
     },
     task: `Navigate to https://qafromla.herokuapp.com/. 
     Click on "Log In" button. Wait 2 seconds for page load. 
     Fill email field with "papapin888@gmail.com". 
     Fill password field with "lalalend". 
     Click "Sign In" button. Wait 3 seconds for page load. 
     Verify login was successful by checking page content.`,
   };
   ```

7. Add scripts to your `package.json`:
   ```json
   {
     "scripts": {
       "test": "endorphin-ai run test all",
       "test:smoke": "endorphin-ai run test --tag smoke",
       "test:auth": "endorphin-ai run test --tag authentication",
       "test:single": "endorphin-ai run test",
       "test:record": "endorphin-ai run test-recorder",
       "endorphin:init": "./node_modules/.bin/endorphin-ai init",
       "endorphin:version": "./node_modules/.bin/endorphin --version"
     }
   }
   ```

## 🎯 Core Features

### 🤖 AI-Powered Testing

- **Write tests in plain English** - No complex selectors needed
- **Intelligent element detection** - AI finds buttons, forms, and content
  automatically
- **Auto-inject page context** - Accessibility tree auto-injected before every
  AI decision for full page awareness
- **Self-healing tests** - Adapts to UI changes without breaking
- **Smart error recovery** - 3-tier retry strategy for reliable form input
- **Multi-provider AI** - OpenAI GPT-4o and Google Gemini support with
  auto-detection

### 👁️ Vision Verification

- **AI-powered screenshot verification** - Verify elements visually, not just
  in the DOM
- **Auto-highlight bounding box** - Red border drawn on verified elements
  before capture
- **Dual verification modes** - `supplement` (vision augments DOM) or `primary`
  (vision overrides DOM)
- **Validation Agent vision** - Screenshot confirmation of test results with
  confidence scoring

### 📊 Beautiful Reports

- **Interactive HTML reports** with screenshots and step-by-step execution
- **Cost & token tracking** - Monitor AI usage and optimize expenses (including
  vision API calls)
- **AI decision history** - See exactly how AI analyzes and executes tests
- **Real-time filtering and search** to quickly find issues
- **Visual debugging** with click-to-zoom screenshots
- **Export capabilities** for sharing with your team

### 🎬 Report Demo

https://github.com/user-attachments/assets/83a900c6-9279-496d-bc12-f16fb98cf6dc

### 🛠️ Developer Experience

- **Zero configuration** - Works out of the box
- **TypeScript support** with full type definitions
- **Smart test structure** - Dynamic setup, data generation, and task functions
- **26 built-in browser tools** - Navigate, click, fill, verify, hover, drag,
  scroll, file upload, tabs, network inspection, and more
- **Sequential tool execution** - Reliable sequential execution preventing
  race conditions
- **VS Code debugging** - Professional debugging with debug object access
- **Multiple browsers** - Chrome, Firefox, Safari support

### 🤖 Claude Code Integration

- **AI-assisted test creation** - `/write-test` slash command for autonomous
  test writing
- **AI-assisted test repair** - `/fix-test` reads failures and rewrites broken
  steps
- **Recorder CLI** - Programmatic `recorder create`, `add-step`, `generate`
  commands
- **Autonomous mode** - Claude reads the page accessibility tree and
  auto-generates test steps
- **One-command setup** - `npx endorphin-ai init-claude-skill` scaffolds
  everything

### 🎮 Interactive Tools

- **Test Recorder** - Create tests by clicking through your app or via CLI
- **Live debugging** - See exactly what the AI is doing
- **Custom test creation** with guided prompts
- **Session replay** to understand test failures

---

## 🔄 Staying Updated

### Current Version: v1.1.0

```bash
# Check your current version
npx endorphin-ai --version

# Update to the latest version
npm update endorphin-ai

# Get help and see new features
npx endorphin-ai --help
```

### What's New in v1.1.0

#### Intelligence
- ✅ **Auto-inject page context** - Accessibility tree auto-injected before
  every AI decision with `[CHANGED]`/`[NEW]` markers
- ✅ **Sequential tool execution** - Reliable sequential execution preventing
  race conditions
- ✅ **Fill tool reliability** - 3-tier retry strategy (focus+fill,
  pressSequentially, JS native value setter)
- ✅ **Gemini crash recovery** - Graceful handling of empty candidates from
  Gemini API
- ✅ **26 built-in tools** - Expanded from 14 to 26 browser automation tools

#### Vision
- ✅ **Vision verification** - AI-powered screenshot verification for all
  verify tools
- ✅ **Auto-highlight bounding box** - Red border on verified elements before
  screenshot capture
- ✅ **Validation Agent vision** - Test result validation with screenshot
  confirmation

#### Claude Code Integration
- ✅ **Recorder CLI** - Programmatic test recording via `recorder create`,
  `add-step`, `generate` commands
- ✅ **Claude Code skills** - `/write-test`, `/fix-test`, `/record-test` slash
  commands
- ✅ **Autonomous mode** - Claude reads the page and auto-generates test steps

#### Bug Fixes
- ✅ Bounding box screenshots render correctly with viewport-only capture
- ✅ Vision API calls appear in cost report with correct model name
- ✅ Navigation tools capture screenshots on error

## 🚀 Project Initialization

### New Projects (Recommended)

```bash
# Quick setup for new projects
mkdir my-test-project && cd my-test-project
npx endorphin-ai init
```

The `init` command creates:

- ✅ `tests/` directory with sample TypeScript test
- ✅ `test-results/` for test outputs
- ✅ `test-recorder/` for recorded tests
- ✅ `.env` file with API key placeholder
- ✅ `endorphin.config.ts` with optimized TypeScript settings

- ✅ `tsconfig.json` for TypeScript compilation
- ✅ `.gitignore` with Endorphin-specific patterns
- ✅ `README-ENDORPHIN.md` quick start guide

### Existing Projects

For existing Endorphin projects, the `init` command is optional and safe:

- ✅ Never overwrites existing configuration files
- ✅ Only creates missing directories
- ✅ Adds helpful template files if needed

```bash
# Safe to run in existing projects
npx endorphin-ai init
```

### Usage Commands

#### ℹ️ Version & Help

```bash
# Check current version
npx endorphin-ai --version

# Get help and see all commands
npx endorphin-ai --help

# Update to latest version
npm update endorphin-ai
```

#### 🎯 Initialize New Project

```bash
# Create a new Endorphin AI project with all necessary files
npx endorphin-ai init

# What gets created:
# ├── tests/sample-test.ts     # Ready-to-run TypeScript test
# ├── .env                     # API key configuration
# ├── endorphin.config.ts      # Framework settings (TypeScript)
# ├── tsconfig.json            # TypeScript configuration
# ├── .gitignore              # Endorphin-specific ignores
# └── README-ENDORPHIN.md     # Quick start guide
```

#### 🧪 Run Specific Test

```bash
# Using npm scripts (recommended)
npm run test:single QE-001

# Using npx
npx endorphin-ai run test QE-001

# Global installation
endorphin run test QE-001
```

#### 🏷️ Run Tests by Category

```bash
# Using npm scripts
npm run test:smoke
npm run test:auth

# Using npx/global
npx endorphin-ai run test --tag authentication
npx endorphin-ai run test --priority High
```

#### 🎯 Run All Tests

```bash
# Using npm scripts
npm test

# Using npx/global
npx endorphin-ai run test all
```

#### 🎬 Test Recorder Mode

```bash
# Using npm scripts
npm run test:record

# Using npx/global
npx endorphin-ai run test-recorder
```

#### 🤖 Claude Code Integration

```bash
# Initialize Claude Code skills (one-time setup)
npx endorphin-ai init-claude-skill

# Then use slash commands in Claude Code:
# /write-test   - AI writes a test from scratch
# /fix-test     - AI diagnoses and fixes a failing test
# /record-test  - AI records a test interactively
```

#### 🎮 Recorder CLI (Programmatic)

```bash
# Create a recording session
npx endorphin-ai recorder create --id TEST-001 --name "Login Test" --url https://example.com

# Add steps to the session
npx endorphin-ai recorder add-step --session <id> --step "Click the Login button"
npx endorphin-ai recorder add-step --session <id> --step "Fill email with test@example.com"

# Generate a test file from the recording
npx endorphin-ai recorder generate --session <id> --output-dir tests/

# List all sessions / check status
npx endorphin-ai recorder list
npx endorphin-ai recorder status --session <id>
```

## 📊 HTML Reports & Analytics

Endorphin AI generates beautiful, interactive HTML reports that provide
comprehensive insights into your test execution results.

### 🚀 Quick Report Generation

```bash
# Generate a full interactive HTML report
npx endorphin-ai generate report

# Generate a lightweight summary report
npx endorphin-ai generate report --summary

# Open the latest report in your browser
npx endorphin-ai open report

# Open a specific report file
npx endorphin-ai open report report-2025-06-22.html
```

### ✨ Report Features

#### 📈 **Interactive Dashboard**

- **Real-time Statistics**: Success rates, test counts, execution trends
- **Visual Progress Bars**: Easy-to-understand success rate indicators
- **Summary Cards**: Quick overview of test health

#### 🔍 **Advanced Search & Filtering**

- **Real-time Search**: Find tests by name or ID instantly
- **Status Filtering**: Filter by passed/failed tests with one click
- **Smart Results**: Shows "5 of 25 tests matching 'login' with status 'failed'"
- **Keyboard Shortcuts**: `Ctrl+F` to search, `Ctrl+3` for failed tests only

#### 🎯 **Detailed Test Analysis**

- **Step-by-Step Timeline**: See exactly what happened during test execution
- **Screenshot Galleries**: Visual debugging with click-to-zoom screenshots
- **Interactive Modals**: Deep dive into test execution details
- **Tool Call Tracking**: See which browser actions were performed

#### ⌨️ **Productivity Features**

- **Export to JSON**: Data-driven analysis and custom reporting
- **Print Support**: Documentation-ready printed reports
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Performance Optimized**: Fast loading even with large test suites

### 📖 Complete Guide

For detailed usage instructions, advanced features, and best practices, see the
**[HTML Reporter User Guide](./doc/user-guide/HTML-Reporter-Guide.md)**.

## 🏗️ Framework Architecture

Endorphin AI is built with a modular, extensible architecture designed for
reliability and maintainability.

### Key Components

- **Core Framework**: Test execution engine with dependency injection and
  session management
- **AI Agent**: LangGraph StateGraph with multi-provider support (OpenAI,
  Gemini) and auto-injected page context
- **Browser Tools**: 26 intelligent automation tools powered by AI
- **Vision System**: AI-powered screenshot verification with bounding box
  highlights
- **Configuration System**: Flexible, hierarchical configuration
  (CLI > config file > env vars > defaults)
- **Test Discovery**: Automatic test file detection and loading
- **Reporters**: Interactive HTML, console, and performance reporters with cost
  tracking

## ⚙️ Configuration

### Default Configuration

Endorphin AI works out of the box with sensible defaults, but you can customize
it by creating an `endorphin.config.ts` file in your project root:

```typescript
// endorphin.config.ts
import type { FrameworkConfig } from 'endorphin-ai';

const config: FrameworkConfig = {
  // AI model (auto-detects provider from name)
  model: 'gpt-4o',           // or 'gemini-1.5-pro'

  // Global test settings
  defaultTimeout: 30000,
  headless: false,
  viewport: { width: 1280, height: 720 },

  // Default test data
  testData: {
    baseUrl: 'https://staging.example.com',
    adminEmail: 'admin@example.com',
  },

  // Result settings
  screenshots: true,
  recordVideo: false,
};

export default config;
```

### CLI Options

You can override configuration with CLI flags:

```bash
# Using npm scripts with -- to pass flags
npm test -- --browser firefox
npm run test:single QE-001 -- --no-headless

# Using npx/global
npx endorphin-ai run test all --browser firefox
npx endorphin-ai run test QE-001 --no-headless
npx endorphin-ai run test all --viewport 1920x1080
npx endorphin-ai run test all
npx endorphin-ai run test all --model gpt-4o-mini
npx endorphin-ai run test all --env staging
```

## 📝 Test Categories

You can organize your tests using tags and priorities:

### Common Tags

- `authentication` - Login, logout, registration tests
- `smoke` - Critical path tests that must pass
- `navigation` - Menu, links, page routing tests
- `forms` - Form filling and validation tests
- `checkout` - E-commerce purchase flow tests
- `search` - Search functionality tests
- `responsive` - Mobile/tablet/desktop tests

### Priority Levels

- `High` - Critical functionality, run on every build
- `Medium` - Important features, run daily
- `Low` - Nice-to-have features, run weekly

### Example Test Organization

```typescript
// tests/auth-tests.ts
import type { TestCase } from 'endorphin-ai';

export const LOGIN_TEST: TestCase = {
  id: 'AUTH-001',
  name: 'User Login Test',
  description: 'Test user authentication flow',
  tags: ['authentication', 'smoke'],
  priority: 'High',
  site: 'https://example.com',
  task: 'Navigate to login page and authenticate user...',
};

export const LOGOUT_TEST: TestCase = {
  id: 'AUTH-002',
  name: 'User Logout Test',
  description: 'Test user logout functionality',
  tags: ['authentication'],
  priority: 'Medium',
  site: 'https://example.com',
  task: 'Log out the authenticated user...',
};
```

## 🔧 Smart Test Structure

Endorphin AI supports a powerful test structure with async functions for
dynamic test preparation.

### 🚀 Test Format

```typescript
import type { TestCase } from 'endorphin-ai';

export const SMART_TEST: TestCase = {
  id: 'LOGIN-001',
  name: 'User Login Test',
  description: 'Test login with generated credentials',
  priority: 'High',
  tags: ['auth', 'smoke'],

  // Generate test data dynamically
  data: async () => {
    const timestamp = Date.now();
    return {
      email: `testuser${timestamp}@example.com`,
      password: 'SecurePassword123!',
      firstName: 'Test',
      lastName: 'User',
    };
  },

  // Set up test environment
  setup: async () => {
    return {
      baseUrl: process.env.TEST_URL || 'https://example.com',
      startTime: new Date().toISOString(),
    };
  },

  // Main test instructions using generated data
  task: async (data, setupData) => {
    return `
      Navigate to ${setupData.baseUrl}/login
      Fill email with "${data.email}"
      Fill password with "${data.password}"
      Click Submit button
      Verify welcome message contains "${data.firstName}"
    `;
  },
};
```

### ✨ Key Benefits

- **Dynamic Data Generation** - Create unique test data for each run
- **Environment Setup** - Prepare test environment before execution
- **Type Safety** - Full TypeScript support for all functions
- **Backward Compatibility** - Old test format still works perfectly

## 📁 Project Structure

Your project should look like this:

```
my-test-project/
├── .env                    # OpenAI API key
├── tests/                  # Your test files (TypeScript)
│   ├── login-test.ts      # Authentication tests
│   ├── checkout-test.ts   # E-commerce tests
│   └── navigation-test.ts # UI/Navigation tests
├── endorphin.config.ts    # Optional configuration (TypeScript)
├── tsconfig.json          # TypeScript configuration
└── package.json           # Project config
```

## 📝 Test File Format

Each test file should export test objects with TypeScript types:

```typescript
import type { TestCase } from 'endorphin-ai';

export const QE001: TestCase = {
  id: 'QE-001', // Unique test identifier
  name: 'Basic Login Test', // Human readable name
  description: 'Test login functionality with valid credentials',
  priority: 'High', // High, Medium, Low
  tags: ['authentication', 'login', 'smoke'], // Categories
  site: 'https://example.com/', // Target website
  data: async () => {
    return {
      email: 'test@example.com',
      password: 'password123',
    };
  },
  task: `Your test instructions in plain English...`,
};

// Multiple tests per file with full type safety
export const QE002: TestCase = {
  id: 'QE-002',
  name: 'Registration Test',
  description: 'Test user registration flow',
  priority: 'Medium',
  tags: ['authentication', 'registration'],
  site: 'https://example.com/',
  task: 'Test new user registration process...',
};
```

### 🎯 TypeScript Benefits

- ✅ **Full type safety** for test configuration
- ✅ **IntelliSense support** in your IDE
- ✅ **Compile-time error checking**
- ✅ **Auto-completion** for test properties
- ✅ **Refactoring support** across your test suite

## 📊 Test Results

Each test execution creates:

- **📁 Session Directory**: `test-result/[test-id]_[timestamp]/`
- **📝 Session Data**: `test-session.json` with complete execution details
- **📊 Summary**: `summary.json` with test outcomes
- **📸 Screenshots**: Automatic visual documentation
- **🔄 Step Logs**: Detailed execution tracking

### Example Test Output

```
🎯 Running: QE-001 - Basic Login Test
📸 Screenshot taken: step-1-navigation.png
✅ Login successful - test completed!
📊 Result: PASSED
```

## 🎮 Interactive Features

### Custom Test Creation

```bash
# Using npm scripts
npm run test:record

# Using npx/global
npx endorphin-ai run test-recorder
```

Create tests on-the-fly with guided prompts:

- Custom navigation tasks
- Form filling scenarios
- Login test automation
- Content verification

---

## 🏆 Why Choose Endorphin AI?

### Traditional E2E Testing vs Endorphin AI

| Traditional Testing            | Endorphin AI                               |
| ------------------------------ | ------------------------------------------ |
| ❌ Brittle CSS selectors       | ✅ AI finds elements intelligently          |
| ❌ Breaks with UI changes      | ✅ Self-healing tests with page context     |
| ❌ Complex setup               | ✅ Zero configuration                      |
| ❌ Hard to maintain            | ✅ Plain English test descriptions          |
| ❌ Basic reporting             | ✅ Interactive HTML reports with cost tracking |
| ❌ Manual debugging            | ✅ Visual debugging with AI vision verification |
| ❌ Single AI provider lock-in  | ✅ Multi-provider (OpenAI + Gemini)         |
| ❌ Manual test writing         | ✅ Claude Code autonomous test generation  |

### 🚀 Production Ready

✅ **Enterprise Scale**: Used in production environments
✅ **Cross-Platform**: Windows, macOS, Linux support
✅ **CI/CD Integration**: GitHub Actions, Jenkins, CircleCI
✅ **Multi-Provider AI**: OpenAI GPT-4o and Google Gemini
✅ **26 Built-in Tools**: Comprehensive browser automation toolkit
✅ **Vision Verification**: AI-powered screenshot validation
✅ **Type Safe**: Full TypeScript support
✅ **Extensible**: Modular architecture with dependency injection

## 🔄 Staying Updated

### Check Your Version

```bash
# Check current installed version
npx endorphin-ai --version

# Check latest available version on npm
npm view endorphin-ai version

# Check for outdated packages
npm outdated endorphin-ai
```

### Update to Latest

```bash
# Update to the latest version
npm update endorphin-ai

# Or force install latest
npm install endorphin-ai@latest

# Verify the update
npx endorphin-ai --version
```

### Version History & Features

- **v1.1.0** _(Latest)_: Auto-inject page context, vision verification,
  26 browser tools, sequential execution, fill reliability, Claude Code
  integration, recorder CLI, autonomous mode, Gemini crash recovery
- **v1.0.2**: 12 new browser tools (hover, drag, scroll, tabs, file upload,
  etc.), multi-provider AI (OpenAI + Gemini)
- **v1.0.1**: AI agent fleet, CI/CD stabilization, validation agent
  improvements
- **v1.0.0**: Natural language testing via GPT-4o, 14 built-in tools,
  interactive recorder, HTML reports, JIRA integration, multi-user testing
- **v0.9.0**: Smart test structure, enhanced HTML reports with cost tracking
- **v0.8.0**: Custom tools support with CLI management
- **v0.6.x**: Enhanced CLI, cross-platform CI/CD
- **v0.5.0**: Advanced HTML reporting
- **v0.4.0**: TypeScript-first experience
- **v0.3.0**: `endorphin-ai init` command
- **v0.2.x**: Core framework
- **v0.1.x**: Initial release

### Compatibility & Migration

Endorphin AI maintains **backward compatibility** across versions:

- ✅ **All existing tests work** without modification
- ✅ **Configuration files** are automatically migrated
- ✅ **npm scripts** continue to function normally
- ✅ **Semantic versioning** ensures predictable updates

Update with confidence - your existing tests won't break!

---

## 🤝 Support & Community

### 📚 Documentation

- **[Quick Start Guide](./doc/user-guide/Quick-Start.md)** - Get up and running
  quickly
- **[Project Setup Guide](./doc/user-guide/Project-Setup-Guide.md)** - Complete
  project setup
- **[Test Structure Guide](./doc/user-guide/Test-Structure-Guide.md)** - Learn
  test structure with setup/data functions
- **[Test Writing Tips](./doc/user-guide/Test-Writing-Tips.md)** - Enterprise &
  small app examples
- **[Prompt Guide](./doc/user-guide/Prompt-Guide.md)** - Advanced AI prompting
  techniques
- **[HTML Reporter Guide](./doc/user-guide/HTML-Reporter-Guide.md)** -
  Interactive reporting with cost tracking
- **[Test Recorder Guide](./doc/user-guide/Test-Recorder.md)** - Recording test
  workflows interactively
- **[Claude Code Integration](./doc/user-guide/Claude-Code-Integration.md)** -
  AI-assisted test creation and repair
- **[Vision Verification Guide](./doc/user-guide/Vision-Verification-Guide.md)** -
  AI-powered screenshot verification
- **[Environment Variables Guide](./doc/user-guide/Environment-Variables-Guide.md)** -
  Configure your environment
- **[Multi-User Testing Guide](./doc/user-guide/Multi-User-Testing-Guide.md)** -
  Test with multiple browser sessions
- **[VS Code Debugging Guide](./doc/user-guide/VSCode-Debugging-Guide.md)** -
  Professional debugging setup
- **[CI/CD Setup Guide](./doc/user-guide/CI-CD-Setup-Guide.md)** - GitHub
  Actions integration
- **[JIRA Integration Guide](./doc/user-guide/JIRA-Integration-Guide.md)** -
  Sync tests with JIRA

### 🐛 Issues & Feature Requests

Found a bug or have a feature idea?
[Open an issue](https://github.com/endorphin-ai/endorphin-ai/issues) on GitHub.

### 💬 Getting Help

- Check the **[documentation](./doc/)** first
- Search
  **[existing issues](https://github.com/endorphin-ai/endorphin-ai/issues)**
- Create a
  **[new issue](https://github.com/endorphin-ai/endorphin-ai/issues/new)** with
  details

---

## 📄 License

Endorphin AI is licensed under the **GNU Affero General Public License v3.0**
(AGPLv3).

**For Open Source Projects**: Free to use under AGPLv3  
**For Commercial Projects**: Commercial licenses available

📧 Contact: [iam@andrewnovykov.com](mailto:iam@andrewnovykov.com) for licensing
questions

---

<div align="center">
  <p><strong>⚡ Happy Vibetesting!</strong></p>
  <p>
    <a href="#-installation--setup">Get Started Now</a> • 
    <a href="https://youtu.be/ev_71RBO6g8?si=F9xTPSJNp36Mr1wx">Watch Demo</a> • 
    <a href="./doc/">Documentation</a> • 
    <a href="https://endorphinai.dev">Website</a>
  </p>
</div>

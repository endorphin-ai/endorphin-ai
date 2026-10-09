# Package Tests - Endorphin AI

_Last Updated: June 27, 2025_

## 🎯 Overview

This directory contains package-level tests that verify Endorphin AI from a
**user's perspective** - testing the actual npm package installation, CLI
commands, and user workflow. These tests are different from framework unit tests
and simulate real user scenarios.

## 📊 Latest Test Results

**Session**: 20250627_220349  
**Status**: 7/10 tests passing (70% success rate)  
**Duration**: 89 seconds

### Test Summary:
- ✅ Environment Setup
- ✅ Init Command
- ✅ Install Playwright Browsers
- ✅ Test Recorder Functionality
- ✅ Test Recorder File Location
- ✅ Basic Test Execution
- ✅ CLI Commands
- ❌ Console Reporter
- ❌ HTML Reporter
- ❌ All Reporters

### Known Issues:
The reporter tests failed due to a corrupted `.env` file that contained a duplicate
API key on its own line, which bash interpreted as a command when the file was
sourced. This has been fixed in the main repository.

## ⚙️ Centralized Configuration

All test scripts use a centralized configuration system for consistent path
management and utilities:

- **Config File**: `config/test-config.sh`
- **Key Constants**:
  - `USER_PROJECT_DIR`: Path to `tmp/test-endorphin` (the simulated user
    project)
  - `RESULTS_DIR`: Path to `results/` directory
  - `SCRIPTS_DIR`: Path to `scripts/` directory
  - `REPO_ROOT`: Path to the main Endorphin AI repository
  - `PACKAGE_TEST_DIR`: Path to this package tests directory

- **Utility Functions**:
  - `cd_user_project()`: Changes to user project directory with validation
  - `ensure_user_project()`: Validates user project setup
  - `show_paths()`: Displays all important paths
  - `print_status()`: Consistent colored output

All test scripts source this configuration to ensure they run from the correct
directory context.

## 📁 Directory Structure

```
development-tests/package-tests/
├── README.md                           # This file
├── run-all-tests.sh                   # Main automation script
├── run-tests-by-category.sh           # Category-specific testing
├── view-results.sh                    # Results viewer utility
├── cleanup-results.sh                 # Results cleanup utility
├── demo-logging.sh                    # Quick demo of logging system
├── test-config-verification.sh        # Config verification script
├── config/                            # Centralized configuration
│   └── test-config.sh                  # Shared constants & utilities
├── scripts/                           # Test automation scripts
│   ├── setup/
│   │   └── setup-user-project.sh      # Creates test environment
│   ├── init/
│   │   └── test-init-command.sh        # Tests init command
│   ├── recorder/
│   │   ├── test-recorder.sh            # Tests test recorder
│   │   └── test-recorder-location.sh   # Verifies file locations
│   ├── runner/
│   │   ├── run-test.sh                 # Runs specific tests
│   │   └── quick-commands.sh           # Tests CLI commands
│   └── reporter/
│       ├── test-console-reporter.sh    # Tests console output
│       ├── test-html-reporter.sh       # Tests HTML reports
│       └── test-all-reporters.sh       # Tests all reporters
├── results/                           # Test session results & logs
│   ├── README.md                      # Results documentation
│   └── YYYYMMDD_HHMMSS/              # Timestamped session folders
├── tmp/                               # Test environment
│   └── test-endorphin/                # User project simulation
```

## 🚀 Quick Start

### Run All Package Tests

```bash
# From repository root
./development-tests/package-tests/run-all-tests.sh
```

### Run Tests by Category

```bash
# Setup only
./development-tests/package-tests/run-tests-by-category.sh setup

# Test specific functionality
./development-tests/package-tests/run-tests-by-category.sh recorder
./development-tests/package-tests/run-tests-by-category.sh runner
./development-tests/package-tests/run-tests-by-category.sh reporter

# Run all categories
./development-tests/package-tests/run-tests-by-category.sh all
```

### Manual Test Execution

```bash
# 1. Setup test environment
./development-tests/package-tests/scripts/setup/setup-user-project.sh

# 2. Navigate to test project
cd development-tests/package-tests/tmp/test-endorphin

# 3. Run individual tests (NOTE: Use endorphin-ai, not endorphin)
npx endorphin-ai list
npx endorphin-ai run test USER-001
npx endorphin-ai run test-recorder

# 4. Cleanup when done
cd ../../..
rm -rf development-tests/package-tests/tmp/test-endorphin
```

## 🔧 Dependencies & Path Management

### Critical Dependencies

All package tests depend on these key components:

#### 1. Test Environment Setup

- **Script**: `scripts/setup/setup-user-project.sh`
- **Purpose**: Creates isolated user project in `tmp/test-endorphin/`
- **Dependencies**:
  - Node.js and npm availability
  - Access to main repository for package installation
  - Write permissions for directory creation

#### 2. User Project Directory

- **Location**: `development-tests/package-tests/tmp/test-endorphin/`
- **Purpose**: Simulates real user project environment
- **Contents**:
  - Installed endorphin-ai package
  - User configuration files
  - Generated test files
  - Test execution results

#### 3. Path Resolution

- **Repository Root**: Auto-detected from script location
- **Package Tests Dir**: `development-tests/package-tests/`
- **User Project**: `development-tests/package-tests/tmp/test-endorphin/`
- **Results**: `development-tests/package-tests/results/`

### Path Dependencies

Most test scripts follow this pattern:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_TEST_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPO_ROOT="$(cd "$PACKAGE_TEST_DIR/../.." && pwd)"
USER_PROJECT_DIR="$PACKAGE_TEST_DIR/tmp/test-endorphin"
```

### Prerequisites Check

Before running tests, the system verifies:

- ✅ Node.js is installed and accessible
- ✅ npm is available for package management
- ✅ Repository structure is correct (package.json exists)
- ✅ Write permissions for test directory creation
- ✅ OpenAI API key (for AI-powered tests)

### Environment Isolation

Tests maintain strict isolation:

- 🔒 **User Project**: Clean environment for each test run
- 🔒 **Framework Protection**: No pollution of framework directories
- 🔒 **Dependency Isolation**: Local package installation from repository
- 🔒 **Configuration Isolation**: Separate config files for testing

## 🔧 Test Categories

### Setup Tests

- **Purpose**: Verify environment setup and configuration
- **Scripts**: `scripts/setup/setup-user-project.sh`
- **Verifies**:
  - User project creation
  - Package installation from local source
  - Configuration file generation
  - Environment variable handling

### Init Tests

- **Purpose**: Test project initialization commands
- **Scripts**: `scripts/init/test-init-command.sh`
- **Verifies**:
  - `endorphin init` command functionality
  - Template generation
  - Project structure creation

### Recorder Tests

- **Purpose**: Test the interactive test recorder
- **Scripts**:
  - `scripts/recorder/test-recorder.sh`
  - `scripts/recorder/test-recorder-location.sh`
- **Verifies**:
  - Test recorder launches correctly
  - Files created in USER project (not framework)
  - Generated test files are valid
  - Browser automation works

### Runner Tests

- **Purpose**: Test test execution functionality
- **Scripts**:
  - `scripts/runner/run-test.sh`
  - `scripts/runner/quick-commands.sh`
- **Verifies**:
  - Test discovery and listing
  - Individual test execution
  - Tag-based filtering
  - Priority-based filtering
  - CLI command functionality

### Reporter Tests

- **Purpose**: Test result reporting functionality
- **Scripts**:
  - `scripts/reporter/test-console-reporter.sh`
  - `scripts/reporter/test-html-reporter.sh`
  - `scripts/reporter/test-all-reporters.sh`
- **Verifies**:
  - Console output formatting
  - HTML report generation
  - Result file creation
  - Report accuracy

## 🎯 Critical Verifications

### 1. File Location Isolation

- ✅ Test recorder creates files in USER project only
- ✅ No framework directory pollution
- ✅ User project independence

### 2. Package Installation

- ✅ Local package installation works
- ✅ Dependencies resolve correctly
- ✅ CLI commands are accessible via npx

### 3. Configuration System

- ✅ Default config generation
- ✅ Environment variable handling
- ✅ Config validation

### 4. Test Execution

- ✅ Test discovery works
- ✅ Test execution completes
- ✅ Results are generated
- ✅ Error handling works

## 📊 Test Results & Logging

The test runner now includes comprehensive logging and reporting:

### Results Directory Structure

```
development-tests/package-tests/
├── results/                           # All test session results
│   ├── README.md                      # Results documentation
│   └── YYYYMMDD_HHMMSS/              # Timestamped session folder
│       ├── session_info.txt          # Session metadata & summary
│       ├── test_results.csv          # Machine-readable results
│       ├── test_report.html          # Interactive HTML report
│       ├── Environment_Setup.log     # Individual test logs
│       ├── Test_Recorder_Functionality.log
│       └── ... (one log per test)
└── view-results.sh                   # Results viewer utility
```

### Viewing Results

#### Quick Commands

```bash
# List all test sessions
./development-tests/package-tests/view-results.sh

# View latest session
./development-tests/package-tests/view-results.sh latest

# View specific session
./development-tests/package-tests/view-results.sh 20231215_143022

# Open HTML report in browser
./development-tests/package-tests/view-results.sh open

# Check results status and disk usage
./development-tests/package-tests/cleanup-results.sh

# Clean up old results (older than 7 days)
./development-tests/package-tests/cleanup-results.sh --days 7

# Keep only latest 5 sessions
./development-tests/package-tests/cleanup-results.sh --keep 5

# Preview cleanup without deleting
./development-tests/package-tests/cleanup-results.sh --dry-run
```

#### Results Viewer Features

- 📋 **Session List**: Overview of all test runs with pass/fail counts
- 📊 **Session Details**: Complete metadata and test breakdown
- 🌐 **HTML Reports**: Interactive browser-based reports with:
  - Visual dashboard with success metrics
  - Detailed test grid with status indicators
  - Direct links to individual test logs
  - Responsive design for mobile/desktop
- 📁 **Log Management**: Automatic cleanup and organization

### Enhanced Test Execution

The test runner now provides:

- ⏱️ **Timing**: Duration tracking for each test and overall session
- 📋 **Detailed Logs**: Complete output capture for each test
- 🚨 **Error Preview**: Immediate feedback with last few lines of failed tests
- 📈 **Progress Tracking**: Real-time status updates during execution
- 📄 **Multiple Formats**: Both human-readable and machine-parseable results

### Automated Logging

Each test execution automatically:

1. Creates timestamped session directory
2. Captures complete test output to individual log files
3. Records test metadata (start/end times, duration, result)
4. Generates CSV summary for automation/CI integration
5. Creates interactive HTML report for stakeholders
6. Provides immediate error feedback for failed tests

Test results are generated in the user project directory:

```
tmp/test-endorphin/
├── test-results/           # Test execution results
├── test-recorder/          # Recorded test sessions
├── tests/                  # User test files
└── .env                    # Environment configuration
```

## 🔄 Automation Scripts

### Main Scripts

#### `run-all-tests.sh`

Comprehensive automation that runs all package tests in sequence:

1. Environment setup
2. All test categories
3. Result verification
4. Cleanup

#### `run-tests-by-category.sh`

Targeted testing by specific functionality:

- `setup` - Environment and configuration
- `init` - Project initialization
- `recorder` - Test recording functionality
- `runner` - Test execution
- `reporter` - Result reporting
- `all` - All categories

### Individual Scripts

Each script in `scripts/` can be run independently for targeted testing.

## 🛠️ Development Usage

### Adding New Package Tests

1. Create script in appropriate `scripts/` subdirectory
2. Follow naming convention: `test-[functionality].sh`
3. Include verification and cleanup
4. Update category runner scripts

### Testing Before Release

```bash
# Full package verification
./development-tests/package-tests/run-all-tests.sh

# Verify specific functionality
./development-tests/package-tests/run-tests-by-category.sh recorder

# Manual verification
./development-tests/package-tests/scripts/setup/setup-user-project.sh
cd development-tests/package-tests/tmp/test-endorphin
npx endorphin list
```

## 📋 Prerequisites

- Node.js 16+ installed
- npm or yarn available
- OpenAI API key (for AI-powered tests)
- Bash shell (macOS/Linux)

## 🚨 Important Notes

1. **Clean Environment**: Each test run creates a fresh user project
2. **No Framework Pollution**: Verify tests don't create files in framework
   directory
3. **API Key Required**: Some tests require valid OpenAI API key
4. **Browser Dependencies**: Recorder tests need browser capabilities
5. **Cleanup**: Always cleanup test environment after completion

## 🔍 Troubleshooting

### Using the Logging System

With the enhanced logging system, debugging is much easier:

```bash
# 1. Run tests and capture logs
./development-tests/package-tests/run-all-tests.sh

# 2. View latest session results
./development-tests/package-tests/view-results.sh latest

# 3. Check specific test log
cat results/YYYYMMDD_HHMMSS/Environment_Setup.log

# 4. Open interactive HTML report
./development-tests/package-tests/view-results.sh open
```

### Common Issues

#### "Command not found: endorphin"

- **Log Location**: Check `Environment_Setup.log` for installation errors
- **Solution**: Use `npx endorphin-ai` instead of `npx endorphin`
- **Important**: The correct command is `endorphin-ai`, not `endorphin`
- **Alternative**: Use npm scripts defined in package.json

#### "OpenAI API key not configured"

- **Log Location**: Check individual test logs for configuration errors
- **Solution**: Check `.env` file in test project
- **Fix**: Copy API key from main repository

#### "Browser not found"

- **Log Location**: Check `Test_Recorder_*.log` files
- **Solution**: Install Playwright browsers: `npx playwright install`
- **Alternative**: Ensure headless mode is properly configured

#### Test files in wrong location

- **Log Location**: Check `Test_Recorder_File_Location.log`
- **Verification**: Verify current working directory
- **Fix**: Check test-recorder script output and path resolution

#### Path Resolution Issues

- **Symptoms**: Tests can't find scripts or directories
- **Debug**: Check session_info.txt for path information
- **Common Cause**: Running from wrong directory
- **Solution**: Always run from `development-tests/package-tests/`

#### ".env: command not found" Error

- **Symptoms**: Reporter tests fail with bash command errors
- **Cause**: Malformed .env file with duplicate API key on its own line
- **Solution**: Check .env file for duplicate lines without variable assignment
- **Fix**: Remove any standalone API key lines from .env file

### Debug Mode

```bash
# Run with debug output
ENDORPHIN_DEBUG=true ./development-tests/package-tests/run-all-tests.sh

# Verbose script execution
bash -x ./development-tests/package-tests/scripts/setup/setup-user-project.sh

# View detailed logs
./development-tests/package-tests/view-results.sh latest
```

### Log Analysis

Each test session provides multiple debugging resources:

#### Session Information (`session_info.txt`)

- Environment details (Node.js, npm versions)
- Path resolution details
- Test timing and summary
- Final success/failure counts

#### Individual Test Logs (`TestName.log`)

- Complete test output
- Start/end timestamps
- Full error messages and stack traces
- Script execution details

#### CSV Results (`test_results.csv`)

- Machine-readable format for automation
- Test timing data
- Pass/fail status
- Log file references

#### HTML Report (`test_report.html`)

- Visual dashboard with metrics
- Interactive test grid
- Direct links to detailed logs
- Mobile-friendly interface

## 📚 Related Documentation

- [Package Testing Scenarios Guide](../../doc/framework-development/Package-Testing-Scenarios.md)
- [Framework Tests README](../framework-tests/README.md)
- [User Setup Guide](../../doc/user-guide/User-Setup-Guide.md)

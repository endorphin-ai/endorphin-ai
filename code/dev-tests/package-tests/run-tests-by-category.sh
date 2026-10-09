#!/bin/bash

# Run Package Tests by Category - Endorphin AI
# This script allows running specific categories of package tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
USER_PROJECT_DIR="$SCRIPT_DIR/tmp/test-endorphin"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to run setup category
run_setup_tests() {
    print_status $YELLOW "📦 RUNNING SETUP TESTS"
    print_status $YELLOW "======================"
    
    if [ -f "$SCRIPT_DIR/scripts/setup/setup-user-project.sh" ]; then
        print_status $BLUE "🔧 Running: Environment Setup"
        if bash "$SCRIPT_DIR/scripts/setup/setup-user-project.sh"; then
            print_status $GREEN "✅ Setup tests passed"
            return 0
        else
            print_status $RED "❌ Setup tests failed"
            return 1
        fi
    else
        print_status $RED "❌ Setup script not found"
        return 1
    fi
}

# Function to run init category
run_init_tests() {
    print_status $YELLOW "🏗️  RUNNING INIT TESTS"
    print_status $YELLOW "====================="
    
    if [ -f "$SCRIPT_DIR/scripts/init/test-init-command.sh" ]; then
        print_status $BLUE "🔧 Running: Init Command Tests"
        if bash "$SCRIPT_DIR/scripts/init/test-init-command.sh"; then
            print_status $GREEN "✅ Init tests passed"
            return 0
        else
            print_status $RED "❌ Init tests failed"
            return 1
        fi
    else
        print_status $YELLOW "⚠️ Init script not found - skipping"
        return 0
    fi
}

# Function to run recorder category
run_recorder_tests() {
    print_status $YELLOW "🎬 RUNNING RECORDER TESTS"
    print_status $YELLOW "========================="
    
    local failed=0
    
    # Test basic recorder functionality
    if [ -f "$SCRIPT_DIR/scripts/recorder/test-recorder.sh" ]; then
        print_status $BLUE "🔧 Running: Test Recorder Functionality"
        if ! bash "$SCRIPT_DIR/scripts/recorder/test-recorder.sh"; then
            print_status $RED "❌ Test recorder functionality failed"
            failed=1
        fi
    else
        print_status $RED "❌ Test recorder script not found"
        failed=1
    fi
    
    # Test recorder file location
    if [ -f "$SCRIPT_DIR/scripts/recorder/test-recorder-location.sh" ]; then
        print_status $BLUE "🔧 Running: Test Recorder File Location"
        if ! bash "$SCRIPT_DIR/scripts/recorder/test-recorder-location.sh"; then
            print_status $RED "❌ Test recorder location test failed"
            failed=1
        fi
    else
        print_status $RED "❌ Test recorder location script not found"
        failed=1
    fi
    
    if [ $failed -eq 0 ]; then
        print_status $GREEN "✅ All recorder tests passed"
        return 0
    else
        print_status $RED "❌ Some recorder tests failed"
        return 1
    fi
}

# Function to run runner category
run_runner_tests() {
    print_status $YELLOW "🏃 RUNNING RUNNER TESTS"
    print_status $YELLOW "======================"
    
    local failed=0
    
    # Test basic test execution
    if [ -f "$SCRIPT_DIR/scripts/runner/run-test.sh" ]; then
        print_status $BLUE "🔧 Running: Basic Test Execution"
        if ! bash "$SCRIPT_DIR/scripts/runner/run-test.sh"; then
            print_status $RED "❌ Basic test execution failed"
            failed=1
        fi
    else
        print_status $RED "❌ Run test script not found"
        failed=1
    fi
    
    # Test CLI commands
    if [ -f "$SCRIPT_DIR/scripts/runner/quick-commands.sh" ]; then
        print_status $BLUE "🔧 Running: CLI Commands Test"
        if ! bash "$SCRIPT_DIR/scripts/runner/quick-commands.sh"; then
            print_status $RED "❌ CLI commands test failed"
            failed=1
        fi
    else
        print_status $RED "❌ CLI commands script not found"
        failed=1
    fi
    
    if [ $failed -eq 0 ]; then
        print_status $GREEN "✅ All runner tests passed"
        return 0
    else
        print_status $RED "❌ Some runner tests failed"
        return 1
    fi
}

# Function to run reporter category
run_reporter_tests() {
    print_status $YELLOW "📊 RUNNING REPORTER TESTS"
    print_status $YELLOW "========================="
    
    local failed=0
    
    # Test console reporter
    if [ -f "$SCRIPT_DIR/scripts/reporter/test-console-reporter.sh" ]; then
        print_status $BLUE "🔧 Running: Console Reporter"
        if ! bash "$SCRIPT_DIR/scripts/reporter/test-console-reporter.sh"; then
            print_status $RED "❌ Console reporter test failed"
            failed=1
        fi
    else
        print_status $YELLOW "⚠️ Console reporter script not found - skipping"
    fi
    
    # Test HTML reporter
    if [ -f "$SCRIPT_DIR/scripts/reporter/test-html-reporter.sh" ]; then
        print_status $BLUE "🔧 Running: HTML Reporter"
        if ! bash "$SCRIPT_DIR/scripts/reporter/test-html-reporter.sh"; then
            print_status $RED "❌ HTML reporter test failed"
            failed=1
        fi
    else
        print_status $YELLOW "⚠️ HTML reporter script not found - skipping"
    fi
    
    # Test all reporters
    if [ -f "$SCRIPT_DIR/scripts/reporter/test-all-reporters.sh" ]; then
        print_status $BLUE "🔧 Running: All Reporters"
        if ! bash "$SCRIPT_DIR/scripts/reporter/test-all-reporters.sh"; then
            print_status $RED "❌ All reporters test failed"
            failed=1
        fi
    else
        print_status $YELLOW "⚠️ All reporters script not found - skipping"
    fi
    
    if [ $failed -eq 0 ]; then
        print_status $GREEN "✅ All reporter tests passed"
        return 0
    else
        print_status $RED "❌ Some reporter tests failed"
        return 1
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 <category> [options]"
    echo ""
    echo "Categories:"
    echo "  setup      Run setup and environment tests"
    echo "  init       Run project initialization tests"
    echo "  recorder   Run test recorder tests"
    echo "  runner     Run test execution and CLI tests"
    echo "  reporter   Run result reporting tests"
    echo "  all        Run all categories in sequence"
    echo ""
    echo "Options:"
    echo "  --verbose, -v    Enable verbose output"
    echo "  --help, -h       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup                    # Run only setup tests"
    echo "  $0 recorder --verbose       # Run recorder tests with verbose output"
    echo "  $0 all                      # Run all test categories"
}

# Function to ensure setup before other tests
ensure_setup() {
    if [ ! -d "$USER_PROJECT_DIR" ]; then
        print_status $YELLOW "⚠️ User project not found, running setup first..."
        if ! run_setup_tests; then
            print_status $RED "❌ Setup failed, cannot continue"
            exit 1
        fi
    fi
}

# Main execution
main() {
    local category="$1"
    local exit_code=0
    
    print_status $BLUE "🚀 Running Endorphin AI Package Tests by Category"
    print_status $BLUE "================================================="
    echo "Category: $category"
    echo "Repository: $REPO_ROOT"
    echo "Test Environment: $USER_PROJECT_DIR"
    echo "Date: $(date)"
    echo ""
    
    case "$category" in
        setup)
            run_setup_tests || exit_code=1
            ;;
        init)
            ensure_setup
            run_init_tests || exit_code=1
            ;;
        recorder)
            ensure_setup
            run_recorder_tests || exit_code=1
            ;;
        runner)
            ensure_setup
            run_runner_tests || exit_code=1
            ;;
        reporter)
            ensure_setup
            run_reporter_tests || exit_code=1
            ;;
        all)
            run_setup_tests || exit_code=1
            run_init_tests || exit_code=1
            run_recorder_tests || exit_code=1
            run_runner_tests || exit_code=1
            run_reporter_tests || exit_code=1
            ;;
        *)
            print_status $RED "❌ Unknown category: $category"
            echo ""
            show_usage
            exit 1
            ;;
    esac
    
    echo ""
    if [ $exit_code -eq 0 ]; then
        print_status $GREEN "🎉 Category '$category' tests completed successfully!"
    else
        print_status $RED "❌ Category '$category' tests failed!"
    fi
    
    exit $exit_code
}

# Parse arguments
if [ $# -eq 0 ]; then
    print_status $RED "❌ No category specified"
    echo ""
    show_usage
    exit 1
fi

# Handle options
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_usage
            exit 0
            ;;
        --verbose|-v)
            set -x
            shift
            ;;
        setup|init|recorder|runner|reporter|all)
            main "$1"
            exit $?
            ;;
        *)
            print_status $RED "❌ Unknown option: $1"
            echo ""
            show_usage
            exit 1
            ;;
    esac
done

#!/bin/bash

# Run All Package Tests - Endorphin AI
# This script runs comprehensive package-level tests from a user's perspective

set -e

# Load centralized configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config/test-config.sh"

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
FAILED_TEST_NAMES=()
SESSION_START_TIME=$(date +%s)

# Function to run a test and track results
run_test() {
    local test_name="$1"
    local test_script="$2"
    local description="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Create safe filename for logs
    local safe_name=$(echo "$test_name" | sed 's/[^a-zA-Z0-9]/_/g')
    local log_file="$SESSION_DIR/${safe_name}.log"
    local start_time=$(date +%s)
    
    print_status $BLUE "\\n🧪 Running: $test_name"
    print_status $BLUE "📝 Description: $description"
    print_status $BLUE "🔧 Script: $test_script"
    print_status $BLUE "📁 Log: $log_file"
    echo "----------------------------------------"
    
    # Create log file with test metadata
    {
        echo "===========================================" 
        echo "Test: $test_name"
        echo "Description: $description"
        echo "Script: $test_script"
        echo "Start Time: $(date)"
        echo "==========================================="
        echo ""
    } > "$log_file"
    
    # Run test and capture all output
    if bash "$test_script" >> "$log_file" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        echo "" >> "$log_file"
        echo "==========================================="  >> "$log_file"
        echo "Test Result: PASSED" >> "$log_file"
        echo "End Time: $(date)" >> "$log_file"
        echo "Duration: ${duration}s" >> "$log_file"
        echo "==========================================="  >> "$log_file"
        
        print_status $GREEN "✅ PASSED: $test_name (${duration}s)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        
        # Log to summary
        echo "PASS,$test_name,$duration,$log_file" >> "$SESSION_DIR/test_results.csv"
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        echo "" >> "$log_file"
        echo "==========================================="  >> "$log_file"
        echo "Test Result: FAILED" >> "$log_file"
        echo "End Time: $(date)" >> "$log_file"
        echo "Duration: ${duration}s" >> "$log_file"
        echo "==========================================="  >> "$log_file"
        
        print_status $RED "❌ FAILED: $test_name (${duration}s)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_TEST_NAMES+=("$test_name")
        
        # Log to summary
        echo "FAIL,$test_name,$duration,$log_file" >> "$SESSION_DIR/test_results.csv"
        
        # Show last few lines of error for immediate feedback
        print_status $YELLOW "🔍 Last few lines from log:"
        tail -10 "$log_file" | sed 's/^/    /'
    fi
    
    echo "========================================"
}

# Function to check prerequisites
check_prerequisites() {
    print_status $BLUE "🔍 Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_status $RED "❌ Node.js is not installed"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_status $RED "❌ npm is not installed"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [ ! -f "$REPO_ROOT/package.json" ]; then
        print_status $RED "❌ Not in Endorphin AI repository root"
        exit 1
    fi
    
    print_status $GREEN "✅ Prerequisites check passed"
}

# Function to setup results directory
setup_results_directory() {
    print_status $BLUE "📁 Setting up results directory..."
    
    # Create main results directory if it doesn't exist
    mkdir -p "$RESULTS_DIR"
    
    # Create session directory
    mkdir -p "$SESSION_DIR"
    
    # Create CSV header for test results
    echo "Result,Test_Name,Duration_Seconds,Log_File" > "$SESSION_DIR/test_results.csv"
    
    # Create session metadata
    {
        echo "Endorphin AI Package Test Session"
        echo "=================================="
        echo "Session ID: $TEST_SESSION"
        echo "Start Time: $(date)"
        echo "Repository: $REPO_ROOT"
        echo "Test Environment: $USER_PROJECT_DIR"
        echo "Node Version: $(node --version 2>/dev/null || echo 'Not available')"
        echo "NPM Version: $(npm --version 2>/dev/null || echo 'Not available')"
        echo "OS: $(uname -s 2>/dev/null || echo 'Unknown')"
        echo "=================================="
        echo ""
    } > "$SESSION_DIR/session_info.txt"
    
    print_status $GREEN "✅ Results directory created: $SESSION_DIR"
}

# Function to cleanup previous test environment
cleanup_previous() {
    print_status $BLUE "🧹 Cleaning up previous test environment..."
    
    if [ -d "$USER_PROJECT_DIR" ]; then
        rm -rf "$USER_PROJECT_DIR"
        print_status $GREEN "✅ Previous test environment cleaned"
    else
        print_status $YELLOW "ℹ️ No previous test environment found"
    fi
}

# Function to print final summary
print_summary() {
    local end_session_time=$(date)
    local total_duration=$(($(date +%s) - SESSION_START_TIME))
    
    echo ""
    echo "========================================"
    print_status $BLUE "📊 PACKAGE TESTS SUMMARY"
    echo "========================================"
    echo "Total Tests Run: $TOTAL_TESTS"
    print_status $GREEN "Passed: $PASSED_TESTS"
    print_status $RED "Failed: $FAILED_TESTS"
    echo "Total Duration: ${total_duration}s"
    
    if [ $FAILED_TESTS -gt 0 ]; then
        echo ""
        print_status $RED "❌ Failed Tests:"
        for test_name in "${FAILED_TEST_NAMES[@]}"; do
            echo "  - $test_name"
        done
    fi
    
    echo ""
    echo "Session ID: $TEST_SESSION"
    echo "Results Directory: $SESSION_DIR"
    echo "Test Environment: $USER_PROJECT_DIR"
    echo "Repository Root: $REPO_ROOT"
    
    # Update session info with final results
    {
        echo ""
        echo "Final Results:"
        echo "=============="
        echo "End Time: $end_session_time"
        echo "Total Duration: ${total_duration}s"
        echo "Total Tests: $TOTAL_TESTS"
        echo "Passed: $PASSED_TESTS"
        echo "Failed: $FAILED_TESTS"
        echo "Success Rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
    } >> "$SESSION_DIR/session_info.txt"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        print_status $GREEN "🎉 ALL PACKAGE TESTS PASSED!"
        echo ""
        echo "✅ Package is ready for user consumption"
        echo "✅ All CLI commands work correctly"
        echo "✅ File isolation is maintained"
        echo "✅ User workflow is functional"
    else
        print_status $RED "❌ SOME TESTS FAILED"
        echo ""
        echo "🔧 Please fix failing tests before releasing package"
        echo "📚 Check individual test logs in: $SESSION_DIR"
    fi
    
    echo "========================================"
    
    # Generate HTML report
    generate_html_report
}

# Function to generate HTML report
generate_html_report() {
    local html_file="$SESSION_DIR/test_report.html"
    
    print_status $BLUE "📄 Generating HTML report: $html_file"
    
    cat > "$html_file" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Endorphin AI Package Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 1.1em;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #fafafa;
        }
        .metric {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 6px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .metric-value {
            font-size: 2.5em;
            font-weight: bold;
            margin: 0;
        }
        .metric-label {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 5px 0 0 0;
        }
        .passed { color: #4CAF50; }
        .failed { color: #f44336; }
        .total { color: #2196F3; }
        .duration { color: #FF9800; }
        .tests-section {
            padding: 30px;
        }
        .section-title {
            font-size: 1.5em;
            margin: 0 0 20px 0;
            color: #333;
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
        }
        .test-grid {
            display: grid;
            gap: 15px;
        }
        .test-item {
            display: grid;
            grid-template-columns: auto 1fr auto auto;
            align-items: center;
            padding: 15px;
            background: #f9f9f9;
            border-radius: 6px;
            border-left: 4px solid #ddd;
        }
        .test-item.passed {
            border-left-color: #4CAF50;
            background: #f8fff8;
        }
        .test-item.failed {
            border-left-color: #f44336;
            background: #fff8f8;
        }
        .test-status {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            margin-right: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 12px;
        }
        .test-status.passed { background: #4CAF50; }
        .test-status.failed { background: #f44336; }
        .test-name {
            font-weight: 600;
            color: #333;
        }
        .test-duration {
            color: #666;
            font-size: 0.9em;
        }
        .test-log {
            color: #2196F3;
            text-decoration: none;
            font-size: 0.9em;
        }
        .test-log:hover {
            text-decoration: underline;
        }
        .footer {
            padding: 30px;
            background: #f5f5f5;
            text-align: center;
            color: #666;
            font-size: 0.9em;
        }
        .session-info {
            background: #f0f0f0;
            padding: 20px;
            margin: 20px 0;
            border-radius: 6px;
            font-family: monospace;
            font-size: 0.9em;
            white-space: pre-line;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Package Test Report</h1>
            <p>Endorphin AI - User Experience Testing</p>
        </div>
EOF

    # Add session info and metrics
    echo "        <div class=\"summary\">" >> "$html_file"
    echo "            <div class=\"metric\"><div class=\"metric-value total\">$TOTAL_TESTS</div><div class=\"metric-label\">Total Tests</div></div>" >> "$html_file"
    echo "            <div class=\"metric\"><div class=\"metric-value passed\">$PASSED_TESTS</div><div class=\"metric-label\">Passed</div></div>" >> "$html_file"
    echo "            <div class=\"metric\"><div class=\"metric-value failed\">$FAILED_TESTS</div><div class=\"metric-label\">Failed</div></div>" >> "$html_file"
    
    local success_rate=0
    if [ $TOTAL_TESTS -gt 0 ]; then
        success_rate=$(( PASSED_TESTS * 100 / TOTAL_TESTS ))
    fi
    echo "            <div class=\"metric\"><div class=\"metric-value duration\">${success_rate}%</div><div class=\"metric-label\">Success Rate</div></div>" >> "$html_file"
    echo "        </div>" >> "$html_file"
    
    # Add session info
    echo "        <div class=\"tests-section\">" >> "$html_file"
    echo "            <h2 class=\"section-title\">📋 Session Information</h2>" >> "$html_file"
    echo "            <div class=\"session-info\">$(cat "$SESSION_DIR/session_info.txt")</div>" >> "$html_file"
    echo "        </div>" >> "$html_file"
    
    # Add test results
    echo "        <div class=\"tests-section\">" >> "$html_file"
    echo "            <h2 class=\"section-title\">🧪 Test Results</h2>" >> "$html_file"
    echo "            <div class=\"test-grid\">" >> "$html_file"
    
    # Read CSV and generate test items
    if [ -f "$SESSION_DIR/test_results.csv" ]; then
        tail -n +2 "$SESSION_DIR/test_results.csv" | while IFS=',' read -r result test_name duration log_file; do
            local status_class="passed"
            local status_icon="✓"
            if [ "$result" = "FAIL" ]; then
                status_class="failed"
                status_icon="✗"
            fi
            
            local log_basename=$(basename "$log_file")
            
            echo "                <div class=\"test-item $status_class\">" >> "$html_file"
            echo "                    <div class=\"test-status $status_class\">$status_icon</div>" >> "$html_file"
            echo "                    <div class=\"test-name\">$test_name</div>" >> "$html_file"
            echo "                    <div class=\"test-duration\">${duration}s</div>" >> "$html_file"
            echo "                    <a href=\"$log_basename\" class=\"test-log\">View Log</a>" >> "$html_file"
            echo "                </div>" >> "$html_file"
        done
    fi
    
    # Close HTML
    cat >> "$html_file" << 'EOF'
            </div>
        </div>
        
        <div class="footer">
            <p>Generated by Endorphin AI Package Test Runner</p>
            <p>For more information, visit the test logs or check the repository documentation</p>
        </div>
    </div>
</body>
</html>
EOF

    print_status $GREEN "✅ HTML report generated: $html_file"
}

# Main execution
main() {
    print_status $BLUE "🚀 Starting Endorphin AI Package Tests"
    print_status $BLUE "======================================"
    show_paths
    echo "Session ID: $TEST_SESSION"
    echo "Date: $(date)"
    echo ""
    
    # Prerequisites check
    check_prerequisites
    
    # Setup results directory
    setup_results_directory
    
    # Cleanup previous environment
    cleanup_previous
    
    # Test Category 1: Setup
    print_status $YELLOW "\\n📦 CATEGORY 1: SETUP TESTS"
    print_status $YELLOW "============================"
    
    run_test "Environment Setup" \
        "$PACKAGE_TEST_DIR/scripts/setup/setup-user-project.sh" \
        "Create user project environment and install package"
    
    # Test Category 2: Init (if script exists)
    if [ -f "$PACKAGE_TEST_DIR/scripts/init/test-init-command.sh" ]; then
        print_status $YELLOW "\n🏗️  CATEGORY 2: INIT TESTS"
        print_status $YELLOW "=========================="
        
        run_test "Init Command" \
            "$PACKAGE_TEST_DIR/scripts/init/test-init-command.sh" \
            "Test project initialization commands"
    fi
    
    # Test Category 3: Recorder
    print_status $YELLOW "\n🎬 CATEGORY 3: RECORDER TESTS"
    print_status $YELLOW "============================="
    
    # Install Playwright browsers before running recorder tests
    run_test "Install Playwright Browsers" \
        "$PACKAGE_TEST_DIR/scripts/setup/install-playwright.sh" \
        "Install Playwright browsers required for test recorder"
    
    run_test "Test Recorder Functionality" \
        "$PACKAGE_TEST_DIR/scripts/recorder/test-recorder.sh" \
        "Test interactive test recorder and file generation"
    
    run_test "Test Recorder File Location" \
        "$PACKAGE_TEST_DIR/scripts/recorder/test-recorder-location.sh" \
        "Verify recorder creates files in user project only"
    
    # Test Category 4: Runner
    print_status $YELLOW "\n🏃 CATEGORY 4: RUNNER TESTS"
    print_status $YELLOW "==========================="
    
    run_test "Basic Test Execution" \
        "$PACKAGE_TEST_DIR/scripts/runner/run-test.sh" \
        "Run user tests and verify execution"
    
    run_test "CLI Commands" \
        "$PACKAGE_TEST_DIR/scripts/runner/quick-commands.sh" \
        "Test all CLI command functionality"
    
    # Test Category 5: Reporter
    print_status $YELLOW "\n📊 CATEGORY 5: REPORTER TESTS"
    print_status $YELLOW "=============================="
    
    run_test "Console Reporter" \
        "$PACKAGE_TEST_DIR/scripts/reporter/test-console-reporter.sh" \
        "Test console output and formatting"
    
    run_test "HTML Reporter" \
        "$PACKAGE_TEST_DIR/scripts/reporter/test-html-reporter.sh" \
        "Test HTML report generation"
    
    run_test "All Reporters" \
        "$PACKAGE_TEST_DIR/scripts/reporter/test-all-reporters.sh" \
        "Test all reporting formats"
    
    # Print final summary
    print_summary
    
    # Exit with appropriate code
    if [ $FAILED_TESTS -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --verbose, -v  Enable verbose output"
        echo "  --clean, -c    Clean environment only (no tests)"
        echo ""
        echo "This script runs comprehensive package-level tests for Endorphin AI."
        echo "It simulates a user installing and using the package."
        echo ""
        echo "Test categories:"
        echo "  1. Setup - Environment and package installation"
        echo "  2. Init - Project initialization commands"
        echo "  3. Recorder - Interactive test recording"
        echo "  4. Runner - Test execution and CLI commands"
        echo "  5. Reporter - Result reporting and output"
        exit 0
        ;;
    --verbose|-v)
        set -x
        main
        ;;
    --clean|-c)
        cleanup_previous
        print_status $GREEN "✅ Test environment cleaned"
        exit 0
        ;;
    "")
        main
        ;;
    *)
        print_status $RED "❌ Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac

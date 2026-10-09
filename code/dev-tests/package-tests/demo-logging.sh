#!/bin/bash

# Quick Test Demo - Single Test with Logging
# This script demonstrates the enhanced logging system

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
USER_PROJECT_DIR="$SCRIPT_DIR/tmp/test-endorphin"
RESULTS_DIR="$SCRIPT_DIR/results"
TEST_SESSION="$(date +%Y%m%d_%H%M%S)"
SESSION_DIR="$RESULTS_DIR/$TEST_SESSION"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
FAILED_TEST_NAMES=()
SESSION_START_TIME=$(date +%s)

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
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
        echo "Endorphin AI Package Test Demo Session"
        echo "======================================="
        echo "Session ID: $TEST_SESSION"
        echo "Start Time: $(date)"
        echo "Repository: $REPO_ROOT"
        echo "Test Environment: $USER_PROJECT_DIR"
        echo "Node Version: $(node --version 2>/dev/null || echo 'Not available')"
        echo "NPM Version: $(npm --version 2>/dev/null || echo 'Not available')"
        echo "OS: $(uname -s 2>/dev/null || echo 'Unknown')"
        echo "======================================="
        echo ""
    } > "$SESSION_DIR/session_info.txt"
    
    print_status $GREEN "✅ Results directory created: $SESSION_DIR"
}

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
    if timeout 60s bash "$test_script" >> "$log_file" 2>&1; then
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

# Quick demo function
demo() {
    print_status $BLUE "🚀 Starting Quick Test Demo"
    print_status $BLUE "============================"
    echo "Session ID: $TEST_SESSION"
    echo "Date: $(date)"
    echo ""
    
    # Setup results directory
    setup_results_directory
    
    # Run just one quick test
    print_status $YELLOW "\\n📦 DEMO: SETUP TEST"
    print_status $YELLOW "==================="
    
    run_test "Environment Setup" \
        "$SCRIPT_DIR/scripts/setup/setup-user-project.sh" \
        "Create user project environment and install package"
    
    # Quick summary
    local end_session_time=$(date)
    local total_duration=$(($(date +%s) - SESSION_START_TIME))
    
    echo ""
    echo "========================================"
    print_status $BLUE "📊 DEMO SUMMARY"
    echo "========================================"
    echo "Total Tests Run: $TOTAL_TESTS"
    print_status $GREEN "Passed: $PASSED_TESTS"
    print_status $RED "Failed: $FAILED_TESTS"
    echo "Total Duration: ${total_duration}s"
    echo ""
    echo "Session Directory: $SESSION_DIR"
    echo "CSV Results: $SESSION_DIR/test_results.csv"
    echo "Session Info: $SESSION_DIR/session_info.txt"
    echo ""
    print_status $GREEN "✅ Demo completed! Check the results directory."
}

demo

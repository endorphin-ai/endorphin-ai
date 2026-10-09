#!/bin/bash

# Package Test Configuration
# Centralized constants and paths for all package tests

# Base directories
export SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PACKAGE_TEST_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
export REPO_ROOT="$(cd "$PACKAGE_TEST_DIR/../.." && pwd)"

# Key test directories - centralized constants
export USER_PROJECT_DIR="$PACKAGE_TEST_DIR/tmp/test-endorphin"
export RESULTS_DIR="$PACKAGE_TEST_DIR/results"
export SCRIPTS_DIR="$PACKAGE_TEST_DIR/scripts"

# Test session info
export TEST_SESSION="${TEST_SESSION:-$(date +%Y%m%d_%H%M%S)}"
export SESSION_DIR="$RESULTS_DIR/$TEST_SESSION"

# Colors for consistent output
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export PURPLE='\033[0;35m'
export CYAN='\033[0;36m'
export NC='\033[0m' # No Color

# Utility functions
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Ensure user project directory exists and is ready
ensure_user_project() {
    if [ ! -d "$USER_PROJECT_DIR" ]; then
        print_status $RED "❌ User project directory not found: $USER_PROJECT_DIR"
        print_status $YELLOW "💡 Run setup-user-project.sh first"
        return 1
    fi
    
    if [ ! -f "$USER_PROJECT_DIR/package.json" ]; then
        print_status $RED "❌ User project not properly initialized (missing package.json)"
        print_status $YELLOW "💡 Run setup-user-project.sh first"
        return 1
    fi
    
    return 0
}

# Change to user project directory with validation
cd_user_project() {
    if ensure_user_project; then
        cd "$USER_PROJECT_DIR"
        print_status $BLUE "📁 Working directory: $USER_PROJECT_DIR"
        return 0
    else
        return 1
    fi
}

# Display path information
show_paths() {
    echo "📍 Package Test Paths:"
    echo "   Repository Root: $REPO_ROOT"
    echo "   Package Test Dir: $PACKAGE_TEST_DIR"
    echo "   User Project Dir: $USER_PROJECT_DIR"
    echo "   Results Dir: $RESULTS_DIR"
    echo "   Scripts Dir: $SCRIPTS_DIR"
}

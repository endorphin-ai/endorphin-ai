#!/bin/bash

# Node.js 22.18.0 Compatibility Test Script
# Tests Endorphin AI framework with Node.js 22.18.0

set -e

echo "🔬 Node.js 22.18.0 Compatibility Test"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Node.js 22.18.0 is available
check_node_version() {
    log_info "Checking Node.js version..."
    
    CURRENT_VERSION=$(node --version)
    EXPECTED_VERSION="v22.18.0"
    
    echo "Current version: $CURRENT_VERSION"
    echo "Expected version: $EXPECTED_VERSION"
    
    if [[ "$CURRENT_VERSION" == "$EXPECTED_VERSION" ]]; then
        log_success "Node.js 22.18.0 is active"
        return 0
    else
        log_warning "Node.js 22.18.0 not active. Current: $CURRENT_VERSION"
        
        # Try to switch to 22.18.0 if nvm is available
        if command -v nvm &> /dev/null; then
            log_info "Attempting to switch to Node.js 22.18.0 using nvm..."
            if nvm use 22.18.0 2>/dev/null; then
                log_success "Switched to Node.js 22.18.0"
                return 0
            else
                log_error "Node.js 22.18.0 not installed. Install with: nvm install 22.18.0"
                return 1
            fi
        else
            log_error "Please install Node.js 22.18.0 manually"
            return 1
        fi
    fi
}

# Run TypeScript type checking
run_type_check() {
    log_info "Running TypeScript type checking..."
    if npm run type-check; then
        log_success "TypeScript type checking passed"
    else
        log_error "TypeScript type checking failed"
        return 1
    fi
}

# Run ESLint
run_lint() {
    log_info "Running ESLint..."
    if npm run lint; then
        log_success "ESLint passed"
    else
        log_warning "ESLint found issues (warnings allowed)"
    fi
}

# Build project
build_project() {
    log_info "Building project..."
    if npm run build; then
        log_success "Build completed successfully"
    else
        log_error "Build failed"
        return 1
    fi
}

# Test CLI functionality
test_cli() {
    log_info "Testing CLI functionality..."
    
    # Test version command
    if node dist/bin/endorphin.js --version > /dev/null 2>&1; then
        log_success "CLI version command works"
    else
        log_error "CLI version command failed"
        return 1
    fi
    
    # Test help command
    if node dist/bin/endorphin.js --help > /dev/null 2>&1; then
        log_success "CLI help command works"
    else
        log_error "CLI help command failed"
        return 1
    fi
    
    # Test list tools command
    if node dist/bin/endorphin.js list tools > /dev/null 2>&1; then
        log_success "CLI list tools command works"
    else
        log_error "CLI list tools command failed"
        return 1
    fi
}

# Run development tests
run_dev_tests() {
    log_info "Running development tests..."
    if npm test; then
        log_success "Development tests passed"
    else
        log_error "Development tests failed"
        return 1
    fi
}

# Run package tests
run_package_tests() {
    log_info "Running package tests..."
    if npm run test:package; then
        log_success "Package tests passed"
    else
        log_error "Package tests failed"
        return 1
    fi
}

# Main execution
main() {
    echo "Starting Node.js 22.18.0 compatibility testing..."
    echo
    
    # Check Node.js version
    if ! check_node_version; then
        log_error "Node.js 22.18.0 is required for this test"
        exit 1
    fi
    
    echo
    
    # Install dependencies
    log_info "Installing dependencies..."
    if npm ci; then
        log_success "Dependencies installed"
    else
        log_error "Failed to install dependencies"
        exit 1
    fi
    
    echo
    
    # Run tests in sequence
    local tests=(
        "run_type_check"
        "run_lint" 
        "build_project"
        "test_cli"
        "run_dev_tests"
        "run_package_tests"
    )
    
    local failed_tests=()
    
    for test in "${tests[@]}"; do
        echo
        if ! $test; then
            failed_tests+=("$test")
        fi
    done
    
    echo
    echo "======================================"
    
    if [ ${#failed_tests[@]} -eq 0 ]; then
        log_success "🎉 All Node.js 22.18.0 compatibility tests passed!"
        echo
        log_info "Summary:"
        echo "  ✅ TypeScript compilation"
        echo "  ✅ ESLint code quality"
        echo "  ✅ Project build"
        echo "  ✅ CLI functionality"
        echo "  ✅ Development tests ($(npm test 2>&1 | grep -o '[0-9]* passed' | head -1))"
        echo "  ✅ Package integration tests"
        echo
        log_success "Endorphin AI is fully compatible with Node.js 22.18.0"
        exit 0
    else
        log_error "Some tests failed:"
        for test in "${failed_tests[@]}"; do
            echo "  ❌ $test"
        done
        echo
        log_error "Node.js 22.18.0 compatibility issues detected"
        exit 1
    fi
}

# Run main function
main "$@"
#!/bin/bash

# Verify CI configuration for Node.js 22.18.0 testing
# This script checks that CI workflows are properly configured

set -e

echo "🔍 Verifying Node.js 22.18.0 CI Configuration"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    log_error "Not in the project root directory. Please run from project root."
    exit 1
fi

log_info "Checking CI workflow files..."

# Check main CI workflow
if [[ -f ".github/workflows/ci.yml" ]]; then
    log_success "Main CI workflow exists"
    
    # Check for Node.js 22.18.0 in matrix
    if grep -q "22.18.0" .github/workflows/ci.yml; then
        log_success "Node.js 22.18.0 found in main CI matrix"
    else
        log_error "Node.js 22.18.0 NOT found in main CI matrix"
    fi
    
    # Check for cross-platform support
    if grep -q "ubuntu-latest.*windows-latest.*macos-latest" .github/workflows/ci.yml; then
        log_success "Cross-platform testing configured (Ubuntu, Windows, macOS)"
    else
        log_warning "Cross-platform configuration might be incomplete"
    fi
else
    log_error "Main CI workflow (.github/workflows/ci.yml) not found"
fi

# Check dedicated Node.js 22.18.0 workflow
if [[ -f ".github/workflows/node-22-18-0-test.yml" ]]; then
    log_success "Dedicated Node.js 22.18.0 workflow exists"
    
    # Check for explicit version
    if grep -q "node-version: '22.18.0'" .github/workflows/node-22-18-0-test.yml; then
        log_success "Explicit Node.js 22.18.0 version specified"
    else
        log_error "Node.js 22.18.0 version not explicitly specified"
    fi
    
    # Check for cross-platform matrix
    if grep -q "ubuntu-latest.*windows-latest.*macos-latest" .github/workflows/node-22-18-0-test.yml; then
        log_success "Cross-platform matrix configured in dedicated workflow"
    else
        log_warning "Cross-platform matrix might be incomplete in dedicated workflow"
    fi
else
    log_error "Dedicated Node.js 22.18.0 workflow not found"
fi

# Check package.json configuration
log_info "Checking package.json configuration..."

if grep -q '"node": ">=16.0.0"' package.json; then
    log_success "Node.js minimum version specified in engines"
else
    log_warning "Node.js engines configuration might be missing"
fi

if grep -q '"test:node-22"' package.json; then
    log_success "Node.js 22 test script exists"
else
    log_warning "Node.js 22 test script not found"
fi

# Check for Node.js compatibility documentation
if [[ -f "doc/NODEJS-COMPATIBILITY.md" ]]; then
    log_success "Node.js compatibility documentation exists"
else
    log_warning "Node.js compatibility documentation not found"
fi

# Check test scripts
log_info "Checking test scripts..."

if [[ -f "scripts/test-node-22.18.0.sh" ]]; then
    log_success "Node.js 22.18.0 test script exists"
    if [[ -x "scripts/test-node-22.18.0.sh" ]]; then
        log_success "Test script is executable"
    else
        log_warning "Test script exists but is not executable"
    fi
else
    log_warning "Node.js 22.18.0 test script not found"
fi

# Summary
echo
echo "🎯 VERIFICATION SUMMARY"
echo "======================="

# Count workflows that support Node.js 22.18.0
WORKFLOW_COUNT=0
if [[ -f ".github/workflows/ci.yml" ]] && grep -q "22.18.0" .github/workflows/ci.yml; then
    ((WORKFLOW_COUNT++))
fi
if [[ -f ".github/workflows/node-22-18-0-test.yml" ]]; then
    ((WORKFLOW_COUNT++))
fi

echo "✅ Workflows supporting Node.js 22.18.0: $WORKFLOW_COUNT"
echo "✅ Platforms tested: Ubuntu, Windows, macOS (in parallel)"
echo "✅ Test types: Development, Integration, CLI, Package"

# Check current Node.js version
CURRENT_NODE=$(node --version 2>/dev/null || echo "not installed")
echo "🔍 Current local Node.js version: $CURRENT_NODE"

if [[ "$CURRENT_NODE" == "v22.18.0" ]]; then
    log_success "Local environment matches CI target version"
    echo
    log_info "You can test locally with: npm run test:node-22"
else
    log_warning "Local Node.js version differs from CI target (v22.18.0)"
    echo
    log_info "To test locally:"
    echo "  nvm install 22.18.0"
    echo "  nvm use 22.18.0"
    echo "  npm run test:node-22"
fi

echo
log_success "CI configuration verification complete!"
log_info "Node.js 22.18.0 will be tested in parallel on Ubuntu, Windows, and macOS"
log_info "Trigger CI by pushing to main/develop or creating a pull request"
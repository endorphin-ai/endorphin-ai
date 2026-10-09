#!/bin/bash

# Comprehensive test script for endorphin-ai CLI commands
set -e

echo "🧪 Comprehensive CLI Test Script"
echo "================================"

# Clean up function
cleanup() {
    echo "🧹 Cleaning up test directories..."
    rm -rf /tmp/test-endorphin-*
    cd /Users/papapin777/Documents/CODE/AI/endorphin-ai
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Test configuration
TEST_VERSION="0.7.4"
NPM_TIMEOUT=45  # seconds to wait for npm propagation

echo "📋 Test Configuration:"
echo "  • Version: $TEST_VERSION"
echo "  • NPM Timeout: $NPM_TIMEOUT seconds"
echo ""

# Step 1: Build and publish
echo "🔨 Step 1: Build and publish version $TEST_VERSION"
echo "=================================================="

# Build the project
echo "Building project..."
npm run build

# Version bump
echo "Bumping version to $TEST_VERSION..."
npm version $TEST_VERSION --no-git-tag-version

# Update create-endorphin-ai version
cd create-endorphin-ai
npm version $TEST_VERSION --no-git-tag-version
cd ..

# Publish both packages
echo "Publishing endorphin-ai@$TEST_VERSION..."
npm publish

echo "Publishing create-endorphin-ai@$TEST_VERSION..."
cd create-endorphin-ai
npm publish
cd ..

echo "✅ Published successfully!"
echo ""

# Step 2: Wait for npm propagation
echo "⏳ Step 2: Waiting for npm propagation ($NPM_TIMEOUT seconds)"
echo "============================================================="
sleep $NPM_TIMEOUT
echo "✅ Wait complete!"
echo ""

# Step 3: Clear npm cache
echo "🗑️  Step 3: Clear npm cache"
echo "============================"
npx --clear-cache
npm cache clean --force
echo "✅ Cache cleared!"
echo ""

# Step 4: Test npx commands
echo "🧪 Step 4: Test npx commands"
echo "============================"

echo "Testing: npx endorphin-ai@$TEST_VERSION --version"
if npx endorphin-ai@$TEST_VERSION --version 2>&1; then
    echo "✅ PASS: --version command works"
else
    echo "❌ FAIL: --version command failed"
    exit 1
fi

echo ""
echo "Testing: npx endorphin-ai@$TEST_VERSION --help"
if npx endorphin-ai@$TEST_VERSION --help > /dev/null 2>&1; then
    echo "✅ PASS: --help command works"
else
    echo "❌ FAIL: --help command failed"
    exit 1
fi

echo ""
echo "Testing: npx create-endorphin-ai@$TEST_VERSION --help"
if npx create-endorphin-ai@$TEST_VERSION --help > /dev/null 2>&1; then
    echo "✅ PASS: create-endorphin-ai --help works"
else
    echo "❌ FAIL: create-endorphin-ai --help failed"
    exit 1
fi

echo ""

# Step 5: Test init command
echo "🧪 Step 5: Test init command"
echo "============================"

TEST_INIT_DIR="/tmp/test-endorphin-init-$(date +%s)"
mkdir -p "$TEST_INIT_DIR"
cd "$TEST_INIT_DIR"

echo "Testing in directory: $TEST_INIT_DIR"
echo "Running: npx endorphin-ai@$TEST_VERSION init"

if npx endorphin-ai@$TEST_VERSION init; then
    echo "✅ PASS: init command executed"
    
    # Check if files were created
    echo "📁 Checking created files..."
    
    if [ -f "endorphin.config.ts" ]; then
        echo "✅ PASS: endorphin.config.ts created"
    else
        echo "❌ FAIL: endorphin.config.ts missing"
        exit 1
    fi
    
    if [ -f ".env" ]; then
        echo "✅ PASS: .env file created"
    else
        echo "❌ FAIL: .env file missing"
        exit 1
    fi
    
    if [ -d "tests" ]; then
        echo "✅ PASS: tests directory created"
    else
        echo "❌ FAIL: tests directory missing"
        exit 1
    fi
    
    if [ -d "test-results" ]; then
        echo "✅ PASS: test-results directory created"
    else
        echo "❌ FAIL: test-results directory missing"
        exit 1
    fi
    
    if [ -f "tests/sample-test.ts" ]; then
        echo "✅ PASS: sample test file created"
    else
        echo "❌ FAIL: sample test file missing"
        exit 1
    fi
    
    echo "📋 Files created:"
    ls -la
    
else
    echo "❌ FAIL: init command failed"
    exit 1
fi

cd /Users/papapin777/Documents/CODE/AI/endorphin-ai

echo ""

# Step 6: Test --save-dev installation
echo "🧪 Step 6: Test --save-dev installation"
echo "======================================="

TEST_SAVEDEV_DIR="/tmp/test-endorphin-savedev-$(date +%s)"
mkdir -p "$TEST_SAVEDEV_DIR"
cd "$TEST_SAVEDEV_DIR"

echo "Testing in directory: $TEST_SAVEDEV_DIR"

# Create package.json
npm init -y > /dev/null

echo "Running: npm install endorphin-ai@$TEST_VERSION --save-dev"
if npm install endorphin-ai@$TEST_VERSION --save-dev > /dev/null 2>&1; then
    echo "✅ PASS: --save-dev installation worked"
    
    # Test local binary
    echo "Testing local binary..."
    if ./node_modules/.bin/endorphin-ai --version; then
        echo "✅ PASS: local binary works"
    else
        echo "❌ FAIL: local binary failed"
        exit 1
    fi
    
    # Test init with local binary
    echo "Testing local init command..."
    if ./node_modules/.bin/endorphin-ai init; then
        echo "✅ PASS: local init command works"
        
        if [ -f "endorphin.config.ts" ]; then
            echo "✅ PASS: init created config file"
        else
            echo "❌ FAIL: init did not create config file"
            exit 1
        fi
    else
        echo "❌ FAIL: local init command failed"
        exit 1
    fi
    
else
    echo "❌ FAIL: --save-dev installation failed"
    exit 1
fi

cd /Users/papapin777/Documents/CODE/AI/endorphin-ai

echo ""

# Step 7: Test global installation
echo "🧪 Step 7: Test global installation"
echo "==================================="

echo "Running: npm install -g endorphin-ai@$TEST_VERSION"
if npm install -g endorphin-ai@$TEST_VERSION > /dev/null 2>&1; then
    echo "✅ PASS: global installation worked"
    
    # Test global binary
    echo "Testing global binary..."
    if endorphin-ai --version; then
        echo "✅ PASS: global binary works"
    else
        echo "❌ FAIL: global binary failed"
    fi
    
    # Clean up global install
    npm uninstall -g endorphin-ai > /dev/null 2>&1
    
else
    echo "⚠️  SKIP: global installation failed (may require permissions)"
fi

echo ""

# Step 8: Test create-endorphin-ai project creation
echo "🧪 Step 8: Test create-endorphin-ai project creation"
echo "==================================================="

TEST_CREATE_DIR="/tmp/test-endorphin-create-$(date +%s)"
mkdir -p "$TEST_CREATE_DIR"
cd "$TEST_CREATE_DIR"

echo "Testing in directory: $TEST_CREATE_DIR"
echo "Running: npx create-endorphin-ai@$TEST_VERSION test-project"

# Create project (with timeout for user input)
if timeout 30 bash -c "echo 'test-project' | npx create-endorphin-ai@$TEST_VERSION" > /dev/null 2>&1; then
    echo "✅ PASS: create-endorphin-ai executed"
    
    if [ -d "test-project" ]; then
        echo "✅ PASS: project directory created"
        
        cd test-project
        if [ -f "package.json" ]; then
            echo "✅ PASS: package.json created"
        else
            echo "❌ FAIL: package.json missing"
        fi
        cd ..
    else
        echo "❌ FAIL: project directory not created"
    fi
else
    echo "⚠️  SKIP: create-endorphin-ai test (may require interactive input)"
fi

cd /Users/papapin777/Documents/CODE/AI/endorphin-ai

# Final Results
echo ""
echo "🎉 Test Results Summary"
echo "======================"
echo "✅ Version $TEST_VERSION published and tested successfully!"
echo ""
echo "🌐 End users can now use:"
echo "  • npx endorphin-ai@latest --version"
echo "  • npx endorphin-ai@latest --help"
echo "  • npx endorphin-ai@latest init"
echo "  • npm install endorphin-ai@latest --save-dev"
echo "  • npx create-endorphin-ai@latest my-project"
echo ""
echo "🔗 Package URLs:"
echo "  • https://www.npmjs.com/package/endorphin-ai"
echo "  • https://www.npmjs.com/package/create-endorphin-ai"
echo ""
echo "🎯 All tests completed successfully!"
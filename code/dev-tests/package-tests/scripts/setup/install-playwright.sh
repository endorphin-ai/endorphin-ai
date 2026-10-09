#!/bin/bash

# Install Playwright Browsers Script
# This script installs Playwright browsers in the user project environment

set -e

# Load centralized configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/test-config.sh"

echo "🎭 Installing Playwright Browsers"
echo "================================="

# Change to user project directory
if ! cd_user_project; then
    exit 1
fi

echo "📁 Working directory: $(pwd)"
echo "🔍 Checking current Playwright installation..."

# Check if playwright is available (through endorphin-ai)
if [ -f "node_modules/endorphin-ai/package.json" ]; then
    echo "✅ Endorphin AI package is available"
else
    echo "❌ Endorphin AI package not found"
    exit 1
fi

# Check if browsers are already installed
echo "🔍 Checking for existing browser installations..."
BROWSERS_STATUS=$(npx playwright install --dry-run 2>&1 || true)

if echo "$BROWSERS_STATUS" | grep -q "is already installed"; then
    echo "✅ Playwright browsers are already installed"
    echo "📊 Browser installation status:"
    echo "$BROWSERS_STATUS" | grep -E "(chromium|firefox|webkit)" | head -3
else
    echo "📥 Installing Playwright browsers..."
    echo "⏳ This may take a few minutes on first install..."
    
    # Install browsers with progress output
    if npx playwright install; then
        echo "✅ Playwright browsers installed successfully"
    else
        echo "❌ Failed to install Playwright browsers"
        echo ""
        echo "🔍 Debugging info:"
        echo "Node version: $(node --version)"
        echo "NPM version: $(npm --version)"
        echo "Playwright package: $(npm list playwright 2>/dev/null || echo 'Not found')"
        echo ""
        echo "💡 Try manually: npx playwright install"
        exit 1
    fi
fi

# Verify installation
echo ""
echo "🔍 Verifying browser installation..."
if npx playwright install --dry-run 2>&1 | grep -q "is already installed"; then
    echo "✅ Browser installation verified"
    
    # Show available browsers
    echo "📋 Available browsers:"
    npx playwright install --dry-run 2>&1 | grep -E "(chromium|firefox|webkit)" | head -3 | sed 's/^/  /'
else
    echo "⚠️ Browser installation verification inconclusive"
    echo "Continuing anyway - some browsers may be available"
fi

echo ""
echo "🎉 Playwright browser setup completed"
echo "📁 User project: $(pwd)"
echo "🎬 Ready for test recorder operations"

#!/bin/bash

# Test Config Verification Script
# This script tests if the centralized configuration is working properly

echo "🔍 Testing Centralized Configuration"
echo "===================================="

# Load centralized configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config/test-config.sh"

echo "✅ Configuration loaded successfully"
echo ""

# Show all the important paths
echo "📍 Important Paths:"
echo "   Repository Root: $REPO_ROOT"
echo "   Package Test Dir: $PACKAGE_TEST_DIR"
echo "   User Project Dir: $USER_PROJECT_DIR"
echo "   Results Dir: $RESULTS_DIR"
echo "   Scripts Dir: $SCRIPTS_DIR"
echo ""

# Test the cd_user_project function
echo "🧪 Testing cd_user_project function..."
if cd_user_project; then
    echo "✅ Successfully changed to user project directory"
    echo "📁 Current directory: $(pwd)"
    
    # Check for key files
    if [ -f ".env" ]; then
        echo "✅ .env file found"
    else
        echo "❌ .env file not found"
    fi
    
    if [ -f "package.json" ]; then
        echo "✅ package.json file found"
    else
        echo "❌ package.json file not found"
    fi
else
    echo "❌ Failed to change to user project directory"
fi

echo ""
echo "🎯 Configuration test completed"

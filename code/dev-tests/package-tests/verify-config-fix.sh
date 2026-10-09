#!/bin/bash

# Quick verification script to test centralized configuration
echo "🔧 Verifying Centralized Configuration Fix"
echo "=========================================="

# Load centralized configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config/test-config.sh"

echo "📍 Configuration loaded successfully!"
echo ""

# Show all paths
show_paths

echo ""
echo "🧪 Testing path functions:"

# Test if user project exists
if ensure_user_project; then
    echo "✅ User project validation: PASSED"
    
    # Test directory change
    if cd_user_project; then
        echo "✅ Directory change: PASSED"
        echo "📁 Current directory: $(pwd)"
        
        # Check for required files
        if [ -f "package.json" ]; then
            echo "✅ package.json found: PASSED"
        else
            echo "❌ package.json not found: FAILED"
        fi
        
        if [ -f ".env" ]; then
            echo "✅ .env file found: PASSED"
        else
            echo "❌ .env file not found: FAILED" 
        fi
        
    else
        echo "❌ Directory change: FAILED"
    fi
else
    echo "❌ User project validation: FAILED"
    echo "💡 Need to run setup-user-project.sh first"
fi

echo ""
echo "🎯 Configuration verification complete!"

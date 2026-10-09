#!/bin/bash

# Complete Test Recorder Test with all required inputs
set -e

# Load centralized configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config/test-config.sh"

echo "🎬 Complete Test Recorder Directory Test"
echo "========================================"

# Change to user project directory
if ! cd_user_project; then
    exit 1
fi

echo "📁 Current directory: $(pwd)"

# Clean up any existing test-recorder directories
echo "🧹 Cleaning up previous test-recorder directories..."
rm -rf test-recorder/ 2>/dev/null || true
rm -rf "$REPO_ROOT/test-recorder/"* 2>/dev/null || true

# Create complete input file with ALL required inputs
cat > /tmp/complete_recorder_input.txt << 'EOF'
TEST-COMPLETE
Complete Test Recorder Test
Test with all required inputs
High
complete,test,full
https://httpbin.org/get



testuser
testuser@example.com
testpassword
Test
User


y
navigate to main page
done
EOF

echo "🚀 Running complete test recorder session..."
echo "   This includes all required inputs:"
echo "   - Basic test data"
echo "   - User ID: testuser"
echo "   - Email: testuser@example.com" 
echo "   - Password: testpassword"
echo "   - First Name: Test"
echo "   - Last Name: User"
echo "   - Confirmation: y"
echo "   - Action: navigate to main page"
echo "   - End: done"

# Run the recorder with complete input
timeout 30 npx endorphin-ai run test-recorder < /tmp/complete_recorder_input.txt 2>&1 || echo "   (Timeout or error - checking results...)"

sleep 3

echo ""
echo "🔍 Checking results..."

# Check if test-recorder directory was created in user project
if [ -d "test-recorder" ]; then
    echo "✅ SUCCESS: test-recorder directory created in user project"
    echo "📂 Contents:"
    ls -la test-recorder/
    if [ -d "test-recorder/TEST-COMPLETE"* ]; then
        echo "📁 Recording session found:"
        ls -la test-recorder/TEST-COMPLETE*/
    fi
else
    echo "❌ No test-recorder directory in user project"
fi

# Check framework directory
if [ -d "$REPO_ROOT/test-recorder" ] && [ "$(ls -A $REPO_ROOT/test-recorder 2>/dev/null)" ]; then
    echo "❌ WARNING: Files found in framework test-recorder directory!"
else
    echo "✅ No unwanted files in framework directory"
fi

# Cleanup
rm -f /tmp/complete_recorder_input.txt

echo ""
echo "📋 Summary:"
echo "Test completed - $(date)"

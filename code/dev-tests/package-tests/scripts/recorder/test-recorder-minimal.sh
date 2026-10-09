#!/bin/bash

# Minimal test to verify test recorder directory creation
set -e

# Load centralized configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config/test-config.sh"

echo "🎬 Minimal Test Recorder Directory Test"
echo "======================================"

# Change to user project directory
if ! cd_user_project; then
    exit 1
fi

echo "📁 Current directory: $(pwd)"
echo "📁 Initial contents:"
ls -la

# Clean up any existing test-recorder directories
echo "🧹 Cleaning up previous test-recorder directories..."
rm -rf test-recorder/ 2>/dev/null || true
rm -rf "$REPO_ROOT/test-recorder/"* 2>/dev/null || true

# Create a very simple input file that should complete quickly
cat > /tmp/minimal_recorder_input.txt << 'EOF'
TEST-MINIMAL
Minimal Test
Simple test for directory creation
High
minimal
https://httpbin.org/get
done
EOF

echo "🚀 Running minimal test recorder session..."

# Run with very short timeout to see if directory gets created
echo "   Input: TEST-MINIMAL, Minimal Test, High priority, https://httpbin.org/get, done"

# Try to run the recorder
timeout 20 npx endorphin-ai run test-recorder < /tmp/minimal_recorder_input.txt 2>&1 || echo "   (Timeout or error - expected)"

sleep 2

echo ""
echo "🔍 Checking results..."

# Check if test-recorder directory was created in user project
if [ -d "test-recorder" ]; then
    echo "✅ SUCCESS: test-recorder directory created in user project"
    echo "📂 Contents:"
    find test-recorder -type f 2>/dev/null | head -5 || echo "   (No files found)"
else
    echo "❌ No test-recorder directory in user project"
fi

# Check if any files were created in framework directory
if [ -d "$REPO_ROOT/test-recorder" ] && [ "$(ls -A $REPO_ROOT/test-recorder 2>/dev/null)" ]; then
    echo "❌ WARNING: Files found in framework test-recorder directory!"
    ls -la "$REPO_ROOT/test-recorder/"
else
    echo "✅ No unwanted files in framework directory"
fi

# Cleanup
rm -f /tmp/minimal_recorder_input.txt

echo ""
echo "📋 Summary:"
echo "User project: $(pwd)"
echo "Framework root: $REPO_ROOT"
echo "Test completed."

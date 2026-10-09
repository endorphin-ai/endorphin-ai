#!/bin/bash

# Debug Test Recorder - Step by Step Analysis
set -e

# Load centralized configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config/test-config.sh"

echo "🔍 Debug Test Recorder Directory Creation"
echo "========================================"

# Change to user project directory
if ! cd_user_project; then
    exit 1
fi

echo "📁 Starting directory: $(pwd)"
echo "📂 Initial contents:"
ls -la

# Clean up any existing recordings
echo ""
echo "🧹 Cleaning up previous recordings..."
rm -rf test-recorder/ 2>/dev/null || true
rm -rf "$REPO_ROOT/test-recorder/"* 2>/dev/null || true

echo ""
echo "🎬 Debug: Step 1 - Testing basic CLI invocation"
echo "Running: npx endorphin-ai --help"
npx endorphin-ai --help | head -10

echo ""
echo "🎬 Debug: Step 2 - Testing recorder CLI without input"
echo "This should show the recorder prompt..."
timeout 3 npx endorphin-ai run test-recorder || echo "  (Expected timeout)"

echo ""
echo "🎬 Debug: Step 3 - Check if config is loaded correctly"
echo "Config file contents:"
cat endorphin.config.ts | grep -A 5 -B 5 "recorder"

echo ""
echo "🎬 Debug: Step 4 - Test with minimal manual input"
echo "Sending just a test ID to see where it stops..."

# Create minimal input
cat > /tmp/debug_input.txt << 'EOF'
DEBUG-001
EOF

echo "Input: DEBUG-001"
timeout 5 npx endorphin-ai run test-recorder < /tmp/debug_input.txt 2>&1 || echo "  (Expected timeout)"

echo ""
echo "🔍 Debug: Final directory check"
echo "Directory contents after tests:"
ls -la

echo ""
echo "🔍 Debug: Check for any error logs"
if [ -d "test-recorder" ]; then
    echo "✅ test-recorder directory was created!"
    find test-recorder -type f 2>/dev/null | head -5
else
    echo "❌ test-recorder directory was NOT created"
fi

# Check for any npm/error logs
echo ""
echo "🔍 Debug: Check for npm debug logs"
ls -la npm-debug.log* 2>/dev/null || echo "  (No npm debug logs)"

# Cleanup
rm -f /tmp/debug_input.txt

echo ""
echo "📋 Debug Summary:"
echo "Current working directory: $(pwd)"
echo "Expected test-recorder location: $(pwd)/test-recorder"
echo "Framework root: $REPO_ROOT"

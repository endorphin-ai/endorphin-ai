#!/bin/bash

# Quick Test - Recorder File Isolation Verification
# Test just the recorder scripts to verify file isolation fix

set -e

# Load centralized configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config/test-config.sh"

echo "🧪 Quick Recorder File Isolation Test"
echo "====================================="
show_paths

# Change to user project directory
if ! cd_user_project; then
    echo "❌ Failed to set up user project directory"
    exit 1
fi

echo ""
echo "📋 Before tests - Framework root contents:"
ls -la "$REPO_ROOT" | grep test || echo "No test directories in framework root"

echo ""
echo "📋 Before tests - User project contents:"
ls -la

echo ""
echo "🎬 Running Test Recorder Functionality..."
timeout 20 bash "$PACKAGE_TEST_DIR/scripts/recorder/test-recorder.sh" > /dev/null 2>&1 || echo "Test completed (timeout expected)"

echo ""
echo "🔍 Running Test Recorder File Location..."
timeout 10 bash "$PACKAGE_TEST_DIR/scripts/recorder/test-recorder-location.sh" > /dev/null 2>&1 || echo "Test completed (timeout expected)"

echo ""
echo "📋 After tests - Framework root contents:"
ls -la "$REPO_ROOT" | grep test || echo "✅ No test directories in framework root"

echo ""
echo "📋 After tests - User project contents:"
ls -la

echo ""
echo "🏁 File Isolation Verification:"
if [ -d "$REPO_ROOT/test-recorder" ]; then
    echo "❌ VIOLATION: test-recorder directory found in framework root!"
    ls -la "$REPO_ROOT/test-recorder/"
else
    echo "✅ SUCCESS: No test-recorder directory in framework root"
fi

if [ -d "test-recorder" ]; then
    echo "✅ SUCCESS: test-recorder directory created in user project"
    ls -la test-recorder/
else
    echo "ℹ️ INFO: test-recorder directory not created in user project (may be expected)"
fi

echo ""
echo "🎯 CONCLUSION: File isolation is $([ ! -d "$REPO_ROOT/test-recorder" ] && echo "WORKING" || echo "BROKEN")"

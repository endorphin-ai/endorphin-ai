#!/bin/bash

# File Isolation Verification Script
# Tests exactly where files are created when running Endorphin AI commands

set -e

# Load centralized configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config/test-config.sh"

echo "🔍 File Isolation Verification Test"
echo "===================================="

# Change to user project directory
if ! cd_user_project; then
    exit 1
fi

echo "📁 Current working directory: $(pwd)"

# Clean up any existing test directories to start fresh
echo "🧹 Cleaning up existing test directories..."
rm -rf test-recorder test-results
rm -rf "$REPO_ROOT/test-recorder" 2>/dev/null || true

echo "📋 Baseline - Current directory contents:"
ls -la

echo ""
echo "🎯 Running a quick Endorphin command to see where files get created..."

# Run a simple list command
echo "Running: npx endorphin-ai list"
npx endorphin-ai list

echo ""
echo "📋 After 'list' command - Directory contents:"
ls -la

echo ""
echo "🔍 Checking framework directory for any new files..."
if [ -d "$REPO_ROOT/test-recorder" ]; then
    echo "❌ WARNING: test-recorder directory found in framework root!"
    ls -la "$REPO_ROOT/test-recorder/"
else
    echo "✅ No test-recorder directory in framework root"
fi

if [ -d "$REPO_ROOT/test-results" ]; then
    echo "❌ WARNING: test-results directory found in framework root!"
    ls -la "$REPO_ROOT/test-results/"
else
    echo "✅ No test-results directory in framework root"
fi

echo ""
echo "🎬 Testing test recorder (quick simulation)..."
echo "Running test recorder for 3 seconds..."

# Start recorder in background and kill it quickly
timeout 3s npx endorphin-ai run test-recorder &> /dev/null || true

echo ""
echo "📋 After test recorder - User project contents:"
ls -la

if [ -d "test-recorder" ]; then
    echo "✅ test-recorder directory created in USER project"
    ls -la test-recorder/
else
    echo "ℹ️ test-recorder directory not yet created in user project"
fi

echo ""
echo "🔍 Final check - Framework directory:"
if [ -d "$REPO_ROOT/test-recorder" ]; then
    echo "❌ ISOLATION VIOLATION: test-recorder directory found in framework!"
    ls -la "$REPO_ROOT/test-recorder/"
else
    echo "✅ ISOLATION MAINTAINED: No test-recorder in framework directory"
fi

if [ -d "$REPO_ROOT/test-results" ]; then
    echo "❌ ISOLATION VIOLATION: test-results directory found in framework!"
    ls -la "$REPO_ROOT/test-results/"
else
    echo "✅ ISOLATION MAINTAINED: No test-results in framework directory"
fi

echo ""
echo "🏁 File Isolation Verification Complete"

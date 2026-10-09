#!/bin/bash

# Test script to simulate test recorder interaction
# This will test where files are created

# Load centralized configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/test-config.sh"

echo "🧪 Testing Test Recorder File Creation"
echo "======================================="

# Change to user project directory with validation
if ! cd_user_project; then
    exit 1
fi

echo "📁 Current working directory: $(pwd)"
echo "📋 Initial directory contents:"
ls -la

echo ""
echo "🎬 Starting test recorder simulation..."

# Simulate test recorder input
(
echo "TEST-REC-001"           # Test ID
echo "Recorder Location Test" # Test Name  
echo "Test where files are created during recording" # Description
echo "High"                   # Priority
echo "location, test"         # Tags
echo "https://qafromla.herokuapp.com/" # Site URL
sleep 2
echo "done"                   # Finish recording
) | npx endorphin-ai run test-recorder &

# Wait a bit for the recorder to start
sleep 5

echo ""
echo "📁 Directory contents after starting recorder:"
ls -la

# Check if test-recorder directory was created in user project
if [ -d "test-recorder" ]; then
  echo "✅ test-recorder directory created in USER project"
  echo "📂 Contents of user test-recorder directory:"
  ls -la test-recorder/
else
  echo "❌ test-recorder directory NOT created in user project"
fi

# Check if files were created in framework directory
if [ -d "$REPO_ROOT/test-recorder" ] && [ "$(ls -A $REPO_ROOT/test-recorder)" ]; then
  echo "❌ WARNING: Files created in FRAMEWORK test-recorder directory!"
  echo "📂 Framework test-recorder contents:"
  ls -la "$REPO_ROOT/test-recorder/"
else
  echo "✅ No files created in framework test-recorder directory"
fi

# Kill the test recorder process
pkill -f "endorphin-ai run test-recorder" 2>/dev/null || true

echo ""
echo "🔍 Final verification:"
echo "User project contents:"
ls -la
echo ""
echo "Framework test-recorder contents:"
ls -la "$FRAMEWORK_DIR/test-recorder/" 2>/dev/null || echo "Directory empty or doesn't exist"

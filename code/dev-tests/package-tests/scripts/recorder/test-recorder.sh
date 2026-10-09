#!/bin/bash

# Test Recorder Location Verification Script
# This script tests that the test recorder creates files in the USER project, not framework

set -e

# Load centralized configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/test-config.sh"

echo "🎬 Testing Test Recorder File Location"
echo "======================================"
echo "📍 Framework root: $REPO_ROOT"
echo "📁 User project: $USER_PROJECT_DIR"
echo "⏰ Current time: $(date)"

# Change to user project directory with validation
if ! cd_user_project; then
    exit 1
fi

echo ""
echo "📋 Initial state:"
echo "User project contents:"
ls -la
echo ""
echo "Framework test-recorder contents:"
ls -la "$REPO_ROOT/test-recorder/" 2>/dev/null || echo "(Directory empty or doesn't exist)"

# Clear any existing recordings
echo ""
echo "🧹 Cleaning up previous recordings..."
rm -rf test-recorder/ 2>/dev/null || true
rm -rf "$REPO_ROOT/test-recorder/"* 2>/dev/null || true

echo ""
echo "🎬 Starting test recorder simulation..."
echo "This will create a test recording session and check where files are created."

# Create input simulation file with complete test session
cat > /tmp/recorder_input.txt << 'EOF'
TEST-REC-001
Test Recorder Location Test
Verify that test recorder creates files in user project not framework
High
location,test,verification
https://qafromla.herokuapp.com/



testuser@example.com
testpassword123
Test
User

y
click the title
done
EOF

echo "📝 Complete test data prepared:"
echo "- Test ID: TEST-REC-001"
echo "- Test Name: Test Recorder Location Test"
echo "- Description: Verify that test recorder creates files in user project not framework"
echo "- Priority: High"
echo "- Tags: location,test,verification"
echo "- Site: https://qafromla.herokuapp.com/"
echo "- User ID: (empty)"
echo "- Email: testuser@example.com"  
echo "- Password: testpassword123"
echo "- First Name: Test"
echo "- Last Name: User"
echo "- Custom fields: (none)"
echo "- Confirmation: y"
echo "- Action: click the title"
echo "- End command: done"

# Run test recorder with simulated input (with longer timeout for full session)
echo ""
echo "🚀 Launching test recorder..."
echo "⏳ This will take 15-20 seconds to complete the full session..."

# Run in background with input and longer timeout
timeout 30 node node_modules/endorphin-ai/dist/bin/endorphin.js run test-recorder < /tmp/recorder_input.txt &
RECORDER_PID=$!

# Wait for recorder to complete data collection phase
echo "⌛ Waiting for data collection phase..."
sleep 5

# Wait for browser initialization
echo "⌛ Waiting for browser initialization..."
sleep 5

# Wait for recording session to start
echo "⌛ Waiting for recording session to start..."
sleep 5

# Wait for site navigation and actions
echo "⌛ Waiting for site navigation and interaction..."
sleep 10

# Check if recorder is still running
if kill -0 $RECORDER_PID 2>/dev/null; then
  echo "⏳ Test recorder still running, waiting for completion..."
  
  # Wait a bit more for the "done" command to be processed
  sleep 5
  
  # If still running, kill gracefully
  if kill -0 $RECORDER_PID 2>/dev/null; then
    echo "🛑 Stopping test recorder gracefully..."
    kill -TERM $RECORDER_PID 2>/dev/null || true
    sleep 2
    
    # Force kill if still running
    if kill -0 $RECORDER_PID 2>/dev/null; then
      echo "🛑 Force stopping test recorder..."
      kill -KILL $RECORDER_PID 2>/dev/null || true
    fi
  fi
  
  wait $RECORDER_PID 2>/dev/null || true
else
  echo "✅ Test recorder completed naturally"
fi

# Cleanup input file
rm -f /tmp/recorder_input.txt

echo ""
echo "🔍 VERIFICATION RESULTS:"
echo "========================"

# Check user project for test-recorder directory
if [ -d "test-recorder" ]; then
  echo "✅ SUCCESS: test-recorder directory created in USER project"
  echo "📂 User project test-recorder contents:"
  find test-recorder -type f 2>/dev/null | head -10 || echo "   (No files found)"
  
  # Count files/directories
  RECORDING_DIRS=$(find test-recorder -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
  if [ $RECORDING_DIRS -gt 0 ]; then
    echo "📊 Found $RECORDING_DIRS recording session(s)"
    
    # Show structure of first recording
    FIRST_RECORDING=$(find test-recorder -mindepth 1 -maxdepth 1 -type d 2>/dev/null | head -1)
    if [ -n "$FIRST_RECORDING" ]; then
      echo "📁 Structure of recording session:"
      tree "$FIRST_RECORDING" 2>/dev/null || ls -la "$FIRST_RECORDING"
    fi
  fi
else
  echo "❌ FAIL: test-recorder directory NOT created in user project"
  echo ""
  echo "🔍 DEBUGGING INFO:"
  echo "This is likely because the test recorder hangs during browser initialization."
  echo "Common causes:"
  echo "  1. Playwright browsers not installed in user project"
  echo "  2. Browser configuration issues"
  echo "  3. Framework initialization timeout"
  echo ""
  echo "🔧 Possible solutions:"
  echo "  1. Install Playwright browsers: npx playwright install"
  echo "  2. Check browser config in endorphin.config.ts"
  echo "  3. Increase timeout or use headless mode"
fi

# Check framework directory for unwanted files
if [ -d "$REPO_ROOT/test-recorder" ] && [ "$(ls -A $REPO_ROOT/test-recorder 2>/dev/null)" ]; then
  echo "❌ WARNING: Files found in FRAMEWORK test-recorder directory!"
  echo "📂 Framework test-recorder contents:"
  ls -la "$REPO_ROOT/test-recorder/"
  echo "🚨 This indicates files are being created in the wrong location!"
else
  echo "✅ SUCCESS: No unwanted files in framework test-recorder directory"
fi

# Check if test file was generated in recording directory
echo ""
echo "📝 Test file generation:"
if [ -d "test-recorder" ]; then
  GENERATED_TEST=$(find test-recorder -name "*recorded-test.ts" 2>/dev/null | head -1)
  if [ -n "$GENERATED_TEST" ]; then
    echo "✅ SUCCESS: Generated test file found in recording directory"
    echo "📄 Generated test file: $GENERATED_TEST"
  else
    echo "⚠️ INFO: No generated test file found (may be expected if recorder was interrupted)"
  fi
else
  echo "⚠️ INFO: No test-recorder directory found"
fi

echo ""
echo "🎯 SUMMARY:"
echo "==========="
echo "User project directory: $USER_PROJECT_DIR"
echo "Framework directory: $REPO_ROOT"

if [ -d "test-recorder" ]; then
  echo "✅ Test recorder correctly creates files in USER project"
else
  echo "❌ Test recorder did NOT create files in user project"
fi

if [ -d "$REPO_ROOT/test-recorder" ] && [ "$(ls -A $REPO_ROOT/test-recorder 2>/dev/null)" ]; then
  echo "❌ Test recorder incorrectly created files in FRAMEWORK"
else
  echo "✅ Test recorder did NOT pollute framework directory"
fi

echo ""
echo "🔧 To test manually:"
echo "node node_modules/endorphin-ai/dist/bin/endorphin.js run test-recorder"

#!/bin/bash

# Run Test Script
# Execute specific tests from the user project

set -e

# Load centralized configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/test-config.sh"

TEST_ID="${1:-USER-001}"

echo "🧪 Running Endorphin AI Test from User Project"
echo "=============================================="
echo "🆔 Test ID: $TEST_ID"
echo "⏰ Current time: $(date)"

# Change to user project directory with validation
if ! cd_user_project; then
    exit 1
fi

# Check if .env file exists and has API key
if [ ! -f ".env" ]; then
  echo "❌ ERROR: .env file not found"
  echo "💡 Run ./setup-user-project.sh first"
  exit 1
fi

if ! grep -q "OPENAI_API_KEY=" .env || grep -q "your_key_here" .env; then
  echo "⚠️ WARNING: OpenAI API key not configured properly"
  echo "📝 Please edit .env file and set your OPENAI_API_KEY"
  echo "💡 You can copy it from the main repository's .env file"
fi

echo ""
echo "📋 Available tests:"
node node_modules/endorphin-ai/dist/bin/endorphin.js list

echo ""
echo "🚀 Running test: $TEST_ID"
echo "=========================="

# Run the specified test
if node node_modules/endorphin-ai/dist/bin/endorphin.js run test "$TEST_ID"; then
  echo ""
  echo "✅ Test completed successfully!"
  
  # Show results if available
  if [ -d "test-results" ]; then
    echo ""
    echo "📊 Test results:"
    ls -la test-results/
    
    # Show latest result if available
    LATEST_RESULT=$(find test-results -name "*.json" -type f -exec ls -t {} + 2>/dev/null | head -1)
    if [ -n "$LATEST_RESULT" ]; then
      echo ""
      echo "📄 Latest result summary:"
      cat "$LATEST_RESULT" | jq -r '. | "Status: \(.status // "unknown")\nTest: \(.testId // "unknown")\nDuration: \(.duration // "unknown")"' 2>/dev/null || echo "Result file found but could not parse JSON"
    fi
  fi
else
  echo ""
  echo "❌ Test failed or was interrupted"
  echo "💡 Check the output above for error details"
  
  # Show common troubleshooting tips
  echo ""
  echo "🔧 Troubleshooting tips:"
  echo "1. Verify OpenAI API key is set correctly in .env"
  echo "2. Check internet connectivity"
  echo "3. Ensure the test ID exists: node node_modules/endorphin-ai/dist/bin/endorphin.js list"
  echo "4. Try running with debug output: DEBUG=1 node node_modules/endorphin-ai/dist/bin/endorphin.js run test $TEST_ID"
fi

echo ""
echo "📁 Project structure after test:"
ls -la

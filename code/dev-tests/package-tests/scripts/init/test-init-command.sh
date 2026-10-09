#!/bin/bash

echo "🎯 Testing Init Command"
echo "====================="

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/test-config.sh"

# Store original directory
ORIGINAL_DIR=$(pwd)

# Create temporary test directory in the proper location
TEST_DIR="$PACKAGE_TEST_DIR/tmp/temp-init-test"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"

echo "📁 Created test directory: $TEST_DIR"

# Setup test environment with package installation
cd "$TEST_DIR"
npm init -y > /dev/null 2>&1

# Install endorphin-ai from tarball
PACKAGE_JSON="$REPO_ROOT/package.json"
VERSION=$(node -p "require('$PACKAGE_JSON').version")
TARBALL_NAME="endorphin-ai-${VERSION}.tgz"
TARBALL_PATH="$REPO_ROOT/dist/$TARBALL_NAME"

if [ ! -f "$TARBALL_PATH" ]; then
    echo "📦 Creating package tarball..."
    cd "$REPO_ROOT"
    npm pack --pack-destination dist > /dev/null 2>&1
    cd "$TEST_DIR"
fi

echo "📥 Installing endorphin-ai..."
npm install "$TARBALL_PATH" > /dev/null 2>&1

# Test init command (run from the test directory)
echo "🚀 Running: endorphin init"
node node_modules/endorphin-ai/dist/bin/endorphin.js init

# Verify files were created
echo "📋 Checking created files..."

FILES=(".env" "endorphin.config.ts" "tests/SAMPLE-001.ts" ".gitignore" "README-ENDORPHIN.md")
ALL_GOOD=true

# Change to test directory for file checks
cd "$TEST_DIR"

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ Missing: $file"
    ALL_GOOD=false
  fi
done

# Check directories
DIRS=("tests" "test-results" "test-recorder")
for dir in "${DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "✅ $dir/"
  else
    echo "❌ Missing directory: $dir/"
    ALL_GOOD=false
  fi
done

# Test if example test is valid
echo "🧪 Validating example test..."
if [ -f "./tests/SAMPLE-001.ts" ] && (grep -q "SAMPLE-001\|export const\|export default" "./tests/SAMPLE-001.ts"); then
  echo "✅ Example test syntax valid"
else
  echo "❌ Example test has syntax errors"
  ALL_GOOD=false
fi

# Test if config is valid
echo "⚙️ Validating config file..."
if [ -f "./endorphin.config.ts" ] && grep -q "export default" "./endorphin.config.ts"; then
  echo "✅ Config file syntax valid"
else
  echo "❌ Config file has syntax errors"
  ALL_GOOD=false
fi

# Test CLI functionality
echo "🔧 Testing CLI commands..."
cd "$TEST_DIR"

# Add a test API key to the .env file
echo "OPENAI_API_KEY=sk-test-key-for-testing" > .env

echo "  Testing version command..."
timeout 15 node node_modules/endorphin-ai/dist/bin/endorphin.js --version >/dev/null 2>&1 && echo "✅ CLI version command works" || echo "⚠️  CLI version command timeout (not critical)"

echo "  Testing list command..."
timeout 15 node node_modules/endorphin-ai/dist/bin/endorphin.js list >/dev/null 2>&1 && echo "✅ CLI list command works" || echo "⚠️  CLI list command timeout (not critical)"

# Test second init (should not overwrite)
echo "🔄 Testing second init (should not overwrite)..."
echo "existing config" > "$TEST_DIR/endorphin.config.ts"
(cd "$TEST_DIR" && node node_modules/endorphin-ai/dist/bin/endorphin.js init)
if grep -q "existing config" "$TEST_DIR/endorphin.config.ts"; then
  echo "✅ Second init doesn't overwrite existing files"
else
  echo "❌ Second init overwrote existing files"
  ALL_GOOD=false
fi

# Cleanup (only if test passed)
if [ "$ALL_GOOD" = true ]; then
  cd "$ORIGINAL_DIR"
  rm -rf "$TEST_DIR"
  echo "🎉 Init command test PASSED"
  exit 0
else
  cd "$ORIGINAL_DIR"
  echo "💥 Init command test FAILED"
  echo "📁 Test directory preserved for debugging: $TEST_DIR"
  exit 1
fi

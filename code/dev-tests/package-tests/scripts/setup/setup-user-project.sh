#!/bin/bash

# Setup User Project Test Environment
# This script creates a clean user project environment to test Endorphin AI package

set -e

# Load centralized configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/test-config.sh"

echo "🚀 Setting up Endorphin AI User Project Test Environment"
echo "========================================================"
echo "📍 Repository root: $REPO_ROOT"
echo "📁 Package tests dir: $PACKAGE_TEST_DIR"
echo "📁 User project: $USER_PROJECT_DIR"

# Create user project directory
echo "📁 Creating user project directory..."
mkdir -p "$USER_PROJECT_DIR"
cd "$USER_PROJECT_DIR"

# Initialize npm project
echo "📦 Initializing npm project..."
npm init -y > /dev/null 2>&1

# Install endorphin-ai from tarball for realistic testing
echo "📥 Installing endorphin-ai from tarball..."

# Get version from package.json and create tarball if needed
PACKAGE_JSON="$REPO_ROOT/package.json"
VERSION=$(node -p "require('$PACKAGE_JSON').version")
TARBALL_NAME="endorphin-ai-${VERSION}.tgz"
TARBALL_PATH="$REPO_ROOT/dist/$TARBALL_NAME"

if [ ! -f "$TARBALL_PATH" ]; then
    echo "📦 Creating package tarball..."
    cd "$REPO_ROOT"
    npm pack --pack-destination dist > /dev/null 2>&1
    cd "$USER_PROJECT_DIR"
fi

npm install "$TARBALL_PATH" > /dev/null 2>&1

# Create user configuration
echo "⚙️ Creating user configuration..."
cat > endorphin.config.js << 'EOF'
export default {
  browser: {
    headless: false,  // Keep browser visible during recording
    viewport: { width: 1280, height: 720 },
    timeout: 30000,
    slowMo: 500  // Slow down actions for better visibility
  },
  
  results: {
    directory: "./test-results",
    keepHistory: 10,
    format: ["json", "html"],
    screenshots: true,
    recordVideo: false
  },
  
  ai: {
    model: "gpt-4o",
    maxRetries: 3,
    temperature: 0.1
  },
  
  recorder: {
    outputDirectory: "./test-recorder",
    screenshotFormat: "png",
    stepDelay: 1000
  }
};
EOF

# Copy environment variables from main repo
echo "🔑 Copying environment variables from main repository..."
if [ -f "$REPO_ROOT/.env" ]; then
  cp "$REPO_ROOT/.env" ".env"
  echo "✅ Environment variables copied from main repo"
else
  echo "⚠️ No .env file found in main repo, creating basic one..."
  cat > .env << 'EOF'
# Copy your OpenAI API key here
OPENAI_API_KEY=your_key_here

# Base URL for test recordings
BASE_URL=https://qafromla.herokuapp.com/

# Browser settings
HEADLESS=false
ENDORPHIN_HEADLESS=false
EOF
fi

# Create tests directory
echo "📝 Creating tests directory..."
mkdir -p tests

# Create a basic test file
echo "📄 Creating basic test file..."
cat > tests/user-basic-test.ts << 'EOF'
export const USER_BASIC_TEST = {
  id: "USER-001",
  name: "User Project Basic Test",
  description: "Test basic functionality from user project perspective",
  priority: "High",
  tags: ["user-test", "basic", "smoke"],
  site: "https://qafromla.herokuapp.com/",
  testData: {},
  task: "Navigate to the QA From LA website and verify it loads successfully. Check that the page title contains 'QA From LA' and look for the main heading."
};
EOF

# Create package.json scripts for convenience
echo "🔧 Adding convenience scripts to package.json..."
npm pkg set type="module"
npm pkg set scripts.test:e2e="endorphin-ai run test all"
npm pkg set scripts.test:smoke="endorphin-ai run test --tag smoke"
npm pkg set scripts.test:list="endorphin-ai list"
npm pkg set scripts.test:recorder="endorphin-ai run test-recorder"

echo ""
echo "✅ User project setup complete!"
echo ""
echo "📋 Directory structure:"
ls -la

echo ""
echo "🎯 Next steps:"
echo "1. cd tmp/test-endorphin"
echo "2. Run: ./test-recorder.sh (to test recorder)"
echo "3. Run: ./run-test.sh USER-001 (to run test)"
echo "4. Run: npx endorphin-ai list (to see available tests)"

echo ""
echo "📁 Project location: $USER_PROJECT_DIR"

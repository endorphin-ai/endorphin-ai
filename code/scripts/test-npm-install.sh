#!/bin/bash

# Test script to verify npm installation works properly

set -e

echo "🧪 Testing npm installation..."

# Clean up any previous test
rm -rf /tmp/endorphin-test-install
mkdir -p /tmp/endorphin-test-install
cd /tmp/endorphin-test-install

echo "📦 Creating test package..."
npm pack /Users/papapin777/Documents/CODE/AI/endorphin-ai

# Find the generated .tgz file
PACKAGE_FILE=$(ls endorphin-ai-*.tgz | head -1)

if [ -z "$PACKAGE_FILE" ]; then
  echo "❌ Failed: No package file generated"
  exit 1
fi

echo "📥 Installing package locally..."
npm init -y > /dev/null 2>&1
npm install "./$PACKAGE_FILE" > /dev/null 2>&1

echo "🧪 Testing npx endorphin-ai command..."
if npx endorphin-ai --version > /dev/null 2>&1; then
  echo "✅ npx endorphin-ai --version works!"
else
  echo "❌ npx endorphin-ai --version failed"
  exit 1
fi

echo "🧪 Testing direct binary execution..."
if ./node_modules/.bin/endorphin-ai --version > /dev/null 2>&1; then
  echo "✅ Direct binary execution works!"
else
  echo "❌ Direct binary execution failed"
  exit 1
fi

echo "🧪 Testing global installation..."
npm install -g "./$PACKAGE_FILE" > /dev/null 2>&1

if endorphin-ai --version > /dev/null 2>&1; then
  echo "✅ Global installation works!"
else
  echo "❌ Global installation failed"
  exit 1
fi

# Clean up global install
npm uninstall -g endorphin-ai > /dev/null 2>&1

echo "🎉 All installation tests passed!"
cd /
rm -rf /tmp/endorphin-test-install
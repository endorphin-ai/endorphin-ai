#!/bin/bash

# Endorphin AI Publishing Script
set -e

echo "🚀 Starting Endorphin AI Publishing Process..."

# Check current directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

# Check npm login
echo "🔐 Checking npm authentication..."
if ! npm whoami > /dev/null 2>&1; then
    echo "❌ Not logged in to npm. Please run: npm login"
    exit 1
fi

echo "✅ Logged in as: $(npm whoami)"

# Build the project
echo "🔨 Building project..."
npm run build

# Verify build output
if [ ! -f "dist/bin/endorphin.js" ]; then
    echo "❌ Build failed: dist/bin/endorphin.js not found"
    exit 1
fi

echo "✅ Build completed successfully"

# Run tests
echo "🧪 Running tests..."
npm run test:unit

echo "✅ Tests passed"

# Publish main package
echo "📦 Publishing endorphin-ai..."
npm publish

echo "✅ endorphin-ai@$(node -p "require('./package.json').version") published!"

# Publish creator package
echo "📦 Publishing create-endorphin-ai..."
cd create-endorphin-ai
npm publish
cd ..

echo "✅ create-endorphin-ai@$(node -p "require('./create-endorphin-ai/package.json').version") published!"

# Test published packages
echo "🧪 Testing published packages..."

# Wait a moment for npm to propagate
sleep 5

echo "Testing npx endorphin-ai..."
if npx endorphin-ai@latest --version; then
    echo "✅ npx endorphin-ai works!"
else
    echo "❌ npx endorphin-ai failed"
fi

echo "Testing npx create-endorphin-ai..."
if npx create-endorphin-ai@latest --help; then
    echo "✅ npx create-endorphin-ai works!"
else
    echo "❌ npx create-endorphin-ai failed"
fi

echo "🎉 Publishing complete!"
echo ""
echo "📋 End users can now:"
echo "  • npx endorphin-ai --version"
echo "  • npx create-endorphin-ai my-project"
echo "  • npm install -g endorphin-ai"
echo ""
echo "🌐 Package URLs:"
echo "  • https://www.npmjs.com/package/endorphin-ai"
echo "  • https://www.npmjs.com/package/create-endorphin-ai"
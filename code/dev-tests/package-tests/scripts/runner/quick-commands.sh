#!/bin/bash

# Quick Commands Script
# Convenient shortcuts for common Endorphin AI operations

# Load centralized configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/test-config.sh"

# Display usage if no arguments
if [ $# -eq 0 ]; then
  echo "🎯 Endorphin AI Quick Commands"
  echo "=============================="
  echo ""
  echo "Usage: ./quick-commands.sh <command> [args]"
  echo ""
  echo "Available commands:"
  echo "  setup           - Setup/reset the user project"
  echo "  list            - List all available tests"
  echo "  run <test-id>   - Run a specific test"
  echo "  run-all         - Run all tests"
  echo "  run-smoke       - Run smoke tests"
  echo "  recorder        - Start test recorder"
  echo "  test-location   - Test recorder file location"
  echo "  clean           - Clean up generated files"
  echo "  status          - Show project status"
  echo "  env             - Show environment configuration"
  echo ""
  echo "Examples:"
  echo "  ./quick-commands.sh setup"
  echo "  ./quick-commands.sh run USER-001"
  echo "  ./quick-commands.sh recorder"
  echo ""
  show_paths
  exit 0
fi

COMMAND="$1"
shift

case "$COMMAND" in
  "setup")
    echo "🚀 Setting up user project..."
    "$SCRIPTS_DIR/setup/setup-user-project.sh"
    ;;
    
  "list")
    echo "📋 Listing available tests..."
    if cd_user_project; then
      node node_modules/endorphin-ai/dist/bin/endorphin.js list
    fi
    ;;
    
  "run")
    if [ -z "$1" ]; then
      echo "❌ Error: Please specify a test ID"
      echo "💡 Usage: ./quick-commands.sh run <test-id>"
      if cd_user_project; then
        echo "📋 Available tests:"
        node node_modules/endorphin-ai/dist/bin/endorphin.js list
      fi
      exit 1
    fi
    echo "🧪 Running test: $1"
    if cd_user_project; then
      node node_modules/endorphin-ai/dist/bin/endorphin.js run test "$1"
    fi
    ;;
    
  "run-all")
    echo "🧪 Running all tests..."
    if cd_user_project; then
      node node_modules/endorphin-ai/dist/bin/endorphin.js run test all
    fi
    ;;
    
  "run-smoke")
    echo "🧪 Running smoke tests..."
    if cd_user_project; then
      node node_modules/endorphin-ai/dist/bin/endorphin.js run test --tag smoke
    fi
    ;;
    
  "recorder")
    echo "🎬 Starting test recorder..."
    echo "💡 Test recorder will create files in: $USER_PROJECT_DIR/test-recorder/"
    if cd_user_project; then
      node node_modules/endorphin-ai/dist/bin/endorphin.js run test-recorder
    fi
    ;;
    
  "test-location")
    echo "🔍 Testing recorder file location..."
    "$SCRIPTS_DIR/recorder/test-recorder-location.sh"
    ;;
    
  "clean")
    echo "🧹 Cleaning up generated files..."
    if [ -d "$USER_PROJECT_DIR" ]; then
      cd "$USER_PROJECT_DIR"
      rm -rf test-recorder/ test-results/ 2>/dev/null || true
      echo "✅ Cleanup complete"
    else
      echo "❌ User project directory not found"
    fi
    ;;
    
  "status")
    echo "📊 Project Status"
    echo "================="
    show_paths
    echo ""
    if cd_user_project; then
      echo "📦 Package: $(npm list endorphin-ai --depth=0 2>/dev/null | grep endorphin-ai || echo 'Not installed')"
      echo ""
      echo "📁 Directory contents:"
      ls -la
      echo ""
      echo "🧪 Available tests:"
      node node_modules/endorphin-ai/dist/bin/endorphin.js list 2>/dev/null || echo "Unable to list tests"
      echo ""
      echo "📊 Generated artifacts:"
      echo "  test-recorder/: $([ -d test-recorder ] && echo "$(ls test-recorder | wc -l) recording(s)" || echo "None")"
      echo "  test-results/:  $([ -d test-results ] && echo "$(ls test-results | wc -l) result(s)" || echo "None")"
    fi
    ;;
    
  "env")
    echo "🔑 Environment Configuration"
    echo "============================"
    if cd_user_project; then
      if [ -f ".env" ]; then
        echo "📄 .env file found:"
        echo "  OPENAI_API_KEY: $(grep OPENAI_API_KEY .env | cut -d= -f2 | cut -c1-20)..."
        echo "  HEADLESS: $(grep HEADLESS .env | cut -d= -f2)"
        echo "  BASE_URL: $(grep BASE_URL .env | cut -d= -f2)"
      else
        echo "❌ No .env file found"
      fi
      echo ""
      if [ -f "endorphin.config.ts" ]; then
        echo "⚙️ Config file found: endorphin.config.ts"
      else
        echo "❌ No endorphin.config.ts found"
      fi
    fi
    ;;
    
  *)
    echo "❌ Unknown command: $COMMAND"
    echo "💡 Run without arguments to see available commands"
    exit 1
    ;;
esac

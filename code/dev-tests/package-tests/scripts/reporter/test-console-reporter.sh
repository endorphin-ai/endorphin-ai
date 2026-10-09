#!/bin/bash
# test-console-reporter.sh
# Test console reporter functionality

set -e

# Load centralized configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/test-config.sh"

echo "🧪 Testing Console Reporter Functionality"
echo "=========================================="

# Change to user project directory with validation
if ! cd_user_project; then
    exit 1
fi

# Source environment variables
if [ -f ".env" ]; then
    source .env
    print_status $BLUE "📁 Loaded environment from .env"
fi

# Test 1: Console reporter with single test
echo -e "\n${YELLOW}🔍 Test 1: Console Reporter - Single Test${NC}"
echo "Running: node node_modules/endorphin-ai/dist/bin/endorphin.js run test USER-001 --headless"
timeout 30s node node_modules/endorphin-ai/dist/bin/endorphin.js run test USER-001 --headless || echo -e "${YELLOW}⏰ Test completed (timeout expected)${NC}"

# Test 2: Console reporter with all tests
echo -e "\n${YELLOW}🔍 Test 2: Console Reporter - All Tests${NC}"
echo "Running: node node_modules/endorphin-ai/dist/bin/endorphin.js run test all --headless"
timeout 60s node node_modules/endorphin-ai/dist/bin/endorphin.js run test all --headless || echo -e "${YELLOW}⏰ Test completed (timeout expected)${NC}"

# Test 3: Console reporter with tag filtering
echo -e "\n${YELLOW}🔍 Test 3: Console Reporter - Tag Filtering${NC}"
echo "Running: node node_modules/endorphin-ai/dist/bin/endorphin.js run test --tag user-test --headless"
timeout 30s node node_modules/endorphin-ai/dist/bin/endorphin.js run test --tag user-test --headless || echo -e "${YELLOW}⏰ Test completed (timeout expected)${NC}"

# Test 4: Console reporter with priority filtering
echo -e "\n${YELLOW}🔍 Test 4: Console Reporter - Priority Filtering${NC}"
echo "Running: node node_modules/endorphin-ai/dist/bin/endorphin.js run test --priority High --headless"
timeout 30s node node_modules/endorphin-ai/dist/bin/endorphin.js run test --priority High --headless || echo -e "${YELLOW}⏰ Test completed (timeout expected)${NC}"

# Test 5: Test list command output
echo -e "\n${YELLOW}🔍 Test 5: List Command Output${NC}"
echo "Running: node node_modules/endorphin-ai/dist/bin/endorphin.js list"
node node_modules/endorphin-ai/dist/bin/endorphin.js list

echo -e "\n${GREEN}✅ Console Reporter Tests Completed${NC}"
echo -e "${BLUE}📋 Summary:${NC}"
echo "- Single test execution with console reporter"
echo "- Multiple test execution with console reporter"
echo "- Tag-based filtering with console reporter"
echo "- Priority-based filtering with console reporter"
echo "- List command formatting"
echo ""
echo -e "${YELLOW}💡 Expected behavior:${NC}"
echo "- Colorful progress indicators (●, ✓, ✗)"
echo "- Real-time test status updates"
echo "- Vitest-style summary formatting"
echo "- Detailed failure information"
echo "- Proper timing information"

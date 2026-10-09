#!/bin/bash

# Test Results Viewer - Endorphin AI
# Utility script to view and manage test results

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to list all sessions
list_sessions() {
    print_status $BLUE "📁 Test Sessions:"
    echo "=================="
    
    if [ ! -d "$RESULTS_DIR" ] || [ -z "$(ls -A "$RESULTS_DIR" 2>/dev/null | grep -E '^[0-9]')" ]; then
        print_status $YELLOW "No test sessions found."
        echo "Run './run-all-tests.sh' to create a test session."
        return
    fi
    
    echo ""
    printf "%-20s %-10s %-10s %-10s %-10s\n" "Session" "Tests" "Passed" "Failed" "Rate"
    echo "--------------------------------------------------------------------"
    
    for session_dir in "$RESULTS_DIR"/*/; do
        if [ -d "$session_dir" ]; then
            local session=$(basename "$session_dir")
            local info_file="$session_dir/session_info.txt"
            local csv_file="$session_dir/test_results.csv"
            
            if [ -f "$info_file" ] && [ -f "$csv_file" ]; then
                local total=$(grep -c "PASS\|FAIL" "$csv_file" 2>/dev/null || echo "0")
                local passed=$(grep -c "PASS" "$csv_file" 2>/dev/null || echo "0")
                local failed=$(grep -c "FAIL" "$csv_file" 2>/dev/null || echo "0")
                
                # Clean and validate numeric values
                total=$(echo "$total" | tr -d '\n\r' | grep -E '^[0-9]+$' || echo "0")
                passed=$(echo "$passed" | tr -d '\n\r' | grep -E '^[0-9]+$' || echo "0")
                failed=$(echo "$failed" | tr -d '\n\r' | grep -E '^[0-9]+$' || echo "0")
                
                local rate="0%"
                if [ "$total" -gt 0 ] 2>/dev/null; then
                    local calc_rate=$((passed * 100 / total)) 2>/dev/null || calc_rate=0
                    rate="${calc_rate}%"
                fi
                
                printf "%-20s %-10s %-10s %-10s %-10s\n" "$session" "$total" "$passed" "$failed" "$rate"
            fi
        fi
    done
    echo ""
}

# Function to show latest session summary
show_latest() {
    local latest_session=$(ls -t "$RESULTS_DIR" 2>/dev/null | head -n 1)
    
    if [ -z "$latest_session" ]; then
        print_status $YELLOW "No test sessions found."
        return
    fi
    
    local session_dir="$RESULTS_DIR/$latest_session"
    local info_file="$session_dir/session_info.txt"
    
    print_status $BLUE "📊 Latest Test Session: $latest_session"
    echo "==========================================="
    
    if [ -f "$info_file" ]; then
        cat "$info_file"
    else
        print_status $RED "Session info file not found."
    fi
    
    echo ""
    print_status $BLUE "📄 HTML Report:"
    echo "file://$session_dir/test_report.html"
}

# Function to show specific session
show_session() {
    local session="$1"
    local session_dir="$RESULTS_DIR/$session"
    
    if [ ! -d "$session_dir" ]; then
        print_status $RED "❌ Session not found: $session"
        return 1
    fi
    
    print_status $BLUE "📊 Test Session: $session"
    echo "=========================="
    
    local info_file="$session_dir/session_info.txt"
    local csv_file="$session_dir/test_results.csv"
    
    if [ -f "$info_file" ]; then
        cat "$info_file"
    fi
    
    echo ""
    print_status $BLUE "📋 Test Results:"
    
    if [ -f "$csv_file" ]; then
        echo ""
        printf "%-8s %-30s %-10s\n" "Result" "Test Name" "Duration"
        echo "------------------------------------------------"
        
        tail -n +2 "$csv_file" | while IFS=',' read -r result test_name duration log_file; do
            local color=$GREEN
            if [ "$result" = "FAIL" ]; then
                color=$RED
            fi
            printf "${color}%-8s${NC} %-30s %-10s\n" "$result" "$test_name" "${duration}s"
        done
    fi
    
    echo ""
    print_status $BLUE "📁 Session Directory:"
    echo "$session_dir"
    
    echo ""
    print_status $BLUE "📄 HTML Report:"
    echo "file://$session_dir/test_report.html"
}

# Function to open HTML report
open_report() {
    local session="$1"
    
    if [ -z "$session" ]; then
        # Use latest session
        session=$(ls -t "$RESULTS_DIR" 2>/dev/null | head -n 1)
    fi
    
    if [ -z "$session" ]; then
        print_status $RED "❌ No test sessions found."
        return 1
    fi
    
    local html_file="$RESULTS_DIR/$session/test_report.html"
    
    if [ ! -f "$html_file" ]; then
        print_status $RED "❌ HTML report not found for session: $session"
        return 1
    fi
    
    print_status $GREEN "🌐 Opening HTML report for session: $session"
    
    # Try different ways to open the file
    if command -v open &> /dev/null; then
        open "$html_file"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$html_file"
    elif command -v firefox &> /dev/null; then
        firefox "$html_file" &
    elif command -v chrome &> /dev/null; then
        chrome "$html_file" &
    else
        print_status $YELLOW "⚠️  Could not auto-open browser. Please open manually:"
        echo "file://$html_file"
    fi
}

# Function to clean old sessions
cleanup() {
    local days="${1:-7}"
    
    print_status $BLUE "🧹 Cleaning up sessions older than $days days..."
    
    local count=0
    find "$RESULTS_DIR" -name "2*" -type d -mtime +$days -print0 | while IFS= read -r -d '' dir; do
        local session=$(basename "$dir")
        print_status $YELLOW "Removing: $session"
        rm -rf "$dir"
        count=$((count + 1))
    done
    
    if [ $count -eq 0 ]; then
        print_status $GREEN "✅ No old sessions to clean up."
    else
        print_status $GREEN "✅ Cleaned up $count old sessions."
    fi
}

# Show help
show_help() {
    echo "Test Results Viewer - Endorphin AI"
    echo "=================================="
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  list                 List all test sessions"
    echo "  latest               Show latest session summary"
    echo "  show <session>       Show specific session details"
    echo "  open [session]       Open HTML report (latest if no session specified)"
    echo "  cleanup [days]       Remove sessions older than N days (default: 7)"
    echo "  help                 Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 latest"
    echo "  $0 show 20231215_143022"
    echo "  $0 open"
    echo "  $0 cleanup 14"
    echo ""
}

# Main command handling
case "${1:-list}" in
    list)
        list_sessions
        ;;
    latest)
        show_latest
        ;;
    show)
        if [ -z "$2" ]; then
            print_status $RED "❌ Please specify a session ID"
            echo "Use '$0 list' to see available sessions"
            exit 1
        fi
        show_session "$2"
        ;;
    open)
        open_report "$2"
        ;;
    cleanup)
        cleanup "$2"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_status $RED "❌ Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac

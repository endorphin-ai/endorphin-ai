#!/bin/bash

# Cleanup Test Results - Endorphin AI
# Utility to manage and clean up old test results

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"
TMP_DIR="$SCRIPT_DIR/tmp"

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

show_help() {
    echo "Test Results Cleanup - Endorphin AI"
    echo "==================================="
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --days <N>           Remove results older than N days (default: 7)"
    echo "  --keep <N>           Keep only the latest N sessions"
    echo "  --dry-run            Show what would be deleted without deleting"
    echo "  --all                Remove all test results and temp files"
    echo "  --temp-only          Remove only temp test environment"
    echo "  --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --days 14         # Remove results older than 14 days"
    echo "  $0 --keep 5          # Keep only latest 5 sessions"
    echo "  $0 --dry-run         # Preview what would be cleaned"
    echo "  $0 --temp-only       # Clean only test environment"
    echo ""
}

cleanup_by_days() {
    local days=${1:-7}
    local dry_run=${2:-false}
    
    print_status $BLUE "🧹 Cleaning test results older than $days days..."
    
    if [ ! -d "$RESULTS_DIR" ]; then
        print_status $YELLOW "No results directory found."
        return
    fi
    
    local count=0
    while IFS= read -r -d '' dir; do
        local session=$(basename "$dir")
        if [ "$dry_run" = "true" ]; then
            print_status $YELLOW "Would remove: $session"
        else
            print_status $YELLOW "Removing: $session"
            rm -rf "$dir"
        fi
        count=$((count + 1))
    done < <(find "$RESULTS_DIR" -name "2*" -type d -mtime +$days -print0)
    
    if [ $count -eq 0 ]; then
        print_status $GREEN "✅ No old sessions to clean up."
    else
        if [ "$dry_run" = "true" ]; then
            print_status $BLUE "Would clean up $count sessions."
        else
            print_status $GREEN "✅ Cleaned up $count sessions."
        fi
    fi
}

cleanup_by_keep() {
    local keep=${1:-5}
    local dry_run=${2:-false}
    
    print_status $BLUE "🧹 Keeping only the latest $keep test sessions..."
    
    if [ ! -d "$RESULTS_DIR" ]; then
        print_status $YELLOW "No results directory found."
        return
    fi
    
    local sessions=($(ls -t "$RESULTS_DIR" 2>/dev/null | grep -E '^[0-9]' | head -n $keep))
    local all_sessions=($(ls "$RESULTS_DIR" 2>/dev/null | grep -E '^[0-9]'))
    
    local count=0
    for session in "${all_sessions[@]}"; do
        local keep_session=false
        for keep_session_name in "${sessions[@]}"; do
            if [ "$session" = "$keep_session_name" ]; then
                keep_session=true
                break
            fi
        done
        
        if [ "$keep_session" = "false" ]; then
            if [ "$dry_run" = "true" ]; then
                print_status $YELLOW "Would remove: $session"
            else
                print_status $YELLOW "Removing: $session"
                rm -rf "$RESULTS_DIR/$session"
            fi
            count=$((count + 1))
        fi
    done
    
    if [ $count -eq 0 ]; then
        print_status $GREEN "✅ No sessions to clean up."
    else
        if [ "$dry_run" = "true" ]; then
            print_status $BLUE "Would clean up $count sessions."
        else
            print_status $GREEN "✅ Cleaned up $count sessions."
        fi
    fi
}

cleanup_temp_only() {
    local dry_run=${1:-false}
    
    print_status $BLUE "🧹 Cleaning test environment..."
    
    if [ -d "$TMP_DIR" ]; then
        if [ "$dry_run" = "true" ]; then
            print_status $YELLOW "Would remove: $TMP_DIR"
        else
            print_status $YELLOW "Removing: $TMP_DIR"
            rm -rf "$TMP_DIR"
            print_status $GREEN "✅ Test environment cleaned."
        fi
    else
        print_status $YELLOW "No test environment found."
    fi
}

cleanup_all() {
    local dry_run=${1:-false}
    
    print_status $BLUE "🧹 Cleaning all test data..."
    
    if [ "$dry_run" = "true" ]; then
        echo ""
        print_status $YELLOW "Would remove:"
        [ -d "$RESULTS_DIR" ] && echo "  - $RESULTS_DIR (all test results)"
        [ -d "$TMP_DIR" ] && echo "  - $TMP_DIR (test environment)"
        echo ""
        print_status $BLUE "Total cleanup preview completed."
    else
        local cleaned=false
        
        if [ -d "$RESULTS_DIR" ]; then
            print_status $YELLOW "Removing all test results..."
            rm -rf "$RESULTS_DIR"
            cleaned=true
        fi
        
        if [ -d "$TMP_DIR" ]; then
            print_status $YELLOW "Removing test environment..."
            rm -rf "$TMP_DIR"
            cleaned=true
        fi
        
        if [ "$cleaned" = "true" ]; then
            print_status $GREEN "✅ All test data cleaned."
        else
            print_status $YELLOW "No test data found to clean."
        fi
    fi
}

show_status() {
    print_status $BLUE "📊 Test Data Status"
    echo "==================="
    
    # Results directory
    if [ -d "$RESULTS_DIR" ]; then
        local session_count=$(ls "$RESULTS_DIR" 2>/dev/null | grep -E '^[0-9]' | wc -l)
        local total_size=$(du -sh "$RESULTS_DIR" 2>/dev/null | cut -f1)
        echo "Results: $session_count sessions ($total_size)"
        
        if [ $session_count -gt 0 ]; then
            echo "Latest: $(ls -t "$RESULTS_DIR" 2>/dev/null | grep -E '^[0-9]' | head -n 1)"
            echo "Oldest: $(ls -t "$RESULTS_DIR" 2>/dev/null | grep -E '^[0-9]' | tail -n 1)"
        fi
    else
        echo "Results: No results directory"
    fi
    
    # Temp directory
    if [ -d "$TMP_DIR" ]; then
        local temp_size=$(du -sh "$TMP_DIR" 2>/dev/null | cut -f1)
        echo "Temp Environment: Present ($temp_size)"
    else
        echo "Temp Environment: Not present"
    fi
    
    echo ""
}

# Main execution
case "${1:-status}" in
    --help|-h)
        show_help
        ;;
    --days)
        if [ -z "$2" ]; then
            print_status $RED "❌ Please specify number of days"
            echo "Usage: $0 --days <N>"
            exit 1
        fi
        dry_run=false
        [ "$3" = "--dry-run" ] && dry_run=true
        cleanup_by_days "$2" "$dry_run"
        ;;
    --keep)
        if [ -z "$2" ]; then
            print_status $RED "❌ Please specify number of sessions to keep"
            echo "Usage: $0 --keep <N>"
            exit 1
        fi
        dry_run=false
        [ "$3" = "--dry-run" ] && dry_run=true
        cleanup_by_keep "$2" "$dry_run"
        ;;
    --dry-run)
        cleanup_by_days 7 true
        ;;
    --all)
        dry_run=false
        [ "$2" = "--dry-run" ] && dry_run=true
        cleanup_all "$dry_run"
        ;;
    --temp-only)
        dry_run=false
        [ "$2" = "--dry-run" ] && dry_run=true
        cleanup_temp_only "$dry_run"
        ;;
    status|"")
        show_status
        ;;
    *)
        print_status $RED "❌ Unknown option: $1"
        echo ""
        show_help
        exit 1
        ;;
esac

#!/bin/bash

# Reddit Stocks Application - Stop Script
# This script will cleanly stop all Reddit Stocks application processes

echo "🛑 Reddit Stocks - Stop Application"
echo "===================================="

# Function to kill processes by pattern
kill_processes() {
    local pattern="$1"
    local description="$2"
    
    echo "🔍 Looking for $description processes..."
    pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        echo "📋 Found processes: $pids"
        echo "🛑 Killing $description processes..."
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        sleep 2
        
        # Force kill if still running
        still_running=$(pgrep -f "$pattern" 2>/dev/null || true)
        if [ -n "$still_running" ]; then
            echo "⚡ Force killing remaining processes..."
            echo "$still_running" | xargs kill -KILL 2>/dev/null || true
        fi
        echo "✅ $description processes stopped"
    else
        echo "ℹ️  No $description processes found"
    fi
}

# Function to kill processes by port
kill_port() {
    local port="$1"
    local description="$2"
    
    echo "🔍 Looking for processes on port $port ($description)..."
    pids=$(lsof -ti :$port 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        echo "📋 Found processes on port $port: $pids"
        echo "🛑 Killing processes on port $port..."
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        sleep 2
        
        # Force kill if still running
        still_running=$(lsof -ti :$port 2>/dev/null || true)
        if [ -n "$still_running" ]; then
            echo "⚡ Force killing remaining processes on port $port..."
            echo "$still_running" | xargs kill -KILL 2>/dev/null || true
        fi
        echo "✅ Port $port freed"
    else
        echo "ℹ️  No processes found on port $port"
    fi
}

# Kill Reddit Stocks specific processes
kill_processes "Reddit_Stocks.*server.js" "Reddit Stocks backend"
kill_processes "Reddit_Stocks.*react-scripts" "Reddit Stocks frontend"
kill_processes "Reddit_Stocks.*npm" "Reddit Stocks npm"

# Kill processes by port
kill_port 5000 "backend API"
kill_port 3000 "frontend dev server"

echo ""
echo "✅ Reddit Stocks application stopped!"
echo ""
echo "🚀 To start the application again, run:"
echo "   ./kill_and_start.sh"

#!/bin/bash

# Reddit Stocks Application - Kill and Start Script
# This script will cleanly stop all related processes and start the application fresh

set -e  # Exit on any error

echo "🔄 Reddit Stocks - Kill and Start Script"
echo "========================================"

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

echo ""
echo "🛑 STOPPING ALL RELATED PROCESSES"
echo "=================================="

# Kill Reddit Stocks specific processes
kill_processes "Reddit_Stocks.*server.js" "Reddit Stocks backend"
kill_processes "Reddit_Stocks.*react-scripts" "Reddit Stocks frontend"
kill_processes "Reddit_Stocks.*npm" "Reddit Stocks npm"

# Kill processes by port
kill_port 5000 "backend API"
kill_port 3000 "frontend dev server"

# Kill any other React/Node processes that might conflict
kill_processes "react-scripts.*start" "React development servers"
kill_processes "node.*server.js" "Node.js servers"

# Wait a moment for cleanup
echo ""
echo "⏳ Waiting for cleanup..."
sleep 3

echo ""
echo "🚀 STARTING REDDIT STOCKS APPLICATION"
echo "====================================="

# Change to application directory
cd "/Users/mattroszak/Dropbox/Reddit_Stocks"

# Verify MongoDB is running
echo "🔍 Checking MongoDB status..."
if pgrep -f mongod > /dev/null; then
    echo "✅ MongoDB is running"
else
    echo "❌ MongoDB is not running. Please start MongoDB first."
    echo "   You can start it with: brew services start mongodb-community"
    exit 1
fi

# Start backend server in background
echo ""
echo "🚀 Starting backend server..."
nohup npm start > backend.log 2>&1 &
BACKEND_PID=$!
echo "📝 Backend PID: $BACKEND_PID"

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
sleep 10

# Check if backend is responding
echo "🔍 Testing backend health..."
for i in {1..30}; do
    if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
        echo "✅ Backend is responding"
        break
    else
        if [ $i -eq 30 ]; then
            echo "❌ Backend failed to start after 30 attempts"
            echo "📋 Backend log:"
            tail -20 backend.log
            exit 1
        fi
        echo "⏳ Attempt $i/30 - waiting for backend..."
        sleep 2
    fi
done

# Start frontend server in background
echo ""
echo "🚀 Starting frontend server..."
nohup npm run client > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "📝 Frontend PID: $FRONTEND_PID"

# Wait for frontend to start
echo "⏳ Waiting for frontend to initialize..."
sleep 15

# Check if frontend is responding
echo "🔍 Testing frontend availability..."
for i in {1..30}; do
    if curl -s -I http://localhost:3000 > /dev/null 2>&1; then
        echo "✅ Frontend is responding"
        break
    else
        if [ $i -eq 30 ]; then
            echo "❌ Frontend failed to start after 30 attempts"
            echo "📋 Frontend log:"
            tail -20 frontend.log
            exit 1
        fi
        echo "⏳ Attempt $i/30 - waiting for frontend..."
        sleep 2
    fi
done

echo ""
echo "🎉 SUCCESS! Reddit Stocks Application Started"
echo "============================================="
echo "📊 Application Status:"
echo "   • Backend:  http://localhost:5000 (PID: $BACKEND_PID)"
echo "   • Frontend: http://localhost:3000 (PID: $FRONTEND_PID)"
echo ""
echo "📋 Quick Links:"
echo "   • Application:     http://localhost:3000"
echo "   • Health Check:    http://localhost:5000/api/health"
echo "   • API Docs:        http://localhost:5000/api/"
echo ""
echo "📝 Logs:"
echo "   • Backend:  tail -f backend.log"
echo "   • Frontend: tail -f frontend.log"
echo ""
echo "🛑 To stop the application:"
echo "   • Kill backend:  kill $BACKEND_PID"
echo "   • Kill frontend: kill $FRONTEND_PID"
echo "   • Or run this script again to restart"
echo ""
echo "✅ Application is ready for use!"

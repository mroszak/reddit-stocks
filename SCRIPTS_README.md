# Reddit Stocks Application Scripts

This document describes the available scripts for managing the Reddit Stocks Sentiment Tracker application.

## 🚀 Quick Start Scripts

### Start/Restart Application
```bash
# Option 1: Direct script execution
./kill_and_start.sh

# Option 2: Via npm
npm run restart
# or
npm run kill-and-start
```

This script will:
- ✅ Kill all existing Reddit Stocks processes
- ✅ Clean up ports 3000 and 5000
- ✅ Start backend server (port 5000)
- ✅ Start frontend server (port 3000)
- ✅ Verify both services are responding
- ✅ Provide status and useful links

### Stop Application
```bash
# Option 1: Direct script execution
./stop_app.sh

# Option 2: Via npm
npm run stop
```

This script will:
- ✅ Gracefully stop all Reddit Stocks processes
- ✅ Free up ports 3000 and 5000
- ✅ Clean shutdown

## 📋 Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `kill_and_start.sh` | `./kill_and_start.sh` or `npm run restart` | Complete restart of the application |
| `stop_app.sh` | `./stop_app.sh` or `npm run stop` | Stop the application |
| `server.js` | `npm start` | Start backend only |
| `client` | `npm run client` | Start frontend only |
| `startup.js` | `npm run init` | Initialize database and setup |

## 🔧 Manual Process Management

If you need to manually manage processes:

### Check Running Processes
```bash
# Check processes on ports
lsof -i :5000  # Backend
lsof -i :3000  # Frontend

# Check Reddit Stocks processes
ps aux | grep -E "(Reddit_Stocks|react-scripts|server.js)" | grep -v grep
```

### Kill Specific Processes
```bash
# Kill by port
kill $(lsof -ti :5000)  # Backend
kill $(lsof -ti :3000)  # Frontend

# Kill by process name
pkill -f "Reddit_Stocks.*server.js"
pkill -f "Reddit_Stocks.*react-scripts"
```

## 📊 Application URLs

Once started, the application will be available at:

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | Main application interface |
| **Backend API** | http://localhost:5000 | API server |
| **Health Check** | http://localhost:5000/api/health | System status |
| **API Docs** | http://localhost:5000/api/ | API documentation |
| **Monitoring** | http://localhost:5000/api/subreddits/monitoring/dashboard | Monitoring dashboard |

## 🐛 Troubleshooting

### Port Already in Use
If you get "EADDRINUSE" errors:
```bash
# Use the kill and start script to clean everything
./kill_and_start.sh
```

### Backend Won't Start
1. Check MongoDB is running: `brew services list | grep mongodb`
2. Start MongoDB if needed: `brew services start mongodb-community`
3. Check logs: `tail -f backend.log`

### Frontend Won't Start
1. Check if port 3000 is free: `lsof -i :3000`
2. Check logs: `tail -f frontend.log`
3. Try restarting: `./kill_and_start.sh`

### Process Cleanup
If processes become unresponsive:
```bash
# Nuclear option - kill all node processes (use with caution)
pkill -f node

# Then restart
./kill_and_start.sh
```

## 📝 Log Files

The scripts create log files for debugging:
- `backend.log` - Backend server output
- `frontend.log` - Frontend development server output

View logs in real-time:
```bash
tail -f backend.log
tail -f frontend.log
```

## ⚙️ Environment Requirements

- **Node.js** (v16+)
- **MongoDB** (running locally or connection string in .env)
- **npm** (for package management)
- **bash** (for script execution)

## 🔒 Security Note

These scripts are designed for development use. For production deployment, use proper process managers like PM2 or Docker containers.

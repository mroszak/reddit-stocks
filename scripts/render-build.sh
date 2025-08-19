#!/bin/bash

echo "🚀 Starting Render build process..."
echo "===================================="

# Install server dependencies
echo "📦 Installing server dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install server dependencies"
    exit 1
fi

# Build React client
echo ""
echo "🔨 Building React client..."
cd client

# Install client dependencies
echo "📦 Installing client dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install client dependencies"
    exit 1
fi

# Build the React app
echo "🏗️  Creating production build..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Failed to build React client"
    exit 1
fi

# Return to root directory
cd ..

echo ""
echo "✅ Build completed successfully!"
echo "📁 Client build directory created at: client/build"
echo "===================================="

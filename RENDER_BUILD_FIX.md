# Render Build Configuration Fix

## Issue
The Render deployment is not building the React client, causing the error:
```
❌ Client build directory does not exist: /opt/render/project/src/client/build
```

## Solution

### Option 1: Update Build Command in Render Dashboard (Recommended)

1. Go to your Render dashboard: https://dashboard.render.com
2. Select your `reddit-stocks-tracker` service
3. Go to Settings → Build & Deploy
4. Update the "Build Command" to:
   ```bash
   npm install && cd client && npm install && npm run build && cd ..
   ```
5. Click "Save Changes"
6. Trigger a manual deploy or push a commit to trigger automatic deployment

### Option 2: Force Render to Use render.yaml Configuration

1. Delete the current service in Render
2. Create a new service using the updated render.yaml:
   ```bash
   git add render.yaml
   git commit -m "Fix Render build command to include React client build"
   git push origin main
   ```
3. In Render dashboard, create new Web Service from GitHub repo
4. Select "Use render.yaml" option during setup

### Option 3: Use Build Script

Create a dedicated build script:

1. Create `scripts/render-build.sh`:
   ```bash
   #!/bin/bash
   echo "Installing server dependencies..."
   npm install

   echo "Building React client..."
   cd client
   npm install
   npm run build
   cd ..

   echo "Build complete!"
   ```

2. Make it executable:
   ```bash
   chmod +x scripts/render-build.sh
   ```

3. Update render.yaml:
   ```yaml
   buildCommand: ./scripts/render-build.sh
   ```

## Verification

After deployment, check:
1. Build logs should show React build output
2. No errors about missing client/build directory
3. The app should be accessible at your Render URL

## Additional Notes

- The build process needs to install dependencies for both server and client
- The React build creates the `client/build` directory with static files
- The server serves these static files for the frontend

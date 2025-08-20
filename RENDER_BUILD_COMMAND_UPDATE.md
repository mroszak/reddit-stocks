# Render Build Command Manual Update

## Important: Dashboard Settings Override

Your Render deployment is using build settings from the dashboard that override the `render.yaml` file. You need to update the build command manually in the Render dashboard.

## Steps to Fix:

1. **Go to your Render Dashboard**
   - Visit https://dashboard.render.com
   - Navigate to your "reddit-stocks-tracker" service

2. **Update Build Command**
   - Click on "Settings" tab
   - Find the "Build Command" field
   - Change it from: `npm install`
   - To: `npm run render-postbuild`
   
   Or alternatively use: `npm install && cd client && npm install && npm run build`

3. **Save and Deploy**
   - Click "Save Changes"
   - This will trigger a new deployment automatically

## What This Does:

The new build command will:
1. Install server dependencies
2. Navigate to the client directory
3. Install client dependencies
4. Build the React application
5. Create the `client/build` directory that your app needs

## Verification:

After the deployment completes, you should see:
- No more "Client build directory does not exist" errors
- Your app URL (https://reddit-stocks.onrender.com) will show the React frontend
- The API will still be available at the `/api` endpoints

## Alternative: Use render.yaml

If you prefer to use the `render.yaml` file for configuration:
1. In the Render dashboard, go to Settings
2. Find "Build Command" and clear/delete any value there
3. Save changes
4. Render will then use the build command from your `render.yaml` file

## Note:
Dashboard settings always override `render.yaml` settings when both are present.

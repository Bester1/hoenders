# Gmail Email Setup Guide for Plaas Hoenders

## 📧 Complete Setup Instructions

### Prerequisites
- A Gmail account
- Access to Google Cloud Console

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a project"** → **"New Project"**
3. Project name: `Plaas Hoenders Email`
4. Click **"Create"**

### Step 2: Enable Gmail API

1. In the dashboard, click **"Enable APIs and Services"**
2. Search for **"Gmail API"**
3. Click on it and press **"ENABLE"**

### Step 3: Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Choose **"External"** and click **"CREATE"**
3. Fill in the required fields:
   - App name: `Plaas Hoenders`
   - User support email: `your-email@gmail.com`
   - Developer contact: `your-email@gmail.com`
4. Click **"SAVE AND CONTINUE"**
5. Skip scopes (click **"SAVE AND CONTINUE"**)
6. Add test users:
   - Add your Gmail address
   - Add any other emails that will use the app
7. Click **"SAVE AND CONTINUE"** then **"BACK TO DASHBOARD"**

### Step 4: Create OAuth 2.0 Client ID

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Application type: **"Web application"**
4. Name: `Plaas Hoenders Web Client`
5. Authorized JavaScript origins - Add ALL of these:
   ```
   http://localhost
   http://localhost:8000
   http://localhost:3000
   http://127.0.0.1
   http://127.0.0.1:8000
   https://bester1.github.io
   ```
6. Authorized redirect URIs - Add ALL of these:
   ```
   http://localhost
   http://localhost:8000
   http://localhost:3000
   http://127.0.0.1
   http://127.0.0.1:8000
   https://bester1.github.io/hoenders
   ```
7. Click **"CREATE"**
8. **COPY AND SAVE** your Client ID (looks like: `123456789012-abcdefghijklmnop.apps.googleusercontent.com`)

### Step 5: Create API Key

1. Click **"+ CREATE CREDENTIALS"** → **"API key"**
2. **COPY THE API KEY IMMEDIATELY**
3. Click **"Restrict Key"**
4. Name: `Plaas Hoenders API Key`
5. Under "API restrictions":
   - Select **"Restrict key"**
   - Choose **"Gmail API"**
6. Click **"SAVE"**

### Step 6: Update Your Application

1. Open `/Users/user/Documents/Cursor/Hoender/script.js`
2. Find these lines (around line 74-75):
   ```javascript
   const GMAIL_API_KEY = 'YOUR_API_KEY_HERE';
   const GMAIL_CLIENT_ID = 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com';
   ```
3. Replace with your actual values:
   ```javascript
   const GMAIL_API_KEY = 'AIzaSyC-YOUR-ACTUAL-API-KEY';
   const GMAIL_CLIENT_ID = '123456789012-abcdefghijklmnop.apps.googleusercontent.com';
   ```

### Step 7: Testing Email Functionality

1. Open your Plaas Hoenders app
2. Go to **Email Center** in the sidebar
3. Click **"Connect Gmail"**
4. Sign in with your Gmail account
5. Allow permissions when prompted
6. Send a test email to verify it works

### Common Issues & Solutions

#### "Redirect URI mismatch" error
- Make sure you added ALL the URLs from Step 4 exactly as shown
- Check for trailing slashes - they matter!

#### "API key not valid" error
- Ensure you restricted the key to Gmail API only
- Check that you copied the key correctly

#### "Unauthorized client" error
- Wait 5-10 minutes after creating credentials (Google needs time to propagate)
- Ensure your email is added as a test user in OAuth consent screen

#### Gmail button doesn't work
- Check browser console for errors (F12)
- Ensure you're using HTTPS if on GitHub Pages
- Try clearing browser cache and cookies

### Security Notes

⚠️ **IMPORTANT**: Never share or commit your API keys and Client ID to public repositories!

Consider using environment variables or a separate config file that's gitignored.

### Need Help?

If you encounter issues:
1. Check the browser console for specific error messages
2. Verify all URLs in authorized origins match exactly
3. Ensure your Gmail account has 2-factor authentication enabled
4. Try in an incognito/private browser window

---

Last updated: January 2025
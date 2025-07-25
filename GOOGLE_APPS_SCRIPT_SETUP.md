# Google Apps Script Email Setup (MUCH EASIER!)

This is a **MUCH SIMPLER** alternative to the Gmail API setup. No OAuth, no API keys, just deploy and use!

## 🚀 Setup Steps (5 minutes)

### Step 1: Create the Apps Script Project

1. Go to [Google Apps Script](https://script.google.com)
2. Click **"New Project"**
3. Name it: `Plaas Hoenders Email Service`

### Step 2: Copy the Code

1. Delete all existing code in the editor
2. Copy ALL the code from `GoogleAppsScript.gs` file
3. Paste it into the Apps Script editor
4. Click **"Save"** (💾 icon)

### Step 3: Deploy as Web App

1. Click **"Deploy"** → **"New Deployment"**
2. Click the gear icon ⚙️ → **"Web app"**
3. Fill in:
   - Description: `Plaas Hoenders Email Service v1`
   - Execute as: **"Me"** (your email)
   - Who has access: **"Anyone"**
4. Click **"Deploy"**
5. **COPY THE WEB APP URL** (looks like: `https://script.google.com/macros/s/AKfycbw.../exec`)
   
   ⚠️ **SAVE THIS URL - YOU NEED IT!**

### Step 4: Authorize the Script

1. You'll see an "Authorization required" dialog
2. Click **"Authorize"**
3. Choose your Google account
4. Click **"Advanced"** → **"Go to Plaas Hoenders Email Service (unsafe)"**
5. Click **"Allow"**

### Step 5: Update Your Application

Replace the Gmail API code in your `script.js` with this simpler version:

```javascript
// Google Apps Script Email Service URL
const GOOGLE_SCRIPT_URL = 'YOUR_WEB_APP_URL_HERE'; // Paste your Web App URL here

// Simple email sending function
async function sendEmailViaGoogleScript(to, subject, body, attachments = []) {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to: to,
                subject: subject,
                body: body,
                fromName: 'Plaas Hoenders',
                attachments: attachments
            })
        });

        const result = await response.json();
        
        if (result.status === 'success') {
            console.log('Email sent successfully');
            return true;
        } else {
            console.error('Email failed:', result.message);
            return false;
        }
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}
```

## 📧 How to Use in Your App

Instead of complex Gmail API calls, just use:

```javascript
// Send a simple email
await sendEmailViaGoogleScript(
    'customer@example.com',
    'Invoice for your Plaas Hoenders order',
    '<h2>Invoice</h2><p>Thank you for your order!</p>'
);

// Send with attachment (base64 encoded)
await sendEmailViaGoogleScript(
    'customer@example.com',
    'Invoice #12345',
    '<h2>Invoice</h2><p>Please find your invoice attached.</p>',
    [{
        filename: 'invoice.pdf',
        mimeType: 'application/pdf',
        data: 'base64_encoded_pdf_data_here'
    }]
);
```

## ✅ Advantages Over Gmail API

1. **No API Keys needed** - Uses your Google account directly
2. **No OAuth dance** - Just authorize once during deployment
3. **No client-side authentication** - Works from anywhere
4. **Free** - Uses your Gmail sending limits (500/day for personal, 2000/day for Workspace)
5. **Simple** - Just POST to a URL

## 🔒 Security

- Only your Google account can send emails
- The web app URL acts as your "API key"
- Keep the URL private (don't commit to public repos)
- You can redeploy anytime to get a new URL

## 🧪 Testing

1. In Apps Script editor, click **"Run"** → **"sendTestEmail"**
2. Check your email - you should receive a test message
3. Check the logs: **"View"** → **"Logs"**

## 🛠️ Troubleshooting

### "Unauthorized" error
- Make sure "Who has access" is set to "Anyone"
- Try redeploying with a new version

### Emails not sending
- Check the Apps Script logs for errors
- Verify you're under Gmail sending limits
- Make sure recipient email is valid

### CORS errors from web applications
- If you get CORS errors when calling from a website (like GitHub Pages)
- Make sure you're using the latest version of GoogleAppsScript.gs (v1.1+) which includes CORS headers
- You need to redeploy the script after updating:
  1. Go to your Apps Script project
  2. Click "Deploy" → "Manage deployments"
  3. Click the pencil icon ✏️ next to your deployment
  4. Change "Version" to "New version"
  5. Click "Deploy"
  6. You'll get a new URL - update GOOGLE_SCRIPT_URL in your script.js

## 📊 Monitoring

View your email quota and logs:
1. Go to [Google Apps Script](https://script.google.com)
2. Open your project
3. Click **"View"** → **"Executions"** to see all emails sent

---

This is MUCH easier than Gmail API and perfect for your Plaas Hoenders app! 🐔
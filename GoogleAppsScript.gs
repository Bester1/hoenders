// Google Apps Script for Plaas Hoenders Email Service
// Deploy as a Web App (Execute as: me, Who has access: Anyone).
//
// SECURITY (2026-09-27): until this version the web app sent any email anyone
// POSTed to it -- any recipient, any HTML, any attachment -- from the owner's
// Gmail, with no check at all. The /exec URL is in the public repo, so it was
// an open relay for phishing from a real address.
//
// Now every send needs `access_token`: a Supabase session token, checked
// against Supabase itself. The admin may send anything; any other signed-in
// user (a customer) may only send to their own address, with no cc/bcc.
//
// Redeploy with Manage deployments -> Edit -> New version, NOT a new
// deployment: a new deployment mints a new /exec URL the site does not use.

const SUPABASE_URL = 'https://ukdmlzuxgnjucwidsygj.supabase.co';
// Public anon key -- the same one in the site's JS; it only identifies the project.
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrZG1senV4Z25qdWN3aWRzeWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTAyNDcsImV4cCI6MjA2ODk2NjI0N30.sMTJlWST6YvV--ZJaAc8x9WYz_m9c-CPpBlNvuiBw3w';
// Same id as public.is_admin() in supabase/migrations/20260927000000_lock_down_rls.sql
const ADMIN_USER_IDS = ['ac60e2ad-9883-4ab9-8cc0-3c98050b5ef2'];

function json_(obj) {
  // ContentService has no setHeaders(): calling it threw AFTER MailApp had
  // already sent, so every send "failed" while the mail went out.
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Returns the Supabase user for a session token, or null.
function supabaseUser_(token) {
  if (!token) return null;
  const res = UrlFetchApp.fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) return null;
  return JSON.parse(res.getContentText());
}

function doPost(e) {
  try {
    let data;
    if (e.postData && e.postData.type === 'application/json') {
      data = JSON.parse(e.postData.contents);
    } else {
      data = e.parameter || {};
      if (data.attachments && typeof data.attachments === 'string') {
        try {
          data.attachments = JSON.parse(data.attachments);
        } catch (parseError) {
          data.attachments = [];
        }
      }
    }

    if (!data.to || !data.subject || !data.body) {
      return json_({ status: 'error', message: 'Missing required fields: to, subject, body' });
    }

    const user = supabaseUser_(data.access_token);
    if (!user || !user.id) {
      return json_({ status: 'error', message: 'Not signed in' });
    }
    const isAdmin = ADMIN_USER_IDS.indexOf(user.id) !== -1;
    if (!isAdmin) {
      const own = String(user.email || '').trim().toLowerCase();
      const to = String(data.to).trim().toLowerCase();
      if (!own || to !== own || data.cc || data.bcc) {
        return json_({ status: 'error', message: 'Customers may only email themselves' });
      }
    }

    const emailOptions = {
      to: data.to,
      subject: data.subject,
      htmlBody: data.body,
      name: data.fromName || 'Plaas Hoenders'
    };
    if (isAdmin && data.cc) emailOptions.cc = data.cc;
    if (isAdmin && data.bcc) emailOptions.bcc = data.bcc;
    if (data.attachments && data.attachments.length > 0) {
      emailOptions.attachments = data.attachments.map(att =>
        Utilities.newBlob(Utilities.base64Decode(att.data), att.mimeType, att.filename));
    }

    MailApp.sendEmail(emailOptions);
    console.log('Email sent by', isAdmin ? 'admin' : 'customer', user.id, 'to', data.to);

    return json_({ status: 'success', message: 'Email sent successfully', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error sending email:', error);
    return json_({ status: 'error', message: error.toString() });
  }
}

function doGet(e) {
  return json_({ status: 'ready', message: 'Plaas Hoenders Email Service is running', version: '2.0-auth' });
}

// Run this ONCE from the editor (select `authorize`, click Run) after pasting
// this version: UrlFetchApp needs the "connect to an external service"
// permission, and a web app running as you cannot ask for it itself. Until it
// is granted, every send fails -- so run it BEFORE deploying the new version.
function authorize() {
  const res = UrlFetchApp.fetch(SUPABASE_URL + '/auth/v1/health', {
    headers: { apikey: SUPABASE_ANON_KEY }, muteHttpExceptions: true
  });
  console.log('Supabase reachable: HTTP ' + res.getResponseCode());
}

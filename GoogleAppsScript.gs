// Google Apps Script for Plaas Hoenders Email Service
// Deploy this as a Web App to handle email sending

function doPost(e) {
  try {
    // Parse the incoming request
    const data = JSON.parse(e.postData.contents);
    
    // Validate required fields
    if (!data.to || !data.subject || !data.body) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Missing required fields: to, subject, body'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Prepare email options
    const emailOptions = {
      to: data.to,
      subject: data.subject,
      htmlBody: data.body,
      name: data.fromName || 'Plaas Hoenders'
    };
    
    // Add CC if provided
    if (data.cc) {
      emailOptions.cc = data.cc;
    }
    
    // Add BCC if provided
    if (data.bcc) {
      emailOptions.bcc = data.bcc;
    }
    
    // Add attachments if provided (as base64 strings)
    if (data.attachments && data.attachments.length > 0) {
      emailOptions.attachments = data.attachments.map(att => {
        return Utilities.newBlob(
          Utilities.base64Decode(att.data), 
          att.mimeType, 
          att.filename
        );
      });
    }
    
    // Send the email
    MailApp.sendEmail(emailOptions);
    
    // Log for tracking
    console.log('Email sent to:', data.to, 'Subject:', data.subject);
    
    // Return success response
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Email sent successfully',
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // Return error response
    console.error('Error sending email:', error);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Test function to verify the script is working
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ready',
    message: 'Plaas Hoenders Email Service is running',
    version: '1.0'
  })).setMimeType(ContentService.MimeType.JSON);
}

// Function to send test email (for testing in Apps Script editor)
function sendTestEmail() {
  const testData = {
    to: Session.getActiveUser().getEmail(),
    subject: 'Test Email from Plaas Hoenders',
    body: '<h2>Test Email</h2><p>This is a test email from your Plaas Hoenders email service.</p>',
    fromName: 'Plaas Hoenders System'
  };
  
  const result = doPost({
    postData: {
      contents: JSON.stringify(testData)
    }
  });
  
  console.log(result.getContent());
}
# 🐔 Gro Chicken Orders - Admin Dashboard

A comprehensive web-based admin panel for managing chicken meat orders, generating invoices, and sending automated emails to customers.

## Features

### 📊 Dashboard
- Real-time statistics (total orders, revenue, emails sent, pending orders)
- Recent activity feed
- Quick action buttons
- Comprehensive overview of business operations

### 📦 Order Management
- Import orders from Google Sheets (CSV format)
- Process multiple orders simultaneously
- Track order status (pending, invoiced, completed)
- Customer information management
- Automatic pricing calculations

### 📧 Email Integration
- Gmail API integration for sending emails
- Customizable email templates
- Bulk email sending with queue management
- Email status tracking (pending, sent, failed)
- Retry failed emails

### 🧾 Invoice Generation
- Automatic invoice creation from orders
- Professional invoice templates
- PDF generation (coming soon)
- Invoice preview and download
- VAT calculations (15%)

### 💰 Pricing Management
- Hardcoded pricing for different chicken products
- Cost price vs selling price tracking
- Profit margin calculations
- Easy product management (add, edit, delete)

### ⚙️ Settings
- Business information configuration
- Banking details for invoices
- Gmail configuration
- Email template customization

## Setup Instructions

### 1. Gmail API Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Gmail API
4. Create credentials (OAuth 2.0 Client ID)
5. Add your domain to authorized origins
6. Update the `GMAIL_API_KEY` and `GMAIL_CLIENT_ID` in `script.js`

### 2. GitHub Pages Deployment
1. Push this code to a GitHub repository
2. Go to repository Settings > Pages
3. Select "GitHub Actions" as the source
4. The site will automatically deploy on every push to main branch

### 3. Google Sheets Integration
Export your Google Sheets data as CSV with these headers:
- Name
- Email  
- Phone
- Product
- Quantity
- Special Instructions

## Usage

### Processing Orders
1. Copy data from your Google Sheets
2. Paste into the "Import Orders" textarea
3. Click "Process Orders"
4. Review imported orders in the Orders section

### Sending Emails
1. Connect your Gmail account in the Email Center
2. Configure your email templates
3. Generate invoices for orders (automatically adds to email queue)
4. Send individual emails or bulk send all queued emails

### Managing Pricing
1. Go to Pricing section
2. View current product pricing and margins
3. Add new products or edit existing ones
4. All pricing is automatically applied to new orders

## Default Products & Pricing
- Whole Chicken: R85 cost → R120 selling (35% margin)
- Chicken Pieces: R95 cost → R140 selling (45% margin)  
- Chicken Breasts: R180 cost → R250 selling (70% margin)
- Chicken Thighs: R120 cost → R180 selling (60% margin)
- Free Range Chicken: R150 cost → R220 selling (70% margin)

## Data Storage
All data is stored locally in your browser using localStorage:
- Orders and customer information
- Generated invoices
- Email queue and status
- Pricing information
- Settings and configuration

## Security Notes
- Gmail credentials are stored locally only
- No sensitive data is transmitted to external servers
- Use HTTPS when deployed for secure Gmail integration
- Regularly export your data as backup

## Browser Compatibility
- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

## Support
For issues or questions, please check the GitHub repository issues section.

---

Made with ❤️ for small business automation
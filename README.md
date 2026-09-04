# 🐔 Plaas Hoenders Orders - Admin Dashboard

A comprehensive web-based admin panel for managing chicken meat orders, generating invoices, and sending automated emails to customers.

## Features

### 📊 Dashboard
- Real-time statistics (total orders, revenue, emails sent, pending orders)
- Recent activity feed
- Quick action buttons
- Comprehensive overview of business operations

### 📦 Order Management
- Import orders from Google Sheets (CSV format)
- Import the monthly butchery invoice PDF (see below)
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

### 🧾 Butchery invoice import (the monthly round)

Nieuwoudt's invoice PDF is imported, matched to customers, and turned into the
customer invoices. **Read `AGENTS.md` before touching this path** — a wrong
invoice looks exactly like a right one, and every failure here has been silent.

- The supplier PDF has **no text layer**: it is a "Microsoft Print to PDF" of a
  Xero invoice, so every character is a separate image (~1,000 a page, 600 PPI).
  Pages are rendered at **300 DPI** (`scale: 4.17`) before OCR — a clean 2:1
  downsample of those tiles. **Re-measure before changing it**: 252 DPI scored
  *worse* than 144.
- Four guards, in the order they catch things:
  1. every row must satisfy `weight x price = total`;
  2. lost decimal points are repaired at /100 and /10, but **only** when the
     repair makes that equation true to the cent;
  3. the page must reconcile against the butchery's own stated total, and a page
     whose total cannot be read is reported `unverified`, never "clean";
  4. `packWeightAnomaly()` checks kg-per-pack against `PACK_WEIGHTS` — the only
     check that still works when the page total is unreadable.
- `node scripts/validate-invoicing.cjs` asserts all of it stays wired in;
  `node test_parsing.js` carries real damaged lines as regression cases.

**The better input, when it arrives:** every page of the supplier PDF carries a
QR code to its Xero online invoice, which offers the same invoice as a proper
PDF *and* as CSV — both exact, no OCR. Nieuwoudt has been asked to send the CSV
export instead. In their data `Reference` is the customer, `Description` is the
number of packs, and `Quantity` is the kilograms.

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
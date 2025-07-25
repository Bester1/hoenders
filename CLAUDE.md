# Plaas Hoenders Admin Dashboard

## Project Overview
A comprehensive admin dashboard for managing Plaas Hoenders chicken orders, invoicing, and email communications. The application has been simplified to use Google Apps Script for email functionality, removing the complex Gmail API integration.

## Recent Major Changes (July 2025)

### Email Service Simplification
- **Removed Gmail API Integration**: Eliminated all Gmail API code, OAuth flows, and complex authentication
- **Google Apps Script Only**: Streamlined to use only Google Apps Script for email sending
- **UI Cleanup**: Updated Email Center to show clean Google Apps Script configuration instead of Gmail login forms
- **Code Reduction**: Removed ~128 lines of Gmail API code, significantly simplifying the codebase

### Invoice Format Improvements
- **Added Weight Column**: Updated invoice structure to include proper Weight (KG) column like farm butchery invoices
- **Common Butchery Mistakes**: System now detects and handles common invoice errors:
  - Item/Description field swapping
  - Quantity showing weight instead of actual count
  - Missing weight column in invoice layout
- **Weight Estimation**: Automatic weight calculation based on product types when not provided

## Key Features
- **Order Management**: Import and process orders from CSV files or manual input
- **Invoice Generation**: Create PDF invoices with business branding
- **Email Integration**: Send invoices via Google Apps Script (no Gmail API complexity)
- **Pricing Management**: Maintain product pricing with cost/selling price tracking
- **AI PDF Analysis**: Analyze butchery invoices for pricing accuracy
- **Data Management**: Supabase integration with local backup/restore capabilities

## Email Configuration
The application uses Google Apps Script for email functionality:
- No OAuth or API keys required
- Simple HTTP POST to Google Apps Script web app
- Configuration guide available in `GOOGLE_APPS_SCRIPT_SETUP.md`
- Email status shows "Google Apps Script Ready" when configured

## Technical Stack
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Database**: Supabase (with localStorage fallback)
- **Email**: Google Apps Script
- **Hosting**: Can be served from any static web server

## File Structure
- `index.html` - Main admin dashboard interface
- `script.js` - Core application logic and functionality
- `styles.css` - Complete styling for the admin interface
- `GOOGLE_APPS_SCRIPT_SETUP.md` - Email service configuration guide
- `GMAIL_SETUP.md` - Legacy Gmail API setup (deprecated)

## Development Workflows

### Email Service Maintenance
When working with email functionality:
1. All email sending goes through `sendEmailViaGoogleScript()` function
2. Email status is managed by `updateEmailStatus()` function
3. No Gmail API authentication or token management needed
4. Test emails can be sent directly from the Email Center

### Code Organization
- Email functions are in the "Email Status Functions" section
- All Gmail API code has been removed (commit 4923381)
- Email queue management remains unchanged
- Google Apps Script URL configuration in constants section

### Common Tasks
1. **Update Email Service**: Modify `GOOGLE_SCRIPT_URL` constant
2. **Test Email Functionality**: Use "Send Test Email" button in Email Center
3. **Debug Email Issues**: Check browser console for Google Apps Script responses
4. **Modify Email Templates**: Edit templates in Email Center UI

## Database Schema
The application uses Supabase with the following main tables:
- `imports` - Order import batches
- `settings` - Global application settings (pricing, email config, etc.)

## Recent Commits
- `4923381` - Remove Gmail API and switch to Google Apps Script only
- `f052905` - Configure Google Apps Script email service and fix TypeScript issues
- `481aaca` - Add Google Apps Script email solution

## Butchery Invoice Analysis

### Common Farm Butchery Invoice Mistakes
The AI PDF analysis system is designed to catch these frequent errors:

1. **Column Header Confusion**:
   - Item and Description columns often swapped
   - "Item" should contain item numbers (1, 2, 3...)
   - "Description" should contain product names (Heel Hoender, Boude en dye, etc.)

2. **Quantity vs Weight Confusion**:
   - Quantity column often shows weight (e.g., 7.00kg) instead of count
   - Should show actual quantity count (1, 2, 4 pieces)
   - Weight should be in separate KG column

3. **Missing Weight Column**:
   - Many invoices lack proper Weight (KG) column
   - Weight is critical for per-kg pricing verification
   - Should show: Description | Quantity | KG | Price | Total

4. **Pricing Verification**:
   - Check unit prices against current rate card
   - Verify total calculations (Quantity × Weight × Price/kg)
   - Flag unusual price variations

### Correct Invoice Format
Based on farm butchery standards:
```
Description | Quantity | KG | Price | Total
Heel Hoender - Full Chicken 1.5kg - 2.2kg R65/kg | 4 | 8.47 | 65 | 550.55
Boude en dye, 2 boude en 2 dye in pak.+-800gr R79/kg | 4 | 3.32 | 79 | 262.28
```

### Customer Information Location
Butchery invoices contain customer information in the **Reference** field:
- Reference field contains customer name (e.g., "JEAN DREYER")
- System extracts Reference and matches against existing customer database
- Auto-populates full customer details if found in previous orders
- Only prompts for new customer details if Reference name not found

## Memory Notes
- Gmail API integration was fully removed in favor of simpler Google Apps Script approach
- Email Center UI was cleaned up to remove confusing Gmail configuration forms
- All email functionality now uses a single, simple HTTP POST method
- No complex authentication flows or API key management required
- Invoice system updated to match proper butchery format with weight column
- Common invoice mistakes are documented and handled by the system
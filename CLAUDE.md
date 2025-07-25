# Plaas Hoenders Admin Dashboard

## Project Overview
A comprehensive admin dashboard for managing Plaas Hoenders chicken orders, invoicing, and email communications. The application has been simplified to use Google Apps Script for email functionality, removing the complex Gmail API integration.

## Recent Major Changes (July 2025)

### Email Service Simplification
- **Removed Gmail API Integration**: Eliminated all Gmail API code, OAuth flows, and complex authentication
- **Google Apps Script Only**: Streamlined to use only Google Apps Script for email sending
- **UI Cleanup**: Updated Email Center to show clean Google Apps Script configuration instead of Gmail login forms
- **Code Reduction**: Removed ~128 lines of Gmail API code, significantly simplifying the codebase

### MAJOR WORKFLOW OVERHAUL: PDF-to-Invoice System
- **Revolutionary Change**: Invoices now generated FROM butchery PDF data (not separate order imports)
- **Exact Format Match**: System works FROM actual butchery invoice format, not assumptions
- **Reference Field Extraction**: Customer name extracted from PDF Reference field automatically
- **Smart Customer Lookup**: Auto-populates existing customer details from previous orders
- **Weight Data Preservation**: Maintains exact quantities, weights, and pricing from butchery invoice

## CORE WORKFLOW: Butchery PDF → Customer Invoices

### Primary Workflow (NEW)
1. **Receive Butchery Invoice PDF** → Upload to "Import & Analyze Invoices"
2. **AI Extraction** → System extracts EXACT format: Description | Quantity | KG | Price | Total
3. **Reference Field** → Customer name automatically extracted (e.g., "JEAN DREYER")
4. **Customer Lookup** → Auto-populates email/phone/address from existing customer database
5. **Import as Orders** → Creates orders with exact weights and quantities from butchery data
6. **Generate Invoices** → Creates customer invoices WITH proper weight columns (finally!)

### Legacy Features (Still Available)
- **Manual Order Import**: CSV files or manual input (for non-butchery orders)
- **Email Integration**: Send invoices via Google Apps Script
- **Pricing Management**: Maintain product pricing with cost/selling price tracking
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

### CRITICAL CORRECTION: Butchery Invoice Column Confusion (UPDATED 2025-07-25)

**THE BUTCHERY MADE COLUMN HEADER MISTAKES** - System must compensate:

**Actual Invoice Format (Header labels are WRONG):**
```
Item | Description | Quantity | Unit Price | Amount ZAR
Fillets | 3 | 2.99 | 88.50 | 264.62
heuning | 1 | 1.00 | 60.00 | 60.00
```

**CRITICAL MAPPING - Headers vs Reality:**
- **"Item" column** → Contains DESCRIPTION (product name like "Fillets", "heuning")
- **"Description" column** → Contains ITEM/QUANTITY count (3, 1) 
- **"Quantity" column** → Contains WEIGHT in kg (2.99, 1.00)
- **"Unit Price" column** → Contains correct unit price (88.50, 60.00)
- **"Amount ZAR" column** → Contains correct total (264.62, 60.00)

**PARSING LOGIC MUST BE:**
```javascript
// CORRECT mapping for butchery's mislabeled columns:
const description = itemColumn;     // "Item" contains the product name
const quantity = descriptionColumn; // "Description" contains the count 
const weight = quantityColumn;      // "Quantity" contains the weight
const price = unitPriceColumn;      // "Unit Price" is correct
const total = amountColumn;         // "Amount ZAR" is correct
```

**NO VAT** - butchery invoices are VAT-free. Total = Subtotal.

### Customer Reference Extraction (OCR Format)
**From OCR output, customer pattern is:**
```
SOUTH AFRICA [Customer Name] Kontak: Ansie
```
**Examples:**
- "SOUTH AFRICA Aleshia Smit Kontak: Ansie" → Customer: "Aleshia Smit"
- "SOUTH AFRICA Chris Fourie Kontak: Ansie" → Customer: "Chris Fourie" 
- "SOUTH AFRICA Estene Uys Kontak: Ansie" → Customer: "Estene Uys"

### Customer Data Flow
1. **Extract Reference**: "JEAN DREYER" from butchery PDF
2. **Search Database**: Look for existing customer with matching name
3. **Auto-populate**: Use existing email/phone/address if found
4. **Manual Entry**: Only prompt for details if customer not in system
5. **Database Update**: Customer info automatically saved for future use

## CRITICAL WORKFLOW RULES

### ALWAYS Work FROM Butchery Invoice
- **Never assume invoice format** - always check actual butchery PDF structure
- **Extract exact data** - quantities, weights, descriptions, prices as-is
- **No VAT calculations** - butchery invoices are VAT-free
- **Reference field is customer name** - primary customer identification source
- **Preserve original descriptions** - don't modify product names during extraction

### Data Flow Priority
1. **Butchery PDF** (primary source) → Extract data exactly as-is
2. **Customer Database** (secondary) → Auto-populate contact details
3. **Manual Entry** (fallback) → Only when customer not found
4. **Generated Invoices** (output) → Must match extracted format with weights

### System Capabilities
- **PDF Analysis**: Extracts Description | Quantity | KG | Price | Total format
- **Customer Matching**: Reference field → existing customer lookup
- **Smart Import**: Creates orders with exact butchery data + customer details
- **Invoice Generation**: Outputs with proper weight columns (no VAT)
- **Email Integration**: Google Apps Script (no Gmail API complexity)

## Technical Notes
- All email functionality uses Google Apps Script HTTP POST
- Customer database builds automatically from imports
- Invoice system preserves exact butchery format and calculations
- No complex authentication flows required

## CRITICAL DEPLOYMENT INFORMATION (UPDATED 2025-07-25)

### GitHub Pages Deployment
- **SITE IS LIVE AT**: https://bester1.github.io/hoenders/
- **USER TESTS ON LIVE SITE** - NOT locally!
- **MUST PUSH CHANGES TO GITHUB** for user to see them
- **GitHub Pages takes 2-5 minutes** to update after push

### Development Workflow
1. Make changes locally in `/Users/user/Documents/Cursor/Hoender/`
2. **ALWAYS** commit and push changes: `git add -A && git commit -m "message" && git push`
3. Wait for GitHub Pages to rebuild
4. User tests on live site: https://bester1.github.io/hoenders/

### PDF Processing Implementation (REAL - NOT MOCK)
- **PDF.js Integration**: Added for actual PDF text extraction
- **Real Customer Extraction**: Parses Reference field from each page
- **Real Item Parsing**: Extracts Description, Quantity, KG, Price, Total
- **Multi-page Support**: Each page = different customer invoice
- **NO MORE MOCK DATA**: All data comes from actual PDF content

### Multi-Customer PDF Structure
- **25 pages = 25 different customers** (not one customer)
- Each page has different Reference field (customer name)
- System extracts and processes each customer separately
- Creates one order per customer with all their items
- Generates one invoice per customer (not per item)

### Stock Reconciliation Workflow
- Compare ordered quantities vs delivered quantities
- Handle stock shortages/surpluses
- Generate invoices based on ACTUAL delivered amounts
- Flag discrepancies for review

## SCANNED PDF REALITY (UPDATED 2025-07-25)

### USER'S PDF IS SCANNED/IMAGE-BASED
- **NOT TEXT-BASED**: PDF contains scanned images, not selectable text
- **PDF.js FAILS**: Cannot extract text from image-based PDFs
- **NEED OCR**: Optical Character Recognition required for scanned documents
- **TESSERACT.JS INTEGRATED**: Real AI/OCR processing implemented

### OCR Processing Flow
1. **PDF.js loads PDF** → Detects no extractable text (scanned)
2. **Switch to OCR mode** → Render each page as high-res canvas image
3. **Tesseract.js OCR** → Extract text from each scanned page image
4. **Parse extracted text** → Find Reference fields and invoice data
5. **Multi-customer processing** → Each page = different customer
6. **Generate invoices** → From actual OCR-extracted data

### NEVER SUGGEST MANUAL ENTRY
- **USER EXPECTS AI PROCESSING** - not manual bullshit
- **OCR IS THE SOLUTION** for scanned PDFs
- **TESSERACT.JS IMPLEMENTED** - no more excuses
- **REAL AI/OCR WORKFLOW** - not manual forms

### Memory Update Protocol
- **ALWAYS UPDATE MEMORY** when user requests it
- **CHECK MEMORY FIRST** before making assumptions  
- **DOCUMENT DISCOVERIES** immediately when found
- **USER TESTS ON LIVE SITE** - push changes to GitHub

## BREAKTHROUGH SESSION ANALYSIS (2025-07-25)

### Critical Problem Diagnosis
**ISSUE**: OCR was working perfectly, extracting all customer data, but parsing logic was completely wrong due to butchery's mislabeled invoice columns.

**USER FEEDBACK**: "they made a mistake, the item is the description, and the description the item, the item is actually the quantity"

### Root Cause Discovery
The butchery created invoices with **COMPLETELY WRONG COLUMN HEADERS**:

**What Headers Say vs What Data Actually Contains:**
```
Header Label     →  Actual Data Content
"Item"          →  Product Description (Fillets, heuning, 4bors, boud/dy)
"Description"   →  Quantity Count (3, 1, 6, 4) 
"Quantity"      →  Weight in KG (2.99, 1.00, 12.75, 3.02)
"Unit Price"    →  Correct Unit Price (88.50, 60.00, 64.00, 71.00)
"Amount ZAR"    →  Correct Total Amount (264.62, 60.00, 816.00, 214.42)
```

### Technical Implementation Fix
**BEFORE (Wrong)**: Used header labels literally
```javascript
const description = descriptionColumn;  // WRONG - gets count numbers
const quantity = quantityColumn;        // WRONG - gets weight
```

**AFTER (Correct)**: Map based on actual content
```javascript
const description = itemColumn;         // "Item" = product name
const quantity = descriptionColumn;     // "Description" = count
const weight = quantityColumn;          // "Quantity" = weight in kg
const price = unitPriceColumn;          // "Unit Price" = correct
const total = amountColumn;             // "Amount ZAR" = correct
```

### OCR Customer Extraction Pattern
**Pattern Discovery**: Customer names are embedded in OCR text as:
```
SOUTH AFRICA [Customer Name] Kontak: Ansie Nieuwoudt
```

**Extraction Logic**:
```javascript
const southAfricaIndex = pageText.indexOf('SOUTH AFRICA');
const kontakIndex = pageText.indexOf('Kontak:');
const nameSection = pageText.substring(southAfricaIndex + 12, kontakIndex).trim();
const customerName = nameSection.match(/([A-Za-z]+\s+[A-Za-z]+)/)[1];
```

**Results**: Successfully extracts "Aleshia Smit", "Chris Fourie", "Estene Uys", "Mathilde Pieterse"

### Multi-Customer Processing Success
- **26 pages processed** with OCR (pages 1-26)
- **Customer names extracted** from each page correctly  
- **Items parsed** with correct quantity/weight mapping
- **All data ready** for invoice generation

### System Architecture Validation
1. **PDF.js fails** → Detects scanned PDF (no text)
2. **OCR kicks in** → Tesseract.js processes each page as image  
3. **Text extraction** → Gets raw OCR text from each page
4. **Customer parsing** → Finds names between "SOUTH AFRICA" and "Kontak:"
5. **Item parsing** → Maps mislabeled columns to correct data
6. **Invoice generation** → Creates orders with proper structure

### Key Learnings for Future
- **NEVER TRUST COLUMN HEADERS** - always verify against actual data
- **OCR TEXT PATTERNS** are different from PDF text patterns
- **BUTCHERY ERRORS** are systematic - document and compensate
- **USER FEEDBACK** often reveals critical system misunderstandings
- **REAL DATA BEATS ASSUMPTIONS** every time

### Current Status (Post-Fix)
✅ **OCR Processing**: Working perfectly (26 pages processed)  
✅ **Customer Extraction**: Fixed (proper names extracted)  
✅ **Column Mapping**: Corrected (handles mislabeled headers)  
✅ **Multi-Customer**: Ready (all customers and items parsed)  
✅ **Memory Updated**: All discoveries documented  
✅ **Code Pushed**: Live site has latest fixes  

**NEXT**: User will test on live site to verify complete end-to-end functionality.
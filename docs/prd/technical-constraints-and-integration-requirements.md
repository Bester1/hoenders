# Technical Constraints and Integration Requirements

## Existing Technology Stack

**Languages**: JavaScript (ES6+), HTML5, CSS3  
**Frameworks**: Vanilla JavaScript SPA, FontAwesome 6.0, PDF.js 3.11.174, Tesseract.js 4.1.1  
**Database**: Supabase (PostgreSQL) with localStorage fallback  
**Infrastructure**: GitHub Pages static hosting, Google Apps Script for email service  
**External Dependencies**: Supabase client library, OCR processing libraries, Google Apps Script HTTP integration

## Integration Approach

**Database Integration Strategy**: 
- Extend existing Supabase schema with `customers` table
- Add `source` field to existing `orders` table ('customer_portal' | 'pdf_import' | 'csv_import')
- Maintain existing dual-layer persistence (Supabase primary, localStorage fallback)
- Customer authentication data stored in new `customer_auth` table with JWT session management

**API Integration Strategy**:
- Leverage existing Supabase client for customer CRUD operations
- Extend existing Google Apps Script email service for customer notifications
- Add customer-specific API endpoints using existing Supabase RPC functions
- Maintain existing PDF processing pipeline unchanged

**Frontend Integration Strategy**:
- Add new customer portal routes using existing section-based navigation pattern
- Create separate customer.html entry point while reusing styles.css and core utilities
- Implement customer session management using existing localStorage patterns
- Share product catalog and pricing data between admin and customer interfaces

**Testing Integration Strategy**:
- Customer portal testing follows same manual verification approach as admin dashboard
- Integration testing ensures customer orders appear correctly in admin interface
- Cross-browser testing maintains existing supported browser matrix

## Code Organization and Standards

**File Structure Approach**:
```
/
├── index.html (existing admin dashboard)
├── customer.html (new customer portal entry)
├── styles.css (shared styling - extended)
├── script.js (admin functionality - unchanged core)
├── customer.js (new customer portal logic)
└── shared-utils.js (extracted common functions)
```

**Naming Conventions**: 
- Customer functions prefixed with `customer` (e.g., `customerLogin()`, `customerPlaceOrder()`)
- Maintain existing camelCase convention throughout
- CSS classes follow existing pattern with `.customer-` prefix for portal-specific styles

**Coding Standards**:
- Continue existing vanilla JavaScript approach (no framework introduction)
- Maintain current error handling patterns with try/catch blocks
- Follow existing async/await pattern for database operations
- Preserve existing modular function organization

**Documentation Standards**:
- Inline comments for customer-specific functions following existing style
- Update CLAUDE.md with customer portal workflow documentation
- API documentation for new customer endpoints

## Deployment and Operations

**Build Process Integration**: 
- No build process changes required (static files deployment)
- GitHub Pages continues to serve both admin and customer portals
- Same deployment workflow: commit → push → GitHub Pages rebuild

**Deployment Strategy**:
- Phased deployment: customer.html deployed but not publicly linked initially
- Admin dashboard remains primary interface during customer portal development
- Feature flags in localStorage for gradual customer portal rollout

**Monitoring and Logging**:
- Extend existing console logging for customer portal activities
- Customer authentication events logged to browser console
- Order placement tracking using existing analytics patterns

**Configuration Management**:
- Customer portal shares existing Supabase and Google Apps Script configuration
- Environment-specific settings managed through existing constants pattern
- Customer session timeout and security settings configurable via constants

## Risk Assessment and Mitigation

**Technical Risks**:
- Session management complexity could impact performance
- Customer concurrent access might stress existing Supabase limits
- Mobile performance on rural networks with slower connections

**Integration Risks**:
- Customer orders could conflict with simultaneous admin operations
- Email system might be overwhelmed with customer notifications
- Shared product pricing could create consistency issues

**Deployment Risks**:
- Customer portal bugs could affect admin dashboard through shared components
- Database schema changes might impact existing admin functionality
- GitHub Pages deployment timing could cause temporary customer portal unavailability

**Mitigation Strategies**:
- Implement customer portal with isolated JavaScript file to prevent admin impact
- Use database transactions for customer order placement to ensure consistency
- Implement rate limiting on customer actions to prevent system overload
- Comprehensive testing of admin functionality after each customer portal change
- Rollback plan: remove customer.html link while keeping admin dashboard operational

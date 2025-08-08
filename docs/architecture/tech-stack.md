# Tech Stack

## Cloud Infrastructure

- **Provider**: GitHub Pages + Supabase Cloud + Google Apps Script
- **Key Services**: Static hosting, managed PostgreSQL, real-time subscriptions, email automation
- **Deployment Regions**: Global CDN (GitHub Pages), US-East (Supabase primary)

## Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| **Language** | JavaScript | ES6+ (2023) | Primary development language | Existing codebase standard, excellent browser support |
| **Runtime** | Browser | Modern browsers | Client-side execution | Static hosting model, existing architecture |
| **Frontend Framework** | Vanilla JavaScript | N/A | UI framework | Maintains existing patterns, no framework overhead |
| **CSS Framework** | Custom CSS + Grid/Flexbox | CSS3 | Styling system | Existing responsive design, professional appearance |
| **Icons** | FontAwesome | 6.0.0 | Icon library | Currently used, consistent visual language |
| **Database** | Supabase | Latest Stable | Primary data persistence | Existing proven integration, real-time capabilities |
| **Database Engine** | PostgreSQL | 15+ (managed) | SQL database engine | Managed by Supabase, ACID compliance |
| **Authentication** | Supabase Auth | Latest | Customer authentication | Native Supabase integration, JWT tokens |
| **Session Management** | JWT + localStorage | N/A | Client session storage | Stateless, compatible with static hosting |
| **Password Hashing** | bcrypt (via Supabase) | N/A | Secure password storage | Industry standard, managed by Supabase |
| **Email Service** | Google Apps Script | Latest | Email delivery | Existing proven integration |
| **PDF Processing** | PDF.js | 3.11.174 | PDF text extraction | Existing integration for butchery invoices |
| **OCR Processing** | Tesseract.js | 4.1.1 | Image text recognition | Existing integration for scanned documents |
| **Hosting** | GitHub Pages | N/A | Static site hosting | Current deployment, zero-cost scaling |
| **Version Control** | Git + GitHub | Latest | Source code management | Current workflow, integrated deployment |
| **Build Process** | None (Static) | N/A | Deployment pipeline | Simple git push deployment |

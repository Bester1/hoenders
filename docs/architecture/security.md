# Security

## Input Validation

- **Validation Library:** Browser native validation + Supabase RLS policies for server-side validation
- **Validation Location:** Client-side validation at form submission, server-side validation enforced by database constraints
- **Required Rules:**
  - All customer inputs MUST be validated before Supabase operations
  - Email validation using HTML5 email input type + regex verification
  - Phone number validation for South African format (+27 or 0XX XXX XXXX)
  - Address validation for required delivery information
  - Order quantities must be positive integers with maximum limits
  - Product names must match existing pricing catalog exactly

## Authentication & Authorization

- **Auth Method:** Supabase Auth with JWT tokens and Row Level Security (RLS) policies
- **Session Management:** JWT tokens stored in localStorage with automatic expiration handling
- **Required Patterns:**
  - NEVER store passwords in localStorage - only JWT tokens
  - Always validate JWT token before sensitive operations
  - Customer can only access their own orders and profile data
  - Admin role required for customer management and order status updates
  - Automatic logout after 24 hours of inactivity

## Secrets Management

- **Development:** Configuration constants in JavaScript files (acceptable for client-side app)
- **Production:** Public API keys embedded in JavaScript (standard for Supabase client-side usage)
- **Code Requirements:**
  - Supabase anon key is public-safe and designed for client-side use
  - NEVER hardcode sensitive Google Apps Script tokens
  - Access configuration via constants object only
  - No customer passwords or sensitive data in logs or error messages

## API Security

- **Rate Limiting:** Supabase built-in rate limiting (500 requests/second) sufficient for expected load
- **CORS Policy:** Supabase CORS configured for GitHub Pages domain
- **Security Headers:** Implement Content Security Policy to prevent XSS attacks
- **HTTPS Enforcement:** GitHub Pages automatic HTTPS with force HTTPS enabled

## Data Protection

- **Encryption at Rest:** Managed by Supabase (AES-256 encryption)
- **Encryption in Transit:** All communications over HTTPS/TLS 1.3
- **PII Handling:** Customer names, emails, addresses treated as PII with restricted access
- **Logging Restrictions:** NEVER log passwords, JWT tokens, or complete customer profiles

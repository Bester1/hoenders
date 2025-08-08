# External APIs

## Supabase API

- **Purpose:** Primary database operations and real-time subscriptions for both admin and customer functionality
- **Documentation:** https://supabase.com/docs/reference/javascript
- **Base URL(s):** https://ukdmlzuxgnjucwidsygj.supabase.co/rest/v1/
- **Authentication:** API Key + JWT tokens for authenticated operations
- **Rate Limits:** 500 requests/second (generous for expected load)

**Key Endpoints Used:**
- `POST /customers` - Customer registration and profile management
- `GET /customers` - Customer profile retrieval and admin customer management
- `POST /orders` - Order creation from both customer portal and admin imports
- `GET /orders` - Order retrieval with filtering by customer or admin
- `POST /rpc/match_customer_orders` - Custom function to link historical orders to customers

**Integration Notes:** Extends existing Supabase integration with customer-specific tables. Uses existing error handling patterns and localStorage fallback mechanisms.

## Supabase Auth API

- **Purpose:** Customer authentication, registration, password management, and JWT token handling
- **Documentation:** https://supabase.com/docs/reference/javascript/auth
- **Base URL(s):** https://ukdmlzuxgnjucwidsygj.supabase.co/auth/v1/
- **Authentication:** API Key for service operations, user credentials for auth flows
- **Rate Limits:** 30 auth requests/hour per IP (standard for security)

**Key Endpoints Used:**
- `POST /signup` - Customer account registration with email verification
- `POST /token?grant_type=password` - Customer login authentication
- `POST /logout` - Session termination and token invalidation
- `POST /recover` - Password reset email delivery
- `PUT /user` - Customer profile updates and password changes

**Integration Notes:** New integration for customer portal. Handles secure password hashing, email verification, and JWT token management automatically.

## Google Apps Script API

- **Purpose:** Email delivery for order confirmations, admin notifications, and customer communications
- **Documentation:** https://developers.google.com/apps-script/guides/web
- **Base URL(s):** https://script.google.com/macros/s/AKfycbzBN3lIbR-ZW9ybqb5E6e0XNa7wdrfKmO8d6pQeSVXAd0WM7tT-n9M4jFO42mC1vcS1/exec
- **Authentication:** None required (public web app endpoint)
- **Rate Limits:** 20,000 triggers/day, sufficient for expected email volume

**Key Endpoints Used:**
- `POST /exec` - Send email with customer order confirmations and admin notifications

**Integration Notes:** Existing proven integration. Extended to handle customer email templates while maintaining admin email functionality.

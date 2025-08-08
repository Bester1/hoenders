# User Interface Enhancement Goals

## Integration with Existing UI

The customer portal will maintain visual consistency with the existing admin dashboard while creating a distinct customer-focused experience. The portal will reuse the existing CSS framework and design patterns:

- **Color Scheme**: Adapt the current gradient sidebar design (#667eea to #764ba2) for customer navigation
- **Typography**: Use the same font stack (-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto)  
- **Component Library**: Leverage existing button styles (.btn-primary, .btn-secondary), form inputs, and card layouts
- **Icons**: Continue using FontAwesome icons for consistency
- **Responsive Grid**: Use the same CSS Grid and Flexbox patterns for mobile optimization

## Modified/New Screens and Views

**New Customer Portal Screens**:
1. **Customer Login/Registration** - Simple email/password form using existing form styling
2. **Customer Dashboard** - Order summary cards similar to admin dashboard stats
3. **Product Catalog** - Grid layout showcasing products with images, descriptions, and pricing
4. **Order Placement** - Shopping cart interface with quantity selectors and order summary
5. **Order History** - Table format similar to admin orders table but customer-filtered
6. **Order Tracking** - Individual order details with status timeline
7. **Customer Profile** - Account settings and contact information management

**Modified Admin Screens**:
- **Orders Table**: Add "Source" column to distinguish customer vs PDF import orders
- **Customer Management**: Enhance to show customer portal accounts alongside imported customers

## UI Consistency Requirements

**Visual Consistency**:
- Customer portal uses same card-based layout as admin dashboard
- Consistent button hierarchy and interaction patterns
- Same loading states and success/error messaging
- Unified color palette with customer-appropriate accent colors

**Interaction Consistency**:
- Form validation follows same patterns as admin forms
- Navigation structure mirrors admin sidebar approach
- Modal dialogs and confirmations use existing styling
- Mobile responsive breakpoints match admin dashboard

**Branding Consistency**:
- Same "🐔 Plaas Hoenders" branding and logo
- Professional agricultural theme maintained
- Customer-friendly language while keeping brand voice

# Test Strategy and Standards

## Testing Philosophy

- **Approach:** Manual testing with systematic verification following existing admin dashboard patterns
- **Coverage Goals:** 100% functionality coverage for customer portal, regression testing for admin dashboard
- **Test Pyramid:** Primarily manual integration testing with focus on user workflows and cross-component compatibility

## Test Types and Organization

### Manual Testing Requirements

**AI Agent Testing Requirements:**
- Test all public functions through browser console before integration
- Verify error handling with invalid inputs and network failures
- Validate data transformations with edge cases (empty orders, special characters)
- Ensure localStorage fallback works when Supabase is unreachable

**Integration Test Scenarios:**
1. **Customer Registration → Admin Visibility:** Register customer, verify admin can see customer in dashboard
2. **Customer Order → Admin Processing:** Place customer order, verify admin can process and update status
3. **Admin Status Update → Customer Notification:** Admin updates order status, verify customer sees update and receives email
4. **Offline Functionality:** Disconnect network, verify customer portal functions with localStorage
5. **Real-time Sync:** Multiple browser tabs, verify changes sync across admin and customer interfaces

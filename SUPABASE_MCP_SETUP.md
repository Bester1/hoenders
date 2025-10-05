# Supabase MCP Setup for Plaas Hoenders

## Project Details
- **Supabase Project**: ukdmlzuxgnjucwidsygj
- **Base URL**: https://ukdmlzuxgnjucwidsygj.supabase.co
- **MCP Server**: https://mcp.supabase.com/mcp

## MCP Connection URLs

### 1. Production Connection (Full Access)
```
https://mcp.supabase.com/mcp?project=ukdmlzuxgnjucwidsygj
```

### 2. Read-Only Connection (Recommended for AI Agents)
```
https://mcp.supabase.com/mcp?project=ukdmlzuxgnjucwidsygj&readOnly=true
```

### 3. Development Features Only
```
https://mcp.supabase.com/mcp?project=ukdmlzuxgnjucwidsygj&features=database,storage,docs
```

### 4. Database-Only Connection
```
https://mcp.supabase.com/mcp?project=ukdmlzuxgnjucwidsygj&features=database
```

## Configuration for Different AI Agents

### Claude Code (Current Environment)
Add to your Claude Code configuration:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "http",
      "args": ["https://mcp.supabase.com/mcp?project=ukdmlzuxgnjucwidsygj&readOnly=true"]
    }
  }
}
```

### Cursor IDE
```json
{
  "mcp": {
    "servers": {
      "supabase": {
        "url": "https://mcp.supabase.com/mcp?project=ukdmlzuxgnjucwidsygj&readOnly=true"
      }
    }
  }
}
```

### ChatGPT Custom Instructions
```
Please connect to my Supabase database using this MCP URL:
https://mcp.supabase.com/mcp?project=ukdmlzuxgnjucwidsygj&readOnly=true

Project: Plaas Hoenders (Chicken order management system)
Database tables: orders, customers, imports, settings
```

## Available MCP Tools

### Database Tools
- List and query tables
- Run SQL queries (read-only)
- Get table schemas
- Fetch database advisors

### Storage Tools
- List storage buckets
- Get bucket configurations
- (Future: List files and details)

### Documentation Tools
- Search Supabase docs
- Get latest documentation
- Context-aware help

### Security Tools
- Get security advisors
- Performance recommendations
- Best practice checks

## Security Notes

### Why Read-Only Mode is Recommended
- Prevents accidental data modifications
- Safer for AI agent interactions
- Still allows full data analysis and insights
- Can be disabled for specific operations when needed

### MCP Authentication
The new MCP server uses OAuth2 authentication via browser, which is:
- More secure than personal access tokens
- No need to manage tokens manually
- Session-based authentication
- Single sign-on with Supabase account

## Use Cases for Plaas Hoenders

### 1. Business Intelligence Analysis
```sql
-- AI can help analyze sales trends
SELECT customer_name, SUM(total_amount) as total_spent
FROM orders
GROUP BY customer_name
ORDER BY total_spent DESC;
```

### 2. Customer Insights
```sql
-- Find most valuable customers
SELECT email, COUNT(*) as order_count, SUM(total_amount) as lifetime_value
FROM orders
WHERE created_at >= '2025-01-01'
GROUP BY email;
```

### 3. Product Performance
```sql
-- Analyze product popularity
SELECT product_name, SUM(quantity) as total_quantity, SUM(total_amount) as revenue
FROM order_items
GROUP BY product_name
ORDER BY revenue DESC;
```

### 4. Database Health Check
- Get security and performance advisors
- Check for slow queries
- Analyze table sizes and growth

## Getting Started

1. **Choose your AI agent** (Claude Code, ChatGPT, Cursor, etc.)
2. **Configure the MCP URL** using one of the options above
3. **Start asking questions** about your Plaas Hoenders data
4. **Get insights** without writing complex queries manually

## Example Questions to Ask AI

- "Show me my top 10 customers by lifetime value"
- "What are my best-selling products this month?"
- "Are there any security issues with my database?"
- "Help me understand my sales trends"
- "What's the average order value?"

## Next Steps

1. Test the MCP connection with your preferred AI agent
2. Explore the available tools and capabilities
3. Ask business questions about your chicken order data
4. Use the insights to grow your business

## Troubleshooting

If the MCP connection doesn't work:
1. Verify the project ID is correct: `ukdmlzuxgnjucwidsygj`
2. Check that your Supabase project is active
3. Ensure you have the necessary permissions
4. Try without the `readOnly` parameter for testing

## Security Best Practices

- Always use `readOnly=true` for AI agents
- Only disable read-only mode for specific, trusted operations
- Monitor MCP access logs in your Supabase dashboard
- Revoke access if suspicious activity is detected
# Source Tree

```plaintext
plaas-hoenders/
├── docs/                           # Project documentation
│   ├── prd.md                     # Product Requirements Document
│   ├── architecture.md            # This architecture document
│   └── api-documentation.md       # API endpoint documentation
│
├── database/                      # Database schema and migrations
│   ├── schema.sql                # Complete database schema
│   ├── migrations/               # Schema evolution scripts
│   │   ├── 001_add_customers.sql
│   │   ├── 002_extend_orders.sql
│   │   └── 003_add_order_items.sql
│   └── seed-data.sql             # Test/demo data (optional)
│
├── index.html                     # Admin dashboard entry point (existing)
├── customer.html                  # Customer portal entry point (new)
├── script.js                      # Main admin JavaScript (existing)
├── customer.js                    # Customer portal JavaScript (new)
├── shared-utils.js               # Extracted common functions (new)
├── styles.css                     # Shared styles (existing, extended)
├── CLAUDE.md                      # Project documentation (existing)
├── GoogleAppsScript.gs           # Email service (existing)
└── README.md
```

# REST API Spec

```yaml
openapi: 3.0.0
info:
  title: Plaas Hoenders Customer Portal API
  version: 1.0.0
  description: REST API specification for customer portal integration with existing Plaas Hoenders admin system
servers:
  - url: https://ukdmlzuxgnjucwidsygj.supabase.co/rest/v1
    description: Supabase REST API endpoint
  - url: https://script.google.com/macros/s/AKfycbzBN3lIbR-ZW9ybqb5E6e0XNa7wdrfKmO8d6pQeSVXAd0WM7tT-n9M4jFO42mC1vcS1/exec
    description: Google Apps Script email service endpoint

security:
  - ApiKeyAuth: []
  - BearerAuth: []

paths:
  /customers:
    post:
      summary: Create new customer profile
      tags:
        - Customer Management
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CustomerCreate'
            example:
              name: "Jean Dreyer"
              email: "jean.dreyer@example.com"
              phone: "079 123 4567"
              address: "Farm Road 123, Postal Code"
              communication_preferences: {"email_notifications": true}
      responses:
        '201':
          description: Customer created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Customer'
        '400':
          description: Validation error
        '409':
          description: Customer with email already exists

    get:
      summary: Get customer profiles (admin only)
      tags:
        - Customer Management
      security:
        - BearerAuth: []
      parameters:
        - name: select
          in: query
          schema:
            type: string
          example: "id,name,email,phone,created_at"
      responses:
        '200':
          description: List of customers
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Customer'

  /customers/{id}:
    get:
      summary: Get customer profile by ID
      tags:
        - Customer Management
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Customer profile
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Customer'
        '404':
          description: Customer not found

    put:
      summary: Update customer profile
      tags:
        - Customer Management
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CustomerUpdate'
      responses:
        '200':
          description: Customer updated successfully
        '404':
          description: Customer not found

  /orders:
    post:
      summary: Create new order (customer portal or admin)
      tags:
        - Order Management
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/OrderCreate'
            example:
              customer_id: "123e4567-e89b-12d3-a456-426614174000"
              source: "customer_portal"
              customer_name: "Jean Dreyer"
              customer_email: "jean.dreyer@example.com"
              customer_phone: "079 123 4567"
              customer_address: "Farm Road 123"
              total_amount: 268.00
              order_items: [
                {
                  product_name: "HEEL HOENDER",
                  quantity: 2,
                  weight_kg: 3.6,
                  unit_price_per_kg: 67.00,
                  line_total: 241.20
                }
              ]
      responses:
        '201':
          description: Order created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'

    get:
      summary: Get orders with filtering
      tags:
        - Order Management
      security:
        - BearerAuth: []
      parameters:
        - name: customer_id
          in: query
          schema:
            type: string
            format: uuid
          description: Filter orders by customer (for customer portal)
        - name: source
          in: query
          schema:
            type: string
            enum: [customer_portal, pdf_import, csv_import]
          description: Filter orders by source
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, confirmed, processing, delivered, cancelled]
        - name: select
          in: query
          schema:
            type: string
          example: "id,customer_name,total_amount,status,created_at"
      responses:
        '200':
          description: List of orders
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Order'

  /orders/{id}:
    get:
      summary: Get order details by ID
      tags:
        - Order Management
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Order details with items
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderWithItems'

    put:
      summary: Update order status (admin only)
      tags:
        - Order Management
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                status:
                  type: string
                  enum: [pending, confirmed, processing, delivered, cancelled]
                notes:
                  type: string
            example:
              status: "confirmed"
              notes: "Order confirmed and scheduled for Saturday delivery"
      responses:
        '200':
          description: Order status updated
        '404':
          description: Order not found

  /rpc/match_customer_orders:
    post:
      summary: Link historical orders to customer account
      tags:
        - Customer Management
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                customer_id:
                  type: string
                  format: uuid
                customer_name:
                  type: string
                customer_email:
                  type: string
              example:
                customer_id: "123e4567-e89b-12d3-a456-426614174000"
                customer_name: "Jean Dreyer"
                customer_email: "jean.dreyer@example.com"
      responses:
        '200':
          description: Historical orders linked successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  matched_orders:
                    type: integer
                    example: 5

components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: apikey
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Customer:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        email:
          type: string
          format: email
        phone:
          type: string
        address:
          type: string
        communication_preferences:
          type: object
        is_active:
          type: boolean
        created_at:
          type: string
          format: date-time
        last_login:
          type: string
          format: date-time

    CustomerCreate:
      type: object
      required:
        - name
        - email
        - phone
        - address
      properties:
        name:
          type: string
        email:
          type: string
          format: email
        phone:
          type: string
        address:
          type: string
        communication_preferences:
          type: object
          default: {"email_notifications": true}

    CustomerUpdate:
      type: object
      properties:
        name:
          type: string
        phone:
          type: string
        address:
          type: string
        communication_preferences:
          type: object

    Order:
      type: object
      properties:
        id:
          type: string
        customer_id:
          type: string
          format: uuid
          nullable: true
        source:
          type: string
          enum: [customer_portal, pdf_import, csv_import]
        customer_name:
          type: string
        customer_email:
          type: string
        customer_phone:
          type: string
        customer_address:
          type: string
        total_amount:
          type: number
          format: decimal
        status:
          type: string
          enum: [pending, confirmed, processing, delivered, cancelled]
        notes:
          type: string
        created_at:
          type: string
          format: date-time

    OrderCreate:
      type: object
      required:
        - source
        - customer_name
        - customer_email
        - total_amount
        - order_items
      properties:
        customer_id:
          type: string
          format: uuid
          nullable: true
        source:
          type: string
          enum: [customer_portal, pdf_import, csv_import]
        customer_name:
          type: string
        customer_email:
          type: string
        customer_phone:
          type: string
        customer_address:
          type: string
        total_amount:
          type: number
          format: decimal
        notes:
          type: string
        order_items:
          type: array
          items:
            $ref: '#/components/schemas/OrderItemCreate'

    OrderItem:
      type: object
      properties:
        id:
          type: string
          format: uuid
        order_id:
          type: string
        product_name:
          type: string
        quantity:
          type: integer
        weight_kg:
          type: number
          format: decimal
        unit_price_per_kg:
          type: number
          format: decimal
        line_total:
          type: number
          format: decimal
        source:
          type: string
          enum: [customer_selection, pdf_extraction, admin_entry]

    OrderItemCreate:
      type: object
      required:
        - product_name
        - quantity
        - weight_kg
        - unit_price_per_kg
        - line_total
      properties:
        product_name:
          type: string
        quantity:
          type: integer
        weight_kg:
          type: number
          format: decimal
        unit_price_per_kg:
          type: number
          format: decimal
        line_total:
          type: number
          format: decimal
        source:
          type: string
          enum: [customer_selection, pdf_extraction, admin_entry]
          default: customer_selection

    OrderWithItems:
      allOf:
        - $ref: '#/components/schemas/Order'
        - type: object
          properties:
            order_items:
              type: array
              items:
                $ref: '#/components/schemas/OrderItem'
```

export const schemaDescription = `
Tables:
1. sales_orders
   - id INTEGER PRIMARY KEY
   - order_date TEXT (ISO date)
   - region TEXT
   - channel TEXT
   - product_category TEXT
   - customer_segment TEXT
   - revenue REAL
   - cost REAL
   - units INTEGER
2. marketing_spend
   - id INTEGER PRIMARY KEY
   - spend_date TEXT (ISO date)
   - channel TEXT
   - campaign TEXT
   - spend REAL
   - impressions INTEGER
   - clicks INTEGER
3. targets
   - id INTEGER PRIMARY KEY
   - target_month TEXT (YYYY-MM)
   - region TEXT
   - revenue_target REAL
`;

export const allowedTables = ['sales_orders', 'marketing_spend', 'targets'];

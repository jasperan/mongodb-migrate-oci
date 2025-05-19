# AI and Analytics Enhancement Solution

This solution demonstrates how to enhance migrated MongoDB applications with Oracle's AI and analytics capabilities.

## Overview

The solution showcases:
- Excel-based analytics on JSON document data
- Oracle Select AI integration
- Vector processing and semantic search
- AI-enhanced application features

## Prerequisites

- Oracle 23ai Autonomous JSON Database instance
- Microsoft Excel
- Python 3.9+
- Node.js 18+ (for demo application)

## Directory Structure

```
ai-analytics/
├── excel/                 # Excel templates and reports
├── scripts/              # AI and analytics scripts
├── app/                  # Demo application with AI features
└── examples/             # Example queries and use cases
```

## MERN Application Setup

This solution uses the [MERN Ecommerce](https://github.com/mohamedsamara/mern-ecommerce) application as the demonstration vehicle. We'll enhance it with AI and analytics capabilities after migration to Oracle AJD.

### Features
- Node.js backend environment
- Express middleware for request handling
- Mongoose schemas for data modeling
- React frontend components
- Redux for state management
- Redux Thunk for async actions

### 3. LLM Chat Feature
- The LLM chat UI is available at `/support/llm-chat` in the frontend.
- Ensure your Ollama API is running and accessible at the URL specified in `OLLAMA_API_URL`.
- The backend will call the Ollama API for chat completions using the context retrieved from your Oracle JSON collections.

## LLM Chat API (Backend)
- **POST `/api/llm-chat/message`**
  - Request: `{ "message": "How do I find shoes similar to these?" }`
  - Response: `{ "response": "...", "context": [ ... ] }`
- See [docs/ai-analytics/llm-chat.md](docs/ai-analytics/llm-chat.md) for architecture and details.


### Setup Instructions

TODO

## Features

### 1. Excel Analytics
- Sales trends by category
- Product performance analysis
- Customer segmentation
- Custom report templates

### 2. Select AI Integration
- Review sentiment analysis
- Product recommendation engine
- Customer feedback insights
- Automatic product categorization

### 3. Vector Processing
- Similar product recommendations
- Content-based search
- Image similarity (if available)
- Semantic search capabilities

## Example Queries

1. Analytics with Excel:
   ```sql
   -- Sales trends by category
   SELECT json_value(p.data, '$.category') as category,
          json_value(o.data, '$.orderDate') as order_date,
          SUM(json_value(o.data, '$.totalPrice' RETURNING NUMBER)) as total_sales
   FROM orders_collection o, products_collection p
   WHERE json_value(o.data, '$.productId') = json_value(p.data, '$.id')
   GROUP BY json_value(p.data, '$.category'), json_value(o.data, '$.orderDate')
   ORDER BY order_date;
   ```

2. Select AI:
   ```sql
   -- Product improvement suggestions
   SELECT select_ai(
     'Suggest product improvements based on these negative reviews',
     json_arrayagg(json_value(data, '$.reviewText') RETURNING VARCHAR2(4000))
   ) AS improvement_suggestions
   FROM reviews_collection
   WHERE json_value(data, '$.rating' RETURNING NUMBER) < 3;
   ```

3. Vector Search:
   ```sql
   -- Find similar products
   SELECT json_value(data, '$.name') as product_name,
          json_value(data, '$.description') as description,
          vector_distance(product_vector, text_embedding('comfortable athletic shoes')) as similarity
   FROM products_collection
   ORDER BY similarity
   FETCH FIRST 5 ROWS ONLY;
   ```

## Next Steps

- [ ] Set up Excel analytics integration
- [ ] Implement Select AI examples
- [ ] Create vector processing demonstration
- [ ] Develop AI-enhanced UI components 
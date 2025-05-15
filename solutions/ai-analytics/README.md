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

### Setup Instructions

1. Clone the MERN application:
   ```bash
   git clone https://github.com/mohamedsamara/mern-ecommerce.git app
   ```

2. Configure environment variables:
   - Create `.env` files for both client and server
   - Update MongoDB connection string to point to your container
   - Set JWT secret and other required variables

3. Start the application using Docker Compose:
   ```yaml
   version: '3'
   services:
     client:
       build: client
       container_name: client
       ports:
         - '8080:8080'
       networks:
         - app-network
     server:
       build: server
       container_name: server
       environment:
         - PORT=3000
         - BASE_API_URL=api
         - CLIENT_URL=http://localhost:8080
         - JWT_SECRET=your_jwt_secret
         - MONGO_URI=mongodb://mongo:27017/mern_ecommerce
       ports:
         - '3000:3000'
       command: ['sh', '-c', 'npm run seed:db admin@example.com admin123 && npm start']
       depends_on:
         - mongo
       networks:
         - app-network
     mongo:
       image: mongo:latest
       container_name: mongodb
       command: mongod --quiet --logpath /dev/null
       ports:
         - '27017:27017'
       networks:
         - app-network
   networks:
     app-network:
       driver: bridge
   ```

4. Build and start the containers:
   ```bash
   docker-compose build
   docker-compose up
   ```

5. Access the application:
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:3000
   - Admin credentials: admin@example.com / admin123

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
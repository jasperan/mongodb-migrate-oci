# **"From MERN to AI: Building a Distributed RAG System with Microservices"**
## *20-Minute Technical Talk*

---

## **1. MERN App Working & Migration Success (5 minutes)**

### **The Foundation: What We've Already Achieved**
- **Successfully migrated** our MERN ecommerce app from MongoDB to Oracle Autonomous Database
- **MERN Stack Explained**: 
  - **M**ongoDB → Oracle (now using Oracle 23ai with JSON capabilities)
  - **E**xpress (Node.js web framework for APIs)
  - **R**eact (frontend UI components)
  - **N**ode.js (JavaScript runtime environment)

### **Why This Matters for AI Enhancement**
- **Data is already migrated** and accessible through Oracle's SODA (Simple Oracle Document Access)
- **JSON collections** are ready for vector embeddings
- **Perfect foundation** for adding AI capabilities without disrupting existing functionality

### **The Opportunity: Expand into an AI App**
- Instead of just having a working ecommerce app, we can now **transform it into an intelligent platform**
- **Microservices approach** allows us to add AI features incrementally
- **Distributed architecture** means we can scale AI components independently

---

## **2. Frontend Implementation: Keeping It Simple & Informative (5 minutes)**

### **What We Need to Build**
- **Chat Interface**: Simple, intuitive chat component for users
- **Real-time Communication**: Immediate feedback and responses
- **Error Handling**: Graceful fallbacks when AI is unavailable

### **React Component Design**
```jsx
// Simple chat interface - just 3 main pieces:
// 1. Message display area
// 2. Input field
// 3. Send button
```

### **Key Benefits of This Approach**
- **Minimal UI changes** to existing app
- **Familiar chat experience** for users
- **Easy to maintain** and extend
- **Responsive design** that works on all devices

### **Integration Strategy**
- **Add chat component** to existing product pages
- **Leverage existing styling** and design patterns
- **Maintain consistency** with current user experience

---

## **3. Microservice Backend Implementation (5 minutes)**

### **Why Microservices for AI?**
- **Separation of concerns**: AI logic separate from ecommerce logic
- **Independent scaling**: Can scale AI components based on demand
- **Technology flexibility**: Use Python for AI, Node.js for web
- **Easy deployment**: Deploy AI services independently

### **Architecture Overview**

MERN Frontend → Express API → FastAPI RAG Service → Oracle Vector DB
↓ ↓ ↓ ↓
React UI Node.js Server Python RAG Oracle 23ai


### **FastAPI RAG Service Implementation**
- **Lightweight Python service** running on port 8000
- **RESTful API endpoints** for easy integration
- **CORS enabled** for cross-origin requests
- **Async processing** for better performance

### **Key Benefits**
- **Language-appropriate tools**: Python for AI/ML, Node.js for web
- **Independent deployment cycles**
- **Easy to test** and debug separately
- **Can run on different servers** for load distribution

---

## **4. Oracle Vector Store & SODA: The Database Magic (5 minutes)**

### **What is SODA?**
- **Simple Oracle Document Access**: Oracle's NoSQL interface for JSON collections
- **MongoDB-compatible operations**: Familiar API for developers
- **Native JSON storage**: No schema constraints, flexible document structure
- **Vector capabilities**: Built-in support for embeddings and similarity search

### **Collection Architecture**
```python
# SODA collection metadata for optimal performance
metadata = {
    "keyColumn": {
        "name": "_id",
        "sqlType": "BLOB"  # Binary storage for efficient lookups
    },
    "contentColumn": {
        "name": "JSON_DOCUMENT",
        "sqlType": "BLOB"  # Binary JSON storage
    },
    "lastModifiedColumn": {
        "name": "LAST_MODIFIED"  # Automatic timestamp tracking
    },
    "versionColumn": {
        "name": "VERSION"  # Optimistic locking support
    }
}
```

### **Document Structure with Embeddings**
```json
{
    "_id": "binary_id_here",
    "title": "Wireless Headphones",
    "review": "Great sound quality and comfortable fit",
    "rating": 5,
    "isRecommended": true,
    "embedding": [0.123, -0.456, 0.789, ...],  // 384-dimensional vector
    "metadata": {
        "created_at": "2025-01-15T10:30:00Z",
        "user_id": "user123"
    }
}
```

### **Vector Similarity Search Implementation**
```python
def similarity_search(self, query, top_k=3):
    # 1. Convert query to embedding using sentence transformers
    embedding = self.encoder.encode(query)
    
    # 2. Find all documents with embeddings
    documents = self.find_documents({"embedding": {"$exists": True}})
    
    # 3. Calculate Euclidean distance for each document
    similarities = []
    for doc in documents:
        doc_embedding = doc["embedding"]
        # Convert Oracle numeric types to float
        doc_embedding_float = [float(x) for x in doc_embedding]
        
        # Calculate Euclidean distance
        distance = sum((a - b) ** 2 for a, b in zip(embedding, doc_embedding_float)) ** 0.5
        similarities.append((distance, doc))
    
    # 4. Sort by similarity (lower distance = more similar)
    similarities.sort(key=lambda x: x[0])
    
    # 5. Return top_k results
    return [doc for _, doc in similarities[:top_k]]
```

### **Embedding Generation & Storage**
- **Sentence Transformers**: Uses 'all-MiniLM-L12-v2' model for 384-dimensional embeddings
- **Automatic processing**: New reviews automatically get embeddings when added
- **Batch operations**: Can process hundreds of reviews simultaneously
- **Transaction safety**: All operations are ACID compliant

### **SODA Operations Used**
```python
# Core SODA operations for document management
collection.insertOne(document)           # Insert single document
collection.find().filter(criteria)       # Query documents
collection.find().key(id).replaceOne()   # Update document
collection.find().key(id).remove()       # Delete document
collection.find().getCursor()            # Iterate through results
```

### **Performance Optimizations**
- **Binary storage**: BLOB columns for efficient JSON and ID storage
- **Indexed queries**: Automatic indexing on key columns
- **Connection pooling**: Reusable database connections
- **Batch processing**: Bulk operations for embedding updates

---

## **5. Distributed RAG: The Magic Behind the Scenes (5 minutes)**

### **What is RAG?**
- **Retrieval-Augmented Generation**: Combines vector search with LLM responses
- **Context-aware answers**: AI responds based on your actual data
- **No hallucinations**: Responses grounded in real information

### **The Hallucination Problem We Solved**
- **Initial issue**: LLM was creating fake reviews and making up information
- **Root cause**: Generic prompts allowed the AI to be "creative" with responses
- **Solution**: Strict prompt engineering with explicit constraints

### **The Anti-Hallucination Prompt Engineering**
```python
prompt = f"""You are a helpful assistant. Show the EXACT information from the retrieved documents. Do not format, interpret, or change anything.

Context (Retrieved Documents):
{context}

Question: {req.question}

CRITICAL RULES:
- Show EXACTLY what is in the retrieved documents above
- Do NOT create tables, charts, or formatted presentations
- Do NOT change the wording or add any interpretation
- Do NOT combine or synthesize information
- Simply list each review exactly as it appears in the context
- If asked for a review, show the raw review text from the documents
- Present the data in the simplest possible format

Answer:"""
```

### **Why This Prompt Design Works**
- **Explicit constraints** prevent creative interpretation
- **"EXACT information"** instruction forces factual responses
- **"Do NOT" statements** clearly define boundaries
- **Simple format requirement** avoids complex hallucinations

### **The Complete RAG Pipeline**
1. **User asks question** → Frontend sends to FastAPI
2. **Vector similarity search** → Find relevant reviews in Oracle using SODA
3. **Context building** → Extract exact text from retrieved documents
4. **Anti-hallucination prompt** → Send to LLM with strict rules
5. **Factual response** → Return only information from actual data

### **Why This Approach Works**
- **Scalable**: Can handle thousands of products and reviews
- **Accurate**: Context comes from your actual data
- **Reliable**: No more fake information or hallucinations
- **Maintainable**: Easy to update and improve

---

## **Demo & Live Examples (Throughout)**

### **Real Questions You Can Ask**
- "What are customers saying about our wireless headphones?"
- "Which products have the best ratings?"
- "What common issues do customers mention?"

### **Behind the Scenes**
- Show how vectors are generated using sentence transformers
- Demonstrate SODA similarity search in action
- Display the context building process from Oracle collections

---

## **Key Takeaways**

1. **MERN + Microservices = AI-Ready Architecture**
2. **SODA + Vector Search = NoSQL with AI Capabilities**
3. **Vector Search + LLM = Intelligent User Experience**
4. **Distributed Design = Scalable & Maintainable**
5. **Oracle 23ai = Enterprise-Grade Vector Database**
6. **Prompt Engineering = Hallucination Prevention**

### **Next Steps for Your Organization**
- **Start with simple chat** on product pages
- **Add vector embeddings** to existing data using SODA
- **Scale AI services** based on user demand
- **Extend to other data sources** (customer support, product descriptions)

---

## **Questions & Discussion**

*"The beauty of this approach is that you're not just adding AI to your app - you're creating an intelligent layer that understands your business data and can help your customers make better decisions. And most importantly, you're doing it using Oracle's enterprise-grade SODA interface with built-in vector capabilities."*

---

## **Technical Implementation Summary**

### **Frontend (React)**
- Simple chat component with message display and input
- Direct API calls to FastAPI RAG service
- Error handling and loading states

### **Backend (Node.js + Python)**
- Express server handles ecommerce logic
- FastAPI service handles RAG operations
- Microservices communicate via REST APIs

### **Database (Oracle 23ai + SODA)**
- JSON collections with vector embeddings
- SODA operations for NoSQL-style access
- Vector similarity search for context retrieval
- Binary storage for optimal performance

### **AI Layer (Ollama + RAG)**
- Local LLM deployment with Ollama
- Anti-hallucination prompt engineering
- Context-aware response generation
- Sentence transformers for embeddings

---

*This architecture demonstrates how modern web applications can evolve from simple CRUD operations to intelligent, AI-powered systems while maintaining the familiar MERN stack development experience and leveraging Oracle's enterprise-grade vector database capabilities through SODA.*
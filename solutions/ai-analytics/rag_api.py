# FastAPI server for RAG-based LLM chat integration with MERN ecommerce app
# This file exposes a REST API endpoint that enables the frontend to query the LLM
# with context from the Oracle vector store, implementing the RAG pattern

import yaml
with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)
import oracledb
oracledb.init_oracle_client(lib_dir=config.get('WALLET_DIR', 'C:/oracle/instantclient'))
from fastapi import FastAPI, Request
from pydantic import BaseModel
from oracle_vector_store import OracleVectorStore
from ollama_client import OllamaClient
from fastapi.middleware.cors import CORSMiddleware

# Initialize FastAPI app for the RAG service
app = FastAPI()

# Configure CORS to allow requests from the MERN frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request model for the RAG endpoint
class RAGRequest(BaseModel):
    question: str

# Initialize components for RAG pipeline
vector_store = OracleVectorStore(config)
ollama = OllamaClient(config['ollama']['endpoint'])

def build_context(docs, max_tokens=1000):
    """
    Builds a context string from retrieved documents, showing exactly what's in the vectors.
    No creative synthesis - just the raw review data for the LLM to present.
    """
    context = ""
    token_count = 0
    
    print(f"🔍 Building context from {len(docs)} documents (exact vector data)...")
    
    for i, d in enumerate(docs):
        try:
            # Parse the JSON text to extract relevant fields
            import json
            doc_data = json.loads(d.get('text', '{}'))
            
            # Extract only the relevant text content, not the entire document
            title = doc_data.get('title', '')
            review = doc_data.get('review', '')
            rating = doc_data.get('rating', '')
            is_recommended = doc_data.get('isRecommended', '')
            
            # Build a simple, factual context entry showing exactly what's in the vector
            doc_context = f"Review {i+1}: {title} - Rating: {rating}/5, Recommended: {is_recommended}\n{review}\n"
            
            tokens = len(doc_context.split())
            if token_count + tokens > max_tokens:
                print(f"⚠️  Stopping at document {i+1} due to token limit ({token_count + tokens} > {max_tokens})")
                break
                
            context += doc_context
            token_count += tokens
            
            print(f"📄 Added document {i+1}: {title} ({tokens} tokens, total: {token_count})")
            
        except (json.JSONDecodeError, KeyError) as e:
            print(f"⚠️  Error processing document {i+1}: {e}")
            continue
    
    print(f"✅ Final context: {token_count} tokens, {len(context)} characters")
    return context.strip()

@app.post("/rag")
async def rag_endpoint(req: RAGRequest):
    """
    Main RAG endpoint that:
    1. Retrieves relevant context from Oracle vector store
    2. Builds a prompt with the context
    3. Generates a response using Ollama LLM
    4. Returns the answer to the MERN frontend
    """
    print(f"\n🚀 RAG request received: '{req.question}'")
    
    # Step 1: Retrieve relevant documents
    print("🔍 Step 1: Retrieving relevant documents from vector store...")
    docs = vector_store.similarity_search(req.question, top_k=5)
    print(f"✅ Retrieved {len(docs)} documents from similarity search")
    
    # Step 2: Build context from documents
    print("🔍 Step 2: Building context from retrieved documents...")
    context = build_context(docs)
    
    # Step 3: Build prompt with context
    print("🔍 Step 3: Building prompt with context...")
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
    print(f"📝 Final prompt length: {len(prompt)} characters")
    print(f"📝 Context preview: {context[:200]}..." if len(context) > 200 else f"📝 Full context: {context}")
    
    # Step 4: Generate response using LLM
    print("🔍 Step 4: Generating response using Ollama LLM...")
    health = ollama.health()
    if not health.get("ok"):
        print(f"❌ Ollama not reachable: {health}")
        return {"error": "Ollama service unreachable", "details": health}
    answer = ollama.generate(prompt, model="phi3")
    print(f"✅ LLM response generated: {len(answer)} characters")
    
    return {"answer": answer}
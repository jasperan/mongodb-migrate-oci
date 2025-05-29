# FastAPI server for RAG-based LLM chat integration with MERN ecommerce app
# This file exposes a REST API endpoint that enables the frontend to query the LLM
# with context from the Oracle vector store, implementing the RAG pattern

from fastapi import FastAPI, Request
from pydantic import BaseModel
import yaml
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

# Load configuration for vector store and Ollama client
with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

# Initialize components for RAG pipeline
vector_store = OracleVectorStore(config)
ollama = OllamaClient(config['ollama']['endpoint'])

def build_context(docs, max_tokens=1000):
    """
    Builds a context string from retrieved documents, respecting token limits.
    This helps prevent prompt overflow when sending to the LLM.
    """
    context = ""
    token_count = 0
    for d in docs:
        text = d.get('text') or ''
        tokens = len(text.split())
        if token_count + tokens > max_tokens:
            break
        context += text + "\n"
        token_count += tokens
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
    docs = vector_store.similarity_search(req.question, top_k=5)
    context = build_context(docs)
    prompt = f"You are an expert assistant. Use the following context to answer the question.\n\nContext:\n{context}\n\nQuestion: {req.question}\nAnswer:"
    answer = ollama.generate(prompt, model="phi3")
    return {"answer": answer}
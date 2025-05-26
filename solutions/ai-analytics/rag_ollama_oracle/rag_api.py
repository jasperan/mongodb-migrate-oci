from fastapi import FastAPI, Request
from pydantic import BaseModel
import yaml
from oracle_vector_store import OracleVectorStore
from ollama_client import OllamaClient
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RAGRequest(BaseModel):
    question: str

with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

vector_store = OracleVectorStore(config)
ollama = OllamaClient(config['ollama']['endpoint'])

def build_context(docs, max_tokens=1000):
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
    docs = vector_store.similarity_search(req.question, top_k=5)
    context = build_context(docs)
    prompt = f"You are an expert assistant. Use the following context to answer the question.\n\nContext:\n{context}\n\nQuestion: {req.question}\nAnswer:"
    answer = ollama.generate(prompt, model="phi3")
    return {"answer": answer} 
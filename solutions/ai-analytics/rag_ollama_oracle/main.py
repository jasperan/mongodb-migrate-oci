import yaml
from oracle_vector_store import OracleVectorStore
from ollama_client import OllamaClient
import json

def build_context(docs, max_tokens=1000):
    # Concatenate up to max_tokens worth of text from docs
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

with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

vector_store = OracleVectorStore(config)
ollama = OllamaClient(config['ollama']['endpoint'])

def rag_query(user_query):
    docs = vector_store.similarity_search(user_query, top_k=5)
    print('--- DOCS --- {}'.format(docs))
    context = build_context(docs)
    print('--- CONTEXT --- {}'.format(context))
    prompt = f"You are an expert assistant. Use the following context to answer the question.\n\nContext:\n{context}\n\nQuestion: {user_query}\nAnswer:"
    return ollama.generate(prompt, model="phi3")

if __name__ == "__main__":
    q = input("Enter your question: ")
    print(rag_query(q)) 
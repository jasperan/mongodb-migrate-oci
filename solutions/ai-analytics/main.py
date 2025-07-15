import yaml
with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)
import oracledb
oracledb.init_oracle_client(lib_dir=config.get('WALLET_DIR', 'C:/oracle/instantclient'))
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

vector_store = OracleVectorStore(config)
ollama = OllamaClient(config['ollama']['endpoint'])

def rag_query(user_query):
    print("🔍 Performing similarity search for your query...")
    docs = vector_store.similarity_search(user_query, top_k=5)
    print(f"📄 Retrieved {len(docs)} relevant documents from Oracle.")
    context = build_context(docs)
    print(f"📝 Built context with {len(context.split())} words.")
    prompt = f"You are an expert assistant. Use the following context to answer the question.\n\nContext:\n{context}\n\nQuestion: {user_query}\nAnswer:"
    print("🤖 Generating answer using Ollama...")
    return ollama.generate(prompt, model="phi3")

if __name__ == "__main__":
    print("💬 Ready for your question!")
    q = input("❓ Enter your question: ")
    answer = rag_query(q)
    print("\n🟢 Answer:")
    print(answer) 
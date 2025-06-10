from main import rag_query

if __name__ == "__main__":
    print("Testing RAG with Oracle 23ai and Ollama...")
    question = "What are the 5 most positive reviews for the product?"
    answer = rag_query(question)
    print(f"Q: {question}\nA: {answer}") 
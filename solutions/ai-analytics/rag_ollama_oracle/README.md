# RAG with Oracle 23ai Vector Search and Remote Ollama LLM

This solution demonstrates Retrieval-Augmented Generation (RAG) using Oracle 23ai's vector similarity search and a remote Ollama LLM endpoint.

## Setup

1. Fill in `config.yaml` with your Oracle DB and Ollama endpoint details.
2. Install requirements:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the test script:
   ```bash
   python test_rag.py
   ```

## Files
- `main.py`: Main RAG workflow
- `oracle_vector_store.py`: Oracle vector search logic
- `ollama_client.py`: Remote LLM client
- `config.yaml`: Configuration file
- `test_rag.py`: Example/test script
- `review_collection_sync.py`: Extract and search reviews from Oracle to ReviewCollection
- `generate_reviews.py`: Generate and insert fake reviews for testing

## Test Steps
1. Ensure Oracle 23ai is running and accessible.
2. Ensure Ollama is running remotely and accessible via the endpoint in `config.yaml`.
3. Run `python test_rag.py` and check for relevant responses retrieved via vector search and LLM.

## ReviewCollection Usage

### Ingest reviews from Oracle table `ecommercedv.reviews` to `ReviewCollection`
```bash
python review_collection_sync.py --ingest
```

### Query ReviewCollection for similar reviews
```bash
python review_collection_sync.py --query "great battery life"
```

## Generating and Inserting Fake Reviews

You can generate 100 randomized reviews for a product and insert them into the Oracle `ecommercedv.reviews` table for testing.

### Generate reviews and save to file
```bash
python generate_reviews.py --generate --product-id 68252aa00200de17ccc48b75 --file my_reviews.json
```

### Insert generated reviews into Oracle
```bash
python generate_reviews.py --insert --file my_reviews.json
```

### Generate and insert in one step (uses default product id)
```bash
python generate_reviews.py --generate --insert
```
import yaml
with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)
import oracledb
oracledb.init_oracle_client(lib_dir=config.get('WALLET_DIR', 'C:/oracle/instantclient'))
import argparse
import random
import json
from datetime import datetime, timedelta
import array
from sentence_transformers import SentenceTransformer
from soda_utils import SodaUtils

DEFAULT_PRODUCT_ID = "68252aa00200de17ccc48b75"
TITLES = [
    "Great product!", "Not bad", "Would buy again", "Disappointed", "Exceeded expectations",
    "Just okay", "Loved it", "Not worth the price", "Fantastic quality", "Could be better"
]
REVIEWS = [
    "Good granite, smooth granite.",
    "The product arrived on time and works as expected.",
    "Quality could be improved.",
    "Absolutely love it!",
    "Not what I expected.",
    "Five stars!",
    "Would not recommend.",
    "Perfect for my needs.",
    "Too expensive for the quality.",
    "Customer service was helpful.",
    "This granite rock exceeded my expectations! Very solid and well-formed.",
    "Decent weight to it, feels authentic. Good for landscaping projects.",
    "Beautiful natural patterns in the stone. Worth every penny.",
    "Arrived with a small chip, but still usable. Three stars.",
    "Exactly what I needed for my rock garden. Fast shipping too!",
    "The color is more gray than shown in photos. Still okay though.",
    "Heavy-duty granite that will last forever. Highly recommend!",
    "Perfect size and texture. Great addition to my collection.",
    "Overpriced for what you get. Found better deals elsewhere.",
    "Stunning piece of geology! My kids love learning about it.",
    "Good for DIY projects. Cuts clean if you have the right tools.",
    "Natural beauty at its finest. Makes a great paperweight.",
    "Packaging could be better - worried it might break in transit.",
    "Solid granite, no complaints. Does exactly what granite should do.",
    "The surface has interesting mineral inclusions. Very educational.",
    "Not suitable for indoor use as advertised. Too rough.",
    "Amazing quality control. Every edge is perfectly natural.",
    "Great conversation starter for my office desk.",
    "Would buy again. Excellent value for genuine granite.",
    "Delivery was delayed but the rock itself is fantastic."
]


def random_date_may_2025():
    start = datetime(2025, 5, 1)
    end = datetime(2025, 5, 31, 23, 59, 59)
    delta = end - start
    random_seconds = random.randint(0, int(delta.total_seconds()))
    return (start + timedelta(seconds=random_seconds)).isoformat() + "Z"


def generate_reviews(product_id, n=100):
    encoder = SentenceTransformer('all-MiniLM-L12-v2')
    reviews = []
    for i in range(n):
        review_obj = {
            "_id": f"gen_{i+1:03d}",
            "product": product_id,
            "user": f"user_{random.randint(1000,9999)}",
            "rating": random.randint(1, 5),
            "isRecommended": random.choice([True, False]),
            "status": random.choice(["Approved", "Pending", "Rejected"]),
            "review": random.choice(REVIEWS),
            "title": random.choice(TITLES),
            "created": random_date_may_2025(),
            "__v": 0
        }
        review_id = review_obj["_id"]
        text = json.dumps(review_obj, ensure_ascii=False)
        embedding = encoder.encode(text)
        # Add embedding to the review object
        review_obj["embedding"] = embedding.tolist()
        reviews.append(review_obj)
    return reviews


def save_reviews(reviews, filename):
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(reviews, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(reviews)} reviews to {filename}")


def insert_reviews_soda_collection(reviews, config):
    """
    Insert reviews into the SODA collection using SODA operations
    """
    try:
        print("🔗 Initializing SODA connection...")
        soda_utils = SodaUtils(config)
        
        print(f"📊 Inserting {len(reviews)} reviews into SODA collection...")
        inserted_count = soda_utils.insert_many_documents(reviews)
        
        print(f"✅ Successfully inserted {inserted_count} reviews into SODA collection.")
        
        # Get collection statistics
        stats = soda_utils.get_collection_stats()
        print(f"📈 Collection stats: {stats}")
        
    except Exception as e:
        print(f"❌ Error in insert_reviews_soda_collection: {e}")
        raise


def main():
    parser = argparse.ArgumentParser(description="Generate and/or insert fake product reviews for SODA collection.")
    parser.add_argument('--generate', action='store_true', help='Generate review JSONs and save to file')
    parser.add_argument('--insert', action='store_true', help='Insert reviews from file into Oracle SODA collection')
    parser.add_argument('--product-id', type=str, default=DEFAULT_PRODUCT_ID, help='Product ID for reviews')
    parser.add_argument('--file', type=str, default='generated_reviews.json', help='File to save/load reviews')
    args = parser.parse_args()

    try:
        if args.generate:
            print("🔄 Generating reviews...")
            reviews = generate_reviews(args.product_id)
            save_reviews(reviews, args.file)

        if args.insert:
            print("🔄 Loading reviews from file...")
            with open(args.file, 'r', encoding='utf-8') as f:
                reviews = json.load(f)
            insert_reviews_soda_collection(reviews, config)
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1

if __name__ == "__main__":
    main() 
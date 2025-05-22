import yaml
import sys
from oracle_vector_store import OracleVectorStore

def check_credentials():
    try:
        with open('config.yaml', 'r') as f:
            config = yaml.safe_load(f)
        for key in ["ORACLE_DB_USERNAME", "ORACLE_DB_PASSWORD", "ORACLE_DB_DSN"]:
            if not config.get(key):
                print(f"✗ {key} not found in config.yaml")
                return False
        print("✓ Oracle DB credentials found in config.yaml")
        return True
    except Exception as e:
        print(f"✗ Error reading config.yaml: {e}")
        return False

def test_connection():
    print("Testing Oracle DB connection...")
    try:
        with open('config.yaml', 'r') as f:
            config = yaml.safe_load(f)
        store = OracleVectorStore(config)
        print("✓ Connection successful!")
        return True
    except Exception as e:
        print(f"✗ Connection failed: {e}")
        return False

if __name__ == "__main__":
    print("=== Oracle DB Connection Test ===\n")
    if not check_credentials():
        print("✗ Please update config.yaml with valid Oracle DB credentials.")
        sys.exit(1)
    if not test_connection():
        sys.exit(1)
    print("\n=== Test Completed ===") 
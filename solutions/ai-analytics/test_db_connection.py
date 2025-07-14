import yaml
with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)
import oracledb
oracledb.init_oracle_client(lib_dir=config.get('WALLET_DIR', 'C:/oracle/instantclient'))
import sys
from soda_utils import SodaUtils

def check_credentials():
    try:
        for key in ["ORACLE_DB_USERNAME", "ORACLE_DB_PASSWORD", "ORACLE_DB_DSN"]:
            if not config.get(key):
                print(f"✗ {key} not found in config.yaml")
                return False
        print("✓ Oracle DB credentials found in config.yaml")
        return True
    except Exception as e:
        print(f"✗ Error reading config.yaml: {e}")
        return False

def test_soda_connection():
    print("Testing SODA connection...")
    try:
        soda_utils = SodaUtils(config)
        print("✓ SODA connection successful!")
        
        # Test basic SODA operations
        print("Testing SODA operations...")
        stats = soda_utils.get_collection_stats()
        print(f"✓ Collection stats: {stats}")
        
        return True
    except Exception as e:
        print(f"✗ SODA connection failed: {e}")
        return False

if __name__ == "__main__":
    print("=== Oracle DB SODA Connection Test ===\n")
    if not check_credentials():
        print("✗ Please update config.yaml with valid Oracle DB credentials.")
        sys.exit(1)
    if not test_soda_connection():
        sys.exit(1)
    print("\n=== Test Completed ===") 
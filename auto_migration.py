import argparse
import subprocess
import yaml
import sys
from pathlib import Path

def load_config(config_path):
    with open(config_path, "r") as f:
        return yaml.safe_load(f)

def run_mongodump(uri, dump_dir):
    print(f"Running mongodump from {uri} into {dump_dir}...")
    result = subprocess.run([
        "mongodump",
        f"--uri={uri}",
        f"--out={dump_dir}"
    ])
    if result.returncode != 0:
        print("mongodump failed.")
        sys.exit(result.returncode)
    print("mongodump completed.")

def run_mongorestore(uri, dump_dir):
    print(f"Running mongorestore to {uri} from {dump_dir}...")
    result = subprocess.run([
        "mongorestore",
        "--drop",
        f"--uri={uri}",
        "--nsInclude=merndemo",
        "--writeConcern", "{w:0}",
        "--tlsInsecure",
        dump_dir
    ])
    if result.returncode != 0:
        print("mongorestore failed.")
        sys.exit(result.returncode)
    print("mongorestore completed.")

def main():
    parser = argparse.ArgumentParser(description="Auto MongoDB migration tool")
    parser.add_argument("action", choices=["dump", "migrate"], help="Action to perform")
    parser.add_argument("--config", default="config.yaml", help="Path to config.yaml")
    args = parser.parse_args()

    config_path = Path(args.config)
    if not config_path.exists():
        print(f"Config file {config_path} not found.")
        sys.exit(1)

    config = load_config(config_path)
    source_uri = config["source_mongo_uri"]
    oracle_uri = config["oracle_mongo_uri"]
    dump_dir = config.get("dump_dir", "dump")

    if args.action == "dump":
        run_mongodump(source_uri, dump_dir)
    elif args.action == "migrate":
        run_mongorestore(oracle_uri, dump_dir)

if __name__ == "__main__":
    main()
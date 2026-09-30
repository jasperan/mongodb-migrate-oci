#!/usr/bin/env python3
"""Verify a MongoDB -> Oracle Database API for MongoDB migration.

Confirms the *Validate* step of Oracle's MongoDB migration process: the target
documents must match the source documents, collection by collection.

Checks performed per collection:
  1. collection existence in both stores
  2. document counts
  3. the set of ``_id`` values (nothing lost, nothing added)
  4. per-document content equality after type normalisation
     (numbers compared by value, dates/decimals/binary/ObjectId normalised)

Usage:
    python scripts/verify_migration.py \
        --source "mongodb://127.0.0.1:27017/mern_ecommerce" \
        --target "mongodb://MERN26:...@...oraclecloudapps.com:27017/mern26?authMechanism=PLAIN&authSource=%24external&ssl=true&retryWrites=false&loadBalanced=true"

Exit code 0 = migration verified, 1 = differences found, 2 = connection/setup error.
"""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import math
import sys
from typing import Any

from bson import Binary, Decimal128, ObjectId, Regex, Timestamp
from pymongo import MongoClient

SOURCE_DEFAULT = "mongodb://127.0.0.1:27017/mern_ecommerce"


def canonical(value: Any) -> Any:
    """Normalise a BSON value so source and target compare structurally."""
    if isinstance(value, ObjectId):
        return {"$oid": str(value)}
    if isinstance(value, Decimal128):
        return {"$number": str(value.to_decimal().normalize())}
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
            return {"$number": str(value)}
        return {"$number": repr(float(value))}
    if isinstance(value, dt.datetime):
        if value.tzinfo is not None:
            value = value.astimezone(dt.timezone.utc).replace(tzinfo=None)
        return {"$date": value.isoformat()}
    if isinstance(value, dt.date):
        return {"$date": value.isoformat()}
    if isinstance(value, (Binary, bytes, bytearray)):
        return {"$binary": base64.b64encode(bytes(value)).decode()}
    if isinstance(value, Timestamp):
        return {"$timestamp": [value.time, value.inc]}
    if isinstance(value, Regex):
        return {"$regex": [value.pattern, value.flags]}
    if isinstance(value, dict):
        return {str(k): canonical(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [canonical(v) for v in value]
    if value is None or isinstance(value, (str,)):
        return value
    return {"$unrepresentable": str(value)}


def doc_hash(doc: dict) -> str:
    return json.dumps(canonical(doc), sort_keys=True, separators=(",", ":"))


def describe_diff(src: dict, tgt: dict, limit: int = 8) -> list[str]:
    """Return human-readable paths where two documents differ."""
    diffs: list[str] = []

    def walk(path: str, a: Any, b: Any) -> None:
        if len(diffs) >= limit:
            return
        if isinstance(a, dict) and isinstance(b, dict):
            for key in sorted(set(a) | set(b)):
                if key not in a:
                    diffs.append(f"{path}.{key}: missing in source")
                elif key not in b:
                    diffs.append(f"{path}.{key}: missing in target")
                else:
                    walk(f"{path}.{key}", a[key], b[key])
        elif isinstance(a, list) and isinstance(b, list):
            if len(a) != len(b):
                diffs.append(f"{path}: array length {len(a)} != {len(b)}")
            for i, (x, y) in enumerate(zip(a, b)):
                walk(f"{path}[{i}]", x, y)
        elif canonical(a) != canonical(b):
            diffs.append(f"{path}: {canonical(a)!r} != {canonical(b)!r}")

    walk("$", src, tgt)
    return diffs


def db_name_from_uri(uri: str, fallback: str) -> str:
    tail = uri.split("/")[-1]
    return (tail.split("?")[0] or fallback) if tail else fallback


def iter_docs(collection, batch: int = 500):
    cursor = collection.find({}, batch_size=batch)
    for doc in cursor:
        yield doc


def is_system_collection(name: str) -> bool:
    """MongoDB's own namespaces (system.profile, system.views, system.buckets.*).

    They are server bookkeeping, not migrated data: enabling the profiler — which
    the planning step of the migration guide does with db.setProfilingLevel() —
    creates ``system.profile`` on the source, and comparing it would report a
    collection that no target can ever have.
    """
    return name.startswith("system.")


def verify(source_uri: str, target_uri: str, ignore_collections: set[str], sample: int) -> tuple[bool, dict]:
    src_client = MongoClient(source_uri, serverSelectionTimeoutMS=15000)
    tgt_client = MongoClient(target_uri, serverSelectionTimeoutMS=30000)

    src_db = src_client.get_default_database()
    tgt_db = tgt_client.get_default_database()
    if src_db is None:
        raise SystemExit("source URI must include a database name")
    if tgt_db is None:
        raise SystemExit("target URI must include a database name")

    excluded = {"system.indexes", "system.views"} | ignore_collections
    src_all = src_db.list_collection_names()
    src_names = {n for n in src_all if n not in excluded and not is_system_collection(n)}
    src_system = sorted(n for n in src_all if is_system_collection(n) and n not in excluded)
    # The target legitimately carries extra read-only objects (JSON collection
    # views created on top of the migrated collections); only real collections
    # are compared one-to-one.
    tgt_all = {entry["name"]: entry.get("type", "collection") for entry in tgt_db.list_collections()}
    tgt_views = sorted(
        name for name, kind in tgt_all.items() if kind == "view" and name not in excluded and not is_system_collection(name)
    )
    tgt_names = {
        name for name, kind in tgt_all.items() if kind != "view" and name not in excluded and not is_system_collection(name)
    }

    ok = True
    report = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "sourceLabel": src_db.name,
        "targetLabel": tgt_db.name,
        "sourceDocuments": 0,
        "targetDocuments": 0,
        "targetViews": tgt_views,
        "skippedSystemCollections": src_system,
        "verified": False,
        "collections": [],
    }
    print(f"source: {src_db.name}  ({len(src_names)} collections)")
    print(f"target: {tgt_db.name}  ({len(tgt_names)} collections, {len(tgt_views)} views)"
          + (f"  [views: {', '.join(tgt_views)}]" if tgt_views else ""))
    if src_system:
        print(f"skipped: {len(src_system)} MongoDB system collection(s): {', '.join(src_system)}")
    print("-" * 78)

    for name in sorted(src_names - tgt_names):
        print(f"[MISSING  ] {name}: collection absent in target")
        ok = False
        report["collections"].append({"name": name, "source": None, "target": None, "status": "missing-in-target"})
    for name in sorted(tgt_names - src_names):
        print(f"[EXTRA    ] {name}: collection absent in source")
        ok = False
        report["collections"].append({"name": name, "source": None, "target": None, "status": "extra-in-target"})

    for name in sorted(src_names & tgt_names):
        src_coll, tgt_coll = src_db[name], tgt_db[name]
        src_count = src_coll.count_documents({})
        tgt_count = tgt_coll.count_documents({})

        src_ids = set()
        src_hashes = {}
        for doc in iter_docs(src_coll):
            key = canonical(doc.get("_id"))
            src_ids.add(json.dumps(key, sort_keys=True))
            src_hashes[json.dumps(key, sort_keys=True)] = doc_hash(doc)

        tgt_ids = set()
        mismatches: list[tuple[str, list[str]]] = []
        tgt_hashes = {}
        for doc in iter_docs(tgt_coll):
            key = canonical(doc.get("_id"))
            key_s = json.dumps(key, sort_keys=True)
            tgt_ids.add(key_s)
            tgt_hashes[key_s] = doc_hash(doc)

        missing = src_ids - tgt_ids
        extra = tgt_ids - src_ids
        for key in sorted(src_ids & tgt_ids):
            if src_hashes[key] != tgt_hashes[key]:
                if len(mismatches) < sample:
                    mismatches.append(
                        (key, describe_diff(
                            src_coll.find_one(_id_from_key(key)) or {},
                            tgt_coll.find_one(_id_from_key(key)) or {},
                        ))
                    )

        matched = not (missing or extra or mismatches)
        status = "OK       " if matched else "MISMATCH "
        if not matched:
            ok = False
        report["collections"].append(
            {
                "name": name,
                "source": src_count,
                "target": tgt_count,
                "missing": len(missing),
                "extra": len(extra),
                "differing": len(mismatches),
                "status": "match" if matched else "mismatch",
                "sampleDiffs": [{"id": key, "diffs": diffs} for key, diffs in mismatches],
            }
        )
        report["sourceDocuments"] += src_count
        report["targetDocuments"] += tgt_count
        print(
            f"[{status}] {name}: source={src_count} target={tgt_count} "
            f"missing={len(missing)} extra={len(extra)} differing={len(mismatches)}"
            + ("" if matched else f" (showing up to {sample} diffs)")
        )
        for key in sorted(missing)[:sample]:
            print(f"             - missing in target: {key}")
        for key in sorted(extra)[:sample]:
            print(f"             - extra in target:   {key}")
        for key, diffs in mismatches:
            print(f"             - content diff for {key}:")
            for d in diffs:
                print(f"                 {d}")

    print("-" * 78)
    print("RESULT: " + ("PASS - source and target documents match" if ok else "FAIL - differences found"))
    src_client.close()
    tgt_client.close()
    report["verified"] = ok
    return ok, report


def _id_from_key(key: str):
    value = json.loads(key)
    if isinstance(value, dict) and "$oid" in value:
        return ObjectId(value["$oid"])
    return value


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", default=SOURCE_DEFAULT, help="source MongoDB URI (default: %(default)s)")
    parser.add_argument("--target", required=True, help="target Oracle MongoDB API URI")
    parser.add_argument("--ignore", default="", help="comma-separated collections to skip")
    parser.add_argument("--sample", type=int, default=5, help="max diffs reported per collection (default: %(default)s)")
    parser.add_argument("--report", help="write a JSON report (used by GET /api/admin-db/migration-status)")
    args = parser.parse_args()

    try:
        ok, report = verify(args.source, args.target, {c for c in args.ignore.split(",") if c}, args.sample)
    except Exception as exc:  # connection / setup problems
        print(f"ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2

    if args.report:
        with open(args.report, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2, sort_keys=False)
            handle.write("\n")
        print(f"report written: {args.report}")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

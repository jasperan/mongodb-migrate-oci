#!/usr/bin/env python3
"""Verify a MongoDB -> Oracle Database API for MongoDB migration.

Confirms the *Validate* step of Oracle's MongoDB migration process: the target
documents must match the source documents, collection by collection.

Checks performed per collection:
  1. collection existence in both stores
  2. document counts
  3. the set of ``_id`` values (nothing lost, nothing added)
  4. per-document content equality after type normalisation
     (numbers compared by exact decimal value, so 5 == 5.0 == Decimal128('5')
     while 2**53 + 1 != 2**53; dates/binary/ObjectId normalised)

Every differing document is counted; ``--sample`` only caps how many are
printed and stored in the report.

Usage:
    pip install -r scripts/requirements.txt
    python scripts/verify_migration.py \
        --source "mongodb://127.0.0.1:27017/mern_ecommerce" \
        --target "mongodb://MERN26:...@...oraclecloudapps.com:27017/mern26?authMechanism=PLAIN&authSource=%24external&ssl=true&retryWrites=false&loadBalanced=true"

Exit code 0 = migration verified, 1 = differences found, a collection missing, or
nothing was compared, 2 = connection/setup error (no report is written).
"""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import decimal
import hashlib
import json
import math
import os
import sys
import tempfile
from typing import Any

from bson import Binary, Decimal128, Int64, ObjectId, Regex, Timestamp
from pymongo import MongoClient


def exact_number(value: Any) -> dict:
    """Render an int/float/Int64/Decimal128 as its exact decimal value.

    Floats go through repr(), their shortest round-trip decimal, so a double
    19.99 equals the Decimal128 19.99 Oracle may hand back; integers keep every
    digit, so 2**53 + 1 stays distinct from 2**53.
    """
    if isinstance(value, Decimal128):
        number = value.to_decimal()
    elif isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return {"$number": str(value)}
        number = decimal.Decimal(repr(value))
    else:
        number = decimal.Decimal(int(value))
    if not number.is_finite():
        return {"$number": str(number)}
    if number == 0:
        return {"$number": "0"}  # also folds -0 into 0
    return {"$number": format(number.normalize(), "f")}


def canonical(value: Any) -> Any:
    """Normalise a BSON value so source and target compare structurally."""
    if isinstance(value, ObjectId):
        return {"$oid": str(value)}
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float, Int64, Decimal128)):
        return exact_number(value)
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


def doc_hash(doc: dict) -> bytes:
    """sha256 of the canonical JSON: memory stays 32 bytes per document."""
    payload = json.dumps(canonical(doc), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).digest()


def id_key(doc: dict) -> str:
    return json.dumps(canonical(doc.get("_id")), sort_keys=True)


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


def iter_docs(collection, batch: int = 500):
    yield from collection.find({}, batch_size=batch)


def is_system_collection(name: str) -> bool:
    """MongoDB's own namespaces (system.profile, system.views, system.buckets.*).

    They are server bookkeeping, not migrated data: enabling the profiler — which
    the planning step of the migration guide does with db.setProfilingLevel() —
    creates ``system.profile`` on the source, and comparing it would report a
    collection that no target can ever have.
    """
    return name.startswith("system.")


def _id_from_key(key: str):
    value = json.loads(key)
    if isinstance(value, dict) and "$oid" in value:
        return ObjectId(value["$oid"])
    return value


def compare_collection(src_coll, tgt_coll, sample: int) -> dict:
    """Stream both sides once; only the source digests are held in memory."""
    src_digests = {id_key(doc): doc_hash(doc) for doc in iter_docs(src_coll)}
    extra: list[str] = []
    differing: list[str] = []
    for doc in iter_docs(tgt_coll):
        key = id_key(doc)
        expected = src_digests.pop(key, None)
        if expected is None:
            extra.append(key)
        elif expected != doc_hash(doc):
            differing.append(key)
    missing = sorted(src_digests)
    differing.sort()
    extra.sort()

    samples = []
    for key in differing[:sample]:
        oid = _id_from_key(key)
        samples.append((key, describe_diff(src_coll.find_one(oid) or {}, tgt_coll.find_one(oid) or {})))
    return {"missing": missing, "extra": extra, "differing": differing, "samples": samples}


def verify(source_uri: str, target_uri: str, ignore_collections: set[str], sample: int) -> tuple[bool, dict]:
    src_client = MongoClient(source_uri, serverSelectionTimeoutMS=15000)
    tgt_client = MongoClient(target_uri, serverSelectionTimeoutMS=30000)
    try:
        # get_default_database() raises ConfigurationError (exit 2) when a URI names no database
        src_db = src_client.get_default_database()
        tgt_db = tgt_client.get_default_database()
        return _verify(src_db, tgt_db, ignore_collections, sample)
    finally:
        src_client.close()
        tgt_client.close()


def _verify(src_db, tgt_db, ignore_collections: set[str], sample: int) -> tuple[bool, dict]:
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
        count = src_db[name].count_documents({})
        print(f"[MISSING  ] {name}: collection absent in target (source has {count} documents)")
        ok = False
        report["collections"].append({"name": name, "source": count, "target": 0, "status": "missing-in-target"})
        report["sourceDocuments"] += count
    for name in sorted(tgt_names - src_names):
        count = tgt_db[name].count_documents({})
        print(f"[EXTRA    ] {name}: collection absent in source (target has {count} documents)")
        ok = False
        report["collections"].append({"name": name, "source": 0, "target": count, "status": "extra-in-target"})
        report["targetDocuments"] += count

    compared_collections = 0
    compared_documents = 0
    for name in sorted(src_names & tgt_names):
        src_coll, tgt_coll = src_db[name], tgt_db[name]
        src_count = src_coll.count_documents({})
        tgt_count = tgt_coll.count_documents({})
        result = compare_collection(src_coll, tgt_coll, sample)
        missing, extra, differing = result["missing"], result["extra"], result["differing"]
        compared_collections += 1
        compared_documents += src_count + tgt_count

        matched = not (missing or extra or differing)
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
                "differing": len(differing),
                "status": "match" if matched else "mismatch",
                "sampleDiffs": [{"id": key, "diffs": diffs} for key, diffs in result["samples"]],
            }
        )
        report["sourceDocuments"] += src_count
        report["targetDocuments"] += tgt_count
        print(
            f"[{status}] {name}: source={src_count} target={tgt_count} "
            f"missing={len(missing)} extra={len(extra)} differing={len(differing)}"
            + ("" if matched else f" (showing up to {sample} of each)")
        )
        for key in missing[:sample]:
            print(f"             - missing in target: {key}")
        for key in extra[:sample]:
            print(f"             - extra in target:   {key}")
        for key, diffs in result["samples"]:
            print(f"             - content diff for {key}:")
            for d in diffs:
                print(f"                 {d}")

    if compared_collections == 0 or compared_documents == 0:
        print("nothing was compared: no collection exists on both sides, or all of them are empty")
        ok = False

    print("-" * 78)
    print("RESULT: " + ("PASS - source and target documents match" if ok else "FAIL - differences found"))
    report["verified"] = ok
    return ok, report


def write_report_atomic(path: str, report: dict) -> None:
    """Write next to the target and rename, so readers never see a half-written file."""
    directory = os.path.dirname(os.path.abspath(path))
    fd, tmp_path = tempfile.mkstemp(prefix=".migration-report-", suffix=".tmp", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2, sort_keys=False)
            handle.write("\n")
        os.replace(tmp_path, path)
    except BaseException:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise


def _make_output_encoding_safe() -> None:
    """Windows consoles/pipes default to cp1252; never crash on a non-ASCII document value."""
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")


def main() -> int:
    _make_output_encoding_safe()
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", required=True, help="source MongoDB URI (must name the database)")
    parser.add_argument("--target", required=True, help="target Oracle MongoDB API URI (must name the database)")
    parser.add_argument("--ignore", default="", help="comma-separated collections to skip")
    parser.add_argument("--sample", type=int, default=5, help="max items printed/stored per kind and collection (default: %(default)s)")
    parser.add_argument(
        "--report",
        help="write a JSON report to this path (the dashboard reads docs/26ai/migration-report.json; "
        "copy a PASS report there deliberately, this script never targets it by default)",
    )
    args = parser.parse_args()

    try:
        ok, report = verify(args.source, args.target, {c for c in args.ignore.split(",") if c}, max(args.sample, 0))
    except Exception as exc:  # connection / setup problems
        print(f"ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2

    if args.report:
        try:
            write_report_atomic(args.report, report)
        except OSError as exc:
            print(f"ERROR: cannot write report: {exc}", file=sys.stderr)
            return 2
        print(f"report written: {args.report}")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

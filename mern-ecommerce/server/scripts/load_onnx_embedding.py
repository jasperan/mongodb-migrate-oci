"""Load the all-MiniLM-L12-v2 ONNX embedding model into the MERN26 schema.

The onnx2oracle CLI builds the augmented ONNX graph; this script only replaces its
DSN handling because Autonomous Database here is reached over walletless TLS
(tcps://host:1522/service), which the CLI's user/pw@host:port/service parser cannot
express. Everything else (metadata, DBMS_VECTOR.LOAD_ONNX_MODEL call) mirrors
onnx2oracle.loader.upload_model.

usage: <onnx2oracle-venv>/python.exe load_onnx_embedding.py <user> <password> <tcps dsn>
"""
import json
import logging
import pathlib
import sys

import oracledb
from onnx2oracle.pipeline import build_augmented
from onnx2oracle.presets import get_preset

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

METADATA = json.dumps(
    {"function": "embedding", "embeddingOutput": "embedding", "input": {"pre_text": ["DATA"]}}
)


def _build_augmented(spec):
    """build_augmented() unlinks its scratch .onnx while ONNX still holds the handle.

    On Windows that raises WinError 32 after the bytes are already produced, so the
    unlink is made best-effort for the duration of the call.
    """
    original_unlink = pathlib.Path.unlink

    def tolerant_unlink(self, *args, **kwargs):
        try:
            return original_unlink(self, *args, **kwargs)
        except PermissionError:
            logging.warning("leaving locked scratch file behind: %s", self)

    pathlib.Path.unlink = tolerant_unlink
    try:
        return build_augmented(spec)
    finally:
        pathlib.Path.unlink = original_unlink


def main(user: str, password: str, dsn: str, preset: str = "all-MiniLM-L12-v2") -> int:
    spec = get_preset(preset)
    logging.info("building augmented ONNX graph for %s (%s)", preset, spec.oracle_name)
    model_bytes = _build_augmented(spec)
    logging.info("augmented model: %d bytes", len(model_bytes))

    with oracledb.connect(user=user, password=password, dsn=dsn) as conn:
        with conn.cursor() as cur:
            cur.execute("select count(*) from user_mining_models where model_name = :n", n=spec.oracle_name)
            if cur.fetchone()[0]:
                logging.info("model %s already registered", spec.oracle_name)
            else:
                logging.info("uploading into %s ...", spec.oracle_name)
                cur.execute(
                    """
                    BEGIN
                        DBMS_VECTOR.LOAD_ONNX_MODEL(
                            model_name => :model_name,
                            model_data => :model_data,
                            metadata   => JSON(:metadata)
                        );
                    END;
                    """,
                    model_name=spec.oracle_name,
                    model_data=model_bytes,
                    metadata=METADATA,
                )
                conn.commit()

            cur.execute(
                f"select round(vector_distance(vector_embedding({spec.oracle_name} using 'wool blanket' as data),"
                f" vector_embedding({spec.oracle_name} using 'woolen throw' as data), cosine), 4),"
                f" vector_dimension_count(vector_embedding({spec.oracle_name} using 'x' as data)) from dual"
            )
            distance, dims = cur.fetchone()
            logging.info("sanity: cosine distance(wool blanket, woolen throw) = %s, dims = %s", distance, dims)
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        raise SystemExit(2)
    raise SystemExit(main(sys.argv[1], sys.argv[2], sys.argv[3]))

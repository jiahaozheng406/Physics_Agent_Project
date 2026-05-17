from __future__ import annotations

import json
import os
import shutil
import sqlite3
import sys
from pathlib import Path


EXTERNAL_KB_SESSION_ID = "__external_knowledge_base__"


def resolve_repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def resolve_runtime_dir(repo_root: Path) -> Path:
    return Path(os.getenv("PHYSICS_AGENT_RUNTIME_DIR", str(repo_root))).resolve()


def resolve_database_path(runtime_dir: Path) -> Path:
    db_url = os.getenv("DATABASE_URL", "").strip()
    if db_url.startswith("sqlite:///"):
        return Path(db_url.removeprefix("sqlite:///")).resolve()
    if db_url:
        return Path(db_url).resolve()
    return (runtime_dir / "data" / "physics_agent.sqlite3").resolve()


def resolve_phet_catalog_path(runtime_dir: Path) -> Path:
    return Path(
        os.getenv("PHYSICS_AGENT_PHET_CACHE_PATH", str(runtime_dir / "data" / "phet_catalog.json"))
    ).resolve()


def export_phet_catalog(source_path: Path, output_path: Path) -> None:
    payload = {
        "schema_version": 0,
        "ui_profile_version": "",
        "updated_at": "",
        "total": 0,
        "groups": [],
    }
    if source_path.exists():
        try:
            payload = json.loads(source_path.read_text("utf-8"))
        except Exception:
            payload = payload
    output_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def export_external_knowledge_base(db_path: Path, output_path: Path) -> None:
    payload = {
        "documents": [],
        "chunks": [],
        "updated_at": "",
    }
    if not db_path.exists():
        output_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        documents = conn.execute(
            """
            SELECT id, original_name, char_count, source_label, created_at
            FROM documents
            WHERE session_id = ?
            ORDER BY created_at ASC
            """,
            (EXTERNAL_KB_SESSION_ID,),
        ).fetchall()

        chunks = conn.execute(
            """
            SELECT d.original_name, d.source_label, dc.chunk_index, dc.chunk_text, dc.start_offset
            FROM document_chunks dc
            JOIN documents d ON d.id = dc.document_id
            WHERE d.session_id = ?
            ORDER BY d.created_at ASC, dc.chunk_index ASC
            """,
            (EXTERNAL_KB_SESSION_ID,),
        ).fetchall()
    finally:
        conn.close()

    payload["documents"] = [
        {
            "id": row["id"],
            "name": row["original_name"],
            "original_name": row["original_name"],
            "char_count": int(row["char_count"] or 0),
            "source_label": row["source_label"],
            "created_at": row["created_at"],
            "is_external": True,
        }
        for row in documents
    ]
    payload["chunks"] = [
        {
            "original_name": row["original_name"],
            "source_label": row["source_label"],
            "chunk_index": int(row["chunk_index"] or 0),
            "chunk_text": row["chunk_text"] or "",
            "start_offset": int(row["start_offset"] or 0),
        }
        for row in chunks
    ]
    payload["updated_at"] = payload["documents"][0]["created_at"] if payload["documents"] else ""
    output_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: export-lite-assets.py <output_dir>", file=sys.stderr)
        return 1

    output_dir = Path(sys.argv[1]).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    repo_root = resolve_repo_root()
    runtime_dir = resolve_runtime_dir(repo_root)
    phet_catalog_path = resolve_phet_catalog_path(runtime_dir)
    database_path = resolve_database_path(runtime_dir)

    export_phet_catalog(phet_catalog_path, output_dir / "phet_catalog.json")
    export_external_knowledge_base(database_path, output_dir / "external_kb.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

UNSET = object()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class SessionStore:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS session_folders (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    last_model TEXT
                );

                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    model_used TEXT,
                    status TEXT NOT NULL,
                    input_mode TEXT NOT NULL,
                    error_message TEXT,
                    created_at TEXT NOT NULL,
                    completed_at TEXT,
                    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_messages_session_created
                ON messages (session_id, created_at);

                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    original_name TEXT NOT NULL,
                    stored_path TEXT NOT NULL,
                    mime_type TEXT NOT NULL,
                    char_count INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    source_label TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_documents_session_created
                ON documents (session_id, created_at);

                CREATE TABLE IF NOT EXISTS document_chunks (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    chunk_index INTEGER NOT NULL,
                    chunk_text TEXT NOT NULL,
                    source_label TEXT NOT NULL,
                    start_offset INTEGER NOT NULL,
                    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_document_chunks_document
                ON document_chunks (document_id, chunk_index);

                CREATE VIRTUAL TABLE IF NOT EXISTS document_chunks_fts
                USING fts5(chunk_text);
                """
            )
            self._ensure_column(conn, "sessions", "title", "TEXT NOT NULL DEFAULT '新对话'")
            self._ensure_column(conn, "sessions", "folder_id", "TEXT")
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions (updated_at DESC)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_sessions_folder_id ON sessions (folder_id)"
            )

    def _ensure_column(self, conn: sqlite3.Connection, table_name: str, column_name: str, ddl: str) -> None:
        columns = {
            row["name"]
            for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()
        }
        if column_name not in columns:
            conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {ddl}")

    def create_session(self, *, title: str = "新对话", folder_id: str | None = None, session_id: str | None = None) -> str:
        now = utc_now()
        session_key = session_id or uuid.uuid4().hex
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO sessions (session_id, created_at, updated_at, last_model, title, folder_id)
                VALUES (?, ?, ?, NULL, ?, ?)
                ON CONFLICT(session_id) DO NOTHING
                """,
                (session_key, now, now, title or "新对话", folder_id),
            )
        return session_key

    def ensure_session(self, session_id: str, *, title: str = "新对话") -> None:
        now = utc_now()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO sessions (session_id, created_at, updated_at, last_model, title, folder_id)
                VALUES (?, ?, ?, NULL, ?, NULL)
                ON CONFLICT(session_id) DO UPDATE SET updated_at = excluded.updated_at
                """,
                (session_id, now, now, title or "新对话"),
            )

    def touch_session(self, session_id: str, last_model: str | None = None) -> None:
        self.ensure_session(session_id)
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE sessions
                SET updated_at = ?, last_model = COALESCE(?, last_model)
                WHERE session_id = ?
                """,
                (utc_now(), last_model, session_id),
            )

    def create_message(
        self,
        session_id: str,
        role: str,
        content: str,
        *,
        model_used: str | None = None,
        status: str = "done",
        input_mode: str = "text",
        error_message: str | None = None,
        completed_at: str | None = None,
    ) -> str:
        self.ensure_session(session_id)
        message_id = uuid.uuid4().hex
        now = utc_now()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO messages (
                    id, session_id, role, content, model_used, status,
                    input_mode, error_message, created_at, completed_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    message_id,
                    session_id,
                    role,
                    content,
                    model_used,
                    status,
                    input_mode,
                    error_message,
                    now,
                    completed_at or (now if status in {"done", "error"} else None),
                ),
            )
            conn.execute(
                "UPDATE sessions SET updated_at = ? WHERE session_id = ?",
                (now, session_id),
            )
        return message_id

    def update_message(
        self,
        message_id: str,
        *,
        content: str | None = None,
        model_used: str | None = None,
        status: str | None = None,
        error_message: str | None = None,
        completed: bool = False,
    ) -> None:
        updates: list[str] = []
        values: list[Any] = []
        if content is not None:
            updates.append("content = ?")
            values.append(content)
        if model_used is not None:
            updates.append("model_used = ?")
            values.append(model_used)
        if status is not None:
            updates.append("status = ?")
            values.append(status)
        if error_message is not None:
            updates.append("error_message = ?")
            values.append(error_message)
        if completed:
            updates.append("completed_at = ?")
            values.append(utc_now())
        if not updates:
            return
        values.append(message_id)
        with self._connect() as conn:
            conn.execute(
                f"UPDATE messages SET {', '.join(updates)} WHERE id = ?",
                values,
            )

    def list_model_messages(self, session_id: str, limit: int) -> list[dict[str, str]]:
        self.ensure_session(session_id)
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT role, content
                FROM messages
                WHERE session_id = ?
                  AND status = 'done'
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (session_id, limit),
            ).fetchall()
        return [
            {"role": row["role"], "content": row["content"]}
            for row in reversed(rows)
        ]

    def mark_incomplete_messages(self, session_id: str) -> None:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, role, content
                FROM messages
                WHERE session_id = ?
                  AND status IN ('pending', 'streaming')
                ORDER BY created_at ASC
                """,
                (session_id,),
            ).fetchall()
            for row in rows:
                content = row["content"].strip() or "上次回复中断"
                if row["role"] == "assistant":
                    content = "上次回复中断"
                conn.execute(
                    """
                    UPDATE messages
                    SET status = 'error',
                        content = ?,
                        error_message = COALESCE(error_message, 'interrupted'),
                        completed_at = ?
                    WHERE id = ?
                    """,
                    (content, utc_now(), row["id"]),
                )

    def get_session_state(self, session_id: str, *, limit: int = 100) -> dict[str, Any]:
        self.mark_incomplete_messages(session_id)
        with self._connect() as conn:
            session_row = conn.execute(
                """
                SELECT s.session_id, s.created_at, s.updated_at, s.last_model, s.title, s.folder_id, f.name AS folder_name
                FROM sessions s
                LEFT JOIN session_folders f ON s.folder_id = f.id
                WHERE s.session_id = ?
                """,
                (session_id,),
            ).fetchone()
            message_rows = conn.execute(
                """
                SELECT *
                FROM (
                    SELECT id, role, content, model_used, status, input_mode, error_message, created_at, completed_at
                    FROM messages
                    WHERE session_id = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                )
                ORDER BY created_at ASC
                """,
                (session_id, limit),
            ).fetchall()
            document_rows = conn.execute(
                """
                SELECT id, original_name, stored_path, mime_type, char_count, created_at, source_label
                FROM documents
                WHERE session_id = ?
                ORDER BY created_at ASC
                """,
                (session_id,),
            ).fetchall()
        return {
            "session_id": session_id,
            "last_model": session_row["last_model"] if session_row else None,
            "title": session_row["title"] if session_row else "新对话",
            "folder_id": session_row["folder_id"] if session_row else None,
            "folder_name": session_row["folder_name"] if session_row else None,
            "messages": [dict(row) for row in message_rows],
            "documents": [dict(row) for row in document_rows],
            "doc_count": len(document_rows),
        }

    def _next_source_label(self, conn: sqlite3.Connection, session_id: str) -> str:
        count = conn.execute(
            "SELECT COUNT(*) AS count FROM documents WHERE session_id = ?",
            (session_id,),
        ).fetchone()["count"]
        return f"[Source {count + 1}]"

    def add_document(
        self,
        session_id: str,
        *,
        original_name: str,
        stored_path: str,
        mime_type: str,
        text: str,
        chunks: list[dict[str, Any]],
    ) -> dict[str, Any]:
        self.ensure_session(session_id)
        document_id = uuid.uuid4().hex
        created_at = utc_now()
        with self._connect() as conn:
            source_label = self._next_source_label(conn, session_id)
            conn.execute(
                """
                INSERT INTO documents (
                    id, session_id, original_name, stored_path,
                    mime_type, char_count, created_at, source_label
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    document_id,
                    session_id,
                    original_name,
                    stored_path,
                    mime_type,
                    len(text),
                    created_at,
                    source_label,
                ),
            )
            for index, chunk in enumerate(chunks):
                chunk_id = uuid.uuid4().hex
                cursor = conn.execute(
                    """
                    INSERT INTO document_chunks (
                        id, document_id, chunk_index, chunk_text, source_label, start_offset
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        chunk_id,
                        document_id,
                        index,
                        chunk["text"],
                        source_label,
                        chunk["start_offset"],
                    ),
                )
                conn.execute(
                    "INSERT INTO document_chunks_fts (rowid, chunk_text) VALUES (?, ?)",
                    (cursor.lastrowid, chunk["text"]),
                )
            conn.execute(
                "UPDATE sessions SET updated_at = ? WHERE session_id = ?",
                (created_at, session_id),
            )
        return {
            "id": document_id,
            "source_label": source_label,
            "chars": len(text),
            "name": original_name,
        }

    def clear_history(self, session_id: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
            conn.execute(
                "UPDATE sessions SET updated_at = ?, last_model = NULL WHERE session_id = ?",
                (utc_now(), session_id),
            )

    def clear_documents(self, session_id: str) -> list[str]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT stored_path FROM documents WHERE session_id = ?",
                (session_id,),
            ).fetchall()
            conn.execute(
                """
                DELETE FROM document_chunks_fts
                WHERE rowid IN (
                    SELECT dc.rowid
                    FROM document_chunks dc
                    JOIN documents d ON d.id = dc.document_id
                    WHERE d.session_id = ?
                )
                """,
                (session_id,),
            )
            conn.execute(
                """
                DELETE FROM document_chunks
                WHERE document_id IN (
                    SELECT id FROM documents WHERE session_id = ?
                )
                """,
                (session_id,),
            )
            conn.execute("DELETE FROM documents WHERE session_id = ?", (session_id,))
            conn.execute(
                "UPDATE sessions SET updated_at = ? WHERE session_id = ?",
                (utc_now(), session_id),
            )
        return [row["stored_path"] for row in rows]

    def set_last_model(self, session_id: str, model_used: str | None) -> None:
        self.touch_session(session_id, last_model=model_used)

    def maybe_autotitle_session(self, session_id: str, candidate: str) -> None:
        title = self._normalize_title(candidate)
        if not title:
            return
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT title, (
                    SELECT COUNT(*) FROM messages
                    WHERE session_id = ?
                      AND role = 'user'
                ) AS user_count
                FROM sessions
                WHERE session_id = ?
                """,
                (session_id, session_id),
            ).fetchone()
            if not row:
                return
            current_title = (row["title"] or "").strip()
            if row["user_count"] <= 1 and current_title in {"", "新对话"}:
                conn.execute(
                    "UPDATE sessions SET title = ?, updated_at = ? WHERE session_id = ?",
                    (title, utc_now(), session_id),
                )

    def update_session(
        self,
        session_id: str,
        *,
        title: str | None = None,
        folder_id: str | object = UNSET,
    ) -> None:
        self.ensure_session(session_id)
        updates: list[str] = ["updated_at = ?"]
        values: list[Any] = [utc_now()]
        if title is not None:
            updates.append("title = ?")
            values.append(self._normalize_title(title) or "新对话")
        if folder_id is not UNSET:
            updates.append("folder_id = ?")
            values.append(folder_id)
        values.append(session_id)
        with self._connect() as conn:
            conn.execute(
                f"UPDATE sessions SET {', '.join(updates)} WHERE session_id = ?",
                values,
            )

    def create_folder(self, name: str) -> dict[str, Any]:
        clean_name = (name or "").strip()
        if not clean_name:
            raise ValueError("Folder name cannot be empty.")
        folder_id = uuid.uuid4().hex
        now = utc_now()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO session_folders (id, name, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (folder_id, clean_name, now, now),
            )
        return {"id": folder_id, "name": clean_name}

    def rename_folder(self, folder_id: str, name: str) -> None:
        clean_name = (name or "").strip()
        if not clean_name:
            raise ValueError("Folder name cannot be empty.")
        with self._connect() as conn:
            conn.execute(
                "UPDATE session_folders SET name = ?, updated_at = ? WHERE id = ?",
                (clean_name, utc_now(), folder_id),
            )

    def delete_folder(self, folder_id: str) -> None:
        with self._connect() as conn:
            conn.execute("UPDATE sessions SET folder_id = NULL WHERE folder_id = ?", (folder_id,))
            conn.execute("DELETE FROM session_folders WHERE id = ?", (folder_id,))

    def delete_session(self, session_id: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))

    def list_folders(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT f.id, f.name, f.created_at, f.updated_at,
                       SUM(
                           CASE
                               WHEN EXISTS (
                                   SELECT 1 FROM messages m
                                   WHERE m.session_id = s.session_id
                               ) OR EXISTS (
                                   SELECT 1 FROM documents d
                                   WHERE d.session_id = s.session_id
                               ) THEN 1
                               ELSE 0
                           END
                       ) AS session_count
                FROM session_folders f
                LEFT JOIN sessions s ON s.folder_id = f.id
                GROUP BY f.id, f.name, f.created_at, f.updated_at
                ORDER BY f.updated_at DESC, f.created_at DESC
                """
            ).fetchall()
        return [dict(row) for row in rows]

    def list_sessions(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                WITH session_summary AS (
                    SELECT
                        s.session_id,
                        s.title,
                        s.folder_id,
                        f.name AS folder_name,
                        s.created_at,
                        s.updated_at,
                        s.last_model,
                        (
                            SELECT COUNT(*) FROM messages m
                            WHERE m.session_id = s.session_id
                        ) AS message_count,
                        (
                            SELECT COUNT(*) FROM documents d
                            WHERE d.session_id = s.session_id
                        ) AS doc_count,
                        (
                            SELECT content FROM messages m
                            WHERE m.session_id = s.session_id
                            ORDER BY created_at DESC
                            LIMIT 1
                        ) AS last_message
                    FROM sessions s
                    LEFT JOIN session_folders f ON s.folder_id = f.id
                )
                SELECT *
                FROM session_summary
                WHERE message_count > 0 OR doc_count > 0
                ORDER BY updated_at DESC, created_at DESC
                """
            ).fetchall()
        return [dict(row) for row in rows]

    def get_folder_by_name(self, name: str) -> dict[str, Any] | None:
        clean_name = (name or "").strip()
        if not clean_name:
            return None
        with self._connect() as conn:
            row = conn.execute(
                "SELECT id, name, created_at, updated_at FROM session_folders WHERE name = ?",
                (clean_name,),
            ).fetchone()
        return dict(row) if row else None

    def list_documents(self, session_id: str) -> list[dict[str, Any]]:
        self.ensure_session(session_id)
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, original_name, stored_path, mime_type, char_count, created_at, source_label
                FROM documents
                WHERE session_id = ?
                ORDER BY created_at ASC
                """,
                (session_id,),
            ).fetchall()
        return [dict(row) for row in rows]

    def search_chunks(self, session_id: str, query: str, limit: int) -> list[dict[str, Any]]:
        self.ensure_session(session_id)
        fts_query = self._build_fts_query(query)
        with self._connect() as conn:
            rows: list[sqlite3.Row] = []
            if fts_query:
                rows = conn.execute(
                    """
                    SELECT
                        dc.id,
                        dc.document_id,
                        dc.chunk_index,
                        dc.chunk_text,
                        dc.source_label,
                        dc.start_offset,
                        d.original_name,
                        bm25(document_chunks_fts) AS score
                    FROM document_chunks_fts
                    JOIN document_chunks dc ON document_chunks_fts.rowid = dc.rowid
                    JOIN documents d ON dc.document_id = d.id
                    WHERE document_chunks_fts MATCH ?
                      AND d.session_id = ?
                    ORDER BY score
                    LIMIT ?
                    """,
                    (fts_query, session_id, max(limit * 3, limit)),
                ).fetchall()
            if not rows:
                rows = self._fallback_search(conn, session_id, query, max(limit * 3, limit))
        deduped: list[dict[str, Any]] = []
        seen_texts: set[str] = set()
        per_doc: dict[str, int] = {}
        for row in rows:
            text = row["chunk_text"].strip()
            if not text or text in seen_texts:
                continue
            document_id = row["document_id"]
            if per_doc.get(document_id, 0) >= 2:
                continue
            seen_texts.add(text)
            per_doc[document_id] = per_doc.get(document_id, 0) + 1
            deduped.append(dict(row))
            if len(deduped) >= limit:
                break
        return deduped

    def _fallback_search(
        self,
        conn: sqlite3.Connection,
        session_id: str,
        query: str,
        limit: int,
    ) -> list[sqlite3.Row]:
        rows = conn.execute(
            """
            SELECT
                dc.id,
                dc.document_id,
                dc.chunk_index,
                dc.chunk_text,
                dc.source_label,
                dc.start_offset,
                d.original_name
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
            WHERE d.session_id = ?
            """,
            (session_id,),
        ).fetchall()
        scored: list[tuple[int, sqlite3.Row]] = []
        query_text = query.strip()
        for row in rows:
            text = row["chunk_text"]
            score = 0
            if query_text and query_text in text:
                score += 10
            for token in self._query_tokens(query_text):
                if token and token in text:
                    score += 1
            if score:
                scored.append((score, row))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [row for _, row in scored[:limit]]

    def _query_tokens(self, query: str) -> list[str]:
        cleaned = "".join(ch if ch.isalnum() or "\u4e00" <= ch <= "\u9fff" else " " for ch in query)
        tokens = [token.strip() for token in cleaned.split() if token.strip()]
        if not tokens and query.strip():
            tokens = [query.strip()]
        return tokens

    def _build_fts_query(self, query: str) -> str:
        tokens = self._query_tokens(query)
        if not tokens:
            return ""
        safe_tokens = [token.replace('"', "") for token in tokens[:8]]
        return " OR ".join(f'"{token}"' for token in safe_tokens if token)

    def _normalize_title(self, text: str) -> str:
        cleaned = " ".join((text or "").replace("\n", " ").split()).strip()
        if not cleaned:
            return ""
        return cleaned[:48]


def resolve_database_path(base_dir: Path) -> Path:
    db_url = os.getenv("DATABASE_URL", "").strip()
    if db_url.startswith("sqlite:///"):
        return Path(db_url.removeprefix("sqlite:///")).resolve()
    if db_url:
        return Path(db_url).resolve()
    return (base_dir / "data" / "physics_agent.sqlite3").resolve()

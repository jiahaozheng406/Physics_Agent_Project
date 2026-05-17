from __future__ import annotations

import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

UNSET = object()
EXTERNAL_KB_SESSION_ID = "__external_knowledge_base__"
EXTERNAL_SOURCE_INDEX_OFFSET = 1000
TEACHER_KB_SESSION_PREFIX = "__teacher_knowledge_base__:"


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

                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    provider TEXT NOT NULL,
                    provider_subject TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    role TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(provider, provider_subject)
                );

                CREATE TABLE IF NOT EXISTS auth_tokens (
                    token TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    last_used_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS phone_verification_codes (
                    id TEXT PRIMARY KEY,
                    phone TEXT NOT NULL,
                    purpose TEXT NOT NULL,
                    code_hash TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    consumed_at TEXT,
                    attempt_count INTEGER NOT NULL DEFAULT 0,
                    max_attempts INTEGER NOT NULL DEFAULT 5,
                    delivery_mode TEXT NOT NULL DEFAULT 'mock',
                    created_at TEXT NOT NULL,
                    last_sent_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS user_sessions (
                    session_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    session_kind TEXT NOT NULL DEFAULT 'conversation',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS user_folders (
                    folder_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (folder_id) REFERENCES session_folders(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens (user_id)"
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_phone_verification_phone_created
                ON phone_verification_codes (phone, purpose, created_at DESC)
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id, session_kind)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_user_folders_user_id ON user_folders (user_id)"
            )

    def _ensure_column(self, conn: sqlite3.Connection, table_name: str, column_name: str, ddl: str) -> None:
        columns = {
            row["name"]
            for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()
        }
        if column_name not in columns:
            conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {ddl}")

    def teacher_kb_session_id(self, user_id: str) -> str:
        return f"{TEACHER_KB_SESSION_PREFIX}{user_id}"

    def _get_session_link(self, conn: sqlite3.Connection, session_id: str) -> sqlite3.Row | None:
        return conn.execute(
            """
            SELECT session_id, user_id, session_kind, created_at, updated_at
            FROM user_sessions
            WHERE session_id = ?
            """,
            (session_id,),
        ).fetchone()

    def _ensure_session_link(
        self,
        conn: sqlite3.Connection,
        session_id: str,
        user_id: str | None,
        *,
        session_kind: str = "conversation",
    ) -> None:
        if not user_id:
            return
        now = utc_now()
        row = self._get_session_link(conn, session_id)
        if row:
            if row["user_id"] != user_id:
                raise PermissionError("Session does not belong to current user.")
            conn.execute(
                """
                UPDATE user_sessions
                SET updated_at = ?,
                    session_kind = ?
                WHERE session_id = ?
                """,
                (now, row["session_kind"] or session_kind, session_id),
            )
            return
        conn.execute(
            """
            INSERT INTO user_sessions (session_id, user_id, session_kind, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (session_id, user_id, session_kind, now, now),
        )

    def assert_session_access(
        self,
        session_id: str,
        user_id: str,
        *,
        allow_kinds: tuple[str, ...] | None = None,
    ) -> dict[str, Any]:
        with self._connect() as conn:
            row = self._get_session_link(conn, session_id)
            if not row or row["user_id"] != user_id:
                raise PermissionError("Session does not belong to current user.")
            if allow_kinds and row["session_kind"] not in allow_kinds:
                raise PermissionError("Session kind is not allowed.")
        return dict(row)

    def _ensure_folder_access(self, conn: sqlite3.Connection, folder_id: str, user_id: str) -> None:
        row = conn.execute(
            """
            SELECT folder_id
            FROM user_folders
            WHERE folder_id = ?
              AND user_id = ?
            """,
            (folder_id, user_id),
        ).fetchone()
        if not row:
            raise PermissionError("Folder does not belong to current user.")

    def upsert_user(
        self,
        *,
        provider: str,
        provider_subject: str,
        display_name: str,
        role: str,
        allow_role_update: bool = True,
    ) -> dict[str, Any]:
        now = utc_now()
        clean_provider = (provider or "demo").strip().lower() or "demo"
        clean_subject = (provider_subject or "").strip() or uuid.uuid4().hex
        clean_display_name = " ".join((display_name or "").split()).strip() or "未命名用户"
        clean_role = "teacher" if (role or "").strip().lower() == "teacher" else "student"
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT id, role
                FROM users
                WHERE provider = ?
                  AND provider_subject = ?
                """,
                (clean_provider, clean_subject),
            ).fetchone()
            if row:
                user_id = row["id"]
                next_role = clean_role if allow_role_update else ((row["role"] or "").strip().lower() or clean_role)
                conn.execute(
                    """
                    UPDATE users
                    SET display_name = ?,
                        role = ?,
                        updated_at = ?
                    WHERE id = ?
                    """,
                    (clean_display_name, next_role, now, user_id),
                )
            else:
                user_id = uuid.uuid4().hex
                conn.execute(
                    """
                    INSERT INTO users (id, provider, provider_subject, display_name, role, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (user_id, clean_provider, clean_subject, clean_display_name, clean_role, now, now),
                )
            user_row = conn.execute(
                """
                SELECT id, provider, provider_subject, display_name, role, created_at, updated_at
                FROM users
                WHERE id = ?
                """,
                (user_id,),
            ).fetchone()
        return dict(user_row) if user_row else {}

    def get_user_by_identity(self, provider: str, provider_subject: str) -> dict[str, Any] | None:
        clean_provider = (provider or "").strip().lower()
        clean_subject = (provider_subject or "").strip()
        if not clean_provider or not clean_subject:
            return None
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT id, provider, provider_subject, display_name, role, created_at, updated_at
                FROM users
                WHERE provider = ?
                  AND provider_subject = ?
                """,
                (clean_provider, clean_subject),
            ).fetchone()
        return dict(row) if row else None

    def create_auth_token(self, user_id: str) -> str:
        token = uuid.uuid4().hex
        now = utc_now()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO auth_tokens (token, user_id, created_at, last_used_at)
                VALUES (?, ?, ?, ?)
                """,
                (token, user_id, now, now),
            )
        return token

    def get_user_by_token(self, token: str) -> dict[str, Any] | None:
        clean_token = (token or "").strip()
        if not clean_token:
            return None
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT
                    u.id,
                    u.provider,
                    u.provider_subject,
                    u.display_name,
                    u.role,
                    u.created_at,
                    u.updated_at
                FROM auth_tokens t
                JOIN users u ON u.id = t.user_id
                WHERE t.token = ?
                """,
                (clean_token,),
            ).fetchone()
            if not row:
                return None
            conn.execute(
                "UPDATE auth_tokens SET last_used_at = ? WHERE token = ?",
                (utc_now(), clean_token),
            )
        return dict(row)

    def delete_auth_token(self, token: str) -> None:
        clean_token = (token or "").strip()
        if not clean_token:
            return
        with self._connect() as conn:
            conn.execute("DELETE FROM auth_tokens WHERE token = ?", (clean_token,))

    def get_latest_phone_verification(self, phone: str, *, purpose: str = "login") -> dict[str, Any] | None:
        clean_phone = (phone or "").strip()
        clean_purpose = (purpose or "login").strip() or "login"
        if not clean_phone:
            return None
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT
                    id,
                    phone,
                    purpose,
                    code_hash,
                    expires_at,
                    consumed_at,
                    attempt_count,
                    max_attempts,
                    delivery_mode,
                    created_at,
                    last_sent_at
                FROM phone_verification_codes
                WHERE phone = ?
                  AND purpose = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (clean_phone, clean_purpose),
            ).fetchone()
        return dict(row) if row else None

    def create_phone_verification(
        self,
        *,
        phone: str,
        purpose: str = "login",
        code_hash: str,
        expires_at: str,
        max_attempts: int = 5,
        delivery_mode: str = "mock",
    ) -> dict[str, Any]:
        clean_phone = (phone or "").strip()
        clean_purpose = (purpose or "login").strip() or "login"
        record_id = uuid.uuid4().hex
        now = utc_now()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO phone_verification_codes (
                    id,
                    phone,
                    purpose,
                    code_hash,
                    expires_at,
                    consumed_at,
                    attempt_count,
                    max_attempts,
                    delivery_mode,
                    created_at,
                    last_sent_at
                )
                VALUES (?, ?, ?, ?, ?, NULL, 0, ?, ?, ?, ?)
                """,
                (
                    record_id,
                    clean_phone,
                    clean_purpose,
                    code_hash,
                    expires_at,
                    max(1, int(max_attempts)),
                    (delivery_mode or "mock").strip().lower() or "mock",
                    now,
                    now,
                ),
            )
            row = conn.execute(
                """
                SELECT
                    id,
                    phone,
                    purpose,
                    code_hash,
                    expires_at,
                    consumed_at,
                    attempt_count,
                    max_attempts,
                    delivery_mode,
                    created_at,
                    last_sent_at
                FROM phone_verification_codes
                WHERE id = ?
                """,
                (record_id,),
            ).fetchone()
        return dict(row) if row else {}

    def verify_phone_verification(
        self,
        *,
        phone: str,
        code_hash: str,
        purpose: str = "login",
    ) -> dict[str, Any]:
        clean_phone = (phone or "").strip()
        clean_purpose = (purpose or "login").strip() or "login"
        if not clean_phone or not code_hash:
            return {"ok": False, "reason": "missing"}

        now_iso = utc_now()
        now_dt = datetime.fromisoformat(now_iso)
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT
                    id,
                    phone,
                    purpose,
                    code_hash,
                    expires_at,
                    consumed_at,
                    attempt_count,
                    max_attempts,
                    delivery_mode,
                    created_at,
                    last_sent_at
                FROM phone_verification_codes
                WHERE phone = ?
                  AND purpose = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (clean_phone, clean_purpose),
            ).fetchone()
            if not row:
                return {"ok": False, "reason": "missing"}

            if row["consumed_at"]:
                return {"ok": False, "reason": "used"}

            if datetime.fromisoformat(str(row["expires_at"])) <= now_dt:
                return {"ok": False, "reason": "expired"}

            current_attempts = int(row["attempt_count"] or 0)
            max_attempts = max(1, int(row["max_attempts"] or 5))
            if current_attempts >= max_attempts:
                return {"ok": False, "reason": "too_many_attempts", "remaining_attempts": 0}

            if row["code_hash"] != code_hash:
                next_attempts = current_attempts + 1
                conn.execute(
                    """
                    UPDATE phone_verification_codes
                    SET attempt_count = ?
                    WHERE id = ?
                    """,
                    (next_attempts, row["id"]),
                )
                return {
                    "ok": False,
                    "reason": "too_many_attempts" if next_attempts >= max_attempts else "invalid",
                    "remaining_attempts": max(0, max_attempts - next_attempts),
                }

            conn.execute(
                """
                UPDATE phone_verification_codes
                SET consumed_at = ?
                WHERE id = ?
                """,
                (now_iso, row["id"]),
            )
        return {"ok": True, "record": dict(row)}

    def ensure_teacher_kb_session(self, user_id: str) -> str:
        session_id = self.teacher_kb_session_id(user_id)
        self.ensure_session(
            session_id,
            title="教师知识库",
            user_id=user_id,
            session_kind="teacher_kb",
        )
        return session_id

    def claim_orphan_workspace(self, user_id: str) -> None:
        now = utc_now()
        with self._connect() as conn:
            orphan_sessions = conn.execute(
                """
                SELECT session_id
                FROM sessions
                WHERE session_id != ?
                  AND session_id NOT IN (SELECT session_id FROM user_sessions)
                """,
                (EXTERNAL_KB_SESSION_ID,),
            ).fetchall()
            for row in orphan_sessions:
                session_id = row["session_id"]
                session_kind = "teacher_kb" if session_id.startswith(TEACHER_KB_SESSION_PREFIX) else "conversation"
                conn.execute(
                    """
                    INSERT INTO user_sessions (session_id, user_id, session_kind, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (session_id, user_id, session_kind, now, now),
                )

            orphan_folders = conn.execute(
                """
                SELECT id
                FROM session_folders
                WHERE id NOT IN (SELECT folder_id FROM user_folders)
                """
            ).fetchall()
            for row in orphan_folders:
                conn.execute(
                    """
                    INSERT INTO user_folders (folder_id, user_id, created_at, updated_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (row["id"], user_id, now, now),
                )

    def create_session(
        self,
        *,
        title: str = "新对话",
        folder_id: str | None = None,
        session_id: str | None = None,
        user_id: str | None = None,
        session_kind: str = "conversation",
    ) -> str:
        now = utc_now()
        session_key = session_id or uuid.uuid4().hex
        with self._connect() as conn:
            if folder_id and user_id:
                self._ensure_folder_access(conn, folder_id, user_id)
            conn.execute(
                """
                INSERT INTO sessions (session_id, created_at, updated_at, last_model, title, folder_id)
                VALUES (?, ?, ?, NULL, ?, ?)
                ON CONFLICT(session_id) DO NOTHING
                """,
                (session_key, now, now, title or "新对话", folder_id),
            )
            self._ensure_session_link(conn, session_key, user_id, session_kind=session_kind)
        return session_key

    def ensure_session(
        self,
        session_id: str,
        *,
        title: str = "新对话",
        user_id: str | None = None,
        session_kind: str = "conversation",
    ) -> None:
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
            self._ensure_session_link(conn, session_id, user_id, session_kind=session_kind)

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
        user_id: str | None = None,
        session_kind: str = "conversation",
        model_used: str | None = None,
        status: str = "done",
        input_mode: str = "text",
        error_message: str | None = None,
        completed_at: str | None = None,
    ) -> str:
        self.ensure_session(session_id, user_id=user_id, session_kind=session_kind)
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

    def get_session_state(
        self,
        session_id: str,
        *,
        limit: int = 100,
        user_id: str | None = None,
        role: str = "teacher",
    ) -> dict[str, Any]:
        if user_id:
            self.assert_session_access(session_id, user_id, allow_kinds=("conversation", "teacher_kb"))
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
        document_rows = self.list_documents(session_id, user_id=user_id, role=role)
        return {
            "session_id": session_id,
            "last_model": session_row["last_model"] if session_row else None,
            "title": session_row["title"] if session_row else "新对话",
            "folder_id": session_row["folder_id"] if session_row else None,
            "folder_name": session_row["folder_name"] if session_row else None,
            "messages": [dict(row) for row in message_rows],
            "documents": document_rows,
            "doc_count": len(document_rows),
        }

    def _next_source_label(
        self,
        conn: sqlite3.Connection,
        session_id: str,
        *,
        source_index_offset: int = 0,
    ) -> str:
        count = conn.execute(
            "SELECT COUNT(*) AS count FROM documents WHERE session_id = ?",
            (session_id,),
        ).fetchone()["count"]
        return f"[Source {source_index_offset + count + 1}]"

    def add_document(
        self,
        session_id: str,
        *,
        original_name: str,
        stored_path: str,
        mime_type: str,
        text: str,
        chunks: list[dict[str, Any]],
        source_index_offset: int = 0,
    ) -> dict[str, Any]:
        self.ensure_session(session_id)
        document_id = uuid.uuid4().hex
        created_at = utc_now()
        with self._connect() as conn:
            source_label = self._next_source_label(
                conn,
                session_id,
                source_index_offset=source_index_offset,
            )
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

    def has_document(self, session_id: str, stored_path: str) -> bool:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT 1
                FROM documents
                WHERE session_id = ?
                  AND LOWER(stored_path) = LOWER(?)
                LIMIT 1
                """,
                (session_id, stored_path),
            ).fetchone()
        return row is not None

    def clear_history(self, session_id: str, *, user_id: str | None = None) -> None:
        if user_id:
            self.assert_session_access(session_id, user_id, allow_kinds=("conversation",))
        with self._connect() as conn:
            conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
            conn.execute(
                "UPDATE sessions SET updated_at = ?, last_model = NULL WHERE session_id = ?",
                (utc_now(), session_id),
            )

    def clear_documents(self, session_id: str, *, user_id: str | None = None) -> list[str]:
        if user_id:
            self.assert_session_access(session_id, user_id, allow_kinds=("conversation", "teacher_kb"))
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
        user_id: str | None = None,
        title: str | None = None,
        folder_id: str | object = UNSET,
    ) -> None:
        self.ensure_session(session_id, user_id=user_id)
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
            if user_id:
                self.assert_session_access(session_id, user_id, allow_kinds=("conversation",))
                if isinstance(folder_id, str) and folder_id:
                    self._ensure_folder_access(conn, folder_id, user_id)
            conn.execute(
                f"UPDATE sessions SET {', '.join(updates)} WHERE session_id = ?",
                values,
            )

    def create_folder(self, name: str, *, user_id: str) -> dict[str, Any]:
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
            conn.execute(
                """
                INSERT INTO user_folders (folder_id, user_id, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (folder_id, user_id, now, now),
            )
        return {"id": folder_id, "name": clean_name}

    def rename_folder(self, folder_id: str, name: str, *, user_id: str) -> None:
        clean_name = (name or "").strip()
        if not clean_name:
            raise ValueError("Folder name cannot be empty.")
        with self._connect() as conn:
            self._ensure_folder_access(conn, folder_id, user_id)
            conn.execute(
                "UPDATE session_folders SET name = ?, updated_at = ? WHERE id = ?",
                (clean_name, utc_now(), folder_id),
            )

    def delete_folder(self, folder_id: str, *, user_id: str) -> None:
        with self._connect() as conn:
            self._ensure_folder_access(conn, folder_id, user_id)
            conn.execute(
                """
                UPDATE sessions
                SET folder_id = NULL
                WHERE session_id IN (
                    SELECT session_id
                    FROM user_sessions
                    WHERE user_id = ?
                )
                  AND folder_id = ?
                """,
                (user_id, folder_id),
            )
            conn.execute("DELETE FROM session_folders WHERE id = ?", (folder_id,))

    def delete_session(self, session_id: str, *, user_id: str | None = None) -> None:
        if user_id:
            self.assert_session_access(session_id, user_id, allow_kinds=("conversation",))
        with self._connect() as conn:
            conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))

    def list_folders(self, user_id: str) -> list[dict[str, Any]]:
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
                JOIN user_folders uf ON uf.folder_id = f.id
                LEFT JOIN sessions s ON s.folder_id = f.id
                WHERE uf.user_id = ?
                GROUP BY f.id, f.name, f.created_at, f.updated_at
                ORDER BY f.updated_at DESC, f.created_at DESC
                """
                ,
                (user_id,),
            ).fetchall()
        return [dict(row) for row in rows]

    def list_sessions(self, user_id: str) -> list[dict[str, Any]]:
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
                    JOIN user_sessions us ON us.session_id = s.session_id
                    LEFT JOIN session_folders f ON s.folder_id = f.id
                    WHERE us.user_id = ?
                      AND us.session_kind = 'conversation'
                )
                SELECT *
                FROM session_summary
                WHERE session_id != ?
                  AND (message_count > 0 OR doc_count > 0)
                ORDER BY updated_at DESC, created_at DESC
                """
                ,
                (user_id, EXTERNAL_KB_SESSION_ID),
            ).fetchall()
        return [dict(row) for row in rows]

    def get_folder_by_name(self, name: str, *, user_id: str) -> dict[str, Any] | None:
        clean_name = (name or "").strip()
        if not clean_name:
            return None
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT f.id, f.name, f.created_at, f.updated_at
                FROM session_folders f
                JOIN user_folders uf ON uf.folder_id = f.id
                WHERE f.name = ?
                  AND uf.user_id = ?
                """,
                (clean_name, user_id),
            ).fetchone()
        return dict(row) if row else None

    def _target_document_sessions(
        self,
        session_id: str,
        *,
        user_id: str | None = None,
        role: str = "teacher",
        include_platform_kb: bool = True,
        include_teacher_kb: bool = True,
    ) -> list[str]:
        target_sessions = [session_id]
        clean_role = "teacher" if (role or "").strip().lower() == "teacher" else "student"
        if user_id and clean_role == "teacher":
            teacher_kb_session_id = self.teacher_kb_session_id(user_id)
            if include_teacher_kb and teacher_kb_session_id != session_id:
                target_sessions.append(teacher_kb_session_id)
            if include_platform_kb and EXTERNAL_KB_SESSION_ID != session_id:
                target_sessions.append(EXTERNAL_KB_SESSION_ID)
        elif user_id is None and include_platform_kb and session_id != EXTERNAL_KB_SESSION_ID:
            target_sessions.append(EXTERNAL_KB_SESSION_ID)
        deduped: list[str] = []
        seen: set[str] = set()
        for item in target_sessions:
            if item in seen:
                continue
            seen.add(item)
            deduped.append(item)
        return deduped

    def _document_scope(self, doc_session_id: str, current_session_id: str, user_id: str | None) -> str:
        if doc_session_id == current_session_id:
            return "session"
        if user_id and doc_session_id == self.teacher_kb_session_id(user_id):
            return "teacher_kb"
        if doc_session_id == EXTERNAL_KB_SESSION_ID:
            return "platform_kb"
        return "session"

    def list_documents(
        self,
        session_id: str,
        *,
        user_id: str | None = None,
        role: str = "teacher",
    ) -> list[dict[str, Any]]:
        if user_id:
            self.assert_session_access(session_id, user_id, allow_kinds=("conversation", "teacher_kb"))
        else:
            self.ensure_session(session_id)
        target_sessions = self._target_document_sessions(session_id, user_id=user_id, role=role)
        placeholders = ", ".join("?" for _ in target_sessions)
        with self._connect() as conn:
            rows = conn.execute(
                f"""
                SELECT
                    id,
                    original_name,
                    stored_path,
                    mime_type,
                    char_count,
                    created_at,
                    source_label,
                    session_id
                FROM documents
                WHERE session_id IN ({placeholders})
                ORDER BY created_at ASC
                """,
                tuple(target_sessions),
            ).fetchall()
        documents: list[dict[str, Any]] = []
        for row in rows:
            payload = dict(row)
            scope = self._document_scope(payload["session_id"], session_id, user_id)
            payload["knowledge_scope"] = scope
            payload["is_external"] = scope != "session"
            documents.append(payload)
        return documents

    def search_chunks(
        self,
        session_id: str,
        query: str,
        limit: int,
        *,
        user_id: str | None = None,
        role: str = "teacher",
    ) -> list[dict[str, Any]]:
        if user_id:
            self.assert_session_access(session_id, user_id, allow_kinds=("conversation", "teacher_kb"))
        else:
            self.ensure_session(session_id)
        fts_query = self._build_fts_query(query)
        target_sessions = self._target_document_sessions(session_id, user_id=user_id, role=role)
        placeholders = ", ".join("?" for _ in target_sessions)
        with self._connect() as conn:
            rows: list[sqlite3.Row] = []
            if fts_query:
                rows = conn.execute(
                    f"""
                    SELECT
                        dc.id,
                        dc.document_id,
                        dc.chunk_index,
                        dc.chunk_text,
                        dc.source_label,
                        dc.start_offset,
                        d.original_name,
                        d.session_id AS knowledge_session_id,
                        CASE WHEN d.session_id = ? THEN 0 ELSE 1 END AS external_rank,
                        bm25(document_chunks_fts) AS score
                    FROM document_chunks_fts
                    JOIN document_chunks dc ON document_chunks_fts.rowid = dc.rowid
                    JOIN documents d ON dc.document_id = d.id
                    WHERE document_chunks_fts MATCH ?
                      AND d.session_id IN ({placeholders})
                    ORDER BY external_rank, score
                    LIMIT ?
                    """,
                    (
                        session_id,
                        fts_query,
                        *target_sessions,
                        max(limit * 3, limit),
                    ),
                ).fetchall()
            if not rows:
                rows = self._fallback_search(
                    conn,
                    session_id,
                    query,
                    max(limit * 3, limit),
                    user_id=user_id,
                    role=role,
                )
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
            payload = dict(row)
            scope = self._document_scope(payload["knowledge_session_id"], session_id, user_id)
            payload["knowledge_scope"] = scope
            payload["is_external"] = scope != "session"
            deduped.append(payload)
            if len(deduped) >= limit:
                break
        return deduped

    def _fallback_search(
        self,
        conn: sqlite3.Connection,
        session_id: str,
        query: str,
        limit: int,
        *,
        user_id: str | None = None,
        role: str = "teacher",
    ) -> list[sqlite3.Row]:
        target_sessions = self._target_document_sessions(session_id, user_id=user_id, role=role)
        placeholders = ", ".join("?" for _ in target_sessions)
        rows = conn.execute(
            f"""
            SELECT
                dc.id,
                dc.document_id,
                dc.chunk_index,
                dc.chunk_text,
                dc.source_label,
                dc.start_offset,
                d.original_name,
                d.session_id AS knowledge_session_id,
                CASE WHEN d.session_id = ? THEN 0 ELSE 1 END AS external_rank
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
            WHERE d.session_id IN ({placeholders})
            """,
            (session_id, *target_sessions),
        ).fetchall()
        scored: list[tuple[int, int, sqlite3.Row]] = []
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
                scored.append((score, int(row["external_rank"]), row))
        scored.sort(key=lambda item: (-item[0], item[1]))
        return [row for _, _, row in scored[:limit]]

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

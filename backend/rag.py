from __future__ import annotations

from typing import Any


DEFAULT_CHUNK_SIZE = 1100
DEFAULT_CHUNK_OVERLAP = 180
DEFAULT_TOP_K = 6
MAX_RAG_CONTEXT_CHARS = 8000


def chunk_document(
    text: str,
    *,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[dict[str, Any]]:
    clean = text.strip()
    if not clean:
        return []
    if len(clean) <= chunk_size:
        return [{"text": clean, "start_offset": 0}]

    chunks: list[dict[str, Any]] = []
    start = 0
    text_len = len(clean)
    while start < text_len:
        end = min(text_len, start + chunk_size)
        if end < text_len:
            newline = clean.rfind("\n", start, end)
            if newline > start + int(chunk_size * 0.6):
                end = newline
        chunk_text = clean[start:end].strip()
        if chunk_text:
            chunks.append({"text": chunk_text, "start_offset": start})
        if end >= text_len:
            break
        start = max(end - overlap, start + 1)
    return chunks


def build_rag_context(
    chunks: list[dict[str, Any]],
    *,
    max_chars: int = MAX_RAG_CONTEXT_CHARS,
) -> str:
    if not chunks:
        return ""

    blocks: list[str] = []
    used_chars = 0
    for chunk in chunks:
        source_label = chunk.get("source_label", "[Source ?]")
        name = chunk.get("original_name", "document")
        text = chunk.get("chunk_text", "").strip()
        if not text:
            continue
        block = f"{source_label} {name}\n{text}"
        if used_chars and used_chars + len(block) > max_chars:
            break
        blocks.append(block)
        used_chars += len(block)

    if not blocks:
        return ""

    return (
        "Knowledge base from user-uploaded documents. "
        "If used, cite the source id exactly like [Source N].\n\n"
        + "\n\n---\n\n".join(blocks)
    )

from __future__ import annotations

import base64
import binascii
import io
import json
import os
import uuid
from pathlib import Path
from typing import Any

import pdfplumber
from docx import Document
from dotenv import load_dotenv
from fastapi import Body, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pydantic import BaseModel, Field

from backend.models import ModelGateway, encode_base64_bytes, extract_delta_text
from backend.phet_catalog import PhetCatalogService, resolve_phet_cache_age_seconds
from backend.rag import DEFAULT_TOP_K, build_rag_context, chunk_document
from backend.storage import SessionStore, UNSET, resolve_database_path

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
UPLOAD_DIR = BASE_DIR / "uploads"
DOC_UPLOAD_DIR = UPLOAD_DIR / "docs"
IMAGE_UPLOAD_DIR = UPLOAD_DIR / "images"
AUDIO_UPLOAD_DIR = UPLOAD_DIR / "audio"
PHET_CACHE_PATH = BASE_DIR / "data" / "phet_catalog.json"

for folder in (DOC_UPLOAD_DIR, IMAGE_UPLOAD_DIR, AUDIO_UPLOAD_DIR):
    folder.mkdir(parents=True, exist_ok=True)

DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
DASHSCOPE_AUDIO_API_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "").strip()

TEXT_MODEL = "qwen-plus"
VISION_MODEL = "qwen-vl-max"
AUDIO_MODEL = "qwen-audio-turbo"

MAX_IMAGE_SIDE = 1280
JPEG_QUALITY = 85
MAX_HISTORY_TURNS = 12
MAX_SESSION_MESSAGES = 120
MAX_AUDIO_BYTES = 10 * 1024 * 1024
MAX_AUDIO_SECONDS = 30
TOP_K_CHUNKS = int(os.getenv("RAG_TOP_K", str(DEFAULT_TOP_K)))

ALLOWED_DOC_EXT = {".pdf", ".docx"}
ALLOWED_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
ALLOWED_AUDIO_EXT = {".webm", ".wav", ".mp3", ".m4a", ".aac", ".ogg"}

SYSTEM_PROMPT = """
You are an advanced multimodal physics experiment teaching agent.
Core rules:
1. Traceability first:
   - If the user uploaded documents, prioritize those documents as the first reference.
   - Clearly point out the knowledge source. Cite with [Source N] when document evidence is used.
2. Anti-hallucination:
   - If evidence is insufficient, explicitly say what is uncertain and what extra data is needed.
   - Never fabricate constants, formulas, or experiment results.
3. Heuristic teaching:
   - Guide with step-by-step reasoning, ask key diagnostic questions, and explain common mistakes.
   - Encourage users to verify experimentally.
4. Formula style:
   - Use Markdown + LaTeX.
   - Inline formula like $F=ma$, block formula like $$E_k=\\frac{1}{2}mv^2$$.
5. Language:
   - Respond in Simplified Chinese unless the user explicitly asks another language.
""".strip()

DATABASE_PATH = resolve_database_path(BASE_DIR)
STORE = SessionStore(DATABASE_PATH)
PHET_CATALOG = PhetCatalogService(PHET_CACHE_PATH, max_age_seconds=resolve_phet_cache_age_seconds())
GATEWAY = ModelGateway(
    api_key=DASHSCOPE_API_KEY,
    openai_base_url=DASHSCOPE_BASE_URL,
    dashscope_api_url=DASHSCOPE_AUDIO_API_URL,
    text_model=TEXT_MODEL,
    vision_model=VISION_MODEL,
    audio_model=AUDIO_MODEL,
)
SESSION_CACHE: dict[str, dict[str, Any]] = {}


class ExternalLabContext(BaseModel):
    provider: str = "phet"
    slug: str = ""
    title_zh: str = ""
    title_en: str = ""
    topic_zh: str = ""
    intro_zh: str = ""
    interface_guidance_zh: list[str] = Field(default_factory=list)
    layout_zh: str = ""
    screen_flow_zh: list[str] = Field(default_factory=list)
    controls_zh: list[str] = Field(default_factory=list)
    effects_zh: list[str] = Field(default_factory=list)
    interaction_effects_zh: list[str] = Field(default_factory=list)
    readouts_zh: list[str] = Field(default_factory=list)
    first_steps_zh: list[str] = Field(default_factory=list)
    terms_zh: list[str] = Field(default_factory=list)
    hidden_tutor_prompt_zh: str = ""
    ui_profile_version: str = ""
    needs_manual_review: bool = False
    sim_url: str = ""
    official_page_url: str = ""
    has_official_zh: bool = False


class ChatRequest(BaseModel):
    session_id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    message: str = ""
    image_base64: str | None = None
    image_b64: str | None = None
    image_mime: str | None = None
    audio_base64: str | None = None
    audio_mime: str | None = None
    external_lab_context: ExternalLabContext | None = None


class SessionCreateRequest(BaseModel):
    title: str = "新对话"
    folder_id: str | None = None


class SessionUpdateRequest(BaseModel):
    title: str | None = None
    folder_id: str | None = None


class FolderRequest(BaseModel):
    name: str


app = FastAPI(title="Multimodal Physics Teaching Agent", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_api_key() -> str:
    if not DASHSCOPE_API_KEY:
        raise RuntimeError("DASHSCOPE_API_KEY is not set. Please configure it in environment or .env file.")
    return DASHSCOPE_API_KEY


def cache_session_state(session_id: str) -> dict[str, Any]:
    state = STORE.get_session_state(session_id, limit=MAX_SESSION_MESSAGES)
    SESSION_CACHE[session_id] = state
    return state


def get_session_state(session_id: str) -> dict[str, Any]:
    cached = SESSION_CACHE.get(session_id)
    if cached:
        return cached
    return cache_session_state(session_id)


def session_catalog_payload() -> dict[str, Any]:
    return {
        "folders": STORE.list_folders(),
        "sessions": STORE.list_sessions(),
    }


def sanitize_external_lab_context(context: ExternalLabContext | None) -> dict[str, Any] | None:
    if context is None:
        return None
    payload = context.model_dump()
    provider = str(payload.get("provider") or "").strip().lower()
    if provider != "phet":
        return None
    payload["provider"] = "phet"
    return payload


def build_external_lab_context_prompt(context: dict[str, Any] | None) -> str:
    if not context:
        return ""
    title = str(context.get("title_zh") or context.get("title_en") or context.get("slug") or "未命名实验").strip()
    topic = str(context.get("topic_zh") or "物理实验").strip()
    intro = str(context.get("intro_zh") or "").strip()
    layout = str(context.get("layout_zh") or "").strip()
    interface_guidance = [str(item).strip() for item in (context.get("interface_guidance_zh") or []) if str(item).strip()]
    screen_flow = [str(item).strip() for item in (context.get("screen_flow_zh") or []) if str(item).strip()]
    first_steps = [str(item).strip() for item in (context.get("first_steps_zh") or []) if str(item).strip()]
    controls = [str(item).strip() for item in (context.get("controls_zh") or []) if str(item).strip()]
    effects = [
        str(item).strip()
        for item in ((context.get("interaction_effects_zh") or []) or (context.get("effects_zh") or []))
        if str(item).strip()
    ]
    readouts = [str(item).strip() for item in (context.get("readouts_zh") or []) if str(item).strip()]
    terms = [str(item).strip() for item in (context.get("terms_zh") or []) if str(item).strip()]
    sim_url = str(context.get("sim_url") or "").strip()
    interface_language = "中文界面" if context.get("has_official_zh") else "英文界面（支持中文讲解）"

    lines = [
        "当前问题附带一个课外仿真实验上下文，请优先结合该实验的页面结构、控件和现象回答。",
        f"- 实验名称：{title}",
        f"- 研究主题：{topic}",
        f"- 界面语言：{interface_language}",
    ]
    if intro:
        lines.append(f"- 实验原理概述：{intro}")
    if layout:
        lines.append(f"- 界面结构：{layout}")
    if screen_flow:
        lines.append(f"- 页面流转：{'；'.join(screen_flow[:4])}")
    if first_steps:
        lines.append(f"- 建议先做哪一步：{'；'.join(first_steps[:4])}")
    if controls:
        lines.append(f"- 可以调什么：{'；'.join(controls[:6])}")
    if readouts:
        lines.append(f"- 关键读数：{'；'.join(readouts[:5])}")
    if effects:
        lines.append(f"- 怎么调会发生什么：{'；'.join(effects[:5])}")
    if terms:
        lines.append(f"- 界面术语：{'；'.join(terms[:5])}")
    if interface_guidance:
        lines.append(f"- 界面引导：{'；'.join(interface_guidance[:6])}")
    if sim_url:
        lines.append(f"- 仿真链接：{sim_url}")
    hidden_prompt = str(context.get("hidden_tutor_prompt_zh") or "").strip()
    if hidden_prompt:
        lines.append(hidden_prompt)
    lines.append("回答顺序必须是：先定位当前页面和控件，再解释当前参数、读数和现象，最后再说明物理原理。")
    lines.append("如果问题没有说清当前在哪个页面、改了哪个控件，应优先根据截图判断；若截图仍不足，就使用当前实验的真实控件名继续追问。")
    return "\n".join(lines)


def extract_pdf_text(raw: bytes) -> str:
    pages: list[str] = []
    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            text = text.strip()
            if text:
                pages.append(text)
    return "\n\n".join(pages)


def extract_docx_text(raw: bytes) -> str:
    doc = Document(io.BytesIO(raw))
    chunks = [p.text.strip() for p in doc.paragraphs if p.text and p.text.strip()]
    return "\n\n".join(chunks)


def ext_to_mime(ext: str) -> str:
    mapping = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
        ".webm": "audio/webm",
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
        ".ogg": "audio/ogg",
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    return mapping.get(ext.lower(), "application/octet-stream")


def decode_base64_payload(payload: str, fallback_mime: str | None = None, *, label: str) -> tuple[bytes, str]:
    raw_payload = payload.strip()
    mime = fallback_mime or "application/octet-stream"

    if raw_payload.startswith("data:"):
        try:
            header, raw_payload = raw_payload.split(",", 1)
            head_mime = header.split(";", 1)[0].replace("data:", "").strip()
            if head_mime:
                mime = head_mime
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid data URL {label} format.") from exc

    try:
        raw = base64.b64decode(raw_payload, validate=True)
    except binascii.Error as exc:
        raise HTTPException(status_code=400, detail=f"Invalid {label} base64 payload.") from exc

    if not raw:
        raise HTTPException(status_code=400, detail=f"{label.capitalize()} payload is empty.")
    return raw, mime


def compress_image_bytes(raw: bytes, source_mime: str) -> tuple[bytes, str]:
    with Image.open(io.BytesIO(raw)) as img:
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        elif img.mode == "L":
            img = img.convert("RGB")

        img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE), Image.Resampling.LANCZOS)

        out = io.BytesIO()
        if source_mime == "image/png":
            img.save(out, format="PNG", optimize=True)
            return out.getvalue(), "image/png"

        img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
        return out.getvalue(), "image/jpeg"


def ensure_audio_limits(raw: bytes) -> None:
    if len(raw) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=400, detail="Audio file exceeds the 10MB limit.")


def build_text_messages(
    session_id: str,
    message_text: str,
    external_lab_context: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], str]:
    history = STORE.list_model_messages(session_id, MAX_HISTORY_TURNS * 2)
    rag_chunks = STORE.search_chunks(session_id, message_text, TOP_K_CHUNKS)
    rag_context = build_rag_context(rag_chunks)
    lab_context = build_external_lab_context_prompt(external_lab_context)

    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    if rag_context:
        messages.append({"role": "system", "content": rag_context})
    if lab_context:
        messages.append({"role": "system", "content": lab_context})
    messages.extend(history)
    messages.append({"role": "user", "content": message_text})
    return messages, TEXT_MODEL


def build_image_messages(message_text: str, image_payload: str, image_mime: str | None) -> tuple[list[dict[str, Any]], str]:
    raw_image, source_mime = decode_base64_payload(image_payload, image_mime, label="image")
    compressed, mime = compress_image_bytes(raw_image, source_mime)
    encoded = encode_base64_bytes(compressed)
    data_url = f"data:{mime};base64,{encoded}"
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": message_text or "请分析这张物理实验图像。"},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
        },
    ]
    return messages, VISION_MODEL


def build_lab_image_messages(
    session_id: str,
    message_text: str,
    image_payload: str,
    image_mime: str | None,
    external_lab_context: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], str]:
    raw_image, source_mime = decode_base64_payload(image_payload, image_mime, label="image")
    compressed, mime = compress_image_bytes(raw_image, source_mime)
    encoded = encode_base64_bytes(compressed)
    data_url = f"data:{mime};base64,{encoded}"

    history = STORE.list_model_messages(session_id, MAX_HISTORY_TURNS * 2)
    rag_chunks = STORE.search_chunks(session_id, message_text, TOP_K_CHUNKS) if message_text.strip() else []
    rag_context = build_rag_context(rag_chunks)
    lab_context = build_external_lab_context_prompt(external_lab_context)

    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    if rag_context:
        messages.append({"role": "system", "content": rag_context})
    if lab_context:
        messages.append({"role": "system", "content": lab_context})
    messages.extend(history)
    prompt_text = message_text.strip() or "请先根据当前课外仿真截图定位正在显示的页面、勾选项、滑块/数值、读数和现象，再解释它们对应的物理规律。"
    messages.append(
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt_text},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
        }
    )
    return messages, VISION_MODEL


def build_audio_messages(
    session_id: str,
    message_text: str,
    audio_payload: str,
    audio_mime: str | None,
    external_lab_context: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], str, bytes, str]:
    raw_audio, mime = decode_base64_payload(audio_payload, audio_mime, label="audio")
    ensure_audio_limits(raw_audio)
    prompt_text = message_text.strip()
    lab_context = build_external_lab_context_prompt(external_lab_context)
    if prompt_text:
        rag_chunks = STORE.search_chunks(session_id, prompt_text, TOP_K_CHUNKS)
        rag_context = build_rag_context(rag_chunks)
        prompt_parts = [part for part in [lab_context, rag_context] if part]
        prompt_parts.append(f"用户问题：{prompt_text}")
        prompt_text = "\n\n".join(prompt_parts)
    elif lab_context:
        prompt_text = lab_context
    history = STORE.list_model_messages(session_id, MAX_HISTORY_TURNS * 2)
    messages = GATEWAY.build_audio_messages(
        system_prompt=SYSTEM_PROMPT,
        history_messages=history,
        audio_b64=encode_base64_bytes(raw_audio),
        audio_mime=mime,
        text_prompt=prompt_text,
    )
    return messages, AUDIO_MODEL, raw_audio, mime


def extract_audio_answer(response: dict[str, Any]) -> str:
    output = response.get("output", {})
    choices = output.get("choices")
    if isinstance(choices, list) and choices:
        message = choices[0].get("message", {})
        content = message.get("content", [])
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict) and isinstance(item.get("text"), str):
                    parts.append(item["text"])
            if parts:
                return "".join(parts).strip()
    text_value = output.get("text")
    if isinstance(text_value, str):
        return text_value.strip()
    raise RuntimeError(f"Unexpected DashScope audio response: {json.dumps(response, ensure_ascii=False)}")


def display_user_content(
    message_text: str,
    input_mode: str,
    external_lab_context: dict[str, Any] | None = None,
) -> str:
    text = message_text.strip()
    if not text:
        if input_mode == "audio":
            text = "[语音提问]"
        elif input_mode == "image":
            text = "[图片提问]"
        else:
            text = "[空消息]"

    if not external_lab_context:
        return text

    title = str(
        external_lab_context.get("title_zh")
        or external_lab_context.get("title_en")
        or external_lab_context.get("slug")
        or "未命名实验"
    ).strip()
    return f"[课外仿真实验：{title}]\n{text}"


def remove_files(paths: list[str]) -> None:
    for path in paths:
        if not path:
            continue
        file_path = Path(path)
        try:
            if file_path.exists():
                file_path.unlink()
        except OSError:
            continue


def sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


@app.get("/", response_model=None)
async def index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "Backend is running. Frontend page not found in /static/index.html."}


@app.get("/api/session")
async def session_state(session_id: str = Query(...)) -> dict[str, Any]:
    state = get_session_state(session_id)
    return {
        "session_id": session_id,
        "title": state["title"],
        "folder_id": state["folder_id"],
        "folder_name": state["folder_name"],
        "messages": state["messages"],
        "documents": state["documents"],
        "doc_count": state["doc_count"],
        "last_model": state["last_model"] or TEXT_MODEL,
    }


@app.get("/api/sessions")
async def list_sessions() -> dict[str, Any]:
    return session_catalog_payload()


@app.get("/api/phet/catalog")
async def phet_catalog() -> dict[str, Any]:
    try:
        return PHET_CATALOG.get_catalog()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/sessions")
async def create_session(payload: SessionCreateRequest | None = Body(default=None)) -> dict[str, Any]:
    request = payload or SessionCreateRequest()
    session_id = STORE.create_session(title=request.title or "新对话", folder_id=request.folder_id)
    state = cache_session_state(session_id)
    return {
        "session_id": session_id,
        "title": state["title"],
        "folder_id": state["folder_id"],
        "folder_name": state["folder_name"],
    }


@app.patch("/api/sessions/{session_id}")
async def update_session(session_id: str, payload: SessionUpdateRequest) -> dict[str, Any]:
    folder_value: object = payload.folder_id if "folder_id" in payload.model_fields_set else UNSET
    STORE.update_session(session_id, title=payload.title, folder_id=folder_value)
    state = cache_session_state(session_id)
    return {
        "session_id": session_id,
        "title": state["title"],
        "folder_id": state["folder_id"],
        "folder_name": state["folder_name"],
    }


@app.post("/api/folders")
async def create_folder(payload: FolderRequest) -> dict[str, Any]:
    try:
        folder = STORE.create_folder(payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Create folder failed: {exc}") from exc
    return folder


@app.patch("/api/folders/{folder_id}")
async def rename_folder(folder_id: str, payload: FolderRequest) -> dict[str, Any]:
    try:
        STORE.rename_folder(folder_id, payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"id": folder_id, "name": payload.name.strip()}


@app.delete("/api/folders/{folder_id}")
async def delete_folder(folder_id: str) -> dict[str, Any]:
    STORE.delete_folder(folder_id)
    SESSION_CACHE.clear()
    return {"ok": True, "id": folder_id}


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str) -> dict[str, Any]:
    STORE.delete_session(session_id)
    SESSION_CACHE.pop(session_id, None)
    return {"ok": True, "session_id": session_id}


@app.post("/api/chat")
async def chat(req: ChatRequest):
    require_api_key()
    message_text = req.message.strip()
    image_payload = req.image_base64 or req.image_b64
    audio_payload = req.audio_base64
    external_lab_context = sanitize_external_lab_context(req.external_lab_context)

    if image_payload and audio_payload:
        raise HTTPException(status_code=400, detail="Only one attachment type per request is allowed.")
    if not message_text and not image_payload and not audio_payload:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    session_id = req.session_id
    request_id = uuid.uuid4().hex
    input_mode = "audio" if audio_payload else "image" if image_payload else "text"

    user_message_id = STORE.create_message(
        session_id,
        "user",
        display_user_content(message_text, input_mode, external_lab_context),
        status="done",
        input_mode=input_mode,
    )
    STORE.maybe_autotitle_session(
        session_id,
        message_text.strip()
        or str((external_lab_context or {}).get("title_zh") or (external_lab_context or {}).get("title_en") or "").strip()
        or display_user_content(message_text, input_mode, external_lab_context),
    )
    assistant_message_id = STORE.create_message(
        session_id,
        "assistant",
        "",
        status="streaming",
        input_mode=input_mode,
    )
    cache_session_state(session_id)

    def generate():
        try:
            full_answer = ""
            if audio_payload:
                messages, model_used, raw_audio, mime = build_audio_messages(
                    session_id,
                    message_text,
                    audio_payload,
                    req.audio_mime,
                    external_lab_context,
                )
                ext = ".webm"
                for candidate_ext in ALLOWED_AUDIO_EXT:
                    if ext_to_mime(candidate_ext) == mime:
                        ext = candidate_ext
                        break
                audio_path = AUDIO_UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
                audio_path.write_bytes(raw_audio)
                audio_response = GATEWAY.call_audio(messages=messages)
                full_answer = extract_audio_answer(audio_response)
                STORE.update_message(
                    assistant_message_id,
                    content=full_answer,
                    model_used=model_used,
                    status="done",
                    completed=True,
                )
                STORE.set_last_model(session_id, model_used)
                cache_session_state(session_id)
                yield sse(
                    {
                        "type": "model",
                        "model": model_used,
                        "session_id": session_id,
                        "request_id": request_id,
                        "assistant_message_id": assistant_message_id,
                    }
                )
                if full_answer:
                    yield sse(
                        {
                            "type": "chunk",
                            "text": full_answer,
                            "session_id": session_id,
                            "request_id": request_id,
                            "assistant_message_id": assistant_message_id,
                        }
                    )
                yield sse(
                    {
                        "type": "done",
                        "answer": full_answer,
                        "model": model_used,
                        "session_id": session_id,
                        "request_id": request_id,
                        "assistant_message_id": assistant_message_id,
                        "user_message_id": user_message_id,
                        "doc_count": get_session_state(session_id)["doc_count"],
                    }
                )
                return

            if image_payload:
                if external_lab_context:
                    messages, model_used = build_lab_image_messages(
                        session_id,
                        message_text,
                        image_payload,
                        req.image_mime,
                        external_lab_context,
                    )
                else:
                    messages, model_used = build_image_messages(message_text, image_payload, req.image_mime)
            else:
                messages, model_used = build_text_messages(session_id, message_text, external_lab_context)

            yield sse(
                {
                    "type": "model",
                    "model": model_used,
                    "session_id": session_id,
                    "request_id": request_id,
                    "assistant_message_id": assistant_message_id,
                }
            )
            stream = GATEWAY.stream_chat(messages=messages, model=model_used)
            answer_parts: list[str] = []
            for chunk in stream:
                choice = chunk.choices[0] if getattr(chunk, "choices", None) else None
                delta = getattr(choice, "delta", None)
                delta_content = getattr(delta, "content", None) if delta is not None else None
                text = extract_delta_text(delta_content)
                if not text:
                    continue
                answer_parts.append(text)
                yield sse(
                    {
                        "type": "chunk",
                        "text": text,
                        "session_id": session_id,
                        "request_id": request_id,
                        "assistant_message_id": assistant_message_id,
                    }
                )

            full_answer = "".join(answer_parts).strip()
            STORE.update_message(
                assistant_message_id,
                content=full_answer,
                model_used=model_used,
                status="done",
                completed=True,
            )
            STORE.set_last_model(session_id, model_used)
            cache_session_state(session_id)

            yield sse(
                {
                    "type": "done",
                    "answer": full_answer,
                    "model": model_used,
                    "session_id": session_id,
                    "request_id": request_id,
                    "assistant_message_id": assistant_message_id,
                    "user_message_id": user_message_id,
                    "doc_count": get_session_state(session_id)["doc_count"],
                }
            )
        except HTTPException as exc:
            STORE.update_message(
                assistant_message_id,
                content="上次回复中断",
                status="error",
                error_message=str(exc.detail),
                completed=True,
            )
            cache_session_state(session_id)
            yield sse(
                {
                    "type": "error",
                    "message": str(exc.detail),
                    "session_id": session_id,
                    "request_id": request_id,
                    "assistant_message_id": assistant_message_id,
                }
            )
        except Exception as exc:
            STORE.update_message(
                assistant_message_id,
                content="上次回复中断",
                status="error",
                error_message=str(exc),
                completed=True,
            )
            cache_session_state(session_id)
            yield sse(
                {
                    "type": "error",
                    "message": f"DashScope request failed: {exc}",
                    "session_id": session_id,
                    "request_id": request_id,
                    "assistant_message_id": assistant_message_id,
                }
            )

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/upload")
async def upload(
    session_id: str = Form(...),
    files: list[UploadFile] = File(...),
) -> dict[str, Any]:
    STORE.ensure_session(session_id)

    doc_results: list[dict[str, Any]] = []
    image_results: list[dict[str, Any]] = []
    audio_results: list[dict[str, Any]] = []
    skipped: list[dict[str, str]] = []

    for file in files:
        filename = file.filename or "unnamed"
        ext = Path(filename).suffix.lower()
        raw = await file.read()

        if not raw:
            skipped.append({"name": filename, "reason": "empty file"})
            continue

        if ext in ALLOWED_DOC_EXT:
            try:
                text = extract_pdf_text(raw) if ext == ".pdf" else extract_docx_text(raw)
            except Exception as exc:
                skipped.append({"name": filename, "reason": f"parse failed: {exc}"})
                continue

            if not text.strip():
                skipped.append({"name": filename, "reason": "no extractable text"})
                continue

            stored_path = DOC_UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
            stored_path.write_bytes(raw)
            doc_record = STORE.add_document(
                session_id,
                original_name=filename,
                stored_path=str(stored_path),
                mime_type=ext_to_mime(ext),
                text=text,
                chunks=chunk_document(text),
            )
            doc_results.append({"name": filename, "chars": doc_record["chars"], "source_label": doc_record["source_label"]})
            continue

        if ext in ALLOWED_IMAGE_EXT:
            try:
                source_mime = ext_to_mime(ext)
                compressed, mime = compress_image_bytes(raw, source_mime)
                encoded = encode_base64_bytes(compressed)
            except Exception as exc:
                skipped.append({"name": filename, "reason": f"image process failed: {exc}"})
                continue

            save_ext = ".png" if mime == "image/png" else ".jpg"
            image_path = IMAGE_UPLOAD_DIR / f"{uuid.uuid4().hex}{save_ext}"
            image_path.write_bytes(compressed)
            image_results.append(
                {
                    "name": filename,
                    "image_base64": encoded,
                    "image_mime": mime,
                    "stored_path": str(image_path),
                }
            )
            continue

        if ext in ALLOWED_AUDIO_EXT:
            try:
                ensure_audio_limits(raw)
            except HTTPException as exc:
                skipped.append({"name": filename, "reason": str(exc.detail)})
                continue

            audio_path = AUDIO_UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
            audio_path.write_bytes(raw)
            audio_results.append(
                {
                    "name": filename,
                    "audio_base64": encode_base64_bytes(raw),
                    "audio_mime": ext_to_mime(ext),
                    "duration_limit_sec": MAX_AUDIO_SECONDS,
                    "stored_path": str(audio_path),
                }
            )
            continue

        skipped.append({"name": filename, "reason": "unsupported file type"})

    state = cache_session_state(session_id)
    return {
        "session_id": session_id,
        "documents": doc_results,
        "images": image_results,
        "audios": audio_results,
        "skipped": skipped,
        "doc_count": state["doc_count"],
    }


@app.delete("/api/clear-docs")
async def clear_docs(session_id: str = Query(...)) -> dict[str, Any]:
    paths = STORE.clear_documents(session_id)
    remove_files(paths)
    state = cache_session_state(session_id)
    return {"ok": True, "doc_count": state["doc_count"]}


@app.post("/api/clear-history")
async def clear_history(session_id: str = Query(...)) -> dict[str, Any]:
    STORE.clear_history(session_id)
    state = cache_session_state(session_id)
    return {"ok": True, "message_count": len(state["messages"])}


if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)

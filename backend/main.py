from __future__ import annotations

import base64
import binascii
import csv
import hashlib
import io
import json
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pdfplumber
from docx import Document
from dotenv import load_dotenv
from fastapi import Body, Depends, FastAPI, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageDraw
from pydantic import BaseModel, Field

from backend.models import ModelGateway, encode_base64_bytes, extract_delta_text
from backend.pendulum_analysis import (
    PendulumAnalysisError,
    PendulumDependencyError,
    analyze_pendulum_video,
    format_pendulum_report,
)
from backend.torsion_analysis import (
    TorsionAnalysisError,
    TorsionDependencyError,
    analyze_torsion_frame,
    analyze_torsion_video,
    format_torsion_report,
)
from backend.phet_catalog import PhetCatalogService, resolve_phet_cache_age_seconds
from backend.rag import DEFAULT_TOP_K, build_rag_context, chunk_document
from backend.storage import (
    EXTERNAL_KB_SESSION_ID,
    EXTERNAL_SOURCE_INDEX_OFFSET,
    SessionStore,
    UNSET,
    resolve_database_path,
)

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
RUNTIME_DIR = Path(os.getenv("PHYSICS_AGENT_RUNTIME_DIR", str(BASE_DIR))).resolve()
STATIC_DIR = Path(os.getenv("PHYSICS_AGENT_STATIC_DIR", str(BASE_DIR / "static"))).resolve()
UPLOAD_DIR = Path(os.getenv("PHYSICS_AGENT_UPLOAD_DIR", str(RUNTIME_DIR / "uploads"))).resolve()
DOC_UPLOAD_DIR = UPLOAD_DIR / "docs"
IMAGE_UPLOAD_DIR = UPLOAD_DIR / "images"
AUDIO_UPLOAD_DIR = UPLOAD_DIR / "audio"
PENDULUM_UPLOAD_DIR = UPLOAD_DIR / "pendulum"
TORSION_UPLOAD_DIR = UPLOAD_DIR / "torsion"
PHET_CACHE_PATH = Path(
    os.getenv("PHYSICS_AGENT_PHET_CACHE_PATH", str(RUNTIME_DIR / "data" / "phet_catalog.json"))
).resolve()
DEFAULT_EXTERNAL_DOC_FILENAME = "cb2f11a9cd5a4acd83edc2c456894c00.pdf"
DEFAULT_EXTERNAL_DOC_PATH = Path(
    os.getenv("PHYSICS_AGENT_EXTERNAL_DOC_PATH", str(BASE_DIR / DEFAULT_EXTERNAL_DOC_FILENAME))
).resolve()
APP_ICON_SOURCE_PATH = Path(
    os.getenv("PHYSICS_AGENT_APP_ICON_PATH", str(BASE_DIR / "icon.png"))
).resolve()
MANIFEST_PATH = STATIC_DIR / "manifest.webmanifest"
SERVICE_WORKER_PATH = STATIC_DIR / "sw.js"

for folder in (DOC_UPLOAD_DIR, IMAGE_UPLOAD_DIR, AUDIO_UPLOAD_DIR, PENDULUM_UPLOAD_DIR, TORSION_UPLOAD_DIR):
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
ALLOWED_PENDULUM_VIDEO_EXT = {".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv"}
MAX_PENDULUM_VIDEO_BYTES = int(os.getenv("PHYSICS_AGENT_MAX_PENDULUM_VIDEO_BYTES", str(80 * 1024 * 1024)))
MAX_TORSION_LIVE_FRAME_BYTES = int(os.getenv("PHYSICS_AGENT_MAX_TORSION_LIVE_FRAME_BYTES", str(4 * 1024 * 1024)))
WECHAT_APP_ID = os.getenv("PHYSICS_AGENT_WECHAT_APP_ID", "").strip()
WECHAT_APP_SECRET = os.getenv("PHYSICS_AGENT_WECHAT_APP_SECRET", "").strip()
QQ_APP_ID = os.getenv("PHYSICS_AGENT_QQ_APP_ID", "").strip()
QQ_APP_SECRET = os.getenv("PHYSICS_AGENT_QQ_APP_SECRET", "").strip()
SMS_DELIVERY_MODE = (os.getenv("PHYSICS_AGENT_SMS_DELIVERY_MODE", "mock").strip().lower() or "mock")
if SMS_DELIVERY_MODE not in {"mock", "disabled"}:
    SMS_DELIVERY_MODE = "mock"
SMS_CODE_LENGTH = min(8, max(4, int(os.getenv("PHYSICS_AGENT_SMS_CODE_LENGTH", "6") or "6")))
SMS_CODE_EXPIRES_SECONDS = max(60, int(os.getenv("PHYSICS_AGENT_SMS_CODE_EXPIRES_SECONDS", "300") or "300"))
SMS_CODE_COOLDOWN_SECONDS = max(30, int(os.getenv("PHYSICS_AGENT_SMS_CODE_COOLDOWN_SECONDS", "60") or "60"))
SMS_CODE_MAX_ATTEMPTS = max(1, int(os.getenv("PHYSICS_AGENT_SMS_CODE_MAX_ATTEMPTS", "5") or "5"))
SMS_CODE_SECRET = os.getenv("PHYSICS_AGENT_SMS_CODE_SECRET", "physics-agent-sms").strip() or "physics-agent-sms"

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

DATABASE_PATH = resolve_database_path(RUNTIME_DIR)
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


class AuthLoginRequest(BaseModel):
    provider: str = "demo"
    role: str = "student"
    display_name: str = ""


class PhoneCodeSendRequest(BaseModel):
    phone: str


class PhoneCodeLoginRequest(BaseModel):
    phone: str
    code: str
    role: str = "student"
    display_name: str = ""


def resolve_cors_origins() -> tuple[list[str], bool]:
    raw_value = os.getenv("PHYSICS_AGENT_CORS_ORIGINS", "").strip()
    if not raw_value or raw_value == "*":
        return ["*"], False

    origins = [item.strip() for item in raw_value.split(",") if item.strip()]
    return (origins or ["*"]), bool(origins)


app = FastAPI(title="Multimodal Physics Teaching Agent", version="2.0.0")

cors_origins, allow_cors_credentials = resolve_cors_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_cors_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

NO_CACHE_PATHS = {
    "/",
    "/manifest.webmanifest",
    "/sw.js",
    "/static/app.js",
    "/static/lite-backend.js",
    "/static/mobile-config.js",
    "/static/style.css",
}


@app.middleware("http")
async def disable_cache_for_shell_assets(request: Request, call_next):
    response = await call_next(request)
    if request.url.path in NO_CACHE_PATHS:
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


@app.on_event("startup")
async def load_external_knowledge_base() -> None:
    preload_external_documents()


def require_api_key() -> str:
    if not DASHSCOPE_API_KEY:
        raise RuntimeError("DASHSCOPE_API_KEY is not set. Please configure it in environment or .env file.")
    return DASHSCOPE_API_KEY


def normalize_role(value: str) -> str:
    return "teacher" if (value or "").strip().lower() == "teacher" else "student"


def normalize_provider(value: str) -> str:
    clean_value = (value or "").strip().lower()
    if clean_value in {"phone", "wechat", "qq"}:
        return clean_value
    return "demo"


def normalize_phone(value: str) -> str:
    digits = re.sub(r"\D+", "", value or "")
    if digits.startswith("86") and len(digits) == 13:
        digits = digits[2:]
    if not re.fullmatch(r"1\d{10}", digits):
        raise ValueError("请输入有效的 11 位中国大陆手机号。")
    return digits


def mask_phone(value: str) -> str:
    phone = normalize_phone(value)
    return f"{phone[:3]}****{phone[-4:]}"


def teacher_phone_whitelist() -> set[str]:
    whitelist: set[str] = set()
    raw_value = os.getenv("PHYSICS_AGENT_TEACHER_PHONE_WHITELIST", "").strip()
    if not raw_value:
        return whitelist
    for item in raw_value.split(","):
        candidate = item.strip()
        if not candidate:
            continue
        try:
            whitelist.add(normalize_phone(candidate))
        except ValueError:
            continue
    return whitelist


def build_phone_code_hash(phone: str, code: str) -> str:
    normalized_phone = normalize_phone(phone)
    normalized_code = re.sub(r"\D+", "", code or "")
    payload = f"{normalized_phone}:{normalized_code}:{SMS_CODE_SECRET}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def generate_phone_code() -> str:
    upper_bound = 10 ** SMS_CODE_LENGTH
    return f"{secrets.randbelow(upper_bound):0{SMS_CODE_LENGTH}d}"


def deliver_phone_code(phone: str, code: str) -> dict[str, Any]:
    if SMS_DELIVERY_MODE == "disabled":
        raise HTTPException(status_code=503, detail="当前环境尚未开启短信验证码登录。")

    if SMS_DELIVERY_MODE == "mock":
        print(f"[physics-agent] SMS login code for {phone}: {code}")
        return {
            "delivery_mode": "mock",
            "message": "当前为开发联调模式，验证码已直接返回到登录界面，便于测试手机验证码流程。",
            "debug_code": code,
        }

    raise HTTPException(status_code=503, detail="当前环境暂未接入可用的短信发送通道。")


def auth_provider_catalog() -> list[dict[str, Any]]:
    return [
        {
            "key": "wechat",
            "label": "微信登录",
            "configured": bool(WECHAT_APP_ID and WECHAT_APP_SECRET),
        },
        {
            "key": "qq",
            "label": "QQ 登录",
            "configured": bool(QQ_APP_ID and QQ_APP_SECRET),
        },
        {
            "key": "demo",
            "label": "体验登录",
            "configured": True,
        },
    ]


def session_cache_key(session_id: str, user: dict[str, Any]) -> str:
    return f"{user['id']}:{user.get('role', 'student')}:{session_id}"


def cache_session_state(session_id: str, user: dict[str, Any]) -> dict[str, Any]:
    state = STORE.get_session_state(
        session_id,
        limit=MAX_SESSION_MESSAGES,
        user_id=str(user["id"]),
        role=str(user.get("role") or "student"),
    )
    SESSION_CACHE[session_cache_key(session_id, user)] = state
    return state


def get_session_state(session_id: str, user: dict[str, Any]) -> dict[str, Any]:
    cached = SESSION_CACHE.get(session_cache_key(session_id, user))
    if cached:
        return cached
    return cache_session_state(session_id, user)


def session_catalog_payload(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "folders": STORE.list_folders(str(user["id"])),
        "sessions": STORE.list_sessions(str(user["id"])),
    }


def extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        return ""
    prefix = "bearer "
    value = authorization.strip()
    if value.lower().startswith(prefix):
        return value[len(prefix):].strip()
    return ""


def require_current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    token = extract_bearer_token(authorization)
    user = STORE.get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="请先登录后再访问工作区。")
    return user


def require_teacher_user(user: dict[str, Any] = Depends(require_current_user)) -> dict[str, Any]:
    if normalize_role(str(user.get("role") or "")) != "teacher":
        raise HTTPException(status_code=403, detail="仅教师端可以查看学生问题统计。")
    return user


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


def pendulum_video_extension(filename: str, content_type: str | None = None) -> str:
    ext = Path(filename or "").suffix.lower()
    if ext in ALLOWED_PENDULUM_VIDEO_EXT:
        return ext
    mime = (content_type or "").split(";", 1)[0].strip().lower()
    mapping = {
        "video/mp4": ".mp4",
        "video/webm": ".webm",
        "video/quicktime": ".mov",
        "video/x-msvideo": ".avi",
        "video/x-matroska": ".mkv",
    }
    return mapping.get(mime, ext)


def resolve_external_doc_paths() -> list[Path]:
    raw_value = os.getenv("EXTERNAL_DOC_PATHS", "").strip()
    raw_items = [item.strip() for item in raw_value.split(os.pathsep) if item.strip()] if raw_value else [str(DEFAULT_EXTERNAL_DOC_PATH)]

    resolved_paths: list[Path] = []
    seen: set[str] = set()
    for item in raw_items:
        path = Path(item)
        if not path.is_absolute():
            path = (BASE_DIR / path).resolve()
        else:
            path = path.resolve()

        if not path.exists() or path.suffix.lower() not in ALLOWED_DOC_EXT:
            continue

        key = str(path).lower()
        if key in seen:
            continue
        seen.add(key)
        resolved_paths.append(path)
    return resolved_paths


def extract_document_text_from_path(path: Path) -> str:
    raw = path.read_bytes()
    ext = path.suffix.lower()
    if ext == ".pdf":
        return extract_pdf_text(raw)
    if ext == ".docx":
        return extract_docx_text(raw)
    raise ValueError(f"Unsupported external document type: {ext}")


def normalize_document_path(path: Path) -> str:
    return os.path.normcase(str(path.resolve()))


def preload_external_documents() -> None:
    paths = resolve_external_doc_paths()
    if not paths:
        return

    STORE.ensure_session(EXTERNAL_KB_SESSION_ID, title="平台资料库", session_kind="platform_kb")
    for path in paths:
        stored_path = normalize_document_path(path)
        if STORE.has_document(EXTERNAL_KB_SESSION_ID, stored_path):
            continue

        try:
            text = extract_document_text_from_path(path)
        except Exception as exc:
            print(f"[external-kb] failed to load {path.name}: {exc}")
            continue

        clean_text = text.strip()
        if not clean_text:
            print(f"[external-kb] skipped {path.name}: no extractable text")
            continue

        STORE.add_document(
            EXTERNAL_KB_SESSION_ID,
            original_name=path.name,
            stored_path=stored_path,
            mime_type=ext_to_mime(path.suffix),
            text=clean_text,
            chunks=chunk_document(clean_text),
            source_index_offset=EXTERNAL_SOURCE_INDEX_OFFSET,
        )
        print(f"[external-kb] loaded {path.name}")


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
    user: dict[str, Any],
    message_text: str,
    external_lab_context: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], str]:
    history = STORE.list_model_messages(session_id, MAX_HISTORY_TURNS * 2)
    rag_chunks = STORE.search_chunks(
        session_id,
        message_text,
        TOP_K_CHUNKS,
        user_id=str(user["id"]),
        role=str(user.get("role") or "student"),
    )
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
    user: dict[str, Any],
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
    rag_chunks = STORE.search_chunks(
        session_id,
        message_text,
        TOP_K_CHUNKS,
        user_id=str(user["id"]),
        role=str(user.get("role") or "student"),
    ) if message_text.strip() else []
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
    user: dict[str, Any],
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
        rag_chunks = STORE.search_chunks(
            session_id,
            prompt_text,
            TOP_K_CHUNKS,
            user_id=str(user["id"]),
            role=str(user.get("role") or "student"),
        )
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


def _lerp_channel(start: int, end: int, ratio: float) -> int:
    return int(round(start + (end - start) * ratio))


def generate_app_icon_png(size: int) -> bytes:
    safe_size = max(128, min(size, 1024))
    if APP_ICON_SOURCE_PATH.exists():
        with Image.open(APP_ICON_SOURCE_PATH) as source_image:
            resampling = getattr(Image, "Resampling", Image)
            prepared = source_image.convert("RGBA").resize(
                (safe_size, safe_size),
                resampling.LANCZOS,
            )
            output = io.BytesIO()
            prepared.save(output, format="PNG")
            return output.getvalue()

    image = Image.new("RGBA", (safe_size, safe_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    top_color = (32, 48, 79)
    bottom_color = (108, 143, 245)
    for y in range(safe_size):
        ratio = y / max(1, safe_size - 1)
        line_color = (
            _lerp_channel(top_color[0], bottom_color[0], ratio),
            _lerp_channel(top_color[1], bottom_color[1], ratio),
            _lerp_channel(top_color[2], bottom_color[2], ratio),
            255,
        )
        draw.line((0, y, safe_size, y), fill=line_color)

    mask = Image.new("L", (safe_size, safe_size), 0)
    mask_draw = ImageDraw.Draw(mask)
    corner_radius = int(safe_size * 0.23)
    mask_draw.rounded_rectangle((0, 0, safe_size - 1, safe_size - 1), radius=corner_radius, fill=255)
    image.putalpha(mask)
    draw = ImageDraw.Draw(image)

    glow_bounds = (
        int(safe_size * 0.14),
        int(safe_size * 0.12),
        int(safe_size * 0.86),
        int(safe_size * 0.88),
    )
    draw.ellipse(glow_bounds, fill=(255, 255, 255, 20))

    flask_outline = [
        (int(safe_size * 0.38), int(safe_size * 0.24)),
        (int(safe_size * 0.38), int(safe_size * 0.42)),
        (int(safe_size * 0.23), int(safe_size * 0.74)),
        (int(safe_size * 0.77), int(safe_size * 0.74)),
        (int(safe_size * 0.62), int(safe_size * 0.42)),
        (int(safe_size * 0.62), int(safe_size * 0.24)),
    ]
    stroke_width = max(6, safe_size // 34)
    draw.line(flask_outline, fill=(245, 251, 255, 255), width=stroke_width, joint="curve")
    draw.line(
        [
            (int(safe_size * 0.38), int(safe_size * 0.24)),
            (int(safe_size * 0.62), int(safe_size * 0.24)),
        ],
        fill=(245, 251, 255, 255),
        width=stroke_width,
    )

    liquid = [
        (int(safe_size * 0.29), int(safe_size * 0.58)),
        (int(safe_size * 0.70), int(safe_size * 0.58)),
        (int(safe_size * 0.64), int(safe_size * 0.72)),
        (int(safe_size * 0.35), int(safe_size * 0.72)),
    ]
    draw.polygon(liquid, fill=(130, 203, 193, 235))
    bubble_radius = max(8, safe_size // 26)
    draw.ellipse(
        (
            int(safe_size * 0.48) - bubble_radius,
            int(safe_size * 0.50) - bubble_radius,
            int(safe_size * 0.48) + bubble_radius,
            int(safe_size * 0.50) + bubble_radius,
        ),
        fill=(255, 255, 255, 220),
    )
    draw.ellipse(
        (
            int(safe_size * 0.58) - bubble_radius // 2,
            int(safe_size * 0.44) - bubble_radius // 2,
            int(safe_size * 0.58) + bubble_radius // 2,
            int(safe_size * 0.44) + bubble_radius // 2,
        ),
        fill=(255, 255, 255, 180),
    )

    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


@app.get("/", response_model=None)
async def index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "Backend is running. Frontend page not found in /static/index.html."}


@app.get("/manifest.webmanifest", include_in_schema=False)
async def manifest() -> FileResponse:
    return FileResponse(
        MANIFEST_PATH,
        media_type="application/manifest+json",
        headers={"Cache-Control": "no-cache"},
    )


@app.get("/sw.js", include_in_schema=False)
async def service_worker() -> FileResponse:
    return FileResponse(
        SERVICE_WORKER_PATH,
        media_type="application/javascript",
        headers={"Cache-Control": "no-cache"},
    )


@app.get("/app-icon-{size}.png", include_in_schema=False)
async def app_icon(size: int) -> Response:
    if size not in {192, 512}:
        raise HTTPException(status_code=404, detail="Unsupported app icon size.")
    return Response(
        content=generate_app_icon_png(size),
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.get("/api/health")
async def health_check() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "physics-agent",
        "version": app.version,
        "database_path": str(DATABASE_PATH),
        "runtime_dir": str(RUNTIME_DIR),
        "cors_origins": cors_origins,
    }


@app.get("/api/auth/config")
async def auth_config() -> dict[str, Any]:
    providers = [
        {
            "key": "phone",
            "label": "手机验证码登录",
            "configured": SMS_DELIVERY_MODE != "disabled",
        },
        *auth_provider_catalog(),
    ]
    return {
        "providers": providers,
        "oauth_note": "当前已支持手机号验证码登录；微信 / QQ 正式 OAuth 仍需补充开放平台 AppID、AppSecret 与回调域名。",
        "sms": {
            "enabled": SMS_DELIVERY_MODE != "disabled",
            "delivery_mode": SMS_DELIVERY_MODE,
            "code_length": SMS_CODE_LENGTH,
            "cooldown_seconds": SMS_CODE_COOLDOWN_SECONDS,
            "expires_seconds": SMS_CODE_EXPIRES_SECONDS,
            "teacher_whitelist_enabled": bool(teacher_phone_whitelist()),
        },
    }
    return {
        "providers": auth_provider_catalog(),
        "oauth_note": "微信 / QQ 正式 OAuth 仍需配置开放平台 AppID、AppSecret 与回调域名；当前版本已先接入统一角色和权限隔离框架。",
    }


@app.post("/api/auth/send-code")
async def auth_send_code(payload: PhoneCodeSendRequest) -> dict[str, Any]:
    try:
        phone = normalize_phone(payload.phone)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    latest = STORE.get_latest_phone_verification(phone, purpose="login")
    if latest and latest.get("last_sent_at"):
        retry_at = datetime.fromisoformat(str(latest["last_sent_at"])) + timedelta(seconds=SMS_CODE_COOLDOWN_SECONDS)
        now_dt = datetime.now(timezone.utc)
        if retry_at > now_dt:
            retry_after = max(1, int((retry_at - now_dt).total_seconds()))
            raise HTTPException(status_code=429, detail=f"请求过于频繁，请在 {retry_after} 秒后重试。")

    code = generate_phone_code()
    delivery = deliver_phone_code(phone, code)
    STORE.create_phone_verification(
        phone=phone,
        purpose="login",
        code_hash=build_phone_code_hash(phone, code),
        expires_at=(datetime.now(timezone.utc) + timedelta(seconds=SMS_CODE_EXPIRES_SECONDS)).isoformat(),
        max_attempts=SMS_CODE_MAX_ATTEMPTS,
        delivery_mode=str(delivery.get("delivery_mode") or SMS_DELIVERY_MODE),
    )
    return {
        "ok": True,
        "phone_masked": mask_phone(phone),
        "delivery_mode": delivery.get("delivery_mode") or SMS_DELIVERY_MODE,
        "message": delivery.get("message") or "验证码已发送，请注意查收。",
        "debug_code": delivery.get("debug_code"),
        "cooldown_seconds": SMS_CODE_COOLDOWN_SECONDS,
        "expires_seconds": SMS_CODE_EXPIRES_SECONDS,
    }


@app.post("/api/auth/login/code")
async def auth_login_code(payload: PhoneCodeLoginRequest) -> dict[str, Any]:
    try:
        phone = normalize_phone(payload.phone)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    clean_code = re.sub(r"\D+", "", payload.code or "")
    if len(clean_code) != SMS_CODE_LENGTH:
        raise HTTPException(status_code=400, detail=f"请输入 {SMS_CODE_LENGTH} 位短信验证码。")

    verification = STORE.verify_phone_verification(
        phone=phone,
        code_hash=build_phone_code_hash(phone, clean_code),
        purpose="login",
    )
    if not verification.get("ok"):
        reason = verification.get("reason")
        if reason == "expired":
            raise HTTPException(status_code=400, detail="验证码已过期，请重新获取。")
        if reason == "used":
            raise HTTPException(status_code=400, detail="该验证码已使用，请重新获取。")
        if reason == "too_many_attempts":
            raise HTTPException(status_code=429, detail="验证码输入次数过多，请重新获取。")
        if reason == "invalid":
            remaining = int(verification.get("remaining_attempts") or 0)
            raise HTTPException(status_code=400, detail=f"验证码不正确，剩余可尝试 {remaining} 次。")
        raise HTTPException(status_code=400, detail="未找到可用验证码，请先获取短信验证码。")

    requested_role = normalize_role(payload.role)
    existing_user = STORE.get_user_by_identity("phone", phone)
    role = requested_role
    allow_role_update = True
    if existing_user:
        stored_role = normalize_role(str(existing_user.get("role") or "student"))
        if stored_role == "teacher":
            role = "teacher"
            allow_role_update = False
        elif requested_role == "teacher":
            if phone not in teacher_phone_whitelist():
                raise HTTPException(status_code=403, detail="该手机号尚未被授权为教师账号，请联系管理员登记后再试。")
            role = "teacher"
        else:
            role = "student"
            allow_role_update = False
    elif requested_role == "teacher" and phone not in teacher_phone_whitelist():
        raise HTTPException(status_code=403, detail="教师端手机号需先在后台白名单登记，当前号码暂不可开通教师身份。")

    display_name = " ".join((payload.display_name or "").split()).strip()
    if not display_name and existing_user:
        display_name = str(existing_user.get("display_name") or "").strip()
    if not display_name:
        display_name = f"{'教师' if role == 'teacher' else '学生'} {mask_phone(phone)}"

    user = STORE.upsert_user(
        provider="phone",
        provider_subject=phone,
        display_name=display_name,
        role=role,
        allow_role_update=allow_role_update,
    )
    if str(user.get("role") or role) == "teacher":
        STORE.claim_orphan_workspace(str(user["id"]))
        STORE.ensure_teacher_kb_session(str(user["id"]))
    token = STORE.create_auth_token(str(user["id"]))
    return {
        "token": token,
        "user": user,
        "phone_masked": mask_phone(phone),
    }


@app.post("/api/auth/login/demo")
async def auth_login_demo(payload: AuthLoginRequest) -> dict[str, Any]:
    provider = normalize_provider(payload.provider)
    role = normalize_role(payload.role)
    display_name = " ".join((payload.display_name or "").split()).strip() or ("教师用户" if role == "teacher" else "学生用户")
    provider_subject = f"{role}:{display_name.casefold()}"
    user = STORE.upsert_user(
        provider=provider,
        provider_subject=provider_subject,
        display_name=display_name,
        role=role,
    )
    if role == "teacher":
        STORE.claim_orphan_workspace(str(user["id"]))
        STORE.ensure_teacher_kb_session(str(user["id"]))
    token = STORE.create_auth_token(str(user["id"]))
    return {"token": token, "user": user}


@app.get("/api/auth/me")
async def auth_me(user: dict[str, Any] = Depends(require_current_user)) -> dict[str, Any]:
    return {"user": user}


@app.post("/api/auth/logout")
async def auth_logout(
    user: dict[str, Any] = Depends(require_current_user),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    del user
    STORE.delete_auth_token(extract_bearer_token(authorization))
    return {"ok": True}


@app.get("/api/session")
async def session_state(
    session_id: str = Query(...),
    user: dict[str, Any] = Depends(require_current_user),
) -> dict[str, Any]:
    try:
        STORE.ensure_session(session_id, user_id=str(user["id"]))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    state = get_session_state(session_id, user)
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
async def list_sessions(user: dict[str, Any] = Depends(require_current_user)) -> dict[str, Any]:
    return session_catalog_payload(user)


@app.get("/api/teacher/student-question-stats")
async def student_question_stats(
    limit: int = Query(default=80, ge=10, le=500),
    user: dict[str, Any] = Depends(require_teacher_user),
) -> dict[str, Any]:
    del user
    return STORE.get_student_question_statistics(limit=limit)


@app.get("/api/teacher/student-question-stats/export")
async def export_student_question_stats(
    user: dict[str, Any] = Depends(require_teacher_user),
) -> Response:
    del user
    rows = STORE.list_student_questions_for_export()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["提问时间", "学生", "会话", "输入类型", "问题内容", "状态", "模型"])
    for row in rows:
        writer.writerow(
            [
                row.get("created_at") or "",
                row.get("student_name") or "",
                row.get("session_title") or "",
                row.get("input_mode") or "",
                row.get("content") or "",
                row.get("status") or "",
                row.get("model_used") or "",
            ]
        )
    filename = f"student-question-stats-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.csv"
    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/phet/catalog")
async def phet_catalog() -> dict[str, Any]:
    try:
        return PHET_CATALOG.get_catalog()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/sessions")
async def create_session(
    payload: SessionCreateRequest | None = Body(default=None),
    user: dict[str, Any] = Depends(require_current_user),
) -> dict[str, Any]:
    request = payload or SessionCreateRequest()
    try:
        session_id = STORE.create_session(
            title=request.title or "新对话",
            folder_id=request.folder_id,
            user_id=str(user["id"]),
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    state = cache_session_state(session_id, user)
    return {
        "session_id": session_id,
        "title": state["title"],
        "folder_id": state["folder_id"],
        "folder_name": state["folder_name"],
    }


@app.patch("/api/sessions/{session_id}")
async def update_session(
    session_id: str,
    payload: SessionUpdateRequest,
    user: dict[str, Any] = Depends(require_current_user),
) -> dict[str, Any]:
    folder_value: object = payload.folder_id if "folder_id" in payload.model_fields_set else UNSET
    try:
        STORE.update_session(
            session_id,
            user_id=str(user["id"]),
            title=payload.title,
            folder_id=folder_value,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    state = cache_session_state(session_id, user)
    return {
        "session_id": session_id,
        "title": state["title"],
        "folder_id": state["folder_id"],
        "folder_name": state["folder_name"],
    }


@app.post("/api/folders")
async def create_folder(
    payload: FolderRequest,
    user: dict[str, Any] = Depends(require_current_user),
) -> dict[str, Any]:
    try:
        folder = STORE.create_folder(payload.name, user_id=str(user["id"]))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Create folder failed: {exc}") from exc
    return folder


@app.patch("/api/folders/{folder_id}")
async def rename_folder(
    folder_id: str,
    payload: FolderRequest,
    user: dict[str, Any] = Depends(require_current_user),
) -> dict[str, Any]:
    try:
        STORE.rename_folder(folder_id, payload.name, user_id=str(user["id"]))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return {"id": folder_id, "name": payload.name.strip()}


@app.delete("/api/folders/{folder_id}")
async def delete_folder(
    folder_id: str,
    user: dict[str, Any] = Depends(require_current_user),
) -> dict[str, Any]:
    try:
        STORE.delete_folder(folder_id, user_id=str(user["id"]))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    SESSION_CACHE.clear()
    return {"ok": True, "id": folder_id}


@app.delete("/api/sessions/{session_id}")
async def delete_session(
    session_id: str,
    user: dict[str, Any] = Depends(require_current_user),
) -> dict[str, Any]:
    try:
        STORE.delete_session(session_id, user_id=str(user["id"]))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    SESSION_CACHE.pop(session_cache_key(session_id, user), None)
    return {"ok": True, "session_id": session_id}


@app.post("/api/chat")
async def chat(
    req: ChatRequest,
    user: dict[str, Any] = Depends(require_current_user),
):
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
    try:
        STORE.ensure_session(session_id, user_id=str(user["id"]))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    user_message_id = STORE.create_message(
        session_id,
        "user",
        display_user_content(message_text, input_mode, external_lab_context),
        user_id=str(user["id"]),
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
        user_id=str(user["id"]),
        status="streaming",
        input_mode=input_mode,
    )
    cache_session_state(session_id, user)

    def generate():
        try:
            full_answer = ""
            if audio_payload:
                messages, model_used, raw_audio, mime = build_audio_messages(
                    session_id,
                    user,
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
                cache_session_state(session_id, user)
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
                        "doc_count": get_session_state(session_id, user)["doc_count"],
                    }
                )
                return

            if image_payload:
                if external_lab_context:
                    messages, model_used = build_lab_image_messages(
                        session_id,
                        user,
                        message_text,
                        image_payload,
                        req.image_mime,
                        external_lab_context,
                    )
                else:
                    messages, model_used = build_image_messages(message_text, image_payload, req.image_mime)
            else:
                messages, model_used = build_text_messages(session_id, user, message_text, external_lab_context)

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
            cache_session_state(session_id, user)

            yield sse(
                {
                    "type": "done",
                    "answer": full_answer,
                    "model": model_used,
                    "session_id": session_id,
                    "request_id": request_id,
                    "assistant_message_id": assistant_message_id,
                    "user_message_id": user_message_id,
                    "doc_count": get_session_state(session_id, user)["doc_count"],
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
            cache_session_state(session_id, user)
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
            cache_session_state(session_id, user)
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


@app.post("/api/physics/pendulum/analyze")
async def analyze_pendulum_period(
    session_id: str = Form(...),
    length_m: float | None = Form(None),
    gravity: float = Form(9.8),
    detector: str = Form("auto"),
    message: str = Form("帮我测单摆周期"),
    video: UploadFile = File(...),
    user: dict[str, Any] = Depends(require_current_user),
) -> dict[str, Any]:
    try:
        STORE.ensure_session(session_id, user_id=str(user["id"]))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    filename = video.filename or "pendulum-video"
    ext = pendulum_video_extension(filename, video.content_type)
    if ext not in ALLOWED_PENDULUM_VIDEO_EXT:
        raise HTTPException(status_code=400, detail="请上传 mp4、webm、mov、avi 或 mkv 格式的单摆实验视频。")
    if length_m is not None and length_m <= 0:
        raise HTTPException(status_code=400, detail="摆长 L 必须大于 0。")
    if gravity <= 0:
        raise HTTPException(status_code=400, detail="重力加速度 g 必须大于 0。")

    raw = await video.read()
    if not raw:
        raise HTTPException(status_code=400, detail="上传视频为空。")
    if len(raw) > MAX_PENDULUM_VIDEO_BYTES:
        limit_mb = MAX_PENDULUM_VIDEO_BYTES / (1024 * 1024)
        raise HTTPException(status_code=400, detail=f"视频超过 {limit_mb:.0f}MB 上限，请压缩或截取关键片段后重试。")

    stored_path = PENDULUM_UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
    stored_path.write_bytes(raw)
    processed_path = PENDULUM_UPLOAD_DIR / f"{stored_path.stem}.processed.webm"

    try:
        result = analyze_pendulum_video(
            stored_path,
            length_m=length_m,
            gravity=gravity,
            detector=detector,
            output_video_path=processed_path,
        )
    except PendulumDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except PendulumAnalysisError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"单摆视频分析失败：{exc}") from exc

    clean_message = (message or "").strip() or "帮我测单摆周期"
    user_content = "\n".join(
        [
            "[单摆周期测量]",
            clean_message,
            f"视频文件：{filename}",
            (
                f"摆长 L = {length_m:.4g} m，g = {gravity:.4g} m/s^2"
                if length_m is not None
                else f"摆长 L = 未输入，g = {gravity:.4g} m/s^2"
            ),
            f"检测器：{result.get('detector_requested') or detector}",
        ]
    )
    assistant_content = format_pendulum_report(result)
    model_used = f"{result.get('detector') or detector}-pendulum-cv"
    user_message_id = STORE.create_message(
        session_id,
        "user",
        user_content,
        user_id=str(user["id"]),
        status="done",
        input_mode="video",
    )
    assistant_message_id = STORE.create_message(
        session_id,
        "assistant",
        assistant_content,
        user_id=str(user["id"]),
        model_used=model_used,
        status="done",
        input_mode="video",
    )
    STORE.maybe_autotitle_session(session_id, "单摆周期测量")
    STORE.set_last_model(session_id, model_used)
    cache_session_state(session_id, user)

    if result.get("processed_video_created") and processed_path.exists():
        result["processed_video_url"] = f"/api/physics/pendulum/processed/{processed_path.name}"
        result["processed_video_mime"] = "video/webm"

    return {
        **result,
        "session_id": session_id,
        "user_message_id": user_message_id,
        "assistant_message_id": assistant_message_id,
    }


@app.get("/api/physics/pendulum/processed/{filename}")
async def get_pendulum_processed_video(
    filename: str,
    user: dict[str, Any] = Depends(require_current_user),
) -> FileResponse:
    safe_name = Path(filename).name
    if safe_name != filename or not (safe_name.endswith(".processed.webm") or safe_name.endswith(".processed.mp4")):
        raise HTTPException(status_code=404, detail="处理后视频不存在。")
    root = PENDULUM_UPLOAD_DIR.resolve()
    path = (PENDULUM_UPLOAD_DIR / safe_name).resolve()
    if path.parent != root or not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="处理后视频不存在。")
    media_type = "video/webm" if safe_name.endswith(".webm") else "video/mp4"
    return FileResponse(path, media_type=media_type, filename=safe_name)


@app.post("/api/physics/torsion/live-frame")
async def analyze_torsion_live_frame(
    detector: str = Form("opencv"),
    last_angle_deg: float | None = Form(None),
    image: UploadFile = File(...),
    user: dict[str, Any] = Depends(require_current_user),
) -> dict[str, Any]:
    content_type = (image.content_type or "").lower()
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="实时扭摆分析只接受图像帧。")
    raw = await image.read()
    if not raw:
        raise HTTPException(status_code=400, detail="实时图像帧为空。")
    if len(raw) > MAX_TORSION_LIVE_FRAME_BYTES:
        limit_mb = MAX_TORSION_LIVE_FRAME_BYTES / (1024 * 1024)
        raise HTTPException(status_code=400, detail=f"实时图像帧超过 {limit_mb:.0f}MB 上限。")

    try:
        return analyze_torsion_frame(
            raw,
            detector=detector,
            last_angle_deg=last_angle_deg,
        )
    except TorsionDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except TorsionAnalysisError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"实时扭摆帧分析失败：{exc}") from exc


@app.post("/api/physics/torsion/analyze")
async def analyze_torsion_inertia(
    session_id: str = Form(...),
    torsion_constant: float | None = Form(None),
    calibration_inertia: float | None = Form(None),
    calibration_period: float | None = Form(None),
    initial_angle_deg: float | None = Form(None),
    detector: str = Form("auto"),
    message: str = Form("帮我用扭摆法测转动惯量"),
    video: UploadFile = File(...),
    user: dict[str, Any] = Depends(require_current_user),
) -> dict[str, Any]:
    try:
        STORE.ensure_session(session_id, user_id=str(user["id"]))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    filename = video.filename or "torsion-video"
    ext = pendulum_video_extension(filename, video.content_type)
    if ext not in ALLOWED_PENDULUM_VIDEO_EXT:
        raise HTTPException(status_code=400, detail="请上传 mp4、webm、mov、avi 或 mkv 格式的扭摆实验视频。")
    if torsion_constant is not None and torsion_constant <= 0:
        raise HTTPException(status_code=400, detail="扭转常量 κ 必须大于 0。")
    if calibration_inertia is not None and calibration_inertia <= 0:
        raise HTTPException(status_code=400, detail="标定转动惯量 I0 必须大于 0。")
    if calibration_period is not None and calibration_period <= 0:
        raise HTTPException(status_code=400, detail="标定周期 T0 必须大于 0。")

    raw = await video.read()
    if not raw:
        raise HTTPException(status_code=400, detail="上传视频为空。")
    if len(raw) > MAX_PENDULUM_VIDEO_BYTES:
        limit_mb = MAX_PENDULUM_VIDEO_BYTES / (1024 * 1024)
        raise HTTPException(status_code=400, detail=f"视频超过 {limit_mb:.0f}MB 上限，请压缩或截取关键片段后重试。")

    stored_path = TORSION_UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
    stored_path.write_bytes(raw)
    processed_path = TORSION_UPLOAD_DIR / f"{stored_path.stem}.processed.webm"

    try:
        result = analyze_torsion_video(
            stored_path,
            torsion_constant=torsion_constant,
            calibration_inertia=calibration_inertia,
            calibration_period=calibration_period,
            initial_angle_deg=initial_angle_deg,
            detector=detector,
            output_video_path=processed_path,
        )
    except TorsionDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except TorsionAnalysisError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"扭摆视频分析失败：{exc}") from exc

    clean_message = (message or "").strip() or "帮我用扭摆法测转动惯量"
    user_content = "\n".join(
        [
            "[扭摆法测转动惯量]",
            clean_message,
            f"视频文件：{filename}",
            f"扭转常量 κ = {torsion_constant:.6g} N·m/rad" if torsion_constant is not None else "扭转常量 κ = 未直接输入",
            (
                f"标定数据：I0 = {calibration_inertia:.6g} kg·m²，T0 = {calibration_period:.6g} s"
                if calibration_inertia is not None and calibration_period is not None
                else "标定数据：未输入"
            ),
            f"初始角 θ0 = {initial_angle_deg:.4g}°" if initial_angle_deg is not None else "初始角 θ0 = 未输入",
            f"检测器：{result.get('detector_requested') or detector}",
        ]
    )
    assistant_content = format_torsion_report(result)
    model_used = f"{result.get('detector') or detector}-torsion-cv"
    user_message_id = STORE.create_message(
        session_id,
        "user",
        user_content,
        user_id=str(user["id"]),
        status="done",
        input_mode="video",
    )
    assistant_message_id = STORE.create_message(
        session_id,
        "assistant",
        assistant_content,
        user_id=str(user["id"]),
        model_used=model_used,
        status="done",
        input_mode="video",
    )
    STORE.maybe_autotitle_session(session_id, "扭摆法测转动惯量")
    STORE.set_last_model(session_id, model_used)
    cache_session_state(session_id, user)

    if result.get("processed_video_created") and processed_path.exists():
        result["processed_video_url"] = f"/api/physics/torsion/processed/{processed_path.name}"
        result["processed_video_mime"] = "video/webm"

    return {
        **result,
        "session_id": session_id,
        "user_message_id": user_message_id,
        "assistant_message_id": assistant_message_id,
    }


@app.get("/api/physics/torsion/processed/{filename}")
async def get_torsion_processed_video(
    filename: str,
    user: dict[str, Any] = Depends(require_current_user),
) -> FileResponse:
    safe_name = Path(filename).name
    if safe_name != filename or not (safe_name.endswith(".processed.webm") or safe_name.endswith(".processed.mp4")):
        raise HTTPException(status_code=404, detail="处理后视频不存在。")
    root = TORSION_UPLOAD_DIR.resolve()
    path = (TORSION_UPLOAD_DIR / safe_name).resolve()
    if path.parent != root or not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="处理后视频不存在。")
    media_type = "video/webm" if safe_name.endswith(".webm") else "video/mp4"
    return FileResponse(path, media_type=media_type, filename=safe_name)


@app.post("/api/upload")
async def upload(
    session_id: str = Form(...),
    target_scope: str = Form("session"),
    files: list[UploadFile] = File(...),
    user: dict[str, Any] = Depends(require_current_user),
) -> dict[str, Any]:
    clean_scope = "teacher_kb" if target_scope == "teacher_kb" else "session"
    try:
        STORE.ensure_session(session_id, user_id=str(user["id"]))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    target_session_id = session_id
    if clean_scope == "teacher_kb":
        if normalize_role(str(user.get("role") or "")) != "teacher":
            raise HTTPException(status_code=403, detail="学生端不允许上传教师知识库。")
        target_session_id = STORE.ensure_teacher_kb_session(str(user["id"]))

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
                target_session_id,
                original_name=filename,
                stored_path=str(stored_path),
                mime_type=ext_to_mime(ext),
                text=text,
                chunks=chunk_document(text),
            )
            doc_results.append({"name": filename, "chars": doc_record["chars"], "source_label": doc_record["source_label"]})
            continue

        if clean_scope == "teacher_kb":
            skipped.append({"name": filename, "reason": "teacher knowledge base accepts PDF or DOCX only"})
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

    state = cache_session_state(session_id, user)
    return {
        "session_id": session_id,
        "uploaded_documents": doc_results,
        "documents": state["documents"],
        "images": image_results,
        "audios": audio_results,
        "skipped": skipped,
        "doc_count": state["doc_count"],
    }


@app.delete("/api/clear-docs")
async def clear_docs(
    session_id: str = Query(...),
    target_scope: str = Query("session"),
    user: dict[str, Any] = Depends(require_current_user),
) -> dict[str, Any]:
    clean_scope = "teacher_kb" if target_scope == "teacher_kb" else "session"
    target_session_id = session_id
    if clean_scope == "teacher_kb":
        if normalize_role(str(user.get("role") or "")) != "teacher":
            raise HTTPException(status_code=403, detail="学生端不允许清空教师知识库。")
        target_session_id = STORE.ensure_teacher_kb_session(str(user["id"]))
    try:
        paths = STORE.clear_documents(target_session_id, user_id=str(user["id"]))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    remove_files(paths)
    state = cache_session_state(session_id, user)
    return {
        "ok": True,
        "doc_count": state["doc_count"],
        "documents": state["documents"],
    }


@app.post("/api/clear-history")
async def clear_history(
    session_id: str = Query(...),
    user: dict[str, Any] = Depends(require_current_user),
) -> dict[str, Any]:
    try:
        STORE.clear_history(session_id, user_id=str(user["id"]))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    state = cache_session_state(session_id, user)
    return {"ok": True, "message_count": len(state["messages"])}


if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("UVICORN_RELOAD", "1").strip().lower() in {"1", "true", "yes", "on"},
    )

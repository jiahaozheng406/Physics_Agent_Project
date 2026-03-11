# CLAUDE.md

- [English](#english)
- [简体中文](#简体中文)

## English

### Role of This Document

Concise developer handoff note. Implementation-focused, not marketing.

### Current Product Shape

- Single-process FastAPI app serving API + static frontend
- SQLite (WAL mode) for sessions, messages, documents, chunked retrieval
- DashScope API for text (`qwen-plus`), vision (`qwen-vl-max`), audio (`qwen-audio-turbo`)
- 64 PhET simulations with per-experiment UI profiles and teaching prompts
- RAG pipeline: upload → chunk (1100 chars / 180 overlap) → FTS5 → top-6 retrieval

### Dependencies

```
fastapi, uvicorn[standard], openai, python-dotenv,
python-multipart, pdfplumber, python-docx, Pillow
```

### Main Files (read these first)

| Priority | File | What it does |
|----------|------|-------------|
| 1 | `backend/main.py` | All API routes, system prompt, chat SSE logic |
| 2 | `backend/storage.py` | SQLite schema, CRUD for sessions/messages/docs/chunks |
| 3 | `backend/phet_catalog.py` | 64 simulation entries with topic specs & teaching prompts |
| 4 | `backend/rag.py` | Document chunking + FTS5 context building |
| 5 | `backend/models.py` | DashScope model gateway |
| 6 | `static/app.js` | All frontend logic (chat, upload, sessions, simulations) |
| 7 | `static/index.html` + `style.css` | UI structure + glassmorphism styling |

### Important Runtime Notes

- The active system prompt is **embedded in `backend/main.py`**, not loaded from `system_prompt.md`
- `system_prompt.md` is a reference spec only
- `data/physics_agent.sqlite3` and `data/phet_catalog.json` are runtime files (gitignored)
- `uploads/` stores user artifacts — not source code

### Maintenance Priorities

1. Keep docs aligned with live backend routes and frontend files
2. Never reintroduce deprecated paths (`app.py`, `static/js/app.js`)
3. Keep runtime files out of Git
4. Refine simulation UI profiles marked `needs_manual_review`
5. System prompt should eventually be externalized from `main.py`

### Pre-commit Checks

```bash
python -m py_compile backend/main.py backend/phet_catalog.py backend/rag.py backend/storage.py
node --check static/app.js
git status --short
```

---

## 简体中文

### 文档定位

简短的开发交接说明，重点是实用落地。

### 当前产品形态

- 单进程 FastAPI 应用，同时提供 API 和静态前端
- SQLite（WAL 模式）持久化会话、消息、文档、分块检索数据
- DashScope API 提供文本（`qwen-plus`）、视觉（`qwen-vl-max`）、音频（`qwen-audio-turbo`）能力
- 64 个 PhET 仿真，每个实验配有界面画像和教学提示词
- RAG 管线：上传 → 分块（1100 字符 / 180 重叠）→ FTS5 → top-6 检索

### 依赖

```
fastapi, uvicorn[standard], openai, python-dotenv,
python-multipart, pdfplumber, python-docx, Pillow
```

### 核心文件（按优先级阅读）

| 优先级 | 文件 | 职责 |
|--------|------|------|
| 1 | `backend/main.py` | 所有 API 路由、系统提示词、SSE 对话逻辑 |
| 2 | `backend/storage.py` | SQLite 表结构、会话/消息/文档/分块的增删改查 |
| 3 | `backend/phet_catalog.py` | 64 个仿真条目及教学提示词 |
| 4 | `backend/rag.py` | 文档分块 + FTS5 上下文构建 |
| 5 | `backend/models.py` | DashScope 模型网关 |
| 6 | `static/app.js` | 前端全部逻辑（聊天、上传、会话、仿真） |
| 7 | `static/index.html` + `style.css` | UI 结构 + 毛玻璃样式 |

### 运行时注意事项

- 系统提示词**写在 `backend/main.py` 中**，不是从 `system_prompt.md` 加载的
- `system_prompt.md` 只是参考规范
- `data/physics_agent.sqlite3` 和 `data/phet_catalog.json` 是运行时文件（已 gitignore）
- `uploads/` 存放用户上传内容，不是源码

### 维护重点

1. 文档必须和现行后端路由、前端主线保持一致
2. 不要把旧入口（`app.py`、`static/js/app.js`）写回文档
3. 运行时文件排除出 Git
4. 继续精修 `needs_manual_review` 标记的仿真界面画像
5. 系统提示词后续应从 `main.py` 中抽离

### 提交前检查

```bash
python -m py_compile backend/main.py backend/phet_catalog.py backend/rag.py backend/storage.py
node --check static/app.js
git status --short
```

# AGENTS.md

- [English](#english)
- [简体中文](#简体中文)

## English

### Purpose

Operating notes for coding agents working inside this repository.

### Source of Truth

| File | Role | Lines |
|------|------|-------|
| `backend/main.py` | API gateway, routes, system prompt | 989 |
| `backend/storage.py` | SQLite persistence (sessions, messages, docs, chunks) | 726 |
| `backend/rag.py` | Document chunking + FTS5 retrieval | 71 |
| `backend/models.py` | DashScope model routing (text/vision/audio) | 121 |
| `backend/phet_catalog.py` | 64 PhET simulations catalog + teaching prompts | 3033 |
| `backend/phet_ui_overrides.py` | Per-simulation UI profiles | 2568 |
| `static/index.html` | SPA entry point | 295 |
| `static/app.js` | Frontend logic (chat, upload, simulations) | 4688 |
| `static/style.css` | Glassmorphism styles | 2457 |

**Deprecated paths** — do NOT use: `app.py`, `static/js/app.js`, `static/css/style.css`

### API Routes Reference

```
GET  /                          → Serve frontend
POST /api/chat                  → SSE streaming chat
POST /api/upload                → Upload document/image/audio
GET  /api/sessions              → List sessions
POST /api/sessions              → Create session
PATCH /api/sessions/{id}        → Rename session
DELETE /api/sessions/{id}       → Delete session
POST /api/folders               → Create folder
PATCH /api/folders/{id}         → Rename folder
DELETE /api/folders/{id}        → Delete folder
GET  /api/phet/catalog          → PhET simulation list
GET  /api/phet/proxy/{path}     → PhET resource proxy
DELETE /api/clear-docs          → Clear knowledge base
POST /api/clear-history         → Clear chat history
```

### Database Tables

`session_folders`, `sessions`, `messages`, `documents`, `document_chunks` — all in SQLite with WAL mode.

### Safe Working Rules

- Edit files under `backend/` and `static/` only
- `data/`, `uploads/`, `__pycache__/` are runtime artifacts — do not commit
- Keep user-facing text in Chinese academic style
- Do not break existing API shapes unless the task requires it
- If changing PhET logic, verify both `/api/phet/catalog` and the chat flow

### Local Checks

```bash
python -m py_compile backend/main.py backend/phet_catalog.py backend/rag.py backend/storage.py
node --check static/app.js
uvicorn backend.main:app --reload --port 8000   # smoke test
```

### Documentation Map

| File | Content |
|------|---------|
| `README.md` | Overview, setup guide, features |
| `CLAUDE.md` | Developer handoff notes |
| `PROJECT_ANALYSIS.md` | Current state report |
| `AGENT_OPTIMIZATION_REPORT.md` | Gap analysis & next steps |
| `system_prompt.md` | Reference prompt specification |

---

## 简体中文

### 用途

给在本仓库内协作的编码智能体使用的操作说明。

### 主线文件

| 文件 | 职责 | 行数 |
|------|------|------|
| `backend/main.py` | API 网关、路由、系统提示词 | 989 |
| `backend/storage.py` | SQLite 持久化（会话、消息、文档、分块） | 726 |
| `backend/rag.py` | 文档分块 + FTS5 检索 | 71 |
| `backend/models.py` | DashScope 模型路由（文本/视觉/音频） | 121 |
| `backend/phet_catalog.py` | 64 个 PhET 仿真目录 + 教学提示词 | 3033 |
| `backend/phet_ui_overrides.py` | 每个仿真的界面画像 | 2568 |
| `static/index.html` | 单页应用入口 | 295 |
| `static/app.js` | 前端逻辑（聊天、上传、仿真） | 4688 |
| `static/style.css` | 毛玻璃样式 | 2457 |

**已弃用路径** — 不要再使用：`app.py`、`static/js/app.js`、`static/css/style.css`

### API 路由索引

```
GET  /                          → 前端页面
POST /api/chat                  → SSE 流式对话
POST /api/upload                → 上传文档/图片/音频
GET  /api/sessions              → 会话列表
POST /api/sessions              → 创建会话
PATCH /api/sessions/{id}        → 重命名会话
DELETE /api/sessions/{id}       → 删除会话
POST /api/folders               → 创建文件夹
PATCH /api/folders/{id}         → 重命名文件夹
DELETE /api/folders/{id}        → 删除文件夹
GET  /api/phet/catalog          → PhET 实验列表
GET  /api/phet/proxy/{path}     → PhET 资源代理
DELETE /api/clear-docs          → 清空知识库
POST /api/clear-history         → 清空对话历史
```

### 数据库表

`session_folders`、`sessions`、`messages`、`documents`、`document_chunks` — 均在 SQLite WAL 模式下运行。

### 协作规则

- 只修改 `backend/` 和 `static/` 下的文件
- `data/`、`uploads/`、`__pycache__/` 是运行时产物，不要提交
- 用户可见文案保持中文学术化风格
- 不要随意改变已有接口，除非任务明确要求
- 改动 PhET 逻辑后，同时验证 `/api/phet/catalog` 和对话主链路

### 本地检查

```bash
python -m py_compile backend/main.py backend/phet_catalog.py backend/rag.py backend/storage.py
node --check static/app.js
uvicorn backend.main:app --reload --port 8000   # 冒烟测试
```

### 文档索引

| 文件 | 内容 |
|------|------|
| `README.md` | 项目概览、安装指南、功能说明 |
| `CLAUDE.md` | 开发交接说明 |
| `PROJECT_ANALYSIS.md` | 项目现状报告 |
| `AGENT_OPTIMIZATION_REPORT.md` | 差距分析与后续计划 |
| `system_prompt.md` | 参考提示词规范 |

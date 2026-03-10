# Physics Agent Project

- [English](#english)
- [简体中文](#简体中文)

## English

### Overview

Physics Agent Project is a multimodal physics experiment teaching agent built around a single FastAPI application and a browser-based workspace. It combines document-grounded Q&A, image understanding, audio input, persistent conversations, in-browser laboratory simulations, and a PhET-based extracurricular simulation workspace.

The current production path in this repository is:

- Backend entry: `backend/main.py`
- Frontend entry: `static/index.html`
- Frontend logic: `static/app.js`
- Frontend styles: `static/style.css`

### What Is Implemented

- Streaming chat over SSE with stable event types: `model`, `chunk`, `done`, `error`
- SQLite persistence for sessions, messages, uploaded documents, and document chunks
- RAG over SQLite FTS5 chunks instead of whole-document prompt stuffing
- Multimodal routing for text, image, and audio
- Session folders/projects, session rename/delete/move, and project-level creation flows
- Physics experiment library with built-in simulations and prompt shortcuts
- Extracurricular simulation workspace with 64 PhET-based physics simulations
- Per-simulation UI profiles, Chinese academic summaries, and hidden tutoring context
- Hidden extracurricular simulation snapshots captured at question time for visual reasoning

### Architecture

```text
Browser UI
  ├─ Chat workspace
  ├─ Upload area
  ├─ Built-in experiment library
  └─ Extracurricular simulation workspace
            │
            ▼
FastAPI (backend/main.py)
  ├─ Session APIs
  ├─ Streaming chat API
  ├─ Upload API
  ├─ SQLite persistence layer
  ├─ RAG layer
  ├─ DashScope model gateway
  └─ PhET catalog service
            │
            ▼
DashScope + SQLite + local uploads/data cache
```

### Feature Highlights

- Teaching-first behavior: grounded, traceable, and heuristic explanations
- Uploaded PDF/DOCX materials can be chunked, indexed, and cited as `[Source N]`
- Image questions are routed to `qwen-vl-max`
- Audio questions are routed to `qwen-audio-turbo`
- Conversation recovery survives refresh and service restart
- Extracurricular simulations stay inside the current conversation instead of spawning a new one
- Project-style sidebar supports folders, drag-and-drop move, and direct new chat creation inside a project

### Repository Layout

```text
Physics_Agent_Project/
├── backend/
│   ├── main.py
│   ├── models.py
│   ├── phet_catalog.py
│   ├── rag.py
│   └── storage.py
├── static/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── data/
├── uploads/
├── README.md
├── AGENTS.md
├── CLAUDE.md
├── PROJECT_ANALYSIS.md
├── AGENT_OPTIMIZATION_REPORT.md
└── system_prompt.md
```

### Requirements

- Python 3.10+
- DashScope API key in `.env`

Example:

```env
DASHSCOPE_API_KEY=your_api_key_here
```

### Install

```bash
pip install -r requirements.txt
```

### Run

```bash
uvicorn backend.main:app --reload --port 8000
```

Or:

```bash
python backend/main.py
```

Open:

`http://127.0.0.1:8000/`

### Public APIs

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Serve the main UI |
| `GET` | `/api/session` | Restore one session |
| `GET` | `/api/sessions` | List folders and sessions |
| `GET` | `/api/phet/catalog` | Return extracurricular simulation catalog |
| `POST` | `/api/sessions` | Create a conversation |
| `PATCH` | `/api/sessions/{session_id}` | Rename or move a conversation |
| `DELETE` | `/api/sessions/{session_id}` | Delete a conversation |
| `POST` | `/api/folders` | Create a project |
| `PATCH` | `/api/folders/{folder_id}` | Rename a project |
| `DELETE` | `/api/folders/{folder_id}` | Delete a project |
| `POST` | `/api/chat` | Streaming multimodal chat |
| `POST` | `/api/upload` | Upload PDF, DOCX, image, or audio data |
| `DELETE` | `/api/clear-docs` | Clear uploaded document context |
| `POST` | `/api/clear-history` | Clear one conversation history |

### Current Documentation

- `README.md`: project overview and run guide
- `AGENTS.md`: coding-agent operating notes
- `CLAUDE.md`: developer handoff and maintenance notes
- `PROJECT_ANALYSIS.md`: current-state analysis
- `AGENT_OPTIMIZATION_REPORT.md`: capability-gap report versus stronger agent systems
- `system_prompt.md`: reference prompt specification; the active prompt is currently embedded in `backend/main.py`

### Current Priorities

1. Continue manual refinement for simulations marked with `needs_manual_review`
2. Add broader automated tests around persistence, SSE, RAG, and extracurricular visual flows
3. Separate the active system prompt from code into a managed prompt asset
4. Reduce tracked generated artifacts and keep runtime data local-only

---

## 简体中文

### 项目概述

Physics Agent Project 是一个面向物理实验教学的多模态智能体系统，采用单体 FastAPI 应用加浏览器工作台的结构，整合了文档问答、图像理解、音频输入、会话持久化、自研实验仿真以及基于 PhET 的课外实验仿真工作区。

当前仓库的真实主线是：

- 后端入口：`backend/main.py`
- 前端入口：`static/index.html`
- 前端逻辑：`static/app.js`
- 前端样式：`static/style.css`

### 当前已实现能力

- 基于 SSE 的流式对话，稳定事件类型为 `model`、`chunk`、`done`、`error`
- 使用 SQLite 持久化会话、消息、上传文档和文档分块
- 基于 SQLite FTS5 的分块式 RAG，而不是整文拼接注入
- 文本、图片、音频的多模态路由
- 项目/文件夹、对话重命名、删除、移动，以及项目内直接新建对话
- 内置物理实验库与若干自研仿真
- 基于 PhET 的 64 个课外物理仿真实验工作区
- 面向单个仿真的界面画像、中文学术概述和隐藏教学上下文
- 提问时静默截取当前课外仿真画面，用于视觉理解但不在聊天区展示图片

### 系统架构

```text
浏览器前端
  ├─ 对话工作区
  ├─ 上传区域
  ├─ 内置实验库
  └─ 课外实验工作区
            │
            ▼
FastAPI（backend/main.py）
  ├─ 会话接口
  ├─ 流式聊天接口
  ├─ 上传接口
  ├─ SQLite 存储层
  ├─ RAG 检索层
  ├─ DashScope 模型网关
  └─ 课外实验目录服务
            │
            ▼
DashScope + SQLite + 本地上传/缓存
```

### 功能亮点

- 以教学为中心，强调可追溯、反幻觉、启发式讲解
- 上传 PDF/DOCX 后自动切块、索引，并可按 `[Source N]` 引用
- 图片问题自动路由到 `qwen-vl-max`
- 音频问题自动路由到 `qwen-audio-turbo`
- 刷新页面或重启服务后仍可恢复会话
- 课外实验提问不会新开对话，而是延续当前会话
- 左侧项目式侧栏支持文件夹、拖拽移动和项目内直接新建对话

### 仓库结构

```text
Physics_Agent_Project/
├── backend/
│   ├── main.py
│   ├── models.py
│   ├── phet_catalog.py
│   ├── rag.py
│   └── storage.py
├── static/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── data/
├── uploads/
├── README.md
├── AGENTS.md
├── CLAUDE.md
├── PROJECT_ANALYSIS.md
├── AGENT_OPTIMIZATION_REPORT.md
└── system_prompt.md
```

### 环境要求

- Python 3.10+
- `.env` 中配置 DashScope API Key

示例：

```env
DASHSCOPE_API_KEY=your_api_key_here
```

### 安装

```bash
pip install -r requirements.txt
```

### 启动

```bash
uvicorn backend.main:app --reload --port 8000
```

或者：

```bash
python backend/main.py
```

打开：

`http://127.0.0.1:8000/`

### 公共接口

| 方法 | 路径 | 功能 |
| --- | --- | --- |
| `GET` | `/` | 返回主界面 |
| `GET` | `/api/session` | 恢复单个会话 |
| `GET` | `/api/sessions` | 返回项目与会话目录 |
| `GET` | `/api/phet/catalog` | 返回课外实验目录 |
| `POST` | `/api/sessions` | 新建对话 |
| `PATCH` | `/api/sessions/{session_id}` | 重命名或移动对话 |
| `DELETE` | `/api/sessions/{session_id}` | 删除对话 |
| `POST` | `/api/folders` | 新建项目 |
| `PATCH` | `/api/folders/{folder_id}` | 重命名项目 |
| `DELETE` | `/api/folders/{folder_id}` | 删除项目 |
| `POST` | `/api/chat` | 多模态流式聊天 |
| `POST` | `/api/upload` | 上传 PDF、DOCX、图片或音频 |
| `DELETE` | `/api/clear-docs` | 清空当前会话文档上下文 |
| `POST` | `/api/clear-history` | 清空当前会话历史 |

### 当前文档说明

- `README.md`：项目总览与运行方式
- `AGENTS.md`：给编码智能体使用的协作说明
- `CLAUDE.md`：给开发者和维护者的交接说明
- `PROJECT_ANALYSIS.md`：项目现状分析
- `AGENT_OPTIMIZATION_REPORT.md`：面向更强智能体系统的能力差距报告
- `system_prompt.md`：参考提示词规范；当前运行时实际提示词仍内嵌在 `backend/main.py`

### 当前重点

1. 继续对 `needs_manual_review` 标记的课外实验做人工精修
2. 补足围绕持久化、SSE、RAG 和课外实验视觉链路的自动化测试
3. 将运行时提示词从代码中抽离成可管理资源
4. 继续减少不应纳入版本控制的运行时生成文件

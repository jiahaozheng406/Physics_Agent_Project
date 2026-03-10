# AGENTS.md

- [English](#english)
- [简体中文](#简体中文)

## English

### Purpose

This file is the operating note for coding agents working inside this repository.

### Source of Truth

- Backend entry: `backend/main.py`
- Frontend entry: `static/index.html`
- Frontend logic: `static/app.js`
- Frontend styles: `static/style.css`
- Persistent storage: `backend/storage.py`
- RAG logic: `backend/rag.py`
- Extracurricular simulation catalog: `backend/phet_catalog.py`

Do not treat `app.py`, `static/js/app.js`, or `static/css/style.css` as the active implementation path. They are no longer the current product path.

### What the Project Currently Contains

- Single FastAPI app serving both API and static UI
- SQLite persistence for sessions, folders, messages, documents, and chunked retrieval data
- SSE chat streaming
- DashScope routing for text, vision, and audio
- Built-in experiment library plus extracurricular simulation workspace
- Hidden extracurricular simulation snapshots for question-time visual context

### Safe Working Rules

- Prefer editing the active files under `backend/` and `static/`
- Treat `data/`, `uploads/`, `__pycache__/`, and log files as runtime artifacts unless explicitly required
- Keep user-facing wording aligned with the current Chinese academic UI style
- Preserve current API shapes unless the task explicitly asks for breaking changes
- If you touch extracurricular simulation behavior, verify both `/api/phet/catalog` and the current chat flow

### Recommended Local Checks

```bash
python -m py_compile backend/main.py backend/phet_catalog.py backend/rag.py backend/storage.py
node --check static/app.js
```

Optional smoke checks:

```bash
uvicorn backend.main:app --reload --port 8000
```

Then open:

`http://127.0.0.1:8000/`

### Documentation Map

- `README.md`: overview and run guide
- `CLAUDE.md`: developer handoff and maintenance notes
- `PROJECT_ANALYSIS.md`: current-state report
- `AGENT_OPTIMIZATION_REPORT.md`: next-step and gap report
- `system_prompt.md`: reference prompt spec

---

## 简体中文

### 用途

这份文件是给在本仓库内协作的编码智能体使用的操作说明。

### 主线文件

- 后端入口：`backend/main.py`
- 前端入口：`static/index.html`
- 前端逻辑：`static/app.js`
- 前端样式：`static/style.css`
- 持久化存储：`backend/storage.py`
- RAG 逻辑：`backend/rag.py`
- 课外实验目录：`backend/phet_catalog.py`

不要再把 `app.py`、`static/js/app.js`、`static/css/style.css` 视为当前主线实现，它们已经不是现行产品路径。

### 当前项目已包含的核心能力

- 同一个 FastAPI 应用同时提供 API 和静态前端
- 基于 SQLite 的会话、项目、消息、文档和分块检索持久化
- SSE 流式聊天
- DashScope 文本、视觉、音频模型路由
- 内置实验库与课外实验工作区
- 课外实验提问时的隐藏仿真快照

### 协作规则

- 优先修改 `backend/` 和 `static/` 下的现行文件
- `data/`、`uploads/`、`__pycache__/`、日志文件默认视为运行时产物，除非任务明确需要
- 用户可见文案保持与当前中文学术化界面一致
- 如果不是明确要破坏兼容性，不要随意修改现有接口形状
- 只要改动课外实验相关逻辑，就同时验证 `/api/phet/catalog` 和当前对话主链路

### 推荐检查命令

```bash
python -m py_compile backend/main.py backend/phet_catalog.py backend/rag.py backend/storage.py
node --check static/app.js
```

可选冒烟运行：

```bash
uvicorn backend.main:app --reload --port 8000
```

然后打开：

`http://127.0.0.1:8000/`

### 文档索引

- `README.md`：项目概览与运行说明
- `CLAUDE.md`：开发交接和维护说明
- `PROJECT_ANALYSIS.md`：项目现状报告
- `AGENT_OPTIMIZATION_REPORT.md`：后续优化与差距报告
- `system_prompt.md`：参考提示词规范

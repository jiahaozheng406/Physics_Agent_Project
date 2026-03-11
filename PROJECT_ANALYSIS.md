# Project Analysis

- [English](#english)
- [简体中文](#简体中文)

## English

### Executive Summary

The project is **feature-complete for demo and internal use**. The main product loop works end-to-end:

- Browser chat workspace with SSE streaming
- Document upload → chunking → RAG retrieval with citations
- Image and audio question handling (multimodal)
- Persistent sessions and project folders
- 64 PhET interactive simulations with parameter-aware tutoring

Current state: functional product, mid-transition toward cleaner production-grade engineering.

### Codebase Metrics

| Component | Files | Total Lines |
|-----------|-------|-------------|
| Backend (`backend/`) | 6 | ~7,508 |
| Frontend (`static/`) | 3 | ~7,440 |
| **Total** | **9** | **~14,948** |

Key files by size: `phet_catalog.py` (3033), `phet_ui_overrides.py` (2568), `app.js` (4688), `style.css` (2457), `main.py` (989), `storage.py` (726).

### Architecture

| Layer | Implementation |
|-------|---------------|
| Web framework | FastAPI (single-process, API + static serving) |
| Database | SQLite with WAL mode, FTS5 for full-text search |
| AI models | DashScope (Qwen) — text, vision, audio |
| RAG pipeline | Chunking (1100/180) → FTS5 → top-6 context injection |
| Frontend | Vanilla JS + Tailwind CSS + KaTeX |
| Simulations | 64 PhET experiments with UI profiles & teaching prompts |

### What Is Strong

- Clear vertical focus on physics experiment teaching
- Multimodal input (text + image + audio), not just text chat
- Chunk-based RAG with FTS5 — not whole-document stuffing
- Session persistence with folder organization
- Simulation workspace is materially differentiated from a chatbot
- Sidebar, projects, history, and simulation actions form a coherent product

### What Needs Tightening

| Area | Issue |
|------|-------|
| Prompt management | System prompt embedded in `main.py`, should be externalized |
| Simulation profiles | Some still rely on generated heuristics, need manual curation |
| Test coverage | Light relative to feature complexity |
| Frontend | 4688 lines in single file, would benefit from modularization |

### Immediate Priorities

1. Keep documentation aligned with active code paths
2. Expand test coverage (SSE, persistence, RAG, simulation-assisted chat)
3. Refine simulations marked `needs_manual_review`
4. Externalize runtime prompt and model configuration
5. Modularize frontend state management

---

## 简体中文

### 执行结论

项目已**达到演示和内部使用的完整度**，主产品闭环全部跑通：

- 浏览器聊天工作台（SSE 流式）
- 文档上传 → 分块 → RAG 检索 + 引用标注
- 图片与音频提问（多模态）
- 会话与项目文件夹持久化
- 64 个 PhET 交互式仿真，支持参数感知教学

当前状态：可用产品，正在向更干净的工程化版本过渡。

### 代码规模

| 组件 | 文件数 | 总行数 |
|------|--------|--------|
| 后端 (`backend/`) | 6 | ~7,508 |
| 前端 (`static/`) | 3 | ~7,440 |
| **合计** | **9** | **~14,948** |

主要文件：`phet_catalog.py` (3033)、`phet_ui_overrides.py` (2568)、`app.js` (4688)、`style.css` (2457)、`main.py` (989)、`storage.py` (726)。

### 架构

| 层级 | 实现 |
|------|------|
| Web 框架 | FastAPI（单进程，API + 静态文件） |
| 数据库 | SQLite WAL 模式，FTS5 全文检索 |
| AI 模型 | DashScope (Qwen) — 文本、视觉、音频 |
| RAG 管线 | 分块 (1100/180) → FTS5 → top-6 上下文注入 |
| 前端 | 原生 JS + Tailwind CSS + KaTeX |
| 仿真 | 64 个 PhET 实验，含界面画像与教学提示词 |

### 当前优势

- 垂直场景明确，聚焦物理实验教学
- 多模态输入（文本 + 图像 + 音频），不是纯文本聊天
- 基于 FTS5 的分块 RAG，而非整文注入
- 会话持久化 + 文件夹组织
- 仿真工作区与普通聊天有明显差异化
- 左侧项目、历史、实验动作形成统一产品面

### 需要收紧的地方

| 方面 | 问题 |
|------|------|
| 提示词管理 | 系统提示词内嵌在 `main.py` 中，应抽离 |
| 仿真画像 | 部分仍依赖自动生成，需人工精修 |
| 测试覆盖 | 与功能复杂度相比偏少 |
| 前端 | 4688 行在单文件中，适合继续模块化 |

### 近期优先级

1. 保持文档与现行代码一致
2. 补强测试（SSE、持久化、RAG、仿真辅助问答）
3. 精修 `needs_manual_review` 标记的仿真
4. 将运行时提示词和模型配置从代码中抽离
5. 前端状态管理模块化

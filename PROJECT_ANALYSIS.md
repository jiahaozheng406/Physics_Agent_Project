# Project Analysis

- [English](#english)
- [简体中文](#简体中文)

## English

### Executive Summary

The project is no longer in the “prototype sketch” stage. The main product loop already works:

- browser chat workspace
- document upload and chunked retrieval
- image and audio question handling
- persistent sessions and projects
- built-in simulations
- extracurricular simulation workspace

The real state of the project is: feature-complete for demo and internal use, but still mid-transition toward a cleaner production-grade codebase.

### Current Architecture

- Active backend: `backend/main.py`
- Active frontend: `static/index.html`, `static/app.js`, `static/style.css`
- Persistence: SQLite through `backend/storage.py`
- Retrieval: chunking + SQLite FTS5 through `backend/rag.py`
- Extracurricular simulations: `backend/phet_catalog.py`

### What Is Strong

- Clear vertical focus on physics experiment teaching
- Multimodal input instead of text-only chat
- Retrieval is already chunk-based instead of whole-document stuffing
- Session persistence is in place
- The extracurricular simulation flow is materially differentiated from a normal chatbot
- The sidebar, projects, history, and simulation actions form a coherent product surface

### What Still Needs Engineering Tightening

- The runtime prompt is still embedded in code instead of being managed separately
- Some simulation UI profiles still rely on generated heuristics and require manual refinement
- There is still runtime data currently tracked in Git history/worktree
- Automated coverage is still light relative to feature breadth
- The frontend logic remains large and would benefit from modularization

### Immediate Priorities

1. Keep documentation aligned with the active code path
2. Remove generated runtime artifacts from Git tracking
3. Expand tests around SSE, persistence, RAG, and simulation-assisted visual chat
4. Refine simulations marked `needs_manual_review`
5. Externalize the runtime prompt and model config

---

## 简体中文

### 执行结论

这个项目已经不是“草图级原型”了，主产品闭环已经跑通：

- 浏览器聊天工作台
- 文档上传与分块检索
- 图片与音频提问
- 会话与项目持久化
- 内置实验仿真
- 课外实验仿真工作区

更准确地说，当前状态是：演示和内部使用层面已经具备完整度，但离更干净的工程化版本还有一段收口工作。

### 当前架构

- 后端主线：`backend/main.py`
- 前端主线：`static/index.html`、`static/app.js`、`static/style.css`
- 持久化：`backend/storage.py` 中的 SQLite
- 检索：`backend/rag.py` 中的切块 + SQLite FTS5
- 课外实验：`backend/phet_catalog.py`

### 当前优势

- 垂直场景非常明确，聚焦物理实验教学
- 不是单纯文本聊天，而是真正的多模态输入
- 检索已经从整文注入升级为分块式
- 会话持久化已经具备
- 课外实验链路与普通聊天产品有明显差异化
- 左侧项目、历史、实验动作已经形成统一产品面

### 还需要继续收紧的地方

- 运行时提示词还内嵌在代码里，没有独立管理
- 一部分课外实验界面画像仍然依赖自动生成，需要人工精修
- Git 中仍有运行时数据文件的残留跟踪问题
- 与当前功能复杂度相比，自动化测试覆盖还偏少
- 前端逻辑体量仍然较大，后续适合继续模块化

### 近期优先级

1. 保持文档与现行代码主线一致
2. 把运行时生成文件从 Git 跟踪中清掉
3. 补强 SSE、持久化、RAG、仿真辅助视觉问答的测试
4. 继续精修 `needs_manual_review` 标记的课外实验
5. 将运行时提示词和模型配置从代码中抽离

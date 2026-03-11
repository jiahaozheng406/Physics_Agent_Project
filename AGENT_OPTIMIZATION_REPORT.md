# Agent Optimization Report

- [English](#english)
- [简体中文](#简体中文)

## English

### Goal

Gap analysis between the current Physics Agent and a production-grade teaching agent.

### Current Strengths

| Strength | Detail |
|----------|--------|
| Vertical focus | Physics experiment teaching, not generic chat |
| Multimodal routing | Text / vision / audio paths all functional |
| RAG pipeline | Chunk-based FTS5 retrieval with source citations |
| Simulation tutoring | 64 PhET experiments with parameter-aware analysis — strongest differentiator |
| Persistence | SQLite-backed sessions, folders, messages, documents |
| Streaming | SSE real-time output with LaTeX rendering |

### Main Gaps

| # | Gap | Impact |
|---|-----|--------|
| 1 | Prompt embedded in code | Hard to iterate, version, or A/B test prompts |
| 2 | No formal planning layer | Tool orchestration relies on frontend state + backend branching |
| 3 | Partial simulation curation | Some UI profiles are auto-generated, not manually verified |
| 4 | Light test coverage | Feature complexity outpaces automated testing |
| 5 | Monolithic frontend | 4688 lines in single file limits maintainability |

### Highest-Value Next Steps

1. **Externalize prompt** — move system prompt to a versioned config file
2. **Build evaluation sets** — document QA, simulation QA, image QA, audio QA test cases
3. **Curate simulation profiles** — refine experiments marked `needs_manual_review`
4. **Modularize frontend** — split `app.js` by concern (chat, upload, sessions, simulations)
5. **Add observability** — structured logging for DashScope calls, latency, failures

### Strategic Position

The project is already differentiated beyond a chatbot demo. The next competitive jump comes from:

- Tighter prompt and context management
- Higher reliability and testability
- Stronger simulation-grounded tutoring
- Cleaner engineering boundaries

Not from adding more surface features.

---

## 简体中文

### 报告目标

分析当前 Physics Agent 与更成熟教学智能体之间的差距。

### 当前优势

| 优势 | 细节 |
|------|------|
| 垂直定位 | 聚焦物理实验教学，非通用聊天 |
| 多模态路由 | 文本 / 视觉 / 音频三条通路均可用 |
| RAG 管线 | 基于 FTS5 的分块检索 + 来源引用 |
| 仿真教学 | 64 个 PhET 实验，参数感知分析 — 最强差异化能力 |
| 持久化 | SQLite 存储会话、文件夹、消息、文档 |
| 流式输出 | SSE 实时返回 + LaTeX 渲染 |

### 主要差距

| # | 差距 | 影响 |
|---|------|------|
| 1 | 提示词写在代码里 | 难以迭代、版本管理或 A/B 测试 |
| 2 | 缺少正式规划层 | 工具编排依赖前端状态和后端分支 |
| 3 | 部分仿真未人工精修 | 界面画像依赖自动生成，准确度不一 |
| 4 | 测试覆盖不足 | 功能复杂度高于自动化测试覆盖 |
| 5 | 前端单文件过大 | 4688 行限制可维护性 |

### 最值得优先投入的下一步

1. **抽离提示词** — 移到版本化配置文件
2. **建立评测集** — 文档问答、仿真问答、图像问答、音频问答测试用例
3. **精修仿真画像** — 处理 `needs_manual_review` 标记的实验
4. **前端模块化** — 按职责拆分 `app.js`（聊天、上传、会话、仿真）
5. **增加可观测性** — DashScope 调用日志、延迟、失败诊断

### 战略判断

项目已经有足够差异化，不再是聊天框 demo。下一次跃升来自：

- 更紧的提示词与上下文管理
- 更高的稳定性与可测试性
- 更强的仿真场景教学能力
- 更清晰的工程边界

而非堆更多表层功能。

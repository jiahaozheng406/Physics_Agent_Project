# Agent Optimization Report

- [English](#english)
- [简体中文](#简体中文)

## English

### Goal

This report tracks the gap between the current Physics Agent product and a stronger, more production-grade teaching agent.

### Current Strengths

- Vertical domain focus is clear
- Multimodal routing already exists
- Retrieval, persistence, and streaming are already in production shape for a single-node deployment
- Simulation-assisted tutoring is the product’s strongest differentiator
- The extracurricular simulation workspace already goes beyond a simple embedded link list

### Main Gaps Versus a Top-Tier Agent

1. Prompt management is still code-embedded
2. Tool use is mostly orchestrated by frontend state and backend branching, not by a more formal planning layer
3. Simulation expertise is partly generated and still needs deeper manual curation
4. Test coverage and observability lag behind feature complexity
5. Runtime artifacts still need stricter source/runtime separation

### Highest-Value Next Steps

1. Move the active prompt out of code and version it as a managed asset
2. Add a stronger evaluation set for document QA, simulation QA, image QA, and audio QA
3. Keep improving per-simulation UI profiles and hidden tutoring prompts
4. Modularize the frontend state around chat, uploads, projects, and extracurricular simulations
5. Add better operational logging and failure diagnostics for DashScope calls

### Strategic Position

The project is already differentiated enough to be more than a generic chatbot demo. The next competitive jump will not come from more surface features alone. It will come from:

- tighter prompt and context management
- higher reliability
- stronger simulation-grounded tutoring behavior
- better testable engineering boundaries

---

## 简体中文

### 报告目标

这份报告用于追踪当前 Physics Agent 与更强、更成熟教学智能体之间的能力差距。

### 当前优势

- 垂直领域定位明确
- 多模态路由已经具备
- 在单机部署前提下，检索、持久化、流式返回已经进入可用状态
- 仿真辅助教学是当前产品最强的差异化能力
- 课外实验工作区已经不只是简单嵌链接

### 与顶级智能体相比的主要差距

1. 提示词仍然写在代码里，没有独立管理
2. 工具使用更多依赖前端状态和后端分支，还不是更正式的规划层
3. 仿真知识部分已经很强，但仍有一部分依赖自动生成，需要更深的人工精修
4. 测试覆盖和可观测性跟不上当前功能复杂度
5. 运行时产物与源码之间还需要更严格的边界

### 最值得优先投入的下一步

1. 把当前生效的提示词从代码中抽离并版本化管理
2. 为文档问答、仿真问答、图像问答、音频问答建立更强的评测集
3. 继续强化每个实验的界面画像和隐藏教学提示词
4. 将前端状态按聊天、上传、项目、课外实验继续模块化
5. 为 DashScope 调用补更好的日志和失败诊断

### 战略判断

这个项目已经足够有差异化，早就不是普通聊天框 demo。下一次真正的跃升，不会主要来自再堆表层功能，而是来自：

- 更紧的提示词与上下文管理
- 更高的稳定性
- 更强的仿真场景教学能力
- 更可测试、更清晰的工程边界

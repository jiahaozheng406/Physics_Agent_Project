# Physics Agent Project

<div align="center">

**多模态物理实验教学智能体系统**

*Multimodal Physics Experiment Teaching Agent System*

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com/)
[![DashScope](https://img.shields.io/badge/DashScope-Qwen-orange.svg)](https://dashscope.aliyun.com/)
[![PhET](https://img.shields.io/badge/PhET-64%20Simulations-red.svg)](https://phet.colorado.edu/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](#english) | [简体中文](#简体中文)

</div>

---

## English

### Overview

Physics Agent Project is a **multimodal teaching agent** for physics experiment education. It combines domain-specific RAG retrieval, image/audio understanding, 64 PhET interactive simulations, and heuristic teaching strategies into a single web application.

**What makes it different from a generic chatbot:**

- Answers are grounded in user-uploaded documents with `[Source N]` citations
- Never fabricates physical constants or experimental data
- Guides students with questions instead of giving direct answers
- Connects to real PhET simulations with parameter-aware analysis

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, SQLite (WAL + FTS5), Python 3.10+ |
| AI Models | DashScope API — `qwen-plus` (text), `qwen-vl-max` (vision), `qwen-audio-turbo` (audio) |
| Frontend | Vanilla JS, Tailwind CSS, KaTeX (LaTeX), SSE streaming |
| Simulations | 64 PhET experiments (phet.colorado.edu) |
| Document Processing | pdfplumber, python-docx, Pillow |

### Architecture

```
Browser (HTML/JS/CSS)
    │  SSE / REST
    ▼
FastAPI Backend
    ├── API Gateway ─────── main.py
    ├── Model Gateway ───── models.py      (DashScope routing)
    ├── RAG Engine ──────── rag.py         (chunking + FTS5 retrieval)
    ├── Storage Layer ───── storage.py     (SQLite persistence)
    └── PhET Catalog ────── phet_catalog.py (64 simulations + UI profiles)
          │
          ▼
External: DashScope API, SQLite DB, PhET CDN
```

### Quick Start

**Requirements:** Python 3.10+, DashScope API Key ([get one here](https://dashscope.console.aliyun.com/))

```bash
git clone https://github.com/jiahaozheng406/Physics_Agent_Project.git
cd Physics_Agent_Project

pip install -r requirements.txt

echo "DASHSCOPE_API_KEY=your_api_key_here" > .env

# Start server
uvicorn backend.main:app --reload --port 8000
```

Open http://localhost:8000 in your browser.

### Core Features

#### 1. Intelligent Dialogue

- Physics Q&A across mechanics, thermodynamics, electromagnetism, optics
- LaTeX formula rendering (inline `$F=ma$`, block `$$E=mc^2$$`)
- Real-time SSE streaming output

#### 2. RAG Knowledge Enhancement

Upload PDF/DOCX → auto chunking (1100 chars, 180 overlap) → FTS5 retrieval (top-6) → context injection → cited answers `[Source N]`

**Anti-hallucination:** prioritizes uploaded docs, declares uncertainty when evidence is insufficient.

#### 3. Multimodal Input

- **Image:** PNG/JPG/WebP/BMP — apparatus recognition, chart extraction, handwritten formula OCR
- **Audio** (experimental): WebM/WAV/MP3/M4A — max 30s, 10MB

#### 4. PhET Simulation Integration

64 interactive experiments covering kinematics, mechanics, waves, thermodynamics, and electromagnetism. Students adjust parameters in the simulation, then click "Analyze" — the agent explains the physics based on current state.

#### 5. Heuristic Teaching

Instead of direct answers:
- "What factors do you think affect the period?"
- "Let's start with force analysis..."
- "Note the difference between velocity and acceleration direction"

#### 6. Teacher Dashboard

- Teacher and student workspaces are separated by role-based login.
- Teachers can view aggregated student question statistics: total questions, active students, sessions, high-frequency questions, and recent questions.
- Teachers can export student question records as a UTF-8 CSV table for Excel or WPS analysis.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Serve frontend |
| POST | `/api/chat` | Chat with SSE streaming |
| POST | `/api/upload` | Upload document/image/audio |
| GET | `/api/sessions` | List all sessions |
| POST | `/api/sessions` | Create session |
| PATCH | `/api/sessions/{id}` | Rename session |
| DELETE | `/api/sessions/{id}` | Delete session |
| POST | `/api/folders` | Create folder |
| PATCH | `/api/folders/{id}` | Rename folder |
| DELETE | `/api/folders/{id}` | Delete folder |
| GET | `/api/phet/catalog` | Get simulation list |
| GET | `/api/teacher/student-question-stats` | Teacher-only student question analytics |
| GET | `/api/teacher/student-question-stats/export` | Export student question CSV |
| DELETE | `/api/clear-docs` | Clear knowledge base |
| POST | `/api/clear-history` | Clear chat history |

### Project Structure

```
Physics_Agent_Project/
├── backend/
│   ├── main.py               # API gateway & routes (989 lines)
│   ├── models.py             # DashScope model routing (121 lines)
│   ├── rag.py                # RAG chunking + retrieval (71 lines)
│   ├── storage.py            # SQLite persistence (726 lines)
│   ├── phet_catalog.py       # PhET catalog & teaching prompts (3033 lines)
│   └── phet_ui_overrides.py  # Simulation UI profiles (2568 lines)
├── static/
│   ├── index.html            # SPA entry (295 lines)
│   ├── app.js                # Frontend logic (4688 lines)
│   └── style.css             # Glassmorphism styles (2457 lines)
├── data/                      # Runtime data (gitignored)
├── uploads/                   # User uploads (gitignored)
├── requirements.txt
├── .env                       # API key (gitignored)
└── README.md
```

### Database Schema

| Table | Purpose |
|-------|---------|
| `session_folders` | Project/folder organization |
| `sessions` | Chat sessions with titles |
| `messages` | Chat messages (role, content, model, status) |
| `documents` | Uploaded document metadata |
| `document_chunks` | Chunked content for RAG retrieval |

SQLite with WAL mode, foreign key constraints, indexed queries.

### Roadmap

**Completed** ✅ FastAPI backend, dark glassmorphism UI, drag-and-drop upload, Markdown + LaTeX rendering, SSE streaming, RAG knowledge injection, SQLite session persistence, PhET simulation integration (64 experiments)

**Next:**
- [ ] Vector database (Chroma/Milvus) + embedding model
- [ ] Frontend modularization
- [ ] Docker containerization
- [x] Student question statistics and CSV export for teachers
- [ ] Student progress tracking
- [ ] Automated lab report generation

### License

MIT License

### Acknowledgments

- [Alibaba Cloud DashScope](https://dashscope.aliyun.com/) — LLM API
- [PhET Interactive Simulations](https://phet.colorado.edu/) — Physics simulations
- [FastAPI](https://fastapi.tiangolo.com/) — Web framework
- [Tailwind CSS](https://tailwindcss.com/) — CSS framework
- [KaTeX](https://katex.org/) — LaTeX rendering

---

## 简体中文

### 项目概述

Physics Agent Project 是一个专为物理实验教学设计的**多模态智能体系统**，将领域 RAG 检索、图像/音频理解、64 个 PhET 交互式仿真和启发式教学策略整合在一个 Web 应用中。

**与通用聊天机器人的区别：**

- 回答基于用户上传文档，使用 `[Source N]` 标注来源
- 绝不编造物理常数或实验数据
- 引导式提问，培养科学思维，而非直接给答案
- 连接真实 PhET 仿真，基于参数状态进行分析

### 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | FastAPI, SQLite (WAL + FTS5), Python 3.10+ |
| AI 模型 | DashScope API — `qwen-plus`(文本), `qwen-vl-max`(视觉), `qwen-audio-turbo`(音频) |
| 前端 | 原生 JS, Tailwind CSS, KaTeX (LaTeX 渲染), SSE 流式 |
| 仿真 | 64 个 PhET 实验 (phet.colorado.edu) |
| 文档处理 | pdfplumber, python-docx, Pillow |

### 技术架构

```
浏览器 (HTML/JS/CSS)
    │  SSE / REST
    ▼
FastAPI 后端
    ├── API 网关 ─────── main.py
    ├── 模型网关 ─────── models.py      (DashScope 路由)
    ├── RAG 引擎 ─────── rag.py         (文档分块 + FTS5 检索)
    ├── 存储层 ───────── storage.py     (SQLite 持久化)
    └── 实验目录 ─────── phet_catalog.py (64 个仿真 + UI 画像)
          │
          ▼
外部服务: DashScope API, SQLite 数据库, PhET CDN
```

### 快速开始

**环境要求：** Python 3.10+，阿里云百炼 DashScope API Key（[获取地址](https://dashscope.console.aliyun.com/)）

```bash
git clone https://github.com/jiahaozheng406/Physics_Agent_Project.git
cd Physics_Agent_Project

pip install -r requirements.txt

echo "DASHSCOPE_API_KEY=your_api_key_here" > .env

# 启动服务
uvicorn backend.main:app --reload --port 8000
```

浏览器访问 http://localhost:8000

### 核心特性

#### 1. 智能对话系统

- 覆盖力学、热学、电磁学、光学等物理知识问答
- LaTeX 公式渲染（行内 `$F=ma$`，块级 `$$E=mc^2$$`）
- SSE 实时流式输出

#### 2. RAG 知识增强

上传 PDF/DOCX → 自动分块（1100 字符，180 重叠）→ FTS5 检索（top-6）→ 上下文注入 → 带引用回答 `[Source N]`

**反幻觉机制：** 优先引用上传文档，证据不足时明确声明不确定性。

#### 3. 多模态输入

- **图像：** PNG/JPG/WebP/BMP — 实验装置识别、图表提取、手写公式识别
- **音频**（实验性）：WebM/WAV/MP3/M4A — 最大 30 秒，10MB

#### 4. PhET 实验仿真联动

集成 64 个交互式实验，覆盖运动学、力学、波动、热学和电磁学。学生在仿真中调节参数，点击"分析当前状态"，Agent 根据实时参数生成物理解释。

#### 5. 启发式教学策略

不直接给答案，而是：
- "你认为影响周期的因素有哪些？"
- "我们先从受力分析开始..."
- "注意区分速度和加速度的方向"

#### 6. 教师端学生问题统计

- 教师端与学生端基于登录角色隔离工作区。
- 教师端可查看学生提问汇总，包括问题总数、学生数、会话数、高频问题与近期提问。
- 支持将学生提问明细导出为 UTF-8 CSV 表格，便于使用 Excel / WPS 进行课后分析。

### API 端点

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/` | 返回前端页面 |
| POST | `/api/chat` | SSE 流式对话 |
| POST | `/api/upload` | 上传文档/图片/音频 |
| GET | `/api/sessions` | 获取会话列表 |
| POST | `/api/sessions` | 创建会话 |
| PATCH | `/api/sessions/{id}` | 重命名会话 |
| DELETE | `/api/sessions/{id}` | 删除会话 |
| POST | `/api/folders` | 创建文件夹 |
| PATCH | `/api/folders/{id}` | 重命名文件夹 |
| DELETE | `/api/folders/{id}` | 删除文件夹 |
| GET | `/api/phet/catalog` | 获取实验列表 |
| GET | `/api/teacher/student-question-stats` | 教师端学生问题统计 |
| GET | `/api/teacher/student-question-stats/export` | 导出学生问题 CSV |
| DELETE | `/api/clear-docs` | 清空知识库 |
| POST | `/api/clear-history` | 清空对话历史 |

### 项目结构

```
Physics_Agent_Project/
├── backend/
│   ├── main.py               # API 网关与路由 (989 行)
│   ├── models.py             # DashScope 模型路由 (121 行)
│   ├── rag.py                # RAG 分块与检索 (71 行)
│   ├── storage.py            # SQLite 持久化 (726 行)
│   ├── phet_catalog.py       # PhET 实验目录与教学提示词 (3033 行)
│   └── phet_ui_overrides.py  # 仿真界面画像 (2568 行)
├── static/
│   ├── index.html            # 单页应用入口 (295 行)
│   ├── app.js                # 前端核心逻辑 (4688 行)
│   └── style.css             # 毛玻璃样式 (2457 行)
├── data/                      # 运行时数据 (已 gitignore)
├── uploads/                   # 用户上传文件 (已 gitignore)
├── requirements.txt
├── .env                       # API Key (已 gitignore)
└── README.md
```

### 数据库设计

| 表名 | 用途 |
|------|------|
| `session_folders` | 项目/文件夹组织 |
| `sessions` | 聊天会话与标题 |
| `messages` | 消息记录（角色、内容、模型、状态） |
| `documents` | 上传文档元数据 |
| `document_chunks` | 分块内容用于 RAG 检索 |

使用 SQLite WAL 模式，外键约束，索引查询。

### 项目路线图

**已完成** ✅ FastAPI 后端架构、深色毛玻璃 UI、拖拽上传、Markdown + LaTeX 渲染、SSE 流式输出、RAG 知识库注入、SQLite 会话持久化、PhET 实验库集成（64 个实验）

**后续计划：**
- [ ] 向量数据库（Chroma/Milvus）+ 嵌入模型
- [ ] 前端代码模块化拆分
- [ ] Docker 容器化部署
- [x] 教师端学生问题统计与 CSV 导出
- [ ] 学生学习进度追踪
- [ ] 实验报告自动生成

### 许可证

MIT License

### 致谢

- [阿里云百炼](https://dashscope.aliyun.com/) — 大模型 API
- [PhET Interactive Simulations](https://phet.colorado.edu/) — 物理实验仿真
- [FastAPI](https://fastapi.tiangolo.com/) — Web 框架
- [Tailwind CSS](https://tailwindcss.com/) — CSS 框架
- [KaTeX](https://katex.org/) — LaTeX 渲染

---

<div align="center">

**If this project helps you, give it a Star ⭐**

[GitHub Repository](https://github.com/jiahaozheng406/Physics_Agent_Project)

</div>

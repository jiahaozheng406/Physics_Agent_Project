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
| Video Analysis | OpenCV, NumPy, SciPy — pendulum/torsion angle extraction from user video |
| Object Detection | Ultralytics YOLO-Seg (rod instance segmentation + PCA angle), YOLOv5 fallback |

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

#### 5. Video-Based Lab Measurement (Pendulum & Torsion Pendulum)

Students upload a real experiment video (or use a live camera feed for torsion); the backend detects the moving object and computes physical quantities directly, rather than having an LLM guess a number from the video:

- **Simple pendulum:** detects the bob, extracts angle vs. time, estimates the oscillation period via autocorrelation/FFT.
- **Torsion pendulum:** detects the rod with a custom-trained **YOLO-Seg** instance-segmentation model, fits the rod's principal axis via PCA, unwraps the 180°-ambiguous angle, and estimates the period via zero-crossing/peak detection — then derives the moment of inertia from the torsion constant.
- Detector fallback chain: **YOLO-Seg → YOLOv5 → classical OpenCV** (Hough lines / optical flow), so the feature degrades gracefully without custom weights.
- See [`torsion_yolo_period/`](torsion_yolo_period/) for the full offline pipeline used to build the training dataset and train the YOLO-Seg rod detector.

#### 6. Heuristic Teaching

Instead of direct answers:
- "What factors do you think affect the period?"
- "Let's start with force analysis..."
- "Note the difference between velocity and acceleration direction"

#### 7. Teacher Dashboard

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
| POST | `/api/physics/pendulum/analyze` | Analyze uploaded pendulum video → period |
| GET | `/api/physics/pendulum/processed/{filename}` | Fetch annotated pendulum video |
| POST | `/api/physics/torsion/analyze` | Analyze uploaded torsion video → period + moment of inertia |
| POST | `/api/physics/torsion/live-frame` | Analyze one live-camera frame for torsion angle |
| GET | `/api/physics/torsion/processed/{filename}` | Fetch annotated torsion video |
| GET | `/api/teacher/student-question-stats` | Teacher-only student question analytics |
| GET | `/api/teacher/student-question-stats/export` | Export student question CSV |
| DELETE | `/api/clear-docs` | Clear knowledge base |
| POST | `/api/clear-history` | Clear chat history |

### Project Structure

```
Physics_Agent_Project/
|-- backend/
|   |-- __init__.py
|   |-- main.py                    # FastAPI gateway, routes, auth, chat streaming
|   |-- models.py                  # DashScope text/vision/audio model routing
|   |-- rag.py                     # Document chunking and retrieval helpers
|   |-- storage.py                 # SQLite persistence for sessions, messages, docs
|   |-- phet_catalog.py            # PhET simulation catalog and teaching prompts
|   |-- phet_ui_overrides.py       # Per-simulation UI guidance profiles
|   |-- pendulum_analysis.py       # Simple-pendulum video analysis (OpenCV/YOLOv5)
|   |-- pendulum_dataset.py        # Synthetic pendulum-bob YOLO dataset generator
|   |-- torsion_analysis.py        # Torsion-pendulum video analysis (YOLO-Seg/YOLOv5/OpenCV)
|   |-- torsion_dataset.py         # Synthetic torsion-rod YOLO dataset generator
|   |-- start_frontend.ps1         # Windows launcher helper
|   |-- PROJECT_MODULE_ARCHITECTURE.md
|   `-- image/                     # Architecture images used by backend docs
|-- static/
|   |-- index.html                 # Single-page app shell
|   |-- app.js                     # Chat, upload, simulations, data lab UI logic
|   |-- style.css                  # Glassmorphism and responsive styles
|   |-- lite-backend.js            # Browser-side lite backend for mobile shell
|   |-- mobile-config.js           # Mobile connection/runtime defaults
|   |-- manifest.webmanifest       # PWA manifest
|   |-- sw.js                      # Service worker
|   |-- offline.html               # Offline fallback page
|   |-- app-icon-192.png
|   |-- app-icon-512.png
|   `-- capacitor-shell/           # Capacitor Android wrapper and build scripts
|-- torsion_yolo_period/           # YOLO-Seg training pipeline for the torsion rod detector
|   |-- extract_frames.py          # Sample frames from raw torsion videos
|   |-- labelme_to_yolo.py         # Convert Labelme polygon/rect annotations to YOLO-Seg labels
|   |-- make_dataset_split.py      # Stratified train/val/test split across source videos
|   |-- train_yolo_seg.py          # Train an Ultralytics YOLO-Seg model on the rod dataset
|   |-- infer_video.py             # Run inference + angle/period pipeline standalone
|   |-- angle_utils.py             # PCA angle extraction, 180°-aware unwrap, smoothing
|   |-- period_estimator.py        # Zero-crossing / peak / damped-sine period estimation
|   |-- visualize.py               # Overlay video + angle-vs-time plots + reports
|   |-- run_pipeline.py            # One-shot pipeline across multiple videos
|   |-- config.yaml                # Pipeline configuration
|   `-- README.md                  # Full dataset/training/inference walkthrough
|-- data/                          # Runtime SQLite/cache data + YOLO datasets, not for commit
|-- uploads/                       # Runtime user uploads, not for commit
|-- image/                         # Project-level images and assets
|-- .github/                       # GitHub workflow and repository metadata
|-- requirements.txt               # Python dependencies
|-- system_prompt.md               # Reference system prompt specification
|-- AGENTS.md                      # Agent collaboration rules
|-- CLAUDE.md                      # Developer handoff notes
|-- PROJECT_ANALYSIS.md            # Project state report
|-- AGENT_OPTIMIZATION_REPORT.md   # Gap analysis and next steps
|-- .env                           # Local API key/config, not for commit
`-- README.md
```

> **Note:** Training videos, extracted frames, Labelme annotations, YOLO run
> artifacts (`torsion_yolo_period/data/`, `torsion_yolo_period/runs/`,
> `torsion_yolo_period/weights/`) and pretrained/trained `.pt` weights are
> intentionally **not committed** to this repository (see `.gitignore`).
> Only the pipeline code is tracked — regenerate the dataset and weights
> locally by following [`torsion_yolo_period/README.md`](torsion_yolo_period/README.md).

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

**Completed** ✅ FastAPI backend, dark glassmorphism UI, drag-and-drop upload, Markdown + LaTeX rendering, SSE streaming, RAG knowledge injection, SQLite session persistence, PhET simulation integration (64 experiments), pendulum/torsion video measurement with a custom-trained YOLO-Seg rod detector

**Next:**
- [ ] Vector database (Chroma/Milvus) + embedding model
- [ ] Frontend modularization
- [ ] Docker containerization
- [x] Student question statistics and CSV export for teachers
- [ ] Student progress tracking
- [ ] Automated lab report generation
- [ ] Expand YOLO-Seg training set with more lighting/background conditions

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
| 视频分析 | OpenCV, NumPy, SciPy — 从用户视频提取单摆/扭摆角度 |
| 目标检测 | Ultralytics YOLO-Seg（杆子实例分割 + PCA 主方向），并有 YOLOv5 兜底 |

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

#### 5. 视频实验测量（单摆 / 扭摆法）

学生上传真实实验视频（扭摆法也支持实时摄像头），后端直接检测运动物体并计算物理量，而不是让大模型凭视频"猜"数字：

- **单摆：** 检测摆球，提取角度—时间曲线，用自相关/FFT 估计振荡周期。
- **扭摆法：** 用自训练的 **YOLO-Seg** 实例分割模型检测横杆，通过 PCA 拟合杆的主方向，对 180° 对称的角度做连续化处理，再用过零法/峰值法估计周期，最终结合扭转常量反算转动惯量。
- 检测器优先级：**YOLO-Seg → YOLOv5 → 传统 OpenCV**（Hough 直线检测/光流），即使没有自训练权重也能优雅降级。
- 完整的训练数据构建与 YOLO-Seg 训练流程见 [`torsion_yolo_period/`](torsion_yolo_period/)。

#### 6. 启发式教学策略

不直接给答案，而是：
- "你认为影响周期的因素有哪些？"
- "我们先从受力分析开始..."
- "注意区分速度和加速度的方向"

#### 7. 教师端学生问题统计

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
| POST | `/api/physics/pendulum/analyze` | 分析上传的单摆视频 → 周期 |
| GET | `/api/physics/pendulum/processed/{filename}` | 获取标注后的单摆视频 |
| POST | `/api/physics/torsion/analyze` | 分析上传的扭摆视频 → 周期 + 转动惯量 |
| POST | `/api/physics/torsion/live-frame` | 分析实时摄像头单帧的扭摆角度 |
| GET | `/api/physics/torsion/processed/{filename}` | 获取标注后的扭摆视频 |
| GET | `/api/teacher/student-question-stats` | 教师端学生问题统计 |
| GET | `/api/teacher/student-question-stats/export` | 导出学生问题 CSV |
| DELETE | `/api/clear-docs` | 清空知识库 |
| POST | `/api/clear-history` | 清空对话历史 |

### 项目结构

```
Physics_Agent_Project/
|-- backend/
|   |-- __init__.py
|   |-- main.py                    # FastAPI 网关、路由、鉴权与流式对话
|   |-- models.py                  # DashScope 文本/视觉/音频模型路由
|   |-- rag.py                     # 文档分块与检索辅助逻辑
|   |-- storage.py                 # SQLite 会话、消息与资料持久化
|   |-- phet_catalog.py            # PhET 仿真实验目录与教学提示词
|   |-- phet_ui_overrides.py       # 每个仿真的界面引导画像
|   |-- pendulum_analysis.py       # 单摆视频分析（OpenCV/YOLOv5）
|   |-- pendulum_dataset.py        # 单摆摆球合成 YOLO 数据集生成
|   |-- torsion_analysis.py        # 扭摆视频分析（YOLO-Seg/YOLOv5/OpenCV）
|   |-- torsion_dataset.py         # 扭摆杆合成 YOLO 数据集生成
|   |-- start_frontend.ps1         # Windows 启动辅助脚本
|   |-- PROJECT_MODULE_ARCHITECTURE.md
|   `-- image/                     # 后端架构文档图片
|-- static/
|   |-- index.html                 # 单页应用外壳
|   |-- app.js                     # 对话、上传、仿真、数据作图前端逻辑
|   |-- style.css                  # 毛玻璃视觉与响应式样式
|   |-- lite-backend.js            # 移动端壳使用的浏览器侧轻量后端
|   |-- mobile-config.js           # 移动端连接与运行时默认配置
|   |-- manifest.webmanifest       # PWA 配置
|   |-- sw.js                      # Service Worker
|   |-- offline.html               # 离线兜底页面
|   |-- app-icon-192.png
|   |-- app-icon-512.png
|   `-- capacitor-shell/           # Capacitor Android 外壳与构建脚本
|-- torsion_yolo_period/           # 扭摆杆 YOLO-Seg 检测器训练流水线
|   |-- extract_frames.py          # 从原始扭摆视频抽帧
|   |-- labelme_to_yolo.py         # Labelme 多边形/矩形标注转 YOLO-Seg 标签
|   |-- make_dataset_split.py      # 按视频源分层划分 train/val/test
|   |-- train_yolo_seg.py          # 在杆子数据集上训练 Ultralytics YOLO-Seg 模型
|   |-- infer_video.py             # 独立运行推理 + 角度/周期计算流水线
|   |-- angle_utils.py             # PCA 角度提取、180°感知的连续化、平滑
|   |-- period_estimator.py        # 过零法/峰值法/阻尼正弦拟合周期估计
|   |-- visualize.py               # 叠加检测视频 + 角度—时间曲线 + 报告
|   |-- run_pipeline.py            # 多视频一键处理流水线
|   |-- config.yaml                # 流水线配置
|   `-- README.md                  # 完整数据集/训练/推理使用说明
|-- data/                          # 运行时 SQLite/缓存数据 + YOLO 数据集，不提交
|-- uploads/                       # 运行时用户上传文件，不提交
|-- image/                         # 项目级图片与资源
|-- .github/                       # GitHub 工作流与仓库元数据
|-- requirements.txt               # Python 依赖
|-- system_prompt.md               # 系统提示词参考规范
|-- AGENTS.md                      # 智能体协作规则
|-- CLAUDE.md                      # 开发交接说明
|-- PROJECT_ANALYSIS.md            # 项目现状报告
|-- AGENT_OPTIMIZATION_REPORT.md   # 差距分析与后续计划
|-- .env                           # 本地 API Key/配置，不提交
`-- README.md
```

> **说明：** 训练视频、抽取的帧、Labelme 标注、YOLO 训练产物
> （`torsion_yolo_period/data/`、`torsion_yolo_period/runs/`、
> `torsion_yolo_period/weights/`）以及训练好/预训练的 `.pt` 权重文件
> **均不提交**到本仓库（详见 `.gitignore`）。仓库中只保留流水线代码，
> 按照 [`torsion_yolo_period/README.md`](torsion_yolo_period/README.md)
> 的说明即可在本地重新构建数据集并训练权重。

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

**已完成** ✅ FastAPI 后端架构、深色毛玻璃 UI、拖拽上传、Markdown + LaTeX 渲染、SSE 流式输出、RAG 知识库注入、SQLite 会话持久化、PhET 实验库集成（64 个实验）、基于自训练 YOLO-Seg 杆子检测器的单摆/扭摆视频测量

**后续计划：**
- [ ] 向量数据库（Chroma/Milvus）+ 嵌入模型
- [ ] 前端代码模块化拆分
- [ ] Docker 容器化部署
- [x] 教师端学生问题统计与 CSV 导出
- [ ] 学生学习进度追踪
- [ ] 实验报告自动生成
- [ ] 扩充 YOLO-Seg 训练集，覆盖更多光照/背景条件

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

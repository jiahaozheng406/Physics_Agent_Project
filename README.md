# Physics Agent Project

<div align="center">

**多模态物理实验教学智能体系统**

*Multimodal Physics Experiment Teaching Agent System*

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](#english) | [简体中文](#简体中文)

</div>

---

## English

### 📖 Overview

Physics Agent Project is an **advanced multimodal teaching agent** designed specifically for physics experiment education. Unlike generic chatbots, it deeply integrates:

- **Domain Knowledge Enhancement**: RAG (Retrieval-Augmented Generation) with document upload and precise citation
- **Multimodal Understanding**: Text, image, and audio input with experiment apparatus recognition
- **Simulation Integration**: Built-in physics simulations + 64 PhET interactive experiments
- **Heuristic Teaching**: Guided questioning instead of direct answers, fostering scientific thinking
- **Traceability Design**: Source attribution, uncertainty declaration, anti-hallucination mechanisms

### 🎯 Core Features

| Feature | Description |
|---------|-------------|
| **Vertical Domain Focus** | Specialized in physics experiment teaching with domain-specific prompts |
| **Simulation Workspace** | Integrated PhET simulations with parameter-driven analysis |
| **RAG Knowledge Injection** | Automatic document chunking, retrieval, and context injection |
| **Multimodal Input** | Text Q&A, image recognition, audio input (experimental) |
| **Streaming Interaction** | SSE real-time streaming with LaTeX formula rendering |
| **Session Persistence** | SQLite-backed conversation history and project management |
| **Modern UI** | Dark glassmorphism interface with drag-and-drop upload |

### 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser Frontend                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Chat   │  │  Upload  │  │Simulation│  │ History  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │             │          │
│       └─────────────┴─────────────┴─────────────┘          │
│                    │ SSE / REST API                         │
└────────────────────┼──────────────────────────────────────┘
                     │
┌────────────────────┼──────────────────────────────────────┐
│              FastAPI Backend                                │
│  ┌─────────────────┴──────────────────────┐                │
│  │      API Gateway (main.py)             │                │
│  └──┬────────┬────────┬────────┬──────────┘                │
│     │        │        │        │                            │
│  ┌──▼──┐  ┌─▼──┐  ┌──▼──┐  ┌──▼──┐                        │
│  │Model│  │RAG │  │Store│  │PhET │                        │
│  │Gate │  │    │  │     │  │Cata │                        │
│  └──┬──┘  └─┬──┘  └──┬──┘  └──┬──┘                        │
│     │       │        │        │                            │
└─────┼───────┼────────┼────────┼────────────────────────────┘
      │       │        │        │
┌─────▼───────▼────────▼────────▼────────────────────────────┐
│              External Services                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │DashScope │  │  SQLite  │  │PhET API  │                 │
│  │   API    │  │ Database │  │          │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

### 🚀 Quick Start

#### Requirements

- **Python**: 3.10 or higher
- **OS**: Windows / macOS / Linux
- **API Key**: DashScope API Key ([Get it here](https://dashscope.console.aliyun.com/))

#### Installation

```bash
# Clone repository
git clone https://github.com/jiahaozheng406/Physics_Agent_Project.git
cd Physics_Agent_Project

# Install dependencies
pip install -r requirements.txt

# Configure environment
echo "DASHSCOPE_API_KEY=your_api_key_here" > .env
```

#### Run

```bash
# Method 1: Using uvicorn (recommended)
uvicorn backend.main:app --reload --port 8000

# Method 2: Direct execution
python -m backend.main
```

Open browser: http://localhost:8000

### 💡 Feature Highlights

#### 1. Intelligent Dialogue System

- Physics knowledge Q&A (mechanics, thermodynamics, electromagnetism, optics)
- Experiment principle explanations
- Formula derivation and calculation verification
- LaTeX formula rendering (inline `$F=ma$`, block `$$E=mc^2$$`)
- Real-time streaming output

**Example**:
```
User: Explain Newton's Second Law
Agent: Newton's Second Law $F=ma$ reveals the quantitative relationship
       between force, mass, and acceleration...
       [Provides step-by-step derivation, experimental verification, common misconceptions]
```

#### 2. RAG Knowledge Enhancement

**Workflow**:
1. User uploads PDF/DOCX textbooks or lab reports
2. System automatically chunks documents
3. Retrieves relevant chunks when user asks questions
4. Injects retrieval results into model context
5. Cites sources as `[Source 1]`, `[Source 2]`

**Anti-Hallucination**:
- Prioritizes user-uploaded documents
- Explicitly states uncertainty when evidence is insufficient
- Never fabricates experimental data or physical constants

#### 3. Multimodal Understanding

**Image Recognition**:
- Supported formats: PNG, JPG, JPEG, WebP, BMP
- Use cases: Apparatus recognition, chart data extraction, handwritten formula recognition

**Audio Input** (Experimental):
- Supported formats: WebM, WAV, MP3, M4A, AAC, OGG
- Limits: Max 30 seconds, 10MB

#### 4. PhET Simulation Integration

**Integrated Experiments**:
- Kinematics: Projectile motion, circular motion
- Mechanics: Spring oscillator, collision experiments
- Waves: Wave interference, standing waves
- Thermodynamics: Gas properties, energy conversion
- Electromagnetism: Electric field, magnetic field, circuits

**Interaction Flow**:
1. Select experiment from library
2. Adjust parameters in simulation window
3. Observe phenomena
4. Click "Analyze Current State"
5. Agent generates explanation based on parameters

#### 5. Heuristic Teaching Strategy

**Instead of direct answers**:
- Guided questioning: "What factors do you think affect the period?"
- Step-by-step reasoning: "Let's start with force analysis..."
- Common misconception alerts: "Note the difference between velocity and acceleration direction"
- Experimental verification suggestions: "You can verify this by changing the mass"

### 📂 Project Structure

```
Physics_Agent_Project/
├── backend/                    # Backend core modules
│   ├── main.py                # FastAPI main entry (~800 lines)
│   ├── models.py              # Model gateway (~200 lines)
│   ├── rag.py                 # RAG retrieval logic (~150 lines)
│   ├── storage.py             # SQLite persistence (~600 lines)
│   └── phet_catalog.py        # PhET catalog service (~700 lines)
├── static/                     # Frontend resources
│   ├── index.html             # SPA entry point
│   ├── app.js                 # Frontend core logic (~4000 lines)
│   ├── style.css              # Glassmorphism styles (~1200 lines)
│   ├── css/                   # Additional styles
│   └── js/                    # Additional scripts
├── data/                       # Data storage
│   ├── sessions.db            # SQLite session database
│   └── phet_catalog.json      # PhET experiment cache
├── uploads/                    # User uploads
│   ├── docs/                  # Documents (PDF/DOCX)
│   ├── images/                # Images
│   └── audio/                 # Audio files
├── requirements.txt            # Python dependencies
├── .env                        # Environment variables
├── .gitignore                  # Git ignore rules
└── README.md                   # Project documentation
```

### 🔧 API Endpoints

| Method | Path | Function | Request | Response |
|--------|------|----------|---------|----------|
| GET | `/` | Serve frontend | - | HTML |
| POST | `/api/chat` | Send message | `{message, session_id, images?, audio?}` | SSE stream |
| POST | `/api/upload` | Upload file | `FormData(file)` | `{file_id, filename}` |
| DELETE | `/api/clear-docs` | Clear knowledge base | `{session_id}` | `{success}` |
| POST | `/api/clear-history` | Clear chat history | `{session_id}` | `{success}` |
| GET | `/api/sessions` | List sessions | - | `[{id, title, ...}]` |
| GET | `/api/phet/catalog` | Get experiment list | `?locale=zh_CN` | `[{slug, title, ...}]` |

### 🎯 Agent Design Philosophy

1. **Vertical Domain Specialization**: Focus on physics teaching, not general chat
2. **Traceability Design**: Source attribution, uncertainty declaration
3. **Anti-Hallucination**: Never fabricate constants or experimental data
4. **Heuristic Teaching**: Guided questioning instead of direct answers
5. **Multimodal Fusion**: Text mode with RAG, vision mode isolated

### 🚧 Roadmap

**Completed** ✅
- [x] FastAPI backend architecture
- [x] Dark glassmorphism UI
- [x] Drag-and-drop upload
- [x] Markdown + LaTeX rendering
- [x] SSE streaming output
- [x] RAG knowledge injection
- [x] SQLite session persistence
- [x] PhET simulation integration

**Short-term (1-2 weeks)**:
- [ ] Vector database integration (Chroma/Milvus)
- [ ] Embedding model (text-embedding-v2)
- [ ] Frontend code modularization
- [ ] Unit tests

**Mid-term (1-2 months)**:
- [ ] Student learning progress tracking
- [ ] Experiment configuration templating
- [ ] Multi-turn context optimization
- [ ] Docker containerization

**Long-term (3-6 months)**:
- [ ] Multi-tenant support (teacher/student roles)
- [ ] Automated lab report generation
- [ ] Knowledge graph integration
- [ ] Mobile adaptation

### 📜 License

MIT License

### 🙏 Acknowledgments

- [Alibaba Cloud DashScope](https://dashscope.aliyun.com/) - LLM API
- [PhET Interactive Simulations](https://phet.colorado.edu/) - Physics simulations
- [FastAPI](https://fastapi.tiangolo.com/) - Web framework
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework

---

## 简体中文

### 📖 项目概述

Physics Agent Project 是一个专为物理实验教学设计的**高级多模态智能体系统**，不同于通用聊天机器人，它深度整合了：

- **领域知识增强**：RAG 检索增强生成，支持教材文档上传与精准引用
- **多模态理解**：文本、图像、音频三模态输入，实验装置识别与图表分析
- **实验仿真联动**：内置物理仿真 + 64 个 PhET 交互式实验
- **启发式教学**：非直接给答案，引导式提问，培养科学思维
- **可追溯性设计**：知识来源标注、不确定性声明、反幻觉机制

### 🎯 核心特性

| 特性 | 说明 |
|------|------|
| **垂直场景专精** | 专注物理实验教学，内置物理学科提示词与教学策略 |
| **实验仿真工作区** | 集成 PhET 仿真实验，支持参数联动与实时解释 |
| **RAG 知识注入** | 文档上传后自动分块、检索、注入上下文 |
| **多模态输入** | 支持文本问答、图片识别、音频输入（实验性） |
| **流式交互** | SSE 实时流式输出，LaTeX 公式渲染 |
| **会话持久化** | SQLite 存储会话历史，支持多轮对话上下文管理 |
| **现代化 UI** | 深色毛玻璃界面，拖拽上传，动效流畅 |

### 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器前端                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 对话界面 │  │ 文件上传 │  │ 实验仿真 │  │ 历史记录 │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │             │          │
│       └─────────────┴─────────────┴─────────────┘          │
│                    │ SSE / REST API                         │
└────────────────────┼──────────────────────────────────────┘
                     │
┌────────────────────┼──────────────────────────────────────┐
│                FastAPI 后端                                 │
│  ┌─────────────────┴──────────────────────┐                │
│  │      API 网关 (main.py)                │                │
│  └──┬────────┬────────┬────────┬──────────┘                │
│     │        │        │        │                            │
│  ┌──▼──┐  ┌─▼──┐  ┌──▼──┐  ┌──▼──┐                        │
│  │模型 │  │RAG │  │存储 │  │实验 │                        │
│  │网关 │  │引擎│  │层  │  │目录│                        │
│  └──┬──┘  └─┬──┘  └──┬──┘  └──┬──┘                        │
│     │       │        │        │                            │
└─────┼───────┼────────┼────────┼────────────────────────────┘
      │       │        │        │
┌─────▼───────▼────────▼────────▼────────────────────────────┐
│                    外部服务层                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │DashScope │  │  SQLite  │  │PhET API  │                 │
│  │   API    │  │ Database │  │          │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

### 🚀 快速开始

#### 环境要求

- **Python**：3.10 或更高版本
- **操作系统**：Windows / macOS / Linux
- **API Key**：阿里云百炼 DashScope API Key（[获取地址](https://dashscope.console.aliyun.com/)）

#### 安装步骤

```bash
# 克隆项目
git clone https://github.com/jiahaozheng406/Physics_Agent_Project.git
cd Physics_Agent_Project

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
echo "DASHSCOPE_API_KEY=your_api_key_here" > .env
```

#### 启动服务

```bash
# 方式一：使用 uvicorn（推荐）
uvicorn backend.main:app --reload --port 8000

# 方式二：直接运行
python -m backend.main
```

打开浏览器访问：http://localhost:8000

### 💡 功能亮点

#### 1. 智能对话系统

- 物理知识问答（力学、热学、电磁学、光学等）
- 实验原理深度解释
- 公式推导与计算验证
- LaTeX 公式渲染（行内 `$F=ma$`，块级 `$$E=mc^2$$`）
- 实时流式输出

**示例对话**：
```
用户：解释牛顿第二定律的物理意义
Agent：牛顿第二定律 $F=ma$ 揭示了力、质量和加速度之间的定量关系...
      [提供分步推导、实验验证建议、常见误区]
```

#### 2. RAG 知识增强

**工作流程**：
1. 用户上传 PDF/DOCX 教材或实验报告
2. 系统自动文档分块（chunk）
3. 用户提问时检索相关文档片段
4. 将检索结果注入模型上下文
5. 回答时标注来源 `[Source 1]`、`[Source 2]`

**反幻觉机制**：
- 优先引用用户上传文档
- 证据不足时明确声明不确定性
- 不编造实验数据或物理常数

#### 3. 多模态理解

**图像识别**：
- 支持格式：PNG、JPG、JPEG、WebP、BMP
- 应用场景：实验装置识别、图表数据提取、手写公式识别

**音频输入**（实验性）：
- 支持格式：WebM、WAV、MP3、M4A、AAC、OGG
- 限制：最大 30 秒，10MB

#### 4. PhET 实验仿真联动

**集成实验库**：
- 运动学：斜抛运动、圆周运动
- 力学：弹簧振子、碰撞实验
- 波动：波的干涉、驻波
- 热学：气体性质、能量转换
- 电磁学：电场、磁场、电路

**交互流程**：
1. 从实验库选择实验
2. 在仿真窗口调节参数（质量、速度、角度等）
3. 观察实验现象
4. 点击"分析当前状态"
5. Agent 基于参数生成解释

#### 5. 启发式教学策略

**非直接给答案**，而是：
- 引导式提问："你认为影响周期的因素有哪些？"
- 分步推理："我们先从受力分析开始..."
- 常见误区提醒："注意区分速度和加速度的方向"
- 实验验证建议："可以通过改变质量来验证这个结论"

### 📂 项目结构

```
Physics_Agent_Project/
├── backend/                    # 后端核心模块
│   ├── main.py                # FastAPI 主服务入口（~800 行）
│   ├── models.py              # 模型网关封装（~200 行）
│   ├── rag.py                 # RAG 检索增强逻辑（~150 行）
│   ├── storage.py             # SQLite 会话持久化（~600 行）
│   └── phet_catalog.py        # PhET 实验库服务（~700 行）
├── static/                     # 前端资源
│   ├── index.html             # 单页应用入口
│   ├── app.js                 # 前端核心逻辑（~4000 行）
│   ├── style.css              # 毛玻璃样式（~1200 行）
│   ├── css/                   # 额外样式模块
│   └── js/                    # 额外脚本模块
├── data/                       # 数据存储
│   ├── sessions.db            # SQLite 会话数据库
│   └── phet_catalog.json      # PhET 实验库缓存
├── uploads/                    # 用户上传文件
│   ├── docs/                  # 文档文件（PDF/DOCX）
│   ├── images/                # 图片文件
│   └── audio/                 # 音频文件
├── requirements.txt            # Python 依赖
├── .env                        # 环境变量（API Key）
├── .gitignore                  # Git 忽略规则
└── README.md                   # 项目说明文档
```

### 🔧 API 端点

| 方法 | 路径 | 功能 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/` | 返回前端页面 | - | HTML |
| POST | `/api/chat` | 发送消息 | `{message, session_id, images?, audio?}` | SSE 流 |
| POST | `/api/upload` | 上传文件 | `FormData(file)` | `{file_id, filename}` |
| DELETE | `/api/clear-docs` | 清空知识库 | `{session_id}` | `{success}` |
| POST | `/api/clear-history` | 清空对话历史 | `{session_id}` | `{success}` |
| GET | `/api/sessions` | 获取会话列表 | - | `[{id, title, ...}]` |
| GET | `/api/phet/catalog` | 获取实验列表 | `?locale=zh_CN` | `[{slug, title, ...}]` |

### 🎯 智能体设计理念

1. **垂直领域专精**：专注物理实验教学，非通用聊天
2. **可追溯性设计**：知识来源标注、不确定性声明
3. **反幻觉机制**：不编造物理常数或实验数据
4. **启发式教学**：引导式提问而非直接给答案
5. **多模态融合**：文本模式注入 RAG，视觉模式隔离

### 🚧 项目路线图

**已完成** ✅
- [x] FastAPI 后端架构
- [x] 深色毛玻璃 UI
- [x] 拖拽上传（文档/图片/音频）
- [x] Markdown + LaTeX 渲染
- [x] SSE 流式输出
- [x] RAG 知识库注入
- [x] SQLite 会话持久化
- [x] PhET 实验库集成

**短期（1-2 周）**：
- [ ] 引入向量数据库（Chroma/Milvus）
- [ ] 使用嵌入模型（text-embedding-v2）
- [ ] 前端代码模块化拆分
- [ ] 添加单元测试

**中期（1-2 月）**：
- [ ] 学生学习记录与进度追踪
- [ ] 实验配置与 Prompt 模板化
- [ ] 多轮对话上下文优化
- [ ] Docker 容器化部署

**长期（3-6 月）**：
- [ ] 多租户支持（教师/学生角色）
- [ ] 实验报告自动生成
- [ ] 知识图谱集成
- [ ] 移动端适配

### 📜 许可证

MIT License

### 🙏 致谢

- [阿里云百炼](https://dashscope.aliyun.com/) - 提供大模型 API
- [PhET Interactive Simulations](https://phet.colorado.edu/) - 提供物理实验仿真
- [FastAPI](https://fastapi.tiangolo.com/) - 高性能 Web 框架
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先的 CSS 框架

---

<div align="center">

**如果这个项目对你有帮助，欢迎 Star ⭐**

[GitHub 仓库](https://github.com/jiahaozheng406/Physics_Agent_Project)

</div>

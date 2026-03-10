# Physics Agent Project

<div align="center">

**多模态物理实验教学智能体系统**

*基于大模型的垂直领域 Agent，集成实验仿真、知识检索与启发式教学*

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README_EN.md) | 简体中文

</div>

---

## 📖 项目概述

Physics Agent 是一个专为物理实验教学设计的**高级智能体系统**，不同于通用聊天机器人，它深度整合了：

- **领域知识增强**：RAG 检索增强生成，支持教材文档上传与精准引用
- **多模态理解**：文本、图像、音频三模态输入，实验装置识别与图表分析
- **实验仿真联动**：集成 PhET 交互式物理实验库，参数化仿真与智能解释
- **启发式教学**：非直接给答案，引导式提问，培养科学思维
- **可追溯性设计**：知识来源标注、不确定性声明、反幻觉机制

### 🎯 核心特性

| 特性 | 说明 |
|------|------|
| **垂直场景专精** | 专注物理实验教学，内置物理学科提示词与教学策略 |
| **实验库集成** | 集成 PhET 仿真实验，支持参数联动与实时解释 |
| **RAG 知识注入** | 文档上传后自动分块、检索、注入上下文 |
| **多模态输入** | 支持文本问答、图片识别、音频输入（实验性） |
| **流式交互** | SSE 实时流式输出，LaTeX 公式渲染 |
| **会话持久化** | SQLite 存储会话历史，支持多轮对话上下文管理 |
| **现代化 UI** | 深色毛玻璃界面，拖拽上传，动效流畅 |

---

## 🖼️ 界面展示

### 主界面
<div align="center">
<img src="docs/images/main-interface.png" alt="主界面" width="800"/>
</div>

**核心功能区域**：
- **左侧边栏**：会话管理、文件上传、实验库导航
- **中央对话区**：流式消息展示、LaTeX 公式渲染、代码高亮
- **右侧面板**：实验仿真窗口、参数调节、实时分析

### 多模态输入
<div align="center">
<img src="docs/images/multimodal-input.png" alt="多模态输入" width="800"/>
</div>

支持拖拽上传文档、图片、音频，自动识别文件类型并路由到对应模型。

### 实验仿真联动
<div align="center">
<img src="docs/images/phet-simulation.png" alt="实验仿真" width="800"/>
</div>

集成 PhET 交互式实验，参数变化实时同步到 Agent 分析。

### RAG 知识检索
<div align="center">
<img src="docs/images/rag-retrieval.png" alt="RAG 检索" width="800"/>
</div>

上传教材后自动分块索引，回答时标注来源 `[Source N]`，可追溯引用。

---

## 🏗️ 技术架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层 (Browser)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 对话界面 │  │ 文件上传 │  │ 实验仿真 │  │ 历史记录 │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │             │          │
│       └─────────────┴─────────────┴─────────────┘          │
│                         │ SSE / REST API                    │
└─────────────────────────┼─────────────────────────────────┘
                          │
┌─────────────────────────┼─────────────────────────────────┐
│                    后端层 (FastAPI)                         │
│  ┌──────────────────────┴──────────────────────┐           │
│  │          API Gateway (main.py)              │           │
│  └──┬────────┬────────┬────────┬────────┬──────┘           │
│     │        │        │        │        │                  │
│  ┌──▼──┐  ┌─▼──┐  ┌──▼──┐  ┌──▼──┐  ┌─▼──┐               │
│  │模型 │  │RAG │  │存储 │  │实验 │  │文件│               │
│  │网关 │  │引擎│  │层  │  │库  │  │处理│               │
│  └──┬──┘  └─┬──┘  └──┬──┘  └──┬──┘  └─┬──┘               │
│     │       │        │        │       │                   │
└─────┼───────┼────────┼────────┼───────┼───────────────────┘
      │       │        │        │       │
┌─────▼───────▼────────▼────────▼───────▼───────────────────┐
│                    外部服务层                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │DashScope │  │  SQLite  │  │PhET API  │  │文件系统  │  │
│  │   API    │  │ Database │  │          │  │          │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

**后端**
- **框架**：FastAPI + Uvicorn（异步高性能）
- **AI 接入**：阿里云百炼 DashScope API
  - 文本模型：`qwen-plus`（通用问答）
  - 视觉模型：`qwen-vl-max`（图像理解）
  - 音频模型：`qwen-audio-turbo`（语音识别）
- **文档解析**：pdfplumber（PDF）、python-docx（Word）
- **图像处理**：Pillow（压缩、格式转换）
- **持久化**：SQLite（会话存储、历史记录）
- **RAG 引擎**：自研轻量级检索（计划升级向量数据库）

**前端**
- **核心**：原生 HTML5 + CSS3 + JavaScript (ES6+)
- **样式**：Tailwind CSS（实用优先）+ 自定义毛玻璃效果
- **渲染**：
  - Markdown：Marked.js
  - LaTeX 公式：KaTeX
  - 代码高亮：Prism.js
- **交互**：SSE 流式接收、拖拽上传、客户端图片压缩

---

## 🚀 快速开始

### 环境要求

- **Python**：3.8 或更高版本
- **操作系统**：Windows / macOS / Linux
- **API Key**：阿里云百炼 DashScope API Key（[获取地址](https://dashscope.console.aliyun.com/)）

### 安装步骤

1. **克隆项目**

```bash
git clone https://github.com/jiahaozheng406/Physics_Agent_Project.git
cd Physics_Agent_Project
```

2. **安装依赖**

```bash
pip install -r requirements.txt
```

3. **配置环境变量**

在项目根目录创建 `.env` 文件：

```env
DASHSCOPE_API_KEY=your_api_key_here
```

4. **启动服务**

```bash
# 方式一：使用 uvicorn（推荐，支持热重载）
uvicorn backend.main:app --reload --port 8000

# 方式二：直接运行
python -m backend.main
```

5. **访问应用**

打开浏览器访问：http://localhost:8000

---

## 💡 核心功能详解

### 1. 智能对话系统

**特性**：
- 物理知识问答（力学、热学、电磁学、光学等）
- 实验原理深度解释
- 公式推导与计算验证
- LaTeX 公式渲染（行内 `$F=ma$`，块级 `$$E=mc^2$$`）
- 流式输出，实时响应

**示例对话**：
```
用户：解释牛顿第二定律的物理意义
Agent：牛顿第二定律 $F=ma$ 揭示了力、质量和加速度之间的定量关系...
      [提供分步推导、实验验证建议、常见误区]
```

### 2. RAG 知识增强

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

**示例**：
```
用户：[上传《大学物理实验》PDF] 单摆实验的误差来源有哪些？
Agent：根据您上传的文档 [Source 1]，单摆实验的主要误差来源包括：
      1. 摆长测量误差（游标卡尺精度限制）
      2. 周期测量误差（人工计时反应时间）
      3. 空气阻力影响...
```

### 3. 多模态理解

#### 图像识别
- **支持格式**：PNG、JPG、JPEG、WebP、BMP
- **应用场景**：
  - 实验装置识别（弹簧振子、光学平台等）
  - 图表数据提取（位移-时间图、速度-时间图）
  - 手写公式识别
  - 实验现象分析（干涉条纹、光谱线等）

**示例**：
```
用户：[上传实验装置照片]
Agent：这是一个简谐振动实验装置，包含：
      - 弹簧振子系统
      - 位移传感器
      - 数据采集器
      建议观测重点：振幅衰减、周期稳定性...
```

#### 音频输入（实验性）
- **支持格式**：WebM、WAV、MP3、M4A、AAC、OGG
- **限制**：最大 30 秒，10MB
- **应用场景**：语音提问、实验现象描述

### 4. PhET 实验仿真联动

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

**示例**：
```
实验：弹簧振子
参数：质量 m=0.5kg，弹簧系数 k=20N/m，初始位移 x₀=0.1m
Agent：当前系统角频率 ω=√(k/m)=6.32 rad/s
      周期 T=2π/ω≈0.99s
      振幅 A=0.1m
      系统做简谐振动，能量在动能和弹性势能间转换...
```

### 5. 启发式教学策略

**非直接给答案**，而是：
- 引导式提问："你认为影响周期的因素有哪些？"
- 分步推理："我们先从受力分析开始..."
- 常见误区提醒："注意区分速度和加速度的方向"
- 实验验证建议："可以通过改变质量来验证这个结论"

---

## 📂 项目结构

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

---

## 🔧 开发指南

### API 端点

| 方法 | 路径 | 功能 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/` | 返回前端页面 | - | HTML |
| POST | `/api/chat` | 发送消息 | `{message, session_id, images?, audio?}` | SSE 流 |
| POST | `/api/upload-doc` | 上传文档 | `FormData(file)` | `{doc_id, filename}` |
| POST | `/api/upload-image` | 上传图片 | `FormData(file)` | `{image_id, url}` |
| POST | `/api/upload-audio` | 上传音频 | `FormData(file)` | `{audio_id, duration}` |
| DELETE | `/api/clear-docs` | 清空知识库 | `{session_id}` | `{success}` |
| POST | `/api/clear-history` | 清空对话历史 | `{session_id}` | `{success}` |
| GET | `/api/status` | 查询会话状态 | `?session_id=xxx` | `{doc_count, msg_count}` |
| GET | `/api/phet/catalog` | 获取实验列表 | `?locale=zh_CN` | `[{slug, title, ...}]` |
| GET | `/api/phet/detail/{slug}` | 获取实验详情 | - | `{intro, questions, ...}` |

### 配置项

**环境变量** (`.env`)：
```env
# 必填
DASHSCOPE_API_KEY=sk-xxx

# 可选
RAG_TOP_K=3                    # RAG 检索返回文档块数量
DATABASE_PATH=data/sessions.db # SQLite 数据库路径
PHET_CACHE_AGE=86400          # PhET 缓存有效期（秒）
```

**模型配置** (`backend/main.py`)：
```python
TEXT_MODEL = "qwen-plus"          # 文本模型
VISION_MODEL = "qwen-vl-max"      # 视觉模型
AUDIO_MODEL = "qwen-audio-turbo"  # 音频模型

MAX_HISTORY_TURNS = 12            # 最大历史轮数
MAX_IMAGE_SIDE = 1280             # 图片最大边长
JPEG_QUALITY = 85                 # JPEG 压缩质量
```

**系统提示词** (`backend/main.py` 中的 `SYSTEM_PROMPT`)：
```python
SYSTEM_PROMPT = """
You are an advanced multimodal physics experiment teaching agent.
Core rules:
1. Traceability first: 优先引用用户上传文档，标注来源
2. Anti-hallucination: 证据不足时明确声明不确定性
3. Heuristic teaching: 引导式提问，解释常见错误
4. Formula style: 使用 Markdown + LaTeX
5. Language: 默认简体中文
""".strip()
```

### 添加新实验

编辑 `backend/phet_catalog.py`，在实验列表中添加：

```python
{
    "slug": "projectile-motion",           # PhET 实验 slug
    "title_zh": "斜抛运动",                # 中文标题
    "title_en": "Projectile Motion",       # 英文标题
    "topic_zh": "运动学",                  # 主题分类
    "intro_zh": "探索抛体运动的轨迹...",   # 实验简介
    "interface_guidance_zh": [             # 操作指南
        "调节初速度和发射角度",
        "观察轨迹和落点位置"
    ],
    "classic_questions_zh": [              # 经典问题
        "什么角度下射程最远？",
        "如何计算最大高度？"
    ]
}
```

### 自定义样式

**毛玻璃效果** (`static/style.css`)：
```css
.glass-panel {
  backdrop-filter: blur(20px);
  background: rgba(30, 30, 30, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
```

**动画效果**：
```css
@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.message-enter {
  animation: slideUp 0.3s ease-out;
}
```

### 扩展 RAG 能力

**当前实现**（轻量级）：
```python
# backend/rag.py
def build_rag_context(chunks: list[str], top_k: int = 3) -> str:
    # 简单文本拼接
    return "\n\n".join(chunks[:top_k])
```

**升级方向**（向量检索）：
```python
# 1. 引入向量数据库
from chromadb import Client

# 2. 使用嵌入模型
from sentence_transformers import SentenceTransformer
embedder = SentenceTransformer('text-embedding-ada-002')

# 3. 语义检索
def semantic_search(query: str, top_k: int = 3):
    query_embedding = embedder.encode(query)
    results = vector_db.query(query_embedding, n_results=top_k)
    return results
```

---

## 🎯 智能体设计理念

### 1. 垂直领域专精

**不做**：通用聊天、闲聊、娱乐
**专注**：物理实验教学、知识问答、实验指导

**实现方式**：
- 系统提示词明确角色边界
- 拒绝非物理领域问题
- 引导用户回到教学场景

### 2. 可追溯性设计

**问题**：大模型容易"幻觉"，编造不存在的知识
**解决**：
- 优先引用用户上传文档
- 标注知识来源 `[Source N]`
- 证据不足时明确声明："根据当前资料无法确定..."

### 3. 反幻觉机制

**策略**：
- 不编造物理常数（如光速、普朗克常数）
- 不编造实验数据
- 不确定时建议查阅权威资料或实验验证

### 4. 启发式教学

**传统 AI**：直接给答案
**本系统**：
- 引导式提问："你认为影响因素有哪些？"
- 分步推理："我们先从受力分析开始..."
- 常见误区："注意区分速度和加速度..."

### 5. 多模态融合

**文本模式**：注入 RAG 上下文
**视觉模式**：隔离 RAG（防止 token 超限）
**音频模式**：转文本后再处理

---

## 📊 性能优化

### 图片压缩策略

**客户端压缩**（`static/app.js`）：
```javascript
function compressImage(file, maxSide = 768) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  // 等比缩放到 maxSide
  canvas.toBlob(blob => {
    // 压缩后上传
  }, 'image/jpeg', 0.85);
}
```

**服务端兜底**（`backend/main.py`）：
```python
def compress_image(image: Image, max_side: int = 1280) -> bytes:
    if max(image.size) > max_side:
        image.thumbnail((max_side, max_side))
    buffer = io.BytesIO()
    image.save(buffer, format='JPEG', quality=85)
    return buffer.getvalue()
```

### 会话管理

**内存缓存** + **SQLite 持久化**：
```python
SESSION_CACHE: dict[str, dict] = {}  # 热数据
STORE = SessionStore(DATABASE_PATH)  # 冷数据

def get_session(session_id: str):
    if session_id in SESSION_CACHE:
        return SESSION_CACHE[session_id]
    return STORE.load_session(session_id)
```

### SSE 流式优化

**分块发送**，避免长时间阻塞：
```python
async def stream_response():
    for chunk in model.stream():
        yield f"data: {json.dumps(chunk)}\n\n"
        await asyncio.sleep(0)  # 让出控制权
```

---

## 🔒 安全性考虑

### 文件上传限制

```python
ALLOWED_DOC_EXT = {".pdf", ".docx"}
ALLOWED_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
ALLOWED_AUDIO_EXT = {".webm", ".wav", ".mp3", ".m4a", ".aac", ".ogg"}

MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 10MB
MAX_AUDIO_SECONDS = 30
```

### API Key 保护

```python
# .env 文件不提交到 Git
# .gitignore
.env
*.env
```

### 输入验证

```python
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
```

---

## 🚧 项目状态与路线图

### 已完成功能 ✅

- [x] FastAPI 后端架构
- [x] 深色毛玻璃 UI
- [x] 拖拽上传（文档/图片/音频）
- [x] Markdown + LaTeX 渲染
- [x] SSE 流式输出
- [x] 客户端/服务端图片压缩
- [x] RAG 知识库注入
- [x] 视觉模式隔离（防 token 超限）
- [x] SQLite 会话持久化
- [x] PhET 实验库集成

### 改进路线图

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

---

## 📜 许可证

MIT License

---

## 🙏 致谢

- [阿里云百炼](https://dashscope.aliyun.com/) - 提供大模型 API
- [PhET Interactive Simulations](https://phet.colorado.edu/) - 提供物理实验仿真
- [FastAPI](https://fastapi.tiangolo.com/) - 高性能 Web 框架
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先的 CSS 框架

---

<div align="center">

**如果这个项目对你有帮助，欢迎 Star ⭐**

[GitHub 仓库](https://github.com/jiahaozheng406/Physics_Agent_Project)

</div>

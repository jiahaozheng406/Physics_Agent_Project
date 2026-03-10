# Physics Agent Project

## 项目简介
基于 FastAPI + 原生 HTML/CSS/JS 的多模态物理实验教学 Agent，调用阿里云百炼（DashScope）接口。
深色模式 · 毛玻璃界面 · 拖拽上传 · Markdown + LaTeX 渲染。

## 文件结构
```
Physics_Agent_Project/
├── app.py              — FastAPI 后端（核心入口）
├── system_prompt.md    — 系统提示词（角色/任务/规则）
├── requirements.txt    — Python 依赖
├── .env                — API Key（DASHSCOPE_API_KEY）
└── static/
    ├── index.html      — 单页应用入口
    ├── css/style.css   — 毛玻璃/动效样式
    └── js/app.js       — 前端交互逻辑
```

## 技术栈
- **后端框架**：FastAPI + Uvicorn
- **前端**：原生 HTML + Tailwind CSS CDN + Marked.js + KaTeX
- **AI 接入**：OpenAI SDK 兼容模式 → 阿里云百炼
  - base_url: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- **模型路由**：
  - 纯文本/RAG → `qwen-plus`
  - 图像分析  → `qwen-vl-max`

## API 端点
| 方法   | 路径                | 功能           |
|--------|---------------------|----------------|
| GET    | `/`                 | 返回 index.html |
| POST   | `/api/chat`         | 发送消息       |
| POST   | `/api/upload`       | 上传文档到 RAG |
| DELETE | `/api/clear-docs`   | 清空知识库     |
| POST   | `/api/clear-history`| 清空对话历史   |
| GET    | `/api/status`       | 会话状态查询   |

## 启动命令
```bash
# 安装依赖
pip install -r requirements.txt

# 启动服务（支持热重载）
uvicorn app:app --reload --port 8000

# 或直接运行
python app.py
```
然后访问 http://localhost:8000

## 当前进度
- [x] FastAPI 后端重构完成
- [x] 深色毛玻璃 UI 重构完成
- [x] 拖拽上传 (PDF/DOCX/图片)
- [x] Markdown + LaTeX 渲染
- [x] 消息动效 (slideUp / fadeIn)
- [x] 客户端图片压缩 (canvas, 768px)
- [x] 服务端图片压缩兜底
- [x] RAG 知识库注入（文本模式）
- [x] 视觉模式隔离（不传 RAG，防 token 超限）
- [ ] 待完善：流式输出（streaming response）
- [ ] 待完善：对话历史持久化（SQLite / Redis）
- [ ] 待完善：音频处理（qwen-audio-turbo）

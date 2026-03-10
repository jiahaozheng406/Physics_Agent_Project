# CLAUDE.md

- [English](#english)
- [简体中文](#简体中文)

## English

### Role of This Document

This file is a concise developer handoff note. It should stay practical and implementation-focused.

### Current Product Shape

- Single-process FastAPI application
- Static frontend served from `static/`
- SQLite-backed session and document state
- DashScope-backed text, vision, and audio paths
- Built-in physics lab library plus extracurricular simulation workspace

### Main Files to Understand First

1. `backend/main.py`
2. `backend/storage.py`
3. `backend/rag.py`
4. `backend/phet_catalog.py`
5. `static/index.html`
6. `static/app.js`
7. `static/style.css`

### Important Runtime Notes

- The active system prompt is still embedded in `backend/main.py`
- `system_prompt.md` is a reference specification, not yet the runtime source
- `data/physics_agent.sqlite3` and `data/phet_catalog.json` are runtime data files
- `uploads/` stores user-uploaded artifacts and should not be treated as source code

### Maintenance Priorities

1. Keep the docs aligned with the live backend routes and active frontend files
2. Avoid reintroducing old paths such as `app.py` or `static/js/app.js`
3. Keep generated runtime files out of Git tracking
4. Continue manual refinement for simulation UI profiles with `needs_manual_review`

### Fast Checks Before Shipping

```bash
python -m py_compile backend/main.py backend/phet_catalog.py backend/rag.py backend/storage.py
node --check static/app.js
git status --short
```

---

## 简体中文

### 文档定位

这份文件是简短的开发交接说明，重点是实用和落地，不是项目宣传文案。

### 当前产品形态

- 单进程 FastAPI 应用
- `static/` 下提供前端页面
- SQLite 保存会话和文档状态
- DashScope 提供文本、视觉、音频模型能力
- 同时包含内置实验库和课外实验工作区

### 优先理解的文件

1. `backend/main.py`
2. `backend/storage.py`
3. `backend/rag.py`
4. `backend/phet_catalog.py`
5. `static/index.html`
6. `static/app.js`
7. `static/style.css`

### 运行时注意事项

- 当前真正生效的系统提示词仍写在 `backend/main.py` 中
- `system_prompt.md` 现在是参考规范，还不是运行时加载源
- `data/physics_agent.sqlite3` 和 `data/phet_catalog.json` 是运行时数据
- `uploads/` 存放用户上传内容，不应当当作源码

### 维护重点

1. 文档必须和现行后端路由、前端主线保持一致
2. 不要把旧入口 `app.py` 或 `static/js/app.js` 再写回主文档
3. 持续把运行时生成文件排除出 Git 跟踪
4. 继续对 `needs_manual_review` 标记的课外实验做人工精修

### 提交前快速检查

```bash
python -m py_compile backend/main.py backend/phet_catalog.py backend/rag.py backend/storage.py
node --check static/app.js
git status --short
```

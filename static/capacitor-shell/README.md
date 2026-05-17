# Capacitor 安卓封装

本目录用于将现有 `Physics Agent` 前端封装为安卓应用壳，并默认启用“手机内置轻后端”模式。

## 常用命令

```bash
cd static/capacitor-shell
npm install
npm run sync:android
npm run open:android
```

若需要直接生成调试版安装包，可执行：

```bash
npm run build:apk
```

## 当前打包逻辑

- 网页资源来自主项目 `static/`
- `scripts/prepare-web.mjs` 会把前端资源复制到 `www/`
- 打包前会自动导出两类轻后端资源：
  - `static/mobile-lite/phet_catalog.json`
  - `static/mobile-lite/external_kb.json`
- 安卓工程通过 `npx cap sync android` 同步到 `android/`

## 手机内置轻后端

轻后端模式下：

- 会话与项目列表保存在手机本地
- App 直接从手机访问 DashScope 模型服务
- 外部 PDF 知识库会以内置分块形式打进安装包
- PhET 目录会以内置 JSON 形式打进安装包

当前轻后端版本支持：

- 文本对话
- 图片分析
- 语音分析
- 本地会话/项目管理
- 内置知识库检索
- 本地 PhET 目录浏览

当前轻后端版本暂不支持：

- 在手机端新增 PDF / DOCX 入库
- 使用电脑本地 SQLite 继续追加文档分块

## 模型密钥配置

默认情况下，安装后的 App 会在侧边栏显示“轻后端模型”，用户可在其中填写自己的 DashScope API Key。

也可以在打包前通过环境变量直接写入：

```powershell
$env:PHYSICS_AGENT_BACKEND_MODE="lite"
$env:PHYSICS_AGENT_MODEL_API_KEY="your_dashscope_api_key"
$env:PHYSICS_AGENT_SHOW_MODEL_KEY_SETTINGS="false"
npm run build:apk
```

若不希望把密钥打进安装包，建议保持 `PHYSICS_AGENT_MODEL_API_KEY` 为空，让用户在手机端首次使用时手动填写。

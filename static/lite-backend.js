(() => {
  "use strict";

  const STATE_STORAGE_KEY = "physics_agent_lite_state_v1";
  const MODEL_API_KEY_STORAGE_KEY = "physics_agent_model_api_key";
  const OPENAI_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
  const AUDIO_API_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
  const TEXT_MODEL = "qwen-plus";
  const VISION_MODEL = "qwen-vl-max";
  const AUDIO_MODEL = "qwen-audio-turbo";
  const DEFAULT_SESSION_TITLE = "新对话";
  const MAX_HISTORY_MESSAGES = 24;
  const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
  const MAX_PDF_BYTES = 20 * 1024 * 1024;
  const MAX_PDF_PAGES = 160;
  const DOC_CHUNK_SIZE = 900;
  const DOC_CHUNK_OVERLAP = 140;
  const TOP_K = 6;
  const MAX_RAG_CONTEXT_CHARS = 8000;

  const SYSTEM_PROMPT = [
    "You are an advanced multimodal physics experiment teaching agent.",
    "Core rules:",
    "1. Traceability first:",
    "   - If the knowledge base is used, cite the source id exactly like [Source N].",
    "2. Anti-hallucination:",
    "   - If evidence is insufficient, explicitly say what is uncertain and what extra data is needed.",
    "   - Never fabricate constants, formulas, or experiment results.",
    "3. Heuristic teaching:",
    "   - Guide with step-by-step reasoning, ask key diagnostic questions, and explain common mistakes.",
    "   - Encourage users to verify experimentally.",
    "4. Formula style:",
    "   - Use Markdown + LaTeX.",
    "   - Inline formula like $F=ma$, block formula like $$E_k=\\\\frac{1}{2}mv^2$$.",
    "5. Language:",
    "   - Respond in Simplified Chinese unless the user explicitly asks another language.",
  ].join("\n");

  let assetPromise = null;
  let assetCache = {
    phetCatalog: { updated_at: "", total: 0, groups: [] },
    externalKnowledge: { updated_at: "", documents: [], chunks: [] },
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function createId(prefix = "id") {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_STORAGE_KEY);
      if (!raw) {
        return { version: 2, folders: [], sessions: [], messages: {}, documents: [], document_chunks: [] };
      }
      const parsed = JSON.parse(raw);
      return {
        version: 2,
        folders: Array.isArray(parsed?.folders) ? parsed.folders : [],
        sessions: Array.isArray(parsed?.sessions) ? parsed.sessions : [],
        messages: parsed?.messages && typeof parsed.messages === "object" ? parsed.messages : {},
        documents: Array.isArray(parsed?.documents) ? parsed.documents : [],
        document_chunks: Array.isArray(parsed?.document_chunks) ? parsed.document_chunks : [],
      };
    } catch {
      return { version: 2, folders: [], sessions: [], messages: {}, documents: [], document_chunks: [] };
    }
  }

  function saveState(state) {
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
  }

  function getStoredModelApiKey() {
    try {
      return String(localStorage.getItem(MODEL_API_KEY_STORAGE_KEY) || "").trim();
    } catch {
      return "";
    }
  }

  function normalizeMessageContent(content) {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item.text === "string") return item.text;
          if (item?.type === "text" && typeof item.text === "string") return item.text;
          return "";
        })
        .join("");
    }
    return "";
  }

  function buildResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }

  function buildErrorResponse(status, detail) {
    return buildResponse({ detail }, status);
  }

  async function loadJsonAsset(relativePath, fallbackValue) {
    try {
      const assetUrl = new URL(relativePath, window.location.href).toString();
      const response = await window.fetch(assetUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch {
      return fallbackValue;
    }
  }

  async function ensureAssets() {
    if (assetPromise) return assetPromise;
    assetPromise = (async () => {
      const [phetCatalog, externalKnowledge] = await Promise.all([
        loadJsonAsset("./static/mobile-lite/phet_catalog.json", {
          updated_at: "",
          total: 0,
          groups: [],
        }),
        loadJsonAsset("./static/mobile-lite/external_kb.json", {
          updated_at: "",
          documents: [],
          chunks: [],
        }),
      ]);

      assetCache = {
        phetCatalog: {
          updated_at: phetCatalog?.updated_at || "",
          total: Number(phetCatalog?.total || 0),
          groups: Array.isArray(phetCatalog?.groups) ? phetCatalog.groups : [],
        },
        externalKnowledge: {
          updated_at: externalKnowledge?.updated_at || "",
          documents: Array.isArray(externalKnowledge?.documents) ? externalKnowledge.documents : [],
          chunks: Array.isArray(externalKnowledge?.chunks) ? externalKnowledge.chunks : [],
        },
      };
      return assetCache;
    })();
    return assetPromise;
  }

  function getEmbeddedDocuments(assets) {
    return (assets?.externalKnowledge?.documents || []).map((doc, index) => ({
      id: doc.id || `embedded-doc-${index}`,
      name: doc.name || doc.original_name || `内置资料 ${index + 1}`,
      original_name: doc.original_name || doc.name || `内置资料 ${index + 1}`,
      chars: Number(doc.char_count || 0),
      char_count: Number(doc.char_count || 0),
      source_label: doc.source_label || "[Source 1001]",
      is_external: true,
    }));
  }

  function getSessionDocuments(state, sessionId) {
    return (Array.isArray(state?.documents) ? state.documents : [])
      .filter((doc) => String(doc.session_id || "") === String(sessionId || ""))
      .sort((a, b) => Date.parse(a.created_at || "") - Date.parse(b.created_at || ""));
  }

  function getSessionChunks(state, sessionId) {
    return (Array.isArray(state?.document_chunks) ? state.document_chunks : [])
      .filter((chunk) => String(chunk.session_id || "") === String(sessionId || ""));
  }

  function listSessionDocuments(state, sessionId, assets, { includeExternal = true } = {}) {
    const sessionDocs = getSessionDocuments(state, sessionId).map((doc) => ({
      ...doc,
      chars: Number(doc.char_count || doc.chars || 0),
      char_count: Number(doc.char_count || doc.chars || 0),
      is_external: false,
    }));
    return includeExternal ? [...sessionDocs, ...getEmbeddedDocuments(assets)] : sessionDocs;
  }

  function nextSessionSourceNumber(state, sessionId) {
    const sessionDocs = getSessionDocuments(state, sessionId).filter((doc) => !doc.is_external);
    return sessionDocs.length + 1;
  }

  function nextSessionDocumentOrder(state, sessionId) {
    return getSessionDocuments(state, sessionId).length;
  }

  function clearSessionDocuments(state, sessionId) {
    state.documents = (state.documents || []).filter((doc) => String(doc.session_id || "") !== String(sessionId || ""));
    state.document_chunks = (state.document_chunks || []).filter((chunk) => String(chunk.session_id || "") !== String(sessionId || ""));
  }

  function findFolder(state, folderId) {
    return state.folders.find((item) => item.id === folderId) || null;
  }

  function ensureSession(state, sessionId, options = {}) {
    let session = state.sessions.find((item) => item.session_id === sessionId);
    if (session) {
      return session;
    }

    const now = nowIso();
    session = {
      session_id: sessionId,
      title: String(options.title || DEFAULT_SESSION_TITLE).trim() || DEFAULT_SESSION_TITLE,
      folder_id: options.folderId ?? null,
      created_at: now,
      updated_at: now,
      last_model: "",
    };
    state.sessions.push(session);
    state.messages[sessionId] = Array.isArray(state.messages[sessionId]) ? state.messages[sessionId] : [];
    return session;
  }

  function ensureFolderNameAvailable(state, name, excludedFolderId = null) {
    const cleanName = String(name || "").trim();
    if (!cleanName) {
      throw new Error("项目名称不能为空。");
    }
    const duplicated = state.folders.some(
      (item) => item.id !== excludedFolderId && String(item.name || "").trim().toLowerCase() === cleanName.toLowerCase(),
    );
    if (duplicated) {
      throw new Error("已存在同名项目，请更换名称。");
    }
    return cleanName;
  }

  function listFoldersPayload(state) {
    return [...state.folders]
      .sort((a, b) => Date.parse(b.updated_at || "") - Date.parse(a.updated_at || ""))
      .map((folder) => ({
        ...folder,
        session_count: state.sessions.filter((session) => session.folder_id === folder.id).length,
      }));
  }

  function listSessionsPayload(state, assets) {
    return [...state.sessions]
      .sort((a, b) => Date.parse(b.updated_at || "") - Date.parse(a.updated_at || ""))
      .map((session) => ({
        ...session,
        folder_name: session.folder_id ? findFolder(state, session.folder_id)?.name || "" : "",
        doc_count: listSessionDocuments(state, session.session_id, assets).length,
      }));
  }

  function listModelMessages(state, sessionId) {
    return (state.messages[sessionId] || [])
      .filter((item) => item.role === "user" || item.role === "assistant")
      .filter((item) => item.status !== "error")
      .slice(-MAX_HISTORY_MESSAGES)
      .map((item) => ({
        role: item.role,
        content: item.content || "",
      }));
  }

  function createMessage(state, sessionId, role, content, extra = {}) {
    const session = ensureSession(state, sessionId);
    const now = nowIso();
    const entry = {
      id: createId(role),
      session_id: sessionId,
      role,
      content,
      model_used: extra.model_used || "",
      status: extra.status || "done",
      input_mode: extra.input_mode || "text",
      error_message: extra.error_message || "",
      created_at: now,
      completed_at: extra.completed_at || now,
    };
    state.messages[sessionId] = Array.isArray(state.messages[sessionId]) ? state.messages[sessionId] : [];
    state.messages[sessionId].push(entry);
    session.updated_at = now;
    return entry;
  }

  function autoTitleSession(session, messageText) {
    const cleanMessage = String(messageText || "").trim();
    if (!cleanMessage) return;
    const currentTitle = String(session.title || "").trim();
    if (currentTitle && currentTitle !== DEFAULT_SESSION_TITLE) return;
    session.title = cleanMessage.length > 18 ? `${cleanMessage.slice(0, 18)}…` : cleanMessage;
  }

  function tokenizeQuery(query) {
    const clean = String(query || "").trim().toLowerCase();
    if (!clean) return [];
    const tokens = new Set();
    const latin = clean.match(/[a-z0-9]+/g) || [];
    latin.forEach((item) => tokens.add(item));

    const cjkSegments = clean.match(/[\u4e00-\u9fff]+/g) || [];
    cjkSegments.forEach((segment) => {
      tokens.add(segment);
      if (segment.length <= 4) {
        for (const char of segment) {
          tokens.add(char);
        }
      } else {
        for (let index = 0; index < segment.length - 1; index += 1) {
          tokens.add(segment.slice(index, index + 2));
        }
      }
    });

    return [...tokens].filter(Boolean);
  }

  function scoreChunk(query, chunk) {
    const text = String(chunk?.chunk_text || "").toLowerCase();
    if (!text) return 0;
    let score = 0;
    const cleanQuery = String(query || "").trim().toLowerCase();
    if (cleanQuery && text.includes(cleanQuery)) {
      score += 12;
    }
    for (const token of tokenizeQuery(query)) {
      if (!token) continue;
      const count = text.split(token).length - 1;
      if (count > 0) {
        score += count * Math.min(token.length, 6);
      }
    }
    return score;
  }

  function normalizeExtractedText(text) {
    return String(text || "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function splitLongText(text, size, overlap) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(text.length, start + size);
      chunks.push(text.slice(start, end).trim());
      if (end >= text.length) break;
      start = Math.max(0, end - overlap);
    }
    return chunks.filter(Boolean);
  }

  function chunkDocumentText(text, { size = DOC_CHUNK_SIZE, overlap = DOC_CHUNK_OVERLAP } = {}) {
    const normalized = normalizeExtractedText(text);
    if (!normalized) return [];
    const paragraphs = normalized.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
    const chunks = [];
    let buffer = "";

    for (const paragraph of paragraphs) {
      if (paragraph.length > size * 1.4) {
        if (buffer.trim()) {
          chunks.push(buffer.trim());
          buffer = "";
        }
        chunks.push(...splitLongText(paragraph, size, overlap));
        continue;
      }

      const next = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
      if (next.length <= size) {
        buffer = next;
      } else {
        if (buffer.trim()) chunks.push(buffer.trim());
        buffer = paragraph;
      }
    }

    if (buffer.trim()) {
      chunks.push(buffer.trim());
    }

    return chunks.filter(Boolean);
  }

  function extractTextFromPdfItems(items) {
    if (!Array.isArray(items) || !items.length) return "";
    const rows = [];
    for (const item of items) {
      const text = String(item?.str || "").trim();
      if (!text) continue;
      const y = Number(item?.transform?.[5] || 0);
      const x = Number(item?.transform?.[4] || 0);
      const row = rows.find((entry) => Math.abs(entry.y - y) <= 3.5);
      if (row) {
        row.items.push({ x, text });
      } else {
        rows.push({ y, items: [{ x, text }] });
      }
    }
    return rows
      .sort((a, b) => b.y - a.y)
      .map((row) => row.items.sort((a, b) => a.x - b.x).map((entry) => entry.text).join(" "))
      .join("\n");
  }

  async function extractPdfText(file) {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error("PDF 超过 20MB 上限，建议先压缩或拆分后再上传");
    }
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib?.getDocument) {
      throw new Error("PDF 解析组件未加载完成，请稍后重试");
    }
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer, disableWorker: true }).promise;
    if (Number(pdf.numPages || 0) > MAX_PDF_PAGES) {
      throw new Error(`PDF 页数超过 ${MAX_PDF_PAGES} 页上限，建议拆分后上传`);
    }

    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = extractTextFromPdfItems(content?.items || []);
      if (pageText.trim()) {
        pages.push(pageText.trim());
      }
    }

    const text = normalizeExtractedText(pages.join("\n\n"));
    if (!text) {
      throw new Error("PDF 中未提取到可用文本，可能是扫描件或图片版 PDF");
    }
    return text;
  }

  function searchKnowledgeBase(state, assets, sessionId, query, topK = TOP_K) {
    const sessionChunks = getSessionChunks(state, sessionId).map((chunk) => ({ ...chunk, is_external: false }));
    const externalChunks = (assets?.externalKnowledge?.chunks || []).map((chunk) => ({ ...chunk, is_external: true }));
    return [...sessionChunks, ...externalChunks]
      .map((chunk) => {
        const baseScore = scoreChunk(query, chunk);
        const boostedScore = chunk.is_external ? baseScore : baseScore + (baseScore > 0 ? 4 : 0);
        return {
          ...chunk,
          score: boostedScore,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.is_external !== b.is_external) return a.is_external ? 1 : -1;
        return Number(a.chunk_index || 0) - Number(b.chunk_index || 0);
      })
      .slice(0, topK);
  }

  function buildRagContext(chunks) {
    const blocks = [];
    let usedChars = 0;
    for (const chunk of chunks || []) {
      const sourceLabel = chunk.source_label || "[Source ?]";
      const name = chunk.original_name || "document";
      const text = String(chunk.chunk_text || "").trim();
      if (!text) continue;
      const block = `${sourceLabel} ${name}\n${text}`;
      if (usedChars && usedChars + block.length > MAX_RAG_CONTEXT_CHARS) {
        break;
      }
      blocks.push(block);
      usedChars += block.length;
    }
    if (!blocks.length) return "";
    return [
      "Knowledge base from uploaded session documents and bundled references. If used, cite the source id exactly like [Source N].",
      "",
      blocks.join("\n\n---\n\n"),
    ].join("\n");
  }

  function buildExternalLabContextPrompt(context) {
    if (!context || String(context.provider || "").trim().toLowerCase() !== "phet") {
      return "";
    }
    const title = String(context.title_zh || context.title_en || context.slug || "未命名实验").trim();
    const topic = String(context.topic_zh || "课外仿真实验").trim();
    const intro = String(context.intro_zh || "").trim();
    const controls = Array.isArray(context.controls_zh) ? context.controls_zh : [];
    const readouts = Array.isArray(context.readouts_zh) ? context.readouts_zh : [];
    const steps = Array.isArray(context.first_steps_zh) ? context.first_steps_zh : [];
    const effects = Array.isArray(context.interaction_effects_zh) && context.interaction_effects_zh.length
      ? context.interaction_effects_zh
      : (Array.isArray(context.effects_zh) ? context.effects_zh : []);

    const lines = [
      "当前问题附带一段课外仿真实验上下文，请优先依据该实验的界面结构、控制项、读数和现象进行解释。",
      `- 实验名称：${title}`,
      `- 研究主题：${topic}`,
    ];
    if (intro) lines.push(`- 实验概述：${intro}`);
    if (steps.length) lines.push(`- 建议先看：${steps.slice(0, 4).join("；")}`);
    if (controls.length) lines.push(`- 可调参数：${controls.slice(0, 6).join("；")}`);
    if (readouts.length) lines.push(`- 关键读数：${readouts.slice(0, 5).join("；")}`);
    if (effects.length) lines.push(`- 典型现象：${effects.slice(0, 5).join("；")}`);
    lines.push("回答时请先定位当前画面和控件，再解释参数变化与物理规律。");
    return lines.join("\n");
  }

  function buildUserDisplayContent(messageText, inputMode, externalLabContext) {
    let text = String(messageText || "").trim();
    if (!text) {
      if (inputMode === "audio") text = "[语音提问]";
      else if (inputMode === "image") text = "[图片提问]";
      else text = "[空消息]";
    }
    if (!externalLabContext || String(externalLabContext.provider || "").toLowerCase() !== "phet") {
      return text;
    }
    const title = String(
      externalLabContext.title_zh || externalLabContext.title_en || externalLabContext.slug || "未命名实验",
    ).trim();
    return `[课外仿真实验：${title}]\n${text}`;
  }

  function extractChatAnswer(responseData) {
    const choice = Array.isArray(responseData?.choices) ? responseData.choices[0] : null;
    const content = choice?.message?.content;
    if (typeof content === "string") {
      return content.trim();
    }
    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (typeof item === "string") return item;
          if (typeof item?.text === "string") return item.text;
          return "";
        })
        .join("")
        .trim();
    }
    return "";
  }

  function extractAudioAnswer(responseData) {
    const choices = responseData?.output?.choices;
    if (Array.isArray(choices) && choices.length) {
      const content = choices[0]?.message?.content;
      if (Array.isArray(content)) {
        const text = content
          .map((item) => (typeof item?.text === "string" ? item.text : ""))
          .join("")
          .trim();
        if (text) return text;
      }
    }
    const outputText = responseData?.output?.text;
    if (typeof outputText === "string" && outputText.trim()) {
      return outputText.trim();
    }
    throw new Error("音频模型返回结果不可解析。");
  }

  async function requestJson(url, { method = "GET", headers = {}, data = null } = {}) {
    const nativeHttp = window.Capacitor?.Plugins?.CapacitorHttp || window.CapacitorHttp;
    if (window.Capacitor?.isNativePlatform?.() && nativeHttp?.request) {
      const response = await nativeHttp.request({
        url,
        method,
        headers,
        data,
        responseType: "json",
      });
      return {
        status: Number(response.status || 0),
        data: response.data,
      };
    }

    const response = await window.fetch(url, {
      method,
      headers,
      body: data == null ? undefined : JSON.stringify(data),
    });
    const text = await response.text();
    let parsed = text;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = text;
    }
    return {
      status: response.status,
      data: parsed,
    };
  }

  async function callTextOrVisionModel(apiKey, messages, model) {
    const { status, data } = await requestJson(OPENAI_BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      data: {
        model,
        messages,
        stream: false,
      },
    });
    if (status < 200 || status >= 300) {
      const detail = typeof data === "string" ? data : JSON.stringify(data || {});
      throw new Error(`模型请求失败（HTTP ${status}）${detail ? `：${detail}` : ""}`);
    }
    return extractChatAnswer(data);
  }

  async function callAudioModel(apiKey, messages) {
    const { status, data } = await requestJson(AUDIO_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      data: {
        model: AUDIO_MODEL,
        input: {
          messages,
        },
      },
    });
    if (status < 200 || status >= 300) {
      const detail = typeof data === "string" ? data : JSON.stringify(data || {});
      throw new Error(`音频模型请求失败（HTTP ${status}）${detail ? `：${detail}` : ""}`);
    }
    return extractAudioAnswer(data);
  }

  function buildTextMessages(history, state, assets, sessionId, messageText, externalLabContext) {
    const ragContext = buildRagContext(searchKnowledgeBase(state, assets, sessionId, messageText));
    const labContext = buildExternalLabContextPrompt(externalLabContext);
    const messages = [{ role: "system", content: SYSTEM_PROMPT }];
    if (ragContext) messages.push({ role: "system", content: ragContext });
    if (labContext) messages.push({ role: "system", content: labContext });
    messages.push(...history);
    messages.push({ role: "user", content: messageText });
    return messages;
  }

  function buildImageMessages(history, state, assets, sessionId, messageText, imageBase64, imageMime, externalLabContext) {
    const ragContext = buildRagContext(searchKnowledgeBase(state, assets, sessionId, messageText));
    const labContext = buildExternalLabContextPrompt(externalLabContext);
    const dataUrl = `data:${imageMime || "image/jpeg"};base64,${imageBase64}`;
    const promptText = String(messageText || "").trim() || "请分析这张物理实验图片。";
    const messages = [{ role: "system", content: SYSTEM_PROMPT }];
    if (ragContext) messages.push({ role: "system", content: ragContext });
    if (labContext) messages.push({ role: "system", content: labContext });
    messages.push(...history);
    messages.push({
      role: "user",
      content: [
        { type: "text", text: promptText },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    });
    return messages;
  }

  function buildAudioMessages(history, state, assets, sessionId, messageText, audioBase64, audioMime, externalLabContext) {
    const ragContext = buildRagContext(searchKnowledgeBase(state, assets, sessionId, messageText));
    const labContext = buildExternalLabContextPrompt(externalLabContext);
    const promptParts = [];
    if (labContext) promptParts.push(labContext);
    if (ragContext) promptParts.push(ragContext);
    if (String(messageText || "").trim()) {
      promptParts.push(`用户问题：${String(messageText || "").trim()}`);
    }
    const promptText = promptParts.join("\n\n");
    const messages = [
      {
        role: "system",
        content: [{ text: SYSTEM_PROMPT }],
      },
      ...history.map((item) => ({
        role: item.role,
        content: [{ text: normalizeMessageContent(item.content) }],
      })),
      {
        role: "user",
        content: [
          { audio: `data:${audioMime || "audio/webm"};base64,${audioBase64}` },
          ...(promptText ? [{ text: promptText }] : []),
        ],
      },
    ];
    return messages;
  }

  async function readRequestJson(init) {
    if (!init?.body) return {};
    if (typeof init.body === "string") {
      return JSON.parse(init.body || "{}");
    }
    if (init.body instanceof Blob) {
      return JSON.parse(await init.body.text());
    }
    return init.body;
  }

  function parseQuery(url) {
    return new URL(url, window.location.href);
  }

  async function fileToBase64(file) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const parts = result.split(",", 2);
        if (parts.length !== 2) {
          reject(new Error("文件编码失败。"));
          return;
        }
        resolve(parts[1]);
      };
      reader.onerror = () => reject(new Error("文件读取失败。"));
      reader.readAsDataURL(file);
    });
  }

  async function handleUpload(init, assets) {
    const form = init?.body;
    if (!(form instanceof FormData)) {
      return buildErrorResponse(400, "上传请求格式不正确。");
    }

    const uploadedDocuments = [];
    const images = [];
    const audios = [];
    const skipped = [];
    const files = form.getAll("files");

    for (const item of files) {
      if (!(item instanceof File)) continue;
      const name = item.name || "未命名文件";
      const mime = item.type || "";
      const lowerName = name.toLowerCase();

      if (mime.startsWith("image/")) {
        const base64 = await fileToBase64(item);
        images.push({
          name,
          image_base64: base64,
          image_mime: mime || "image/jpeg",
        });
        continue;
      }

      if (mime.startsWith("audio/") || /\.(webm|wav|mp3|m4a|aac|ogg)$/i.test(lowerName)) {
        if (item.size > MAX_AUDIO_BYTES) {
          skipped.push({ name, reason: "音频超过 10MB 上限" });
          continue;
        }
        const base64 = await fileToBase64(item);
        audios.push({
          name,
          audio_base64: base64,
          audio_mime: mime || "audio/webm",
        });
        continue;
      }

      if (/\.(pdf|docx)$/i.test(lowerName)) {
        skipped.push({
          name,
          reason: "手机轻后端暂不支持新增 PDF / DOCX 入库，请继续使用内置资料库、图片或语音分析",
        });
        continue;
      }

      skipped.push({ name, reason: "当前文件类型不受支持" });
    }

    return buildResponse({
      session_id: String(form.get("session_id") || ""),
      uploaded_documents: uploadedDocuments,
      documents: getEmbeddedDocuments(assets),
      images,
      audios,
      skipped,
      doc_count: getEmbeddedDocuments(assets).length,
    });
  }

  async function handleUploadLite(init, state, assets) {
    const form = init?.body;
    if (!(form instanceof FormData)) {
      return buildErrorResponse(400, "上传请求格式不正确。");
    }

    const sessionId = String(form.get("session_id") || createId("session"));
    const session = ensureSession(state, sessionId);
    const uploadedDocuments = [];
    const images = [];
    const audios = [];
    const skipped = [];
    const files = form.getAll("files");
    const initialDocumentCount = state.documents.length;
    const initialChunkCount = state.document_chunks.length;
    let sourceNumber = nextSessionSourceNumber(state, sessionId);
    let documentOrder = nextSessionDocumentOrder(state, sessionId);

    for (const item of files) {
      if (!(item instanceof File)) continue;
      const name = item.name || "未命名文件";
      const mime = item.type || "";
      const lowerName = name.toLowerCase();

      if (mime.startsWith("image/")) {
        const base64 = await fileToBase64(item);
        images.push({
          name,
          image_base64: base64,
          image_mime: mime || "image/jpeg",
        });
        continue;
      }

      if (mime.startsWith("audio/") || /\.(webm|wav|mp3|m4a|aac|ogg)$/i.test(lowerName)) {
        if (item.size > MAX_AUDIO_BYTES) {
          skipped.push({ name, reason: "音频超过 10MB 上限" });
          continue;
        }
        const base64 = await fileToBase64(item);
        audios.push({
          name,
          audio_base64: base64,
          audio_mime: mime || "audio/webm",
        });
        continue;
      }

      if (/\.pdf$/i.test(lowerName)) {
        try {
          const text = await extractPdfText(item);
          const chunks = chunkDocumentText(text);
          if (!chunks.length) {
            skipped.push({ name, reason: "PDF 中未识别到可入库文本" });
            continue;
          }

          const documentId = createId("doc");
          const sourceLabel = `[Source ${sourceNumber}]`;
          const createdAt = nowIso();
          const documentRecord = {
            id: documentId,
            session_id: sessionId,
            name,
            original_name: name,
            char_count: text.length,
            chars: text.length,
            source_label: sourceLabel,
            created_at: createdAt,
            is_external: false,
            doc_order: documentOrder,
          };

          state.documents.push(documentRecord);
          chunks.forEach((chunkText, chunkIndex) => {
            state.document_chunks.push({
              id: createId("chunk"),
              session_id: sessionId,
              document_id: documentId,
              chunk_index: chunkIndex,
              chunk_text: chunkText,
              source_label: sourceLabel,
              original_name: name,
              is_external: false,
            });
          });

          uploadedDocuments.push(documentRecord);
          sourceNumber += 1;
          documentOrder += 1;
        } catch (error) {
          skipped.push({ name, reason: String(error?.message || "PDF 解析失败") });
        }
        continue;
      }

      if (/\.docx$/i.test(lowerName)) {
        skipped.push({
          name,
          reason: "手机轻后端当前先支持 PDF 入库，DOCX 解析将在后续补上",
        });
        continue;
      }

      skipped.push({ name, reason: "当前文件类型暂不支持" });
    }

    session.updated_at = nowIso();
    try {
      saveState(state);
    } catch (error) {
      state.documents.length = initialDocumentCount;
      state.document_chunks.length = initialChunkCount;
      return buildErrorResponse(507, "手机本地存储空间不足，请先清理部分资料后再上传 PDF");
    }

    return buildResponse({
      session_id: sessionId,
      uploaded_documents: uploadedDocuments,
      documents: listSessionDocuments(state, sessionId, assets),
      images,
      audios,
      skipped,
      doc_count: listSessionDocuments(state, sessionId, assets).length,
    });
  }

  async function handleChat(init, runtime, state, assets) {
    const payload = await readRequestJson(init);
    const sessionId = String(payload.session_id || createId("session"));
    const messageText = String(payload.message || "");
    const imageBase64 = payload.image_base64 || payload.image_b64 || "";
    const imageMime = String(payload.image_mime || "image/jpeg");
    const audioBase64 = payload.audio_base64 || "";
    const audioMime = String(payload.audio_mime || "audio/webm");
    const externalLabContext = payload.external_lab_context || null;
    const apiKey = String(runtime?.modelApiKey || getStoredModelApiKey() || "").trim();

    if (!apiKey) {
      return buildErrorResponse(400, "尚未设置 DashScope API Key，请在侧边栏“轻后端模型”中先完成配置。");
    }
    if (!String(messageText).trim() && !imageBase64 && !audioBase64) {
      return buildErrorResponse(400, "消息不能为空。");
    }

    const session = ensureSession(state, sessionId);
    const inputMode = audioBase64 ? "audio" : imageBase64 ? "image" : "text";
    const historySnapshot = listModelMessages(state, sessionId);
    const userMessage = createMessage(
      state,
      sessionId,
      "user",
      buildUserDisplayContent(messageText, inputMode, externalLabContext),
      { input_mode: inputMode, status: "done" },
    );
    autoTitleSession(session, messageText);

    try {
      let answer = "";
      let modelUsed = TEXT_MODEL;

      if (audioBase64) {
        const messages = buildAudioMessages(historySnapshot, state, assets, sessionId, messageText, audioBase64, audioMime, externalLabContext);
        answer = await callAudioModel(apiKey, messages);
        modelUsed = AUDIO_MODEL;
      } else if (imageBase64) {
        const messages = buildImageMessages(historySnapshot, state, assets, sessionId, messageText, imageBase64, imageMime, externalLabContext);
        answer = await callTextOrVisionModel(apiKey, messages, VISION_MODEL);
        modelUsed = VISION_MODEL;
      } else {
        const messages = buildTextMessages(historySnapshot, state, assets, sessionId, messageText, externalLabContext);
        answer = await callTextOrVisionModel(apiKey, messages, TEXT_MODEL);
        modelUsed = TEXT_MODEL;
      }

      const assistantMessage = createMessage(
        state,
        sessionId,
        "assistant",
        answer || "模型未返回可用结果",
        {
          input_mode: inputMode,
          model_used: modelUsed,
          status: "done",
        },
      );
      session.last_model = modelUsed;
      session.updated_at = nowIso();
      saveState(state);

      return buildResponse({
        answer: answer || "模型未返回可用结果",
        model: modelUsed,
        session_id: sessionId,
        assistant_message_id: assistantMessage.id,
        user_message_id: userMessage.id,
        doc_count: listSessionDocuments(state, sessionId, assets).length,
      });
    } catch (error) {
      createMessage(
        state,
        sessionId,
        "assistant",
        "上次回复已中断",
        {
          input_mode,
          status: "error",
          error_message: String(error?.message || "轻后端请求失败"),
        },
      );
      saveState(state);
      return buildErrorResponse(500, String(error?.message || "轻后端请求失败"));
    }
  }

  async function handleRequest({ input, init = {}, runtime = {} }) {
    const requestUrl = typeof input === "string" ? input : input?.url || "";
    const url = parseQuery(requestUrl);
    const path = url.pathname;
    const method = String(init.method || (typeof input === "string" ? "GET" : input?.method) || "GET").toUpperCase();
    const assets = await ensureAssets();
    const state = loadState();

    try {
      if (path === "/api/session" && method === "GET") {
        const sessionId = url.searchParams.get("session_id") || createId("session");
        const session = ensureSession(state, sessionId);
        saveState(state);
        return buildResponse({
          session_id: session.session_id,
          title: session.title || DEFAULT_SESSION_TITLE,
          folder_id: session.folder_id || null,
          folder_name: session.folder_id ? findFolder(state, session.folder_id)?.name || "" : "",
          messages: cloneJson(state.messages[sessionId] || []),
          documents: listSessionDocuments(state, sessionId, assets),
          doc_count: listSessionDocuments(state, sessionId, assets).length,
          last_model: session.last_model || TEXT_MODEL,
        });
      }

      if (path === "/api/sessions" && method === "GET") {
        return buildResponse({
          folders: listFoldersPayload(state),
          sessions: listSessionsPayload(state, assets),
        });
      }

      if (path === "/api/sessions" && method === "POST") {
        const payload = await readRequestJson(init);
        const sessionId = createId("session");
        const session = ensureSession(state, sessionId, {
          title: String(payload.title || DEFAULT_SESSION_TITLE).trim() || DEFAULT_SESSION_TITLE,
          folderId: payload.folder_id ?? null,
        });
        saveState(state);
        return buildResponse({ session_id: session.session_id });
      }

      if (path === "/api/phet/catalog" && method === "GET") {
        return buildResponse(cloneJson(assets.phetCatalog));
      }

      if (path === "/api/chat" && method === "POST") {
        return await handleChat(init, runtime, state, assets);
      }

      if (path === "/api/upload" && method === "POST") {
        return await handleUploadLite(init, state, assets);
      }

      if (path === "/api/clear-docs" && method === "DELETE") {
        const sessionId = url.searchParams.get("session_id") || "";
        if (sessionId) {
          clearSessionDocuments(state, sessionId);
          const session = ensureSession(state, sessionId);
          session.updated_at = nowIso();
          saveState(state);
        }
        return buildResponse({
          ok: true,
          doc_count: listSessionDocuments(state, sessionId, assets).length,
          documents: listSessionDocuments(state, sessionId, assets),
        });
      }

      if (path === "/api/clear-history" && method === "POST") {
        const sessionId = url.searchParams.get("session_id") || "";
        if (!sessionId) {
          return buildErrorResponse(400, "缺少 session_id。");
        }
        state.messages[sessionId] = [];
        const session = ensureSession(state, sessionId);
        session.updated_at = nowIso();
        saveState(state);
        return buildResponse({ ok: true, message_count: 0 });
      }

      if (path === "/api/folders" && method === "POST") {
        const payload = await readRequestJson(init);
        const cleanName = ensureFolderNameAvailable(state, payload.name);
        const now = nowIso();
        const folder = {
          id: createId("folder"),
          name: cleanName,
          created_at: now,
          updated_at: now,
        };
        state.folders.push(folder);
        saveState(state);
        return buildResponse({ id: folder.id, name: folder.name });
      }

      if (path.startsWith("/api/folders/") && method === "PATCH") {
        const folderId = decodeURIComponent(path.split("/").pop() || "");
        const folder = findFolder(state, folderId);
        if (!folder) return buildErrorResponse(404, "项目不存在。");
        const payload = await readRequestJson(init);
        folder.name = ensureFolderNameAvailable(state, payload.name, folderId);
        folder.updated_at = nowIso();
        saveState(state);
        return buildResponse({ id: folder.id, name: folder.name });
      }

      if (path.startsWith("/api/folders/") && method === "DELETE") {
        const folderId = decodeURIComponent(path.split("/").pop() || "");
        state.folders = state.folders.filter((item) => item.id !== folderId);
        state.sessions.forEach((session) => {
          if (session.folder_id === folderId) {
            session.folder_id = null;
            session.updated_at = nowIso();
          }
        });
        saveState(state);
        return buildResponse({ ok: true, id: folderId });
      }

      if (path.startsWith("/api/sessions/") && method === "PATCH") {
        const sessionId = decodeURIComponent(path.split("/").pop() || "");
        const session = state.sessions.find((item) => item.session_id === sessionId);
        if (!session) return buildErrorResponse(404, "对话不存在。");
        const payload = await readRequestJson(init);
        if (Object.prototype.hasOwnProperty.call(payload, "title")) {
          session.title = String(payload.title || "").trim() || DEFAULT_SESSION_TITLE;
        }
        if (Object.prototype.hasOwnProperty.call(payload, "folder_id")) {
          session.folder_id = payload.folder_id || null;
        }
        session.updated_at = nowIso();
        saveState(state);
        return buildResponse({
          session_id: session.session_id,
          title: session.title,
          folder_id: session.folder_id,
          folder_name: session.folder_id ? findFolder(state, session.folder_id)?.name || "" : "",
        });
      }

      if (path.startsWith("/api/sessions/") && method === "DELETE") {
        const sessionId = decodeURIComponent(path.split("/").pop() || "");
        state.sessions = state.sessions.filter((item) => item.session_id !== sessionId);
        delete state.messages[sessionId];
        clearSessionDocuments(state, sessionId);
        saveState(state);
        return buildResponse({ ok: true, session_id: sessionId });
      }

      if (path === "/api/health" && method === "GET") {
        return buildResponse({
          ok: true,
          service: "physics-agent-lite",
          embedded_docs: getEmbeddedDocuments(assets).length,
          uploaded_docs: Array.isArray(state.documents) ? state.documents.length : 0,
          phet_total: Number(assets?.phetCatalog?.total || 0),
        });
      }

      return buildErrorResponse(404, `轻后端暂未实现接口：${method} ${path}`);
    } catch (error) {
      return buildErrorResponse(500, String(error?.message || "轻后端内部错误"));
    }
  }

  window.PhysicsAgentLiteBackend = {
    MODEL_API_KEY_STORAGE_KEY,
    async handleRequest(args) {
      return await handleRequest(args);
    },
    async preload() {
      return await ensureAssets();
    },
  };
})();

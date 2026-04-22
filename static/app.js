
(() => {
  "use strict";

  const TWO_PI = Math.PI * 2;

  const experiments = [
    { id: "michelson", name: "迈克尔逊干涉仪测定激光波长" },
    { id: "newton-rings", name: "光的等厚干涉——牛顿环实验" },
    { id: "wheatstone-bridge", name: "用惠斯通电桥测电阻" },
    { id: "double-arm-bridge", name: "双臂电桥测量低电阻" },
    { id: "oscilloscope", name: "数字示波器的调整和使用" },
    { id: "torsion-pendulum", name: "扭摆法测量物体的转动惯量" },
    { id: "dielectric-constant", name: "电介质电容率的测量" },
    { id: "spectrometer-prism", name: "分光计调节和棱镜顶角的测定" },
    { id: "franck-hertz", name: "弗兰克-赫兹实验" },
    { id: "bohr-resonance", name: "波尔共振仪研究受迫振动" },
    { id: "grating-spectrum", name: "光栅原子光谱的定性研究" },
  ];

  const experimentMap = new Map(experiments.map((exp) => [exp.id, exp]));
  const implementedSimulationIds = new Set(["michelson", "newton-rings", "bohr-resonance", "spectrometer-prism", "torsion-pendulum", "wheatstone-bridge"]);

  const APP = {
    sessionId: getOrCreateSessionId(),
    pendingImage: null,
    pendingAudio: null,
    history: loadHistory(),
    sessionCatalog: { folders: [], sessions: [] },
    sending: false,
    mediaRecorder: null,
    recordingTimer: null,
    isHydrating: true,
    currentSessionTitle: "新对话",
    folderOpenMap: loadFolderOpenMap(),
    quickJumpItems: [],
    quickJumpActiveId: null,
    openMenuId: null,
    dragSessionId: null,
    phet: {
      isOpen: false,
      loading: false,
      error: "",
      updatedAt: "",
      total: 0,
      groups: [],
      activeTopic: "all",
      selectedSlug: "",
      frameReady: false,
      frameTimeoutId: 0,
      captureNoticeShown: false,
    },
  };

  const SIM = {
    currentExpId: "michelson",
    isOpen: false,
    canvasCssW: 0,
    canvasCssH: 0,
    timeSec: 0,
    lastFrameMs: 0,
    motion: "stable",
    lastControlAction: { expId: "", key: "", direction: 0 },
    params: {
      michelson: {
        lambdaNm: 632.8,
        displacementUm: 0,
        dBaseUm: 58,
        dAnimatedUm: 58,
      },
      "newton-rings": {
        lambdaNm: 546.1,
        curvatureMm: 1000,
      },
      "wheatstone-bridge": {
        ratio: 1,
        rsDigits: {
          d1000: 2,
          d100: 4,
          d10: 5,
          d1: 0,
        },
        rsOhm: 2450,
        rxOhm: randomWheatstoneUnknownRx(),
        supplyV: 3,
        switchPressed: false,
        deltaV: 0,
        needleAngleDeg: 0,
        targetNeedleDeg: 0,
        galvanometerMaxDeg: 34,
        galvanometerGainDegPerV: 120,
      },
      "bohr-resonance": {
        freqHz: 1.5,
        damping: 0.22,
        drive: 1.0,
        inertia: 1.0,
        naturalFreqHz: 1.5,
      },
      "spectrometer-prism": {
        prismAngleDeg: 60,
        telescopeDeg: 120,
        theta1Deg: null,
        theta2Deg: null,
        lastAlignedIndex: -1,
      },
      "torsion-pendulum": {
        objectKey: "empty-disk",
        theta0Deg: 32,
        currentThetaDeg: 32,
        prevThetaDeg: 32,
        simTimeSec: 0,
        isOscillating: true,
        damping: 0.015,
        torsionK: 0.12,
        diskInertia: 0.0064,
        knownInertia: 0.0088,
        objectInertia: {
          "empty-disk": 0,
          "standard-cylinder": 0.0088,
          "unknown-cylinder": 0.0126,
        },
        stopwatch: {
          running: false,
          startMs: 0,
          elapsedMs: 0,
          cycleCount: 0,
          targetCycles: 10,
        },
        measurements: {
          "empty-disk": null,
          "standard-cylinder": null,
          "unknown-cylinder": null,
        },
      },
    },
  };

  const els = {
    fileInput: document.getElementById("fileInput"),
    uploadDropzone: document.getElementById("uploadDropzone"),
    uploadStatus: document.getElementById("uploadStatus"),
    uploadedFiles: document.getElementById("uploadedFiles"),
    clearDocsBtn: document.getElementById("clearDocsBtn"),
    pendingImageBar: document.getElementById("pendingImageBar"),
    pendingImageText: document.getElementById("pendingImageText"),
    clearPendingImageBtn: document.getElementById("clearPendingImageBtn"),
    pendingAudioBar: document.getElementById("pendingAudioBar"),
    pendingAudioText: document.getElementById("pendingAudioText"),
    clearPendingAudioBtn: document.getElementById("clearPendingAudioBtn"),

    historyList: document.getElementById("historyList"),
    clearHistoryBtn: document.getElementById("clearHistoryBtn"),
    newConversationBtn: document.getElementById("newConversationBtn"),
    newFolderBtn: document.getElementById("newFolderBtn"),

    chatMessages: document.getElementById("chatMessages"),
    chatForm: document.getElementById("chatForm"),
    chatInput: document.getElementById("chatInput"),
    sendBtn: document.getElementById("sendBtn"),
    recordBtn: document.getElementById("recordBtn"),
    modelBadge: document.getElementById("modelBadge"),

    openLabMenuBtn: document.getElementById("openLabMenuBtn"),
    closeLabMenuBtn: document.getElementById("closeLabMenuBtn"),
    labMenuPanel: document.getElementById("labMenuPanel"),
    experimentLibraryContainer: document.getElementById("experimentLibraryContainer"),
    togglePhetWorkspaceBtn: document.getElementById("togglePhetWorkspaceBtn"),
    closePhetWorkspaceBtn: document.getElementById("closePhetWorkspaceBtn"),
    contentShell: document.getElementById("contentShell"),
    phetWorkspace: document.getElementById("phetWorkspace"),
    phetCatalogMeta: document.getElementById("phetCatalogMeta"),
    phetTopicTabs: document.getElementById("phetTopicTabs"),
    phetCatalogList: document.getElementById("phetCatalogList"),
    phetEmptyState: document.getElementById("phetEmptyState"),
    phetDetailContent: document.getElementById("phetDetailContent"),
    phetDetailTitle: document.getElementById("phetDetailTitle"),
    phetLanguageBadge: document.getElementById("phetLanguageBadge"),
    phetDetailMeta: document.getElementById("phetDetailMeta"),
    phetOpenNewWindowLink: document.getElementById("phetOpenNewWindowLink"),
    phetFrameNotice: document.getElementById("phetFrameNotice"),
    phetFrameLoading: document.getElementById("phetFrameLoading"),
    phetFrame: document.getElementById("phetFrame"),
    phetIntroText: document.getElementById("phetIntroText"),
    phetObservationList: document.getElementById("phetObservationList"),
    phetQuestionHintList: document.getElementById("phetQuestionHintList"),
    phetInterfaceGuidanceList: document.getElementById("phetInterfaceGuidanceList"),
    phetQuestionInput: document.getElementById("phetQuestionInput"),
    phetAskBtn: document.getElementById("phetAskBtn"),

    simulationModal: document.getElementById("simulationModal"),
    closeSimulationBtn: document.getElementById("closeSimulationBtn"),
    simulationCanvas: document.getElementById("simulationCanvas"),
    simulationModalTitle: document.getElementById("simulationModalTitle"),
    simulationModalSubtitle: document.querySelector("#simulationModal .modal-header p"),
    simReadout: document.getElementById("simReadout"),
    simLambdaRange: document.getElementById("simLambdaRange"),
    simLambdaLabel: document.querySelector('label[for="simLambdaRange"]'),
    simLambdaValue: document.getElementById("simLambdaValue"),
    simDisplacementRange: document.getElementById("simDisplacementRange"),
    simDisplacementLabel: document.querySelector('label[for="simDisplacementRange"]'),
    simDisplacementValue: document.getElementById("simDisplacementValue"),
    simColorName: document.getElementById("simColorName"),
    simColorLabel: document.querySelector("#simColorName")?.previousElementSibling,
    simOpdValue: document.getElementById("simOpdValue"),
    simOpdLabel: document.querySelector("#simOpdValue")?.previousElementSibling,
    simFringeCount: document.getElementById("simFringeCount"),
    simFringeLabel: document.querySelector("#simFringeCount")?.previousElementSibling,
    invokeAgentFromSimBtn: document.getElementById("invokeAgentFromSimBtn"),

    toastRoot: document.getElementById("toastRoot"),
    quickJumpPanel: document.getElementById("quickJumpPanel"),
    quickJumpList: document.getElementById("quickJumpList"),
  };

  if (!els.chatForm || !els.chatInput || !els.experimentLibraryContainer || !els.simulationCanvas) {
    return;
  }

  const simCtx = els.simulationCanvas.getContext("2d", { alpha: false, desynchronized: true });
  if (!simCtx) return;

  if (window.marked?.setOptions) {
    marked.setOptions({ gfm: true, breaks: true });
  }

  renderExperimentLibrary();
  renderPhetWorkspace();
  bindEvents();
  renderHistory();
  updatePendingAttachmentBars();
  configureSimulationUI("michelson");
  ensureSimulationCanvasSize();
  startSimulationLoop();
  hydrateSession().catch((error) => {
    APP.isHydrating = false;
    loadSessionCatalog().catch(() => {});
    showToast(`浼氳瘽鎭㈠澶辫触锛?{error.message}`);
    return;
    appendAgentMessage(
      "欢迎使用多模态物理实验教学 Agent。\n\n点击左侧【🧲 物理实验库】可快速选择 11 个经典实验。当前已支持仿真：迈克尔逊干涉、牛顿环、惠斯通电桥、波尔共振、分光计调节与棱镜顶角、扭摆法转动惯量。"
    );
    showToast(`会话恢复失败：${error.message}`);
  });

  function bindEvents() {
    els.chatForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = els.chatInput.value.trim();
      if (!text && !APP.pendingImage && !APP.pendingAudio) return;
      sendMessage(text);
    });

    els.chatInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        els.chatForm.requestSubmit();
      }
    });

    els.chatInput.addEventListener("input", () => {
      autoResizeTextarea(els.chatInput);
    });

    els.fileInput?.addEventListener("change", async (event) => {
      const files = Array.from(event.target.files || []);
      if (!files.length) return;
      await uploadFiles(files);
      els.fileInput.value = "";
    });

    ["dragenter", "dragover"].forEach((name) => {
      els.uploadDropzone?.addEventListener(name, (event) => {
        event.preventDefault();
        event.stopPropagation();
        els.uploadDropzone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach((name) => {
      els.uploadDropzone?.addEventListener(name, (event) => {
        event.preventDefault();
        event.stopPropagation();
        els.uploadDropzone.classList.remove("dragover");
      });
    });

    els.uploadDropzone?.addEventListener("drop", async (event) => {
      const files = Array.from(event.dataTransfer?.files || []);
      if (!files.length) return;
      await uploadFiles(files);
    });

    els.clearPendingImageBtn?.addEventListener("click", () => {
      APP.pendingImage = null;
      updatePendingAttachmentBars();
    });

    els.clearPendingAudioBtn?.addEventListener("click", () => {
      APP.pendingAudio = null;
      updatePendingAttachmentBars();
    });

    els.clearDocsBtn?.addEventListener("click", async () => {
      await clearDocuments();
    });

    els.clearHistoryBtn?.addEventListener("click", async () => {
      await clearConversationHistory();
    });

    els.newConversationBtn?.addEventListener("click", async () => {
      await startNewConversation();
    });

    els.newFolderBtn?.addEventListener("click", async () => {
      await createFolderInteractive();
    });

    els.togglePhetWorkspaceBtn?.addEventListener("click", async () => {
      if (APP.phet.isOpen) {
        closePhetWorkspace();
        return;
      }
      await openPhetWorkspace();
    });

    els.closePhetWorkspaceBtn?.addEventListener("click", () => {
      closePhetWorkspace();
    });

    els.phetTopicTabs?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-topic-key]");
      if (!button) return;
      APP.phet.activeTopic = button.getAttribute("data-topic-key") || "all";
      ensurePhetSelection();
      renderPhetTopicTabs();
      renderPhetCatalog();
      renderPhetDetail();
    });

    els.phetCatalogList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-phet-slug]");
      if (!button) return;
      const slug = button.getAttribute("data-phet-slug");
      if (!slug) return;
      APP.phet.selectedSlug = slug;
      renderPhetCatalog();
      renderPhetDetail();
    });

    els.phetQuestionHintList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-suggestion]");
      if (!button || !els.phetQuestionInput) return;
      els.phetQuestionInput.value = button.getAttribute("data-suggestion") || "";
      autoResizeTextarea(els.phetQuestionInput);
      els.phetQuestionInput.focus();
    });

    els.phetAskBtn?.addEventListener("click", async () => {
      await askFromPhetWorkspace();
    });

    els.phetQuestionInput?.addEventListener("keydown", async (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        await askFromPhetWorkspace();
      }
    });

    els.phetQuestionInput?.addEventListener("input", () => {
      autoResizeTextarea(els.phetQuestionInput);
    });

    els.phetFrame?.addEventListener("load", () => {
      APP.phet.frameReady = true;
      clearTimeout(APP.phet.frameTimeoutId);
      APP.phet.frameTimeoutId = 0;
      els.phetFrameLoading?.classList.add("hidden");
      els.phetFrameNotice?.classList.add("hidden");
    });

    els.recordBtn?.addEventListener("click", async () => {
      if (APP.mediaRecorder?.state === "recording") {
        stopRecording();
        return;
      }
      await startRecording();
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".session-tree")) {
        closeFloatingMenus();
      }
    });

    els.historyList?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action]");
      if (button) {
        event.stopPropagation();
        const action = button.getAttribute("data-action");
        const sessionId = button.getAttribute("data-session-id");
        const folderId = button.getAttribute("data-folder-id");

        if (action === "toggle-folder" && folderId) {
          APP.folderOpenMap[folderId] = !APP.folderOpenMap[folderId];
          saveFolderOpenMap(APP.folderOpenMap);
          renderHistory();
          return;
        }
        if (action === "toggle-folder-menu" && folderId) {
          toggleFloatingMenu(`folder:${folderId}`);
          return;
        }
        if (action === "toggle-session-menu" && sessionId) {
          toggleFloatingMenu(`session:${sessionId}`);
          return;
        }
        if (action === "rename-folder" && folderId) {
          closeFloatingMenus();
          await renameFolderInteractive(folderId);
          return;
        }
        if (action === "new-session-in-folder" && folderId) {
          closeFloatingMenus();
          await createProjectConversation(folderId);
          return;
        }
        if (action === "delete-folder" && folderId) {
          closeFloatingMenus();
          await deleteFolderInteractive(folderId);
          return;
        }
        if (action === "rename-session" && sessionId) {
          closeFloatingMenus();
          await renameSessionInteractive(sessionId);
          return;
        }
        if (action === "move-session-picker" && sessionId) {
          closeFloatingMenus();
          await moveSessionInteractive(sessionId);
          return;
        }
        if (action === "move-session-root" && sessionId) {
          closeFloatingMenus();
          await moveSessionToFolder(sessionId, null);
          return;
        }
        if (action === "delete-session" && sessionId) {
          closeFloatingMenus();
          await deleteSessionInteractive(sessionId);
          return;
        }
      }

      const sessionRow = event.target.closest("[data-session-id].session-row");
      if (sessionRow) {
        const sessionId = sessionRow.getAttribute("data-session-id");
        if (sessionId && sessionId !== APP.sessionId) {
          await switchConversation(sessionId);
        }
      }
    });

    els.historyList?.addEventListener("dragstart", (event) => {
      const sessionRow = event.target.closest("[data-session-id].session-row");
      if (!sessionRow) return;
      const sessionId = sessionRow.getAttribute("data-session-id");
      if (!sessionId) return;
      APP.dragSessionId = sessionId;
      closeFloatingMenus();
      sessionRow.classList.add("dragging");
      event.dataTransfer?.setData("text/plain", sessionId);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
      }
    });

    els.historyList?.addEventListener("dragend", () => {
      APP.dragSessionId = null;
      clearDropTargets();
      els.historyList.querySelectorAll(".session-row.dragging").forEach((node) => {
        node.classList.remove("dragging");
      });
    });

    els.historyList?.addEventListener("dragover", (event) => {
      const dropZone = event.target.closest("[data-drop-folder]");
      if (!dropZone || !APP.dragSessionId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      clearDropTargets();
      dropZone.classList.add("drag-over");
    });

    els.historyList?.addEventListener("drop", async (event) => {
      const dropZone = event.target.closest("[data-drop-folder]");
      const sessionId = APP.dragSessionId || event.dataTransfer?.getData("text/plain");
      clearDropTargets();
      if (!dropZone || !sessionId) return;
      event.preventDefault();
      APP.dragSessionId = null;
      const folderId = dropZone.getAttribute("data-drop-folder");
      await moveSessionToFolder(sessionId, folderId === "root" ? null : folderId);
    });

    els.historyList?.addEventListener("scroll", () => {
      syncOpenMenuPlacement();
    });

    els.quickJumpList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-target-id]");
      if (!button) return;
      const targetId = button.getAttribute("data-target-id");
      const target = targetId ? document.getElementById(targetId) : null;
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    els.chatMessages?.addEventListener("scroll", () => {
      updateQuickJumpActive();
    });

    els.openLabMenuBtn?.addEventListener("click", () => {
      const willOpen = els.labMenuPanel.classList.contains("hidden");
      els.labMenuPanel.classList.toggle("hidden");
      els.openLabMenuBtn.setAttribute("aria-expanded", String(willOpen));
    });

    els.closeLabMenuBtn?.addEventListener("click", () => {
      els.labMenuPanel.classList.add("hidden");
      els.openLabMenuBtn.setAttribute("aria-expanded", "false");
    });

    els.experimentLibraryContainer.addEventListener("click", (event) => {
      const actionBtn = event.target.closest("button[data-action]");
      if (!actionBtn) return;

      const expCard = actionBtn.closest("[data-exp-id]");
      if (!expCard) return;

      const expId = expCard.getAttribute("data-exp-id");
      const experiment = experimentMap.get(expId);
      if (!experiment) return;

      const action = actionBtn.getAttribute("data-action");

      if (action === "toggle") {
        toggleExperimentAccordion(expCard);
        return;
      }

      if (action === "principles") {
        const prompt = `请为我详细讲解【${experiment.name}】的实验原理、核心公式推导（请使用 LaTeX），以及实验操作的注意事项。`;
        fillAndSendPrompt(prompt);
        return;
      }

      if (action === "questions") {
        const prompt = `请生成一道关于【${experiment.name}】实验的经典思考题。请只输出题目，不要直接给出答案。`;
        fillAndSendPrompt(prompt);
        return;
      }

      if (action === "simulate") {
        if (implementedSimulationIds.has(expId)) {
          openSimulationModal(expId);
        } else {
          openSimulationPlaceholder(experiment);
        }
      }
    });

    els.closeSimulationBtn?.addEventListener("click", closeSimulationModal);
    els.simulationModal?.addEventListener("click", (event) => {
      if (event.target === els.simulationModal) {
        closeSimulationModal();
      }
    });

    els.simLambdaRange?.addEventListener("input", (event) => {
      onSimulationSliderInput(1, Number.parseFloat(event.target.value));
    });

    els.simLambdaRange?.addEventListener("change", () => {
      if (SIM.currentExpId === "torsion-pendulum") {
        releaseTorsionOscillation();
      }
    });

    els.simDisplacementRange?.addEventListener("input", (event) => {
      onSimulationSliderInput(2, Number.parseFloat(event.target.value));
    });

    els.invokeAgentFromSimBtn?.addEventListener("click", () => {
      const prompt = buildSimulationPrompt(SIM.currentExpId);
      closeSimulationModal();
      fillAndSendPrompt(prompt);
    });

    window.addEventListener("resize", () => {
      ensureSimulationCanvasSize();
      syncOpenMenuPlacement();
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && APP.phet.isOpen && !SIM.isOpen) {
        closePhetWorkspace();
      }
    });
  }

  async function clearConversationHistory() {
    try {
      await fetch(`/api/clear-history?session_id=${encodeURIComponent(APP.sessionId)}`, { method: "POST" });
      APP.history = [];
      saveHistory(APP.history);
      renderHistory();
      els.chatMessages.innerHTML = "";
      refreshQuickJumpPanel();
      await loadSessionCatalog();
      return;
      appendAgentMessage(
        "欢迎使用多模态物理实验教学 Agent。\n\n点击左侧【🧲 物理实验库】可快速选择 11 个经典实验。当前已支持仿真：迈克尔逊干涉、牛顿环、惠斯通电桥、波尔共振、分光计调节与棱镜顶角、扭摆法转动惯量。"
      );
      await loadSessionCatalog();
    } catch (error) {
      showToast(`清空历史失败：${error.message}`);
    }
  }

  async function startNewConversation() {
    closeFloatingMenus();
    setCurrentSessionId(generateSessionId());
    APP.currentSessionTitle = "新对话";
    APP.pendingImage = null;
    APP.pendingAudio = null;
    APP.history = [];
    updatePendingAttachmentBars();
    renderUploadedFileList([]);
    setUploadStatus("未上传文件");
    renderConversation([]);
    await loadSessionCatalog();
    els.chatInput.focus();
    return;
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "新对话" }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      await switchConversation(data.session_id, { isNew: true });
    } catch (error) {
      showToast(`创建新对话失败：${error.message}`);
    }
  }

  async function createProjectConversation(folderId) {
    if (!folderId) return;
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "新对话", folder_id: folderId }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      const data = await response.json();
      await switchConversation(data.session_id, { isNew: true });
      APP.folderOpenMap[folderId] = true;
      saveFolderOpenMap(APP.folderOpenMap);
      await loadSessionCatalog();
    } catch (error) {
      showToast(`项目内新建对话失败：${error.message}`);
    }
  }

  async function switchConversation(sessionId, { isNew = false } = {}) {
    closeFloatingMenus();
    setCurrentSessionId(sessionId);
    APP.pendingImage = null;
    APP.pendingAudio = null;
    updatePendingAttachmentBars();
    els.chatMessages.innerHTML = "";
    refreshQuickJumpPanel();
    await hydrateSession();
    if (isNew) {
      els.chatInput.focus();
    }
  }

  async function loadSessionCatalog() {
    const response = await fetch("/api/sessions");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    APP.sessionCatalog = {
      folders: Array.isArray(data.folders) ? data.folders : [],
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
    };
    APP.openMenuId = null;
    renderHistory();
  }

  async function openPhetWorkspace() {
    APP.phet.isOpen = true;
    renderPhetWorkspace();
    refreshQuickJumpPanel();
    if (!APP.phet.groups.length) {
      await loadPhetCatalog();
    } else {
      ensurePhetSelection();
      renderPhetCatalog();
      renderPhetDetail();
    }
  }

  function closePhetWorkspace() {
    APP.phet.isOpen = false;
    clearTimeout(APP.phet.frameTimeoutId);
    APP.phet.frameTimeoutId = 0;
    renderPhetWorkspace();
    refreshQuickJumpPanel();
  }

  async function loadPhetCatalog() {
    APP.phet.loading = true;
    APP.phet.error = "";
    renderPhetWorkspace();
    renderPhetCatalog();
    try {
      const response = await fetch("/api/phet/catalog");
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      const data = await response.json();
      APP.phet.updatedAt = data.updated_at || "";
      APP.phet.total = Number(data.total || 0);
      APP.phet.groups = Array.isArray(data.groups) ? data.groups : [];
      APP.phet.error = "";
      ensurePhetSelection();
      renderPhetWorkspace();
      renderPhetTopicTabs();
      renderPhetCatalog();
      renderPhetDetail();
    } catch (error) {
      APP.phet.error = error.message;
      showToast(`实验目录载入失败：${error.message}`);
      renderPhetWorkspace();
      renderPhetCatalog();
      renderPhetDetail();
    } finally {
      APP.phet.loading = false;
      renderPhetWorkspace();
    }
  }

  function renderPhetWorkspace() {
    if (els.contentShell) {
      els.contentShell.classList.toggle("workspace-open", APP.phet.isOpen);
    }
    if (els.phetWorkspace) {
      els.phetWorkspace.classList.toggle("hidden", !APP.phet.isOpen);
    }
    if (els.togglePhetWorkspaceBtn) {
      els.togglePhetWorkspaceBtn.classList.toggle("active", APP.phet.isOpen);
      els.togglePhetWorkspaceBtn.setAttribute("aria-expanded", APP.phet.isOpen ? "true" : "false");
    }
    if (els.phetCatalogMeta) {
      if (APP.phet.loading) {
        els.phetCatalogMeta.textContent = "正在同步实验目录";
      } else if (APP.phet.error) {
        els.phetCatalogMeta.textContent = `目录载入失败：${APP.phet.error}`;
      } else if (APP.phet.total) {
        const stamp = APP.phet.updatedAt ? formatPhetUpdatedAt(APP.phet.updatedAt) : "刚刚";
        els.phetCatalogMeta.textContent = `共 ${APP.phet.total} 个实验 · ${stamp} 更新`;
      } else {
        els.phetCatalogMeta.textContent = "准备载入实验目录";
      }
    }
    renderPhetTopicTabs();
  }

  function renderPhetTopicTabs() {
    if (!els.phetTopicTabs) return;
    const groups = APP.phet.groups || [];
    if (!groups.length) {
      els.phetTopicTabs.innerHTML = "";
      return;
    }
    const tabs = [
      { key: "all", label: "全部" },
      ...groups.map((group) => ({
        key: group.topic_key,
        label: group.topic_label_zh || group.topic_label_en || group.topic_key,
      })),
    ];
    els.phetTopicTabs.innerHTML = tabs
      .map(
        (tab) => `
          <button
            type="button"
            class="phet-topic-tab${tab.key === APP.phet.activeTopic ? " active" : ""}"
            data-topic-key="${tab.key}"
          >
            ${escapeHtml(tab.label)}
          </button>
        `
      )
      .join("");
  }

  function getFilteredPhetGroups() {
    const activeTopic = APP.phet.activeTopic || "all";
    return (APP.phet.groups || [])
      .filter((group) => activeTopic === "all" || group.topic_key === activeTopic)
      .map((group) => ({ ...group, sims: Array.isArray(group.sims) ? group.sims : [] }))
      .filter((group) => group.sims.length);
  }

  function findPhetSimulation(slug = APP.phet.selectedSlug) {
    if (!slug) return null;
    for (const group of APP.phet.groups || []) {
      const match = (group.sims || []).find((sim) => sim.slug === slug);
      if (match) return match;
    }
    return null;
  }

  function ensurePhetSelection() {
    const filteredGroups = getFilteredPhetGroups();
    const current = findPhetSimulation(APP.phet.selectedSlug);
    const stillVisible = filteredGroups.some((group) => (group.sims || []).some((sim) => sim.slug === current?.slug));
    if (stillVisible) {
      return current;
    }
    const next = filteredGroups[0]?.sims?.[0] || null;
    APP.phet.selectedSlug = next?.slug || "";
    return next;
  }

  function renderPhetCatalog() {
    if (!els.phetCatalogList) return;
    const groups = getFilteredPhetGroups();
    if (APP.phet.loading && !groups.length) {
      els.phetCatalogList.innerHTML = `<div class="phet-empty-list">正在加载实验目录...</div>`;
      return;
    }
    if (APP.phet.error && !groups.length) {
      els.phetCatalogList.innerHTML = `<div class="phet-empty-list">实验目录暂时不可用，请稍后重试。</div>`;
      return;
    }
    if (!groups.length) {
      els.phetCatalogList.innerHTML = `<div class="phet-empty-list">当前主题下暂无可展示的实验。</div>`;
      return;
    }

    els.phetCatalogList.innerHTML = groups
      .map(
        (group) => `
          <section class="phet-group">
            <div class="phet-group-header">${escapeHtml(group.topic_label_zh || group.topic_label_en || group.topic_key)}</div>
            <div class="phet-group-list">
              ${(group.sims || [])
                .map(
                  (sim) => `
                    <button
                      type="button"
                      class="phet-sim-btn${sim.slug === APP.phet.selectedSlug ? " active" : ""}"
                      data-phet-slug="${sim.slug}"
                    >
                      <span class="phet-sim-title">${escapeHtml(sim.title_zh || sim.title_en || sim.slug)}</span>
                    </button>
                  `
                )
                .join("")}
            </div>
          </section>
        `
      )
      .join("");
  }

  function renderPhetDetail() {
    const sim = ensurePhetSelection();
    if (!els.phetEmptyState || !els.phetDetailContent) return;

    if (!sim) {
      els.phetEmptyState.classList.remove("hidden");
      els.phetDetailContent.classList.add("hidden");
      return;
    }

    els.phetEmptyState.classList.add("hidden");
    els.phetDetailContent.classList.remove("hidden");

    if (els.phetDetailTitle) {
      els.phetDetailTitle.textContent = sim.title_zh || sim.title_en || sim.slug;
    }
    if (els.phetLanguageBadge) {
      els.phetLanguageBadge.textContent = sim.has_official_zh ? "中文界面" : "英文界面（支持中文讲解）";
      els.phetLanguageBadge.classList.toggle("is-zh", Boolean(sim.has_official_zh));
      els.phetLanguageBadge.classList.toggle("is-en", !sim.has_official_zh);
    }
    if (els.phetDetailMeta) {
      els.phetDetailMeta.textContent = `${sim.topic_zh || "课外实验"} · ${sim.research_focus_zh || "适合参数分析与现象观察"}`;
    }
    if (els.phetOpenNewWindowLink) {
      els.phetOpenNewWindowLink.href = sim.embed_url || "#";
    }
    if (els.phetIntroText) {
      els.phetIntroText.textContent = sim.intro_zh || "该实验当前缺少详细概述，建议先进入仿真界面识别变量、读数与现象，再结合规律提出问题。";
    }
    if (els.phetObservationList) {
      const observationBlocks = [];
      (sim.observation_points || []).forEach((item) => observationBlocks.push(item));
      (sim.readouts_zh || []).slice(0, 2).forEach((item) => observationBlocks.push(item));
      renderTextBlocks(els.phetObservationList, observationBlocks);
    }
    if (els.phetQuestionHintList) {
      els.phetQuestionHintList.innerHTML = (sim.suggested_questions || [])
        .map(
          (item) => `
            <button type="button" class="phet-suggestion-btn" data-suggestion="${escapeAttribute(item)}">
              ${escapeHtml(item)}
            </button>
          `
        )
        .join("");
    }
    if (els.phetInterfaceGuidanceList) {
      renderGuidanceSections(els.phetInterfaceGuidanceList, sim);
    }
    if (els.phetQuestionInput) {
      els.phetQuestionInput.placeholder = `围绕“${sim.title_zh || sim.title_en || sim.slug}”继续提出分析问题`;
      autoResizeTextarea(els.phetQuestionInput);
    }

    updatePhetFrame(sim);
  }

  function phetProxyUrl(embedUrl) {
    if (!embedUrl) return "";
    const prefix = "https://phet.colorado.edu/";
    if (embedUrl.startsWith(prefix)) {
      const path = "/api/phet/proxy/" + embedUrl.slice(prefix.length);
      // preserveDrawingBuffer lets us capture the WebGL canvas via toDataURL
      return path + (path.includes("?") ? "&" : "?") + "preserveDrawingBuffer";
    }
    return embedUrl;
  }

  function updatePhetFrame(sim) {
    if (!els.phetFrame || !sim?.embed_url) return;
    const proxyUrl = phetProxyUrl(sim.embed_url);
    clearTimeout(APP.phet.frameTimeoutId);
    const currentSrc = els.phetFrame.getAttribute("src") || "";
    if (currentSrc === proxyUrl && APP.phet.frameReady) {
      els.phetFrameLoading?.classList.add("hidden");
      els.phetFrameNotice?.classList.add("hidden");
      return;
    }
    APP.phet.frameReady = false;
    els.phetFrameLoading?.classList.remove("hidden");
    els.phetFrameNotice?.classList.add("hidden");
    if (currentSrc !== proxyUrl) {
      els.phetFrame.src = proxyUrl;
    }
    APP.phet.frameTimeoutId = window.setTimeout(() => {
      if (!APP.phet.frameReady) {
        els.phetFrameLoading?.classList.add("hidden");
        els.phetFrameNotice?.classList.remove("hidden");
      }
    }, 8000);
  }

  function renderTextBlocks(container, items) {
    if (!container) return;
    const blocks = (Array.isArray(items) ? items : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    container.innerHTML = blocks.map((item) => `<div class="phet-text-block">${escapeHtml(item)}</div>`).join("");
  }

  function renderGuidanceSections(container, sim) {
    if (!container) return;
    const sections = [
      {
        title: "界面布局",
        items: sim.layout_zh ? [sim.layout_zh] : [],
      },
      {
        title: "观察流程",
        items: Array.isArray(sim.screen_flow_zh) ? sim.screen_flow_zh : [],
      },
      {
        title: "控件说明",
        items: Array.isArray(sim.controls_zh) ? sim.controls_zh : [],
      },
      {
        title: "操作效果",
        items: Array.isArray(sim.interaction_effects_zh) && sim.interaction_effects_zh.length
          ? sim.interaction_effects_zh
          : (Array.isArray(sim.effects_zh) ? sim.effects_zh : []),
      },
      {
        title: "建议步骤",
        items: Array.isArray(sim.first_steps_zh) ? sim.first_steps_zh : [],
      },
    ]
      .map((section) => ({
        ...section,
        items: (Array.isArray(section.items) ? section.items : [])
          .map((item) => String(item || "").trim())
          .filter(Boolean),
      }))
      .filter((section) => section.items.length);

    container.innerHTML = sections
      .map(
        (section) => `
          <section class="phet-guidance-section">
            <h5 class="phet-guidance-title">${escapeHtml(section.title)}</h5>
            <div class="phet-guidance-list">
              ${section.items.map((item) => `<div class="phet-guidance-item">${escapeHtml(item)}</div>`).join("")}
            </div>
          </section>
        `
      )
      .join("");
  }

  function capturePhetWorkspaceImage() {
    if (!els.phetFrame || !APP.phet.frameReady) {
      console.warn("[截图] iframe未就绪", { frame: !!els.phetFrame, ready: APP.phet.frameReady });
      return null;
    }
    try {
      const iframeWin = els.phetFrame.contentWindow;
      if (!iframeWin) {
        console.warn("[截图] 无法访问 iframe contentWindow（可能跨域）");
        return null;
      }
      console.log("[截图] 成功访问 iframe contentWindow");

      // Try PhET's built-in screenshot API (scenery display)
      const display = iframeWin.phet?.joist?.display;
      if (display && typeof display.renderToCanvasSync === "function") {
        console.log("[截图] 找到 PhET display API，尝试 renderToCanvasSync");
        const wrapper = iframeWin.document.createElement("canvas");
        const w = display.width || 800;
        const h = display.height || 600;
        wrapper.width = w;
        wrapper.height = h;
        const ctx = wrapper.getContext("2d");
        if (ctx) {
          display.renderToCanvasSync(wrapper);
          const dataUrl = wrapper.toDataURL("image/jpeg", 0.88);
          if (dataUrl && dataUrl.length > 100) {
            console.log("[截图] PhET API 截图成功，数据长度:", dataUrl.length);
            return { base64: dataUrl, mime: "image/jpeg" };
          }
          console.warn("[截图] PhET API 返回空白，回退到 canvas 方式");
        }
      } else {
        console.log("[截图] 未找到 PhET display API，直接用 canvas 方式", { phet: !!iframeWin.phet, joist: !!iframeWin.phet?.joist, display: !!display });
      }

      // Fallback: grab the largest canvas directly
      const iframeDoc = iframeWin.document;
      const canvases = Array.from(iframeDoc.querySelectorAll("canvas"));
      console.log("[截图] iframe 内 canvas 数量:", canvases.length, canvases.map(c => `${c.width}x${c.height}`));
      const canvas = canvases.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
      if (!canvas || canvas.width < 20 || canvas.height < 20) {
        console.warn("[截图] 未找到有效 canvas");
        return null;
      }
      const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
      if (!dataUrl || dataUrl === "data:," || dataUrl.length < 100) {
        console.warn("[截图] canvas.toDataURL 返回空白（WebGL preserveDrawingBuffer 可能未生效）");
        return null;
      }
      console.log("[截图] canvas 截图成功，数据长度:", dataUrl.length);
      return { base64: dataUrl, mime: "image/jpeg" };
    } catch (err) {
      console.error("[截图] 异常:", err.message, err);
      if (!APP.phet.captureNoticeShown) {
        showToast("未能获取仿真画面，已按文本模式继续");
        APP.phet.captureNoticeShown = true;
      }
      return null;
    }
  }

  async function askFromPhetWorkspace() {
    const sim = findPhetSimulation();
    const question = String(els.phetQuestionInput?.value || "").trim();
    if (!sim) {
      showToast("请先选择一个课外实验");
      return;
    }
    if (!question) {
      showToast("先输入你想提问的问题");
      return;
    }

    const hiddenImage = capturePhetWorkspaceImage();
    if (hiddenImage) {
      APP.phet.captureNoticeShown = false;
    }

    await sendMessage(question, {
      hiddenImage,
      externalLabContext: {
        provider: "phet",
        slug: sim.slug,
        title_zh: sim.title_zh || "",
        title_en: sim.title_en || "",
        topic_zh: sim.topic_zh || "",
        intro_zh: sim.intro_zh || "",
        interface_guidance_zh: Array.isArray(sim.interface_guidance_zh) ? sim.interface_guidance_zh : [],
        layout_zh: sim.layout_zh || "",
        screen_flow_zh: Array.isArray(sim.screen_flow_zh) ? sim.screen_flow_zh : [],
        controls_zh: Array.isArray(sim.controls_zh) ? sim.controls_zh : [],
        interaction_effects_zh: Array.isArray(sim.interaction_effects_zh) ? sim.interaction_effects_zh : [],
        effects_zh: Array.isArray(sim.effects_zh) ? sim.effects_zh : [],
        readouts_zh: Array.isArray(sim.readouts_zh) ? sim.readouts_zh : [],
        first_steps_zh: Array.isArray(sim.first_steps_zh) ? sim.first_steps_zh : [],
        terms_zh: Array.isArray(sim.terms_zh) ? sim.terms_zh : [],
        hidden_tutor_prompt_zh: sim.hidden_tutor_prompt_zh || "",
        ui_profile_version: sim.ui_profile_version || "",
        needs_manual_review: Boolean(sim.needs_manual_review),
        sim_url: sim.embed_url || "",
        official_page_url: sim.official_page_url || "",
        has_official_zh: Boolean(sim.has_official_zh),
      },
    });

    if (els.phetQuestionInput) {
      els.phetQuestionInput.value = "";
      autoResizeTextarea(els.phetQuestionInput);
    }
  }

  function formatPhetUpdatedAt(value) {
    const time = Date.parse(value);
    if (!Number.isFinite(time)) return "刚刚";
    return new Date(time).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function createFolderInteractive() {
    const projectName = window.prompt("输入新项目名称");
    if (projectName === null) return;
    const projectCleanName = projectName.trim();
    if (!projectCleanName) return;
    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectCleanName }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      await loadSessionCatalog();
    } catch (error) {
      showToast(`新建项目失败：${error.message}`);
    }
    return;
    const name = window.prompt("输入新文件夹名称");
    if (name === null) return;
    const cleanName = name.trim();
    if (!cleanName) return;
    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      await loadSessionCatalog();
    } catch (error) {
      showToast(`创建文件夹失败：${error.message}`);
    }
  }

  async function renameFolderInteractive(folderId) {
    const projectInfo = APP.sessionCatalog.folders.find((item) => item.id === folderId);
    const projectName = window.prompt("修改项目名称", projectInfo?.name || "");
    if (projectName === null) return;
    const projectCleanName = projectName.trim();
    if (!projectCleanName) return;
    try {
      const response = await fetch(`/api/folders/${encodeURIComponent(folderId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectCleanName }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      await loadSessionCatalog();
    } catch (error) {
      showToast(`重命名项目失败：${error.message}`);
    }
    return;
    const folder = APP.sessionCatalog.folders.find((item) => item.id === folderId);
    const name = window.prompt("修改文件夹名称", folder?.name || "");
    if (name === null) return;
    const cleanName = name.trim();
    if (!cleanName) return;
    try {
      const response = await fetch(`/api/folders/${encodeURIComponent(folderId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      await loadSessionCatalog();
    } catch (error) {
      showToast(`重命名文件夹失败：${error.message}`);
    }
  }

  async function renameSessionInteractive(sessionId) {
    const session = APP.sessionCatalog.sessions.find((item) => item.session_id === sessionId);
    const name = window.prompt("修改对话名称", session?.title || "");
    if (name === null) return;
    const cleanName = name.trim();
    if (!cleanName) return;
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: cleanName }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      if (sessionId === APP.sessionId) {
        APP.currentSessionTitle = cleanName;
      }
      await loadSessionCatalog();
    } catch (error) {
      showToast(`重命名对话失败：${error.message}`);
    }
  }

  async function moveSessionToFolder(sessionId, folderId) {
    const session = APP.sessionCatalog.sessions.find((item) => item.session_id === sessionId);
    if (!session) return;
    if ((session.folder_id || null) === (folderId || null)) return;
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: folderId }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      await loadSessionCatalog();
      if (sessionId === APP.sessionId) {
        await hydrateSession();
      }
    } catch (error) {
      showToast(`移动对话失败：${error.message}`);
    }
  }

  async function deleteSessionInteractive(sessionId) {
    const session = APP.sessionCatalog.sessions.find((item) => item.session_id === sessionId);
    if (!session) return;
    const confirmed = window.confirm(`删除对话“${session.title || "未命名对话"}”后无法恢复，是否继续？`);
    if (!confirmed) return;
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      if (sessionId === APP.sessionId) {
        await startNewConversation();
        return;
      }
      await loadSessionCatalog();
    } catch (error) {
      showToast(`删除对话失败：${error.message}`);
    }
  }

  async function deleteFolderInteractive(folderId) {
    const projectInfo = APP.sessionCatalog.folders.find((item) => item.id === folderId);
    if (!projectInfo) return;
    const projectConfirmed = window.confirm(`删除项目“${projectInfo.name}”后，其中对话会移出项目，是否继续？`);
    if (!projectConfirmed) return;
    try {
      const response = await fetch(`/api/folders/${encodeURIComponent(folderId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      delete APP.folderOpenMap[folderId];
      saveFolderOpenMap(APP.folderOpenMap);
      await loadSessionCatalog();
      if (APP.sessionCatalog.sessions.some((item) => item.session_id === APP.sessionId)) {
        await hydrateSession();
      }
    } catch (error) {
      showToast(`删除项目失败：${error.message}`);
    }
    return;
    const folder = APP.sessionCatalog.folders.find((item) => item.id === folderId);
    if (!folder) return;
    const confirmed = window.confirm(`删除文件夹“${folder.name}”后，其中对话会移回默认列表，是否继续？`);
    if (!confirmed) return;
    try {
      const response = await fetch(`/api/folders/${encodeURIComponent(folderId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      delete APP.folderOpenMap[folderId];
      saveFolderOpenMap(APP.folderOpenMap);
      await loadSessionCatalog();
      if (APP.sessionCatalog.sessions.some((item) => item.session_id === APP.sessionId)) {
        await hydrateSession();
      }
    } catch (error) {
      showToast(`删除文件夹失败：${error.message}`);
    }
  }

  async function moveSessionInteractive(sessionId) {
    const currentSession = APP.sessionCatalog.sessions.find((item) => item.session_id === sessionId);
    const targetName = window.prompt("输入目标项目名称，留空则移出项目", currentSession?.folder_name || "");
    if (targetName === null) return;
    const targetCleanName = targetName.trim();
    let targetFolderId = null;
    try {
      if (targetCleanName) {
        let targetFolder = APP.sessionCatalog.folders.find((item) => item.name === targetCleanName);
        if (!targetFolder) {
          const createResp = await fetch("/api/folders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: targetCleanName }),
          });
          if (!createResp.ok) {
            const error = await createResp.json().catch(() => ({}));
            throw new Error(error.detail || `HTTP ${createResp.status}`);
          }
          targetFolder = await createResp.json();
        }
        targetFolderId = targetFolder.id;
      }
      await moveSessionToFolder(sessionId, targetFolderId);
    } catch (error) {
      showToast(`移动对话失败：${error.message}`);
    }
    return;
    const current = APP.sessionCatalog.sessions.find((item) => item.session_id === sessionId);
    const name = window.prompt("输入目标文件夹名称，留空则移出文件夹", current?.folder_name || "");
    if (name === null) return;
    const cleanName = name.trim();
    let folderId = null;
    try {
      if (cleanName) {
        let folder = APP.sessionCatalog.folders.find((item) => item.name === cleanName);
        if (!folder) {
          const createResp = await fetch("/api/folders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: cleanName }),
          });
          if (!createResp.ok) {
            const error = await createResp.json().catch(() => ({}));
            throw new Error(error.detail || `HTTP ${createResp.status}`);
          }
          folder = await createResp.json();
        }
        folderId = folder.id;
      }

      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: folderId }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      await loadSessionCatalog();
    } catch (error) {
      showToast(`移动对话失败：${error.message}`);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      showToast("当前浏览器不支持录音");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const preferredMime = MediaRecorder.isTypeSupported?.("audio/webm") ? "audio/webm" : "";
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);
      APP.mediaRecorder = recorder;
      if (els.recordBtn) {
        els.recordBtn.classList.add("recording");
        els.recordBtn.title = "停止录音";
      }

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) {
          chunks.push(event.data);
        }
      });

      recorder.addEventListener("stop", async () => {
        clearTimeout(APP.recordingTimer);
        APP.recordingTimer = null;
        stream.getTracks().forEach((track) => track.stop());
        if (els.recordBtn) {
          els.recordBtn.classList.remove("recording");
          els.recordBtn.title = "开始录音";
        }
        APP.mediaRecorder = null;
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (!blob.size) {
          return;
        }
        if (blob.size > 10 * 1024 * 1024) {
          showToast("录音超过 10MB 上限，请缩短时长");
          return;
        }
        const base64 = await blobToBase64(blob);
        APP.pendingAudio = {
          base64,
          mime: blob.type || "audio/webm",
          name: `录音 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
        };
        APP.pendingImage = null;
        updatePendingAttachmentBars();
      });

      recorder.start();
      showToast("开始录音，30 秒后会自动停止");
      APP.recordingTimer = window.setTimeout(() => {
        stopRecording();
      }, 30000);
    } catch (error) {
      showToast(`无法开始录音：${error.message}`);
    }
  }

  function stopRecording() {
    if (APP.mediaRecorder?.state === "recording") {
      APP.mediaRecorder.stop();
    }
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error("文件读取失败"));
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve(result.includes(",") ? result.split(",")[1] : result);
      };
      reader.readAsDataURL(blob);
    });
  }

  function onSimulationSliderInput(index, value) {
    if (!Number.isFinite(value)) return;

    const expId = SIM.currentExpId;

    if (expId === "michelson") {
      const p = SIM.params.michelson;
      if (index === 1) {
        const delta = value - p.lambdaNm;
        p.lambdaNm = value;
        markControlAction(expId, "lambdaNm", delta);
      } else {
        const delta = value - p.displacementUm;
        p.displacementUm = value;
        if (Math.abs(delta) < 0.0003) {
          SIM.motion = "stable";
        } else {
          SIM.motion = delta > 0 ? "outward" : "inward";
        }
        markControlAction(expId, "displacementUm", delta);
      }
    }

    if (expId === "newton-rings") {
      const p = SIM.params["newton-rings"];
      if (index === 1) {
        const delta = value - p.lambdaNm;
        p.lambdaNm = value;
        markControlAction(expId, "lambdaNm", delta);
      } else {
        const delta = value - p.curvatureMm;
        p.curvatureMm = value;
        markControlAction(expId, "curvatureMm", delta);
      }
    }

    if (expId === "bohr-resonance") {
      const p = SIM.params["bohr-resonance"];
      if (index === 1) {
        const delta = value - p.freqHz;
        p.freqHz = value;
        markControlAction(expId, "freqHz", delta);
      } else {
        const delta = value - p.damping;
        p.damping = value;
        markControlAction(expId, "damping", delta);
      }
    }

    if (expId === "spectrometer-prism") {
      const p = SIM.params["spectrometer-prism"];
      if (index === 1) {
        const delta = value - p.prismAngleDeg;
        p.prismAngleDeg = value;
        p.theta1Deg = null;
        p.theta2Deg = null;
        p.lastAlignedIndex = -1;
        markControlAction(expId, "prismAngleDeg", delta);
      } else {
        const delta = value - p.telescopeDeg;
        p.telescopeDeg = normalizeDeg(value);
        markControlAction(expId, "telescopeDeg", delta);
      }
    }

    if (expId === "torsion-pendulum") {
      const p = SIM.params["torsion-pendulum"];
      if (index === 1) {
        const clamped = clamp(value, 0, 90);
        const delta = clamped - p.theta0Deg;
        p.theta0Deg = clamped;
        p.currentThetaDeg = clamped;
        p.prevThetaDeg = clamped;
        p.simTimeSec = 0;
        p.isOscillating = false;
        markControlAction(expId, "theta0Deg", delta);
      }
    }

    updateSimulationPanelUI();
    drawCurrentSimulation();
  }

  function markControlAction(expId, key, delta) {
    SIM.lastControlAction = {
      expId,
      key,
      direction: Math.abs(delta) < 1e-9 ? 0 : delta > 0 ? 1 : -1,
    };
  }

  function renderExperimentLibrary() {
    const html = experiments
      .map(
        (exp) => `
        <article class="experiment-card" data-exp-id="${exp.id}">
          <button class="exp-entry-btn" data-action="toggle" type="button">
            <span>${escapeHtml(exp.name)}</span>
            <i class="ri-arrow-down-s-line"></i>
          </button>
          <div class="submenu hidden" data-role="submenu">
            <button class="submenu-btn" data-action="simulate" type="button">🧪 实验仿真</button>
            <button class="submenu-btn" data-action="principles" type="button">📘 实验原理</button>
            <button class="submenu-btn" data-action="questions" type="button">📝 实验题目</button>
          </div>
        </article>
      `
      )
      .join("");

    els.experimentLibraryContainer.innerHTML = html;
  }

  function toggleExperimentAccordion(card) {
    const allCards = els.experimentLibraryContainer.querySelectorAll(".experiment-card");
    allCards.forEach((item) => {
      if (item !== card) {
        item.querySelector('[data-role="submenu"]')?.classList.add("hidden");
      }
    });

    const submenu = card.querySelector('[data-role="submenu"]');
    if (!submenu) return;
    const willOpen = submenu.classList.contains("hidden");
    submenu.classList.toggle("hidden");
    if (willOpen) {
      requestAnimationFrame(() => {
        ensureExperimentCardVisible(card);
      });
    }
  }

  function ensureExperimentCardVisible(card) {
    const scrollBox = els.experimentLibraryContainer;
    if (!scrollBox || !card) return;
    const boxRect = scrollBox.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const topOffset = cardRect.top - boxRect.top;
    const bottomOffset = cardRect.bottom - boxRect.bottom;
    if (topOffset < 10) {
      scrollBox.scrollTop += topOffset - 10;
      return;
    }
    if (bottomOffset > -10) {
      scrollBox.scrollTop += bottomOffset + 10;
    }
  }

  function openSimulationPlaceholder(experiment) {
    showToast(`【${experiment.name}】的交互式仿真正在搭建中，敬请期待...`);
  }

  function openSimulationModal(expId) {
    SIM.currentExpId = expId;
    SIM.isOpen = true;
    configureSimulationUI(expId);
    els.simulationModal.classList.remove("hidden");
    ensureSimulationCanvasSize();
    drawCurrentSimulation();
  }

  function closeSimulationModal() {
    if (SIM.currentExpId === "torsion-pendulum") {
      const p = SIM.params["torsion-pendulum"];
      if (p.stopwatch.running) {
        stopTorsionStopwatch(p, false);
      }
    }

    if (SIM.currentExpId === "wheatstone-bridge") {
      setWheatstoneSwitchPressed(false);
    }
    SIM.isOpen = false;
    els.simulationModal.classList.add("hidden");
  }
  function configureSimulationUI(expId) {
    const expName = experimentMap.get(expId)?.name || "实验仿真";
    if (els.simulationModalTitle) {
      els.simulationModalTitle.textContent = `${expName} 仿真`;
    }

    const lambdaRow = els.simLambdaRange?.closest(".control-row");
    const displacementRow = els.simDisplacementRange?.closest(".control-row");
    const torsionPanel = ensureTorsionControlPanel();
    const wheatstonePanel = ensureWheatstoneControlPanel();

    if (lambdaRow) lambdaRow.classList.remove("hidden");
    if (displacementRow) displacementRow.classList.remove("hidden");
    if (torsionPanel) torsionPanel.classList.add("hidden");
    if (wheatstonePanel) wheatstonePanel.classList.add("hidden");

    if (expId === "michelson") {
      const p = SIM.params.michelson;
      if (els.simulationModalSubtitle) {
        els.simulationModalSubtitle.textContent = "等倾干涉圆环 · 2d cosθ = kλ";
      }
      configureSlider(els.simLambdaRange, { min: 400, max: 700, step: 0.1, value: p.lambdaNm });
      configureSlider(els.simDisplacementRange, { min: -8, max: 8, step: 0.01, value: p.displacementUm });
      if (els.simLambdaLabel) els.simLambdaLabel.textContent = "激光波长 λ";
      if (els.simDisplacementLabel) els.simDisplacementLabel.textContent = "微动镜位移 d（相对零位）";
      if (els.simColorLabel) els.simColorLabel.textContent = "颜色";
      if (els.simOpdLabel) els.simOpdLabel.textContent = "Δ(2d)";
      if (els.simFringeLabel) els.simFringeLabel.textContent = "估算级次 N";
    }

    if (expId === "newton-rings") {
      const p = SIM.params["newton-rings"];
      if (els.simulationModalSubtitle) {
        els.simulationModalSubtitle.textContent = "等厚干涉圆环 · r_k = sqrt(kRλ)";
      }
      configureSlider(els.simLambdaRange, { min: 400, max: 700, step: 0.1, value: p.lambdaNm });
      configureSlider(els.simDisplacementRange, { min: 300, max: 3000, step: 10, value: p.curvatureMm });
      if (els.simLambdaLabel) els.simLambdaLabel.textContent = "激光波长 λ";
      if (els.simDisplacementLabel) els.simDisplacementLabel.textContent = "透镜曲率半径 R";
      if (els.simColorLabel) els.simColorLabel.textContent = "颜色";
      if (els.simOpdLabel) els.simOpdLabel.textContent = "第一暗环 r₁";
      if (els.simFringeLabel) els.simFringeLabel.textContent = "可见圆环数";
    }

    if (expId === "wheatstone-bridge") {
      const p = SIM.params["wheatstone-bridge"];
      if (els.simulationModalSubtitle) {
        els.simulationModalSubtitle.textContent = "惠斯通电桥平衡 · Rx = (R1/R2)Rs";
      }
      configureSlider(els.simLambdaRange, { min: 0, max: 1, step: 1, value: 0 });
      configureSlider(els.simDisplacementRange, { min: 0, max: 1, step: 1, value: 0 });
      if (els.simLambdaLabel) els.simLambdaLabel.textContent = "比例臂 R1/R2";
      if (els.simDisplacementLabel) els.simDisplacementLabel.textContent = "比较臂 Rs";
      if (els.simColorLabel) els.simColorLabel.textContent = "开关 K";
      if (els.simOpdLabel) els.simOpdLabel.textContent = "检流计 dV";
      if (els.simFringeLabel) els.simFringeLabel.textContent = "指针偏转";

      if (lambdaRow) lambdaRow.classList.add("hidden");
      if (displacementRow) displacementRow.classList.add("hidden");
      if (wheatstonePanel) wheatstonePanel.classList.remove("hidden");

      p.rsOhm = computeWheatstoneRsFromDigits(p.rsDigits);
      setWheatstoneSwitchPressed(false);
      syncWheatstonePanelFromState();
    }
    if (expId === "bohr-resonance") {
      const p = SIM.params["bohr-resonance"];
      if (els.simulationModalSubtitle) {
        els.simulationModalSubtitle.textContent = "受迫振动稳态 · A = M0 / sqrt((k - Iω²)² + (cω)²)";
      }
      configureSlider(els.simLambdaRange, { min: 0.2, max: 3.0, step: 0.01, value: p.freqHz });
      configureSlider(els.simDisplacementRange, { min: 0.02, max: 1.2, step: 0.01, value: p.damping });
      if (els.simLambdaLabel) els.simLambdaLabel.textContent = "驱动频率 f (Hz)";
      if (els.simDisplacementLabel) els.simDisplacementLabel.textContent = "阻尼系数 c";
      if (els.simColorLabel) els.simColorLabel.textContent = "相位差 φ";
      if (els.simOpdLabel) els.simOpdLabel.textContent = "稳态振幅 A";
      if (els.simFringeLabel) els.simFringeLabel.textContent = "共振频率 f_r";
    }

    if (expId === "spectrometer-prism") {
      const p = SIM.params["spectrometer-prism"];
      if (els.simulationModalSubtitle) {
        els.simulationModalSubtitle.textContent = "分光计反射法 · φ = 2A";
      }
      configureSlider(els.simLambdaRange, { min: 50, max: 70, step: 0.1, value: p.prismAngleDeg });
      configureSlider(els.simDisplacementRange, { min: 0, max: 360, step: 0.05, value: p.telescopeDeg });
      if (els.simLambdaLabel) els.simLambdaLabel.textContent = "待测棱镜顶角 A (°)";
      if (els.simDisplacementLabel) els.simDisplacementLabel.textContent = "望远镜转角 θ (°)";
      if (els.simColorLabel) els.simColorLabel.textContent = "反射夹角 φ";
      if (els.simOpdLabel) els.simOpdLabel.textContent = "当前望远镜偏差 Δθ";
      if (els.simFringeLabel) els.simFringeLabel.textContent = "测得顶角 A_meas";
    }

    if (expId === "torsion-pendulum") {
      const p = SIM.params["torsion-pendulum"];
      if (els.simulationModalSubtitle) {
        els.simulationModalSubtitle.textContent = "扭摆周期公式 · T = 2π√(I/K)";
      }
      configureSlider(els.simLambdaRange, { min: 0, max: 90, step: 0.1, value: p.theta0Deg });
      configureSlider(els.simDisplacementRange, { min: 0, max: 360, step: 0.1, value: 0 });
      if (els.simLambdaLabel) els.simLambdaLabel.textContent = "初始偏转角 θ₀ (°)";
      if (els.simDisplacementLabel) els.simDisplacementLabel.textContent = "秒表读数";
      if (els.simColorLabel) els.simColorLabel.textContent = "实验对象";
      if (els.simOpdLabel) els.simOpdLabel.textContent = "当前周期 T";
      if (els.simFringeLabel) els.simFringeLabel.textContent = "计时结果";

      if (displacementRow) displacementRow.classList.add("hidden");
      if (torsionPanel) torsionPanel.classList.remove("hidden");
      p.currentThetaDeg = p.theta0Deg;
      p.prevThetaDeg = p.theta0Deg;
      p.simTimeSec = 0;
      p.isOscillating = true;
      syncTorsionPanelFromState();
    }

    updateSimulationPanelUI();
  }
  function configureSlider(rangeEl, config) {
    if (!rangeEl) return;
    rangeEl.min = String(config.min);
    rangeEl.max = String(config.max);
    rangeEl.step = String(config.step);
    rangeEl.value = String(config.value);
  }

  function startSimulationLoop() {
    const loop = (ts) => {
      requestAnimationFrame(loop);

      if (!SIM.lastFrameMs) {
        SIM.lastFrameMs = ts;
      }

      const dt = clamp((ts - SIM.lastFrameMs) / 1000, 0.001, 0.06);
      SIM.lastFrameMs = ts;
      SIM.timeSec += dt;

      if (!SIM.isOpen) return;

      if (SIM.currentExpId === "michelson") {
        const p = SIM.params.michelson;
        const target = p.dBaseUm + p.displacementUm;
        p.dAnimatedUm += (target - p.dAnimatedUm) * 0.16;
      }

      if (SIM.currentExpId === "torsion-pendulum") {
        updateTorsionPendulumState(dt);
      }

      if (SIM.currentExpId === "wheatstone-bridge") {
        updateWheatstoneBridgeState(dt);
      }
      drawCurrentSimulation();
    };

    requestAnimationFrame(loop);
  }

  function drawCurrentSimulation() {
    if (SIM.currentExpId === "michelson") {
      drawMichelson();
      return;
    }

    if (SIM.currentExpId === "newton-rings") {
      drawNewtonRings();
      return;
    }

    if (SIM.currentExpId === "bohr-resonance") {
      drawBohrResonance();
      return;
    }

    if (SIM.currentExpId === "spectrometer-prism") {
      drawSpectrometerPrism();
      return;
    }

    if (SIM.currentExpId === "torsion-pendulum") {
      drawTorsionPendulum();
      return;
    }

    if (SIM.currentExpId === "wheatstone-bridge") {
      drawWheatstoneBridge();
      return;
    }
  }
  function ensureSimulationCanvasSize() {
    const wrap = els.simulationCanvas.parentElement;
    if (!wrap) return;

    const rect = wrap.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const dpr = window.devicePixelRatio || 1;

    els.simulationCanvas.width = Math.round(width * dpr);
    els.simulationCanvas.height = Math.round(height * dpr);
    els.simulationCanvas.style.width = `${width}px`;
    els.simulationCanvas.style.height = `${height}px`;

    simCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    SIM.canvasCssW = width;
    SIM.canvasCssH = height;
  }

  function drawMichelson() {
    const w = SIM.canvasCssW;
    const h = SIM.canvasCssH;
    if (w < 2 || h < 2) return;

    const p = SIM.params.michelson;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const maxRadius = Math.min(w, h) * 0.455;
    const focalPx = Math.min(w, h) * 0.73;

    simCtx.clearRect(0, 0, w, h);

    const bg = simCtx.createRadialGradient(cx, cy, maxRadius * 0.05, cx, cy, maxRadius * 1.16);
    bg.addColorStop(0, "rgba(15, 26, 52, 0.98)");
    bg.addColorStop(1, "rgba(2, 6, 16, 1)");
    simCtx.fillStyle = bg;
    simCtx.fillRect(0, 0, w, h);

    simCtx.save();
    simCtx.translate(cx, cy);

    simCtx.beginPath();
    simCtx.arc(0, 0, maxRadius, 0, TWO_PI);
    simCtx.clip();

    const color = wavelengthToRGB(p.lambdaNm);
    const radii = computeMichelsonRadii(p.lambdaNm, p.dAnimatedUm, maxRadius, focalPx);

    for (let i = 0; i < radii.length; i += 1) {
      const r = radii[i];
      const next = radii[i + 1] ?? r + 2.2;
      const spacing = Math.max(0.7, next - r);

      const envelope = Math.exp(-Math.pow(r / (maxRadius * 1.28), 1.2));
      const orderFactor = i % 2 === 0 ? 0.95 : 0.34;
      const alpha = clamp(envelope * orderFactor, 0.04, 0.92);
      const lineWidth = clamp(spacing * 0.62, 0.7, 5.6);

      simCtx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha.toFixed(3)})`;
      simCtx.lineWidth = lineWidth;
      simCtx.beginPath();
      simCtx.arc(0, 0, r, 0, TWO_PI);
      simCtx.stroke();

      simCtx.strokeStyle = `rgba(255, 255, 255, ${(alpha * 0.22).toFixed(3)})`;
      simCtx.lineWidth = Math.max(0.4, lineWidth * 0.22);
      simCtx.beginPath();
      simCtx.arc(0, 0, r, 0, TWO_PI);
      simCtx.stroke();
    }

    const centerGlow = simCtx.createRadialGradient(0, 0, 0, 0, 0, maxRadius * 0.12);
    centerGlow.addColorStop(0, "rgba(255, 255, 255, 0.86)");
    centerGlow.addColorStop(0.26, `rgba(${color.r}, ${color.g}, ${color.b}, 0.55)`);
    centerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    simCtx.fillStyle = centerGlow;
    simCtx.beginPath();
    simCtx.arc(0, 0, maxRadius * 0.12, 0, TWO_PI);
    simCtx.fill();

    simCtx.restore();

    els.simReadout.textContent = `λ=${p.lambdaNm.toFixed(1)}nm · d=${p.displacementUm >= 0 ? "+" : ""}${p.displacementUm.toFixed(3)}μm`;
  }

  function computeMichelsonRadii(lambdaNm, dUm, maxRadius, focalPx) {
    const lambda = lambdaNm * 1e-9;
    const d = Math.max(8e-6, dUm * 1e-6);

    const kMax = Math.floor((2 * d) / lambda);
    const radii = [];

    for (let k = kMax; k >= 1; k -= 1) {
      const cosTheta = (k * lambda) / (2 * d);
      if (cosTheta <= 0 || cosTheta > 1) continue;

      const theta = Math.acos(cosTheta);
      const radius = focalPx * Math.tan(theta);

      if (radius > maxRadius * 1.06) break;
      if (radius >= 1) radii.push(radius);
      if (radii.length > 450) break;
    }

    return radii;
  }

  function drawNewtonRings() {
    const w = SIM.canvasCssW;
    const h = SIM.canvasCssH;
    if (w < 2 || h < 2) return;

    const p = SIM.params["newton-rings"];
    const cx = w * 0.5;
    const cy = h * 0.5;
    const maxRadius = Math.min(w, h) * 0.455;

    const lambdaM = p.lambdaNm * 1e-9;
    const curvatureM = p.curvatureMm / 1000;
    const viewRadiusM = 5.2e-3;
    const pxPerM = maxRadius / viewRadiusM;

    simCtx.clearRect(0, 0, w, h);

    const bg = simCtx.createRadialGradient(cx, cy, maxRadius * 0.05, cx, cy, maxRadius * 1.18);
    bg.addColorStop(0, "rgba(20, 18, 28, 0.98)");
    bg.addColorStop(1, "rgba(4, 6, 14, 1)");
    simCtx.fillStyle = bg;
    simCtx.fillRect(0, 0, w, h);

    simCtx.save();
    simCtx.translate(cx, cy);

    simCtx.beginPath();
    simCtx.arc(0, 0, maxRadius, 0, TWO_PI);
    simCtx.clip();

    simCtx.fillStyle = "rgba(0, 0, 0, 0.92)";
    simCtx.beginPath();
    simCtx.arc(0, 0, maxRadius, 0, TWO_PI);
    simCtx.fill();

    const color = wavelengthToRGB(p.lambdaNm);

    const kMax = Math.floor((viewRadiusM * viewRadiusM) / Math.max(curvatureM * lambdaM, 1e-16)) + 2;

    for (let k = 1; k <= kMax; k += 1) {
      const rDark = Math.sqrt(k * curvatureM * lambdaM) * pxPerM;
      if (rDark > maxRadius * 1.03) break;

      const rDarkNext = Math.sqrt((k + 1) * curvatureM * lambdaM) * pxPerM;
      const rBright = Math.sqrt((k - 0.5) * curvatureM * lambdaM) * pxPerM;
      const spacing = Math.max(0.7, rDarkNext - rDark);

      const envelope = Math.exp(-Math.pow(rBright / (maxRadius * 1.05), 1.24));
      const alphaBright = clamp(0.2 + envelope * 0.78, 0.08, 0.92);
      const alphaDark = clamp(0.14 + envelope * 0.28, 0.08, 0.44);
      const lineWidth = clamp(spacing * 0.62, 0.45, 5.6);

      simCtx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alphaBright.toFixed(3)})`;
      simCtx.lineWidth = lineWidth;
      simCtx.beginPath();
      simCtx.arc(0, 0, rBright, 0, TWO_PI);
      simCtx.stroke();

      simCtx.strokeStyle = `rgba(255, 255, 255, ${(alphaBright * 0.18).toFixed(3)})`;
      simCtx.lineWidth = Math.max(0.35, lineWidth * 0.18);
      simCtx.beginPath();
      simCtx.arc(0, 0, rBright, 0, TWO_PI);
      simCtx.stroke();

      simCtx.strokeStyle = `rgba(0, 0, 0, ${alphaDark.toFixed(3)})`;
      simCtx.lineWidth = Math.max(0.28, lineWidth * 0.55);
      simCtx.beginPath();
      simCtx.arc(0, 0, rDark, 0, TWO_PI);
      simCtx.stroke();
    }

    const r1 = Math.sqrt(curvatureM * lambdaM) * pxPerM;
    const centerDarkRadius = clamp(r1 * 0.9, 2.4, maxRadius * 0.15);
    simCtx.fillStyle = "rgba(0, 0, 0, 0.98)";
    simCtx.beginPath();
    simCtx.arc(0, 0, centerDarkRadius, 0, TWO_PI);
    simCtx.fill();

    const edgeGlow = simCtx.createRadialGradient(0, 0, centerDarkRadius * 0.4, 0, 0, maxRadius * 0.95);
    edgeGlow.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.12)`);
    edgeGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    simCtx.fillStyle = edgeGlow;
    simCtx.beginPath();
    simCtx.arc(0, 0, maxRadius, 0, TWO_PI);
    simCtx.fill();

    simCtx.restore();

    const ringCount = estimateNewtonVisibleRingCount(p.lambdaNm, p.curvatureMm);
    els.simReadout.textContent = `λ=${p.lambdaNm.toFixed(1)}nm · R=${p.curvatureMm.toFixed(0)}mm · 中心暗斑 · 等厚干涉 · 可见圆环数 ${ringCount}`;
  }

  function drawBohrResonance() {
    const w = SIM.canvasCssW;
    const h = SIM.canvasCssH;
    if (w < 2 || h < 2) return;

    const p = SIM.params["bohr-resonance"];

    simCtx.clearRect(0, 0, w, h);

    const bg = simCtx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "rgba(10, 18, 34, 1)");
    bg.addColorStop(1, "rgba(6, 12, 24, 1)");
    simCtx.fillStyle = bg;
    simCtx.fillRect(0, 0, w, h);

    const splitX = w * 0.44;
    const gap = 16;

    const leftX0 = 12;
    const leftY0 = 12;
    const leftW = splitX - 2 * leftX0;
    const leftH = h - 24;

    simCtx.fillStyle = "rgba(255, 255, 255, 0.03)";
    roundRect(simCtx, leftX0, leftY0, leftW, leftH, 14);
    simCtx.fill();
    simCtx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    simCtx.lineWidth = 1;
    roundRect(simCtx, leftX0, leftY0, leftW, leftH, 14);
    simCtx.stroke();

    const omega = TWO_PI * p.freqHz;
    const phase = forcedPhase(p.freqHz, p.damping, p);
    const amp = forcedAmplitude(p.freqHz, p.damping, p);
    const peakAmp = Math.max(peakAmplitudeForDamping(p.damping, p), 1e-6);
    const ampRatio = clamp(amp / peakAmp, 0, 1.2);
    const thetaAmp = 0.08 + ampRatio * 0.56;
    const theta = thetaAmp * Math.cos(SIM.timeSec * omega - phase);

    const pivotX = leftX0 + leftW * 0.5;
    const pivotY = leftY0 + leftH * 0.2;
    const rodLength = Math.min(leftW, leftH) * 0.36;
    const bobX = pivotX + rodLength * Math.sin(theta);
    const bobY = pivotY + rodLength * Math.cos(theta);

    simCtx.strokeStyle = "rgba(160, 198, 255, 0.52)";
    simCtx.lineWidth = 1.2;
    simCtx.beginPath();
    simCtx.moveTo(leftX0 + leftW * 0.18, pivotY);
    simCtx.lineTo(leftX0 + leftW * 0.82, pivotY);
    simCtx.stroke();

    simCtx.setLineDash([4, 5]);
    simCtx.strokeStyle = "rgba(255,255,255,0.2)";
    simCtx.beginPath();
    simCtx.moveTo(pivotX, pivotY);
    simCtx.lineTo(pivotX, pivotY + rodLength + 22);
    simCtx.stroke();
    simCtx.setLineDash([]);

    simCtx.strokeStyle = "rgba(114, 220, 255, 0.42)";
    simCtx.lineWidth = 1;
    simCtx.beginPath();
    simCtx.arc(pivotX, pivotY, rodLength, Math.PI / 2 - thetaAmp, Math.PI / 2 + thetaAmp);
    simCtx.stroke();

    simCtx.strokeStyle = "rgba(138, 221, 255, 0.92)";
    simCtx.lineWidth = 2.4;
    simCtx.beginPath();
    simCtx.moveTo(pivotX, pivotY);
    simCtx.lineTo(bobX, bobY);
    simCtx.stroke();

    const bobGlow = simCtx.createRadialGradient(bobX - 4, bobY - 4, 2, bobX, bobY, 16);
    bobGlow.addColorStop(0, "rgba(255,255,255,0.95)");
    bobGlow.addColorStop(0.35, "rgba(124,220,255,0.85)");
    bobGlow.addColorStop(1, "rgba(34,150,212,0.2)");
    simCtx.fillStyle = bobGlow;
    simCtx.beginPath();
    simCtx.arc(bobX, bobY, 12, 0, TWO_PI);
    simCtx.fill();

    simCtx.fillStyle = "rgba(230, 241, 255, 0.88)";
    simCtx.font = "12px 'Segoe UI', sans-serif";
    simCtx.fillText(`θmax ≈ ${(thetaAmp * 180 / Math.PI).toFixed(1)}°`, leftX0 + 14, leftY0 + 22);
    simCtx.fillText(`A/Apeak = ${ampRatio.toFixed(2)}`, leftX0 + 14, leftY0 + 40);

    const rightX0 = splitX + gap;
    const rightY0 = 16;
    const rightX1 = w - 16;
    const rightY1 = h - 22;

    simCtx.fillStyle = "rgba(255, 255, 255, 0.03)";
    roundRect(simCtx, rightX0 - 6, rightY0 - 6, rightX1 - rightX0 + 12, rightY1 - rightY0 + 10, 14);
    simCtx.fill();
    simCtx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    simCtx.lineWidth = 1;
    roundRect(simCtx, rightX0 - 6, rightY0 - 6, rightX1 - rightX0 + 12, rightY1 - rightY0 + 10, 14);
    simCtx.stroke();

    const chartPadL = 26;
    const chartPadR = 12;
    const chartPadT = 10;
    const chartPadB = 24;

    const chartX0 = rightX0 + chartPadL;
    const chartX1 = rightX1 - chartPadR;
    const chartY0 = rightY0 + chartPadT;
    const chartY1 = rightY1 - chartPadB;

    const fMin = 0.2;
    const fMax = 3.0;
    const samples = 220;

    const curve = [];
    let maxA = 1e-6;
    for (let i = 0; i <= samples; i += 1) {
      const f = fMin + (fMax - fMin) * (i / samples);
      const a = forcedAmplitude(f, p.damping, p);
      curve.push([f, a]);
      if (a > maxA) maxA = a;
    }

    simCtx.strokeStyle = "rgba(255,255,255,0.22)";
    simCtx.lineWidth = 1;
    simCtx.beginPath();
    simCtx.moveTo(chartX0, chartY1);
    simCtx.lineTo(chartX1, chartY1);
    simCtx.lineTo(chartX1, chartY0);
    simCtx.stroke();

    simCtx.strokeStyle = "rgba(90, 193, 255, 0.92)";
    simCtx.lineWidth = 2;
    simCtx.beginPath();
    curve.forEach(([f, a], idx) => {
      const x = chartX0 + ((f - fMin) / (fMax - fMin)) * (chartX1 - chartX0);
      const y = chartY1 - (a / maxA) * (chartY1 - chartY0);
      if (idx === 0) simCtx.moveTo(x, y);
      else simCtx.lineTo(x, y);
    });
    simCtx.stroke();

    const pointX = chartX0 + ((p.freqHz - fMin) / (fMax - fMin)) * (chartX1 - chartX0);
    const pointY = chartY1 - (amp / maxA) * (chartY1 - chartY0);

    simCtx.fillStyle = "rgba(255, 196, 93, 0.98)";
    simCtx.beginPath();
    simCtx.arc(pointX, pointY, 5.2, 0, TWO_PI);
    simCtx.fill();

    simCtx.strokeStyle = "rgba(255, 196, 93, 0.35)";
    simCtx.lineWidth = 1;
    simCtx.beginPath();
    simCtx.moveTo(pointX, chartY1);
    simCtx.lineTo(pointX, pointY);
    simCtx.stroke();

    simCtx.fillStyle = "rgba(230, 241, 255, 0.88)";
    simCtx.font = "12px 'Segoe UI', sans-serif";
    simCtx.fillText("f (Hz)", chartX1 - 28, chartY1 + 16);
    simCtx.fillText("A", chartX0 - 18, chartY0 + 8);

    const fRes = resonancePeakFrequencyHz(p.damping, p);
    simCtx.fillText(`f_r≈${fRes.toFixed(2)}Hz`, chartX0 + 8, chartY0 + 14);

    els.simReadout.textContent = `f=${p.freqHz.toFixed(2)}Hz · c=${p.damping.toFixed(2)} · A=${amp.toExponential(2)}`;
  }



  function ensureWheatstoneControlPanel() {
    const controlsRoot = els.simulationModal?.querySelector(".simulation-controls");
    if (!controlsRoot) return null;

    let panel = document.getElementById("wheatstoneControlPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "wheatstoneControlPanel";
      panel.className = "control-row hidden";
      panel.innerHTML = `
        <div class="control-head">
          <label for="wheatRatioSelect">Ratio Arm R1/R2</label>
          <span id="wheatRsTotal">Rs = 2450 Ω</span>
        </div>
        <select id="wheatRatioSelect" style="width:100%;margin-top:6px;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.18);background:rgba(9,16,30,0.72);color:#e8f3ff;outline:none;">
          <option value="0.01">0.01</option>
          <option value="0.1">0.1</option>
          <option value="1" selected>1</option>
          <option value="10">10</option>
          <option value="100">100</option>
        </select>
        <div style="margin-top:10px;border:1px solid rgba(255,255,255,0.14);border-radius:12px;padding:10px;background:rgba(7,13,25,0.62);">
          <div style="font-size:12px;color:rgba(214,232,255,0.82);margin-bottom:8px;">Rs 十进电阻箱（1000/100/10/1 Ω）</div>
          <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;">
            <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:rgba(214,232,255,0.8);">×1000 Ω
              <input id="wheatDigit1000" type="number" min="0" max="9" step="1" value="2" style="padding:6px;border-radius:8px;border:1px solid rgba(255,255,255,0.16);background:rgba(15,24,44,0.7);color:#e8f3ff;" />
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:rgba(214,232,255,0.8);">×100 Ω
              <input id="wheatDigit100" type="number" min="0" max="9" step="1" value="4" style="padding:6px;border-radius:8px;border:1px solid rgba(255,255,255,0.16);background:rgba(15,24,44,0.7);color:#e8f3ff;" />
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:rgba(214,232,255,0.8);">×10 Ω
              <input id="wheatDigit10" type="number" min="0" max="9" step="1" value="5" style="padding:6px;border-radius:8px;border:1px solid rgba(255,255,255,0.16);background:rgba(15,24,44,0.7);color:#e8f3ff;" />
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:rgba(214,232,255,0.8);">×1 Ω
              <input id="wheatDigit1" type="number" min="0" max="9" step="1" value="0" style="padding:6px;border-radius:8px;border:1px solid rgba(255,255,255,0.16);background:rgba(15,24,44,0.7);color:#e8f3ff;" />
            </label>
          </div>
          <div id="wheatBalanceHint" style="margin-top:8px;font-size:12px;color:rgba(214,232,255,0.82);">按住开关 K 观察检流计偏转。</div>
        </div>
        <button id="wheatSwitchBtn" type="button" style="margin-top:10px;width:100%;padding:9px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.07);color:#e8f3ff;">按住以闭合开关 K</button>
      `;

      const metrics = controlsRoot.querySelector(".sim-metrics");
      if (metrics) controlsRoot.insertBefore(panel, metrics);
      else controlsRoot.appendChild(panel);

      const ratioSelect = panel.querySelector("#wheatRatioSelect");
      const digitInputs = [panel.querySelector("#wheatDigit1000"), panel.querySelector("#wheatDigit100"), panel.querySelector("#wheatDigit10"), panel.querySelector("#wheatDigit1")];
      const switchBtn = panel.querySelector("#wheatSwitchBtn");

      ratioSelect?.addEventListener("change", () => {
        if (SIM.currentExpId !== "wheatstone-bridge") return;
        const p = SIM.params["wheatstone-bridge"];
        const old = p.ratio;
        p.ratio = Number.parseFloat(ratioSelect.value) || 1;
        markControlAction("wheatstone-bridge", "ratio", p.ratio - old);
        updateWheatstoneBridgeState(1 / 60);
        updateSimulationPanelUI();
        drawCurrentSimulation();
      });

      digitInputs.forEach((input) => {
        input?.addEventListener("input", () => {
          if (SIM.currentExpId !== "wheatstone-bridge") return;
          updateWheatstoneFromPanel();
        });
      });

      const releaseSwitch = () => setWheatstoneSwitchPressed(false);
      switchBtn?.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        setWheatstoneSwitchPressed(true);
      });
      switchBtn?.addEventListener("pointerup", releaseSwitch);
      switchBtn?.addEventListener("pointerleave", releaseSwitch);
      switchBtn?.addEventListener("pointercancel", releaseSwitch);
      switchBtn?.addEventListener("blur", releaseSwitch);
    }

    return panel;
  }

  function randomWheatstoneUnknownRx() {
    const base = 300 + Math.random() * 5200;
    return Math.round(base / 5) * 5;
  }

  function normalizeWheatstoneDigit(value) {
    if (!Number.isFinite(value)) return 0;
    return clamp(Math.round(value), 0, 9);
  }

  function computeWheatstoneRsFromDigits(digits) {
    return normalizeWheatstoneDigit(digits.d1000) * 1000 + normalizeWheatstoneDigit(digits.d100) * 100 + normalizeWheatstoneDigit(digits.d10) * 10 + normalizeWheatstoneDigit(digits.d1);
  }

  function updateWheatstoneFromPanel() {
    const panel = ensureWheatstoneControlPanel();
    if (!panel) return;

    const p = SIM.params["wheatstone-bridge"];
    const oldRs = p.rsOhm;

    const d1000Input = panel.querySelector("#wheatDigit1000");
    const d100Input = panel.querySelector("#wheatDigit100");
    const d10Input = panel.querySelector("#wheatDigit10");
    const d1Input = panel.querySelector("#wheatDigit1");

    p.rsDigits.d1000 = normalizeWheatstoneDigit(Number.parseFloat(d1000Input?.value));
    p.rsDigits.d100 = normalizeWheatstoneDigit(Number.parseFloat(d100Input?.value));
    p.rsDigits.d10 = normalizeWheatstoneDigit(Number.parseFloat(d10Input?.value));
    p.rsDigits.d1 = normalizeWheatstoneDigit(Number.parseFloat(d1Input?.value));

    p.rsOhm = computeWheatstoneRsFromDigits(p.rsDigits);
    markControlAction("wheatstone-bridge", "rsOhm", p.rsOhm - oldRs);

    updateWheatstoneBridgeState(1 / 60);
    updateSimulationPanelUI();
    drawCurrentSimulation();
  }

  function setWheatstoneSwitchPressed(pressed) {
    const p = SIM.params["wheatstone-bridge"];
    p.switchPressed = Boolean(pressed);

    const panel = ensureWheatstoneControlPanel();
    const btn = panel?.querySelector("#wheatSwitchBtn");
    if (btn) {
      if (p.switchPressed) {
        btn.textContent = "松开以断开 K";
        btn.style.background = "rgba(26,124,84,0.42)";
        btn.style.borderColor = "rgba(124,255,198,0.45)";
      } else {
        btn.textContent = "按住以闭合开关 K";
        btn.style.background = "rgba(255,255,255,0.07)";
        btn.style.borderColor = "rgba(255,255,255,0.22)";
      }
    }

    updateWheatstoneBridgeState(1 / 60);
    updateSimulationPanelUI();
    drawCurrentSimulation();
  }

  function computeWheatstoneBridgeState(p) {
    const ratio = Math.max(0.01, Number(p.ratio) || 1);
    const r2 = 1000;
    const r1 = ratio * r2;
    const rs = Math.max(1, Number(p.rsOhm) || 1);
    const rx = Math.max(1, Number(p.rxOhm) || 1);
    const sourceV = Math.max(0.1, Number(p.supplyV) || 3);

    const vLeft = sourceV * (r2 / (r1 + r2));
    const vRight = sourceV * (rs / (rx + rs));
    const deltaV = vRight - vLeft;

    const imbalance = r1 * rs - r2 * rx;
    const balanceRs = (r2 / r1) * rx;
    return { ratio, rs, rx, deltaV, imbalance, balanceRs };
  }

  function updateWheatstoneBridgeState(dt) {
    const p = SIM.params["wheatstone-bridge"];
    p.rsOhm = computeWheatstoneRsFromDigits(p.rsDigits);
    const calc = computeWheatstoneBridgeState(p);
    p.deltaV = calc.deltaV;

    const maxNeedle = p.galvanometerMaxDeg;
    const gain = p.galvanometerGainDegPerV;
    p.targetNeedleDeg = p.switchPressed ? clamp(calc.deltaV * gain, -maxNeedle, maxNeedle) : 0;

    const smooth = clamp((dt || 1 / 60) * 11, 0.08, 0.3);
    p.needleAngleDeg += (p.targetNeedleDeg - p.needleAngleDeg) * smooth;

    syncWheatstonePanelFromState();
  }

  function estimateWheatstoneGridDeflection(angleDeg, maxDeg) {
    const unit = Math.max(1, maxDeg / 10);
    return Math.round(Math.abs(angleDeg) / unit);
  }

  function wheatstoneDeflectionText(angleDeg) {
    if (Math.abs(angleDeg) < 1.2) return "接近零位";
    return angleDeg > 0 ? "向右" : "向左";
  }

  function syncWheatstonePanelFromState() {
    const p = SIM.params["wheatstone-bridge"];
    const panel = ensureWheatstoneControlPanel();
    if (!panel) return;

    const ratioSelect = panel.querySelector("#wheatRatioSelect");
    if (ratioSelect) ratioSelect.value = String(p.ratio);

    const rsTotal = panel.querySelector("#wheatRsTotal");
    if (rsTotal) rsTotal.textContent = `Rs = ${p.rsOhm.toFixed(0)} Ω`;

    const hint = panel.querySelector("#wheatBalanceHint");
    const calc = computeWheatstoneBridgeState(p);
    const isNearBalance = Math.abs(calc.deltaV) < 0.0015;
    const deflect = wheatstoneDeflectionText(p.needleAngleDeg);
    const grids = estimateWheatstoneGridDeflection(p.needleAngleDeg, p.galvanometerMaxDeg);

    if (hint) {
      if (!p.switchPressed) hint.textContent = "按住开关 K 观察检流计。";
      else if (isNearBalance) hint.textContent = "电桥已接近平衡。";
      else hint.textContent = `指针${deflect} ${grids} 格，请微调 Rs。`;
    }
  }

  function drawWheatstoneResistor(x1, y1, x2, y2, label, color) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length < 1) return;

    const angle = Math.atan2(dy, dx);
    const lead = Math.min(20, length * 0.18);
    const bodyLen = Math.max(12, length - 2 * lead);
    const steps = 8;
    const amp = 5;

    simCtx.save();
    simCtx.translate(x1, y1);
    simCtx.rotate(angle);

    simCtx.strokeStyle = color;
    simCtx.lineWidth = 2;
    simCtx.beginPath();
    simCtx.moveTo(0, 0);
    simCtx.lineTo(lead, 0);
    for (let i = 0; i <= steps; i += 1) {
      const x = lead + (bodyLen / steps) * i;
      const y = i === 0 || i === steps ? 0 : i % 2 === 0 ? -amp : amp;
      simCtx.lineTo(x, y);
    }
    simCtx.lineTo(lead + bodyLen + lead, 0);
    simCtx.stroke();

    simCtx.fillStyle = "rgba(230,241,255,0.9)";
    simCtx.font = "12px 'Segoe UI', sans-serif";
    simCtx.textAlign = "center";
    simCtx.textBaseline = "bottom";
    simCtx.fillText(label, lead + bodyLen * 0.5, -10);
    simCtx.restore();
  }

  function drawWheatstoneBridge() {
    const w = SIM.canvasCssW;
    const h = SIM.canvasCssH;
    if (w < 2 || h < 2) return;

    const p = SIM.params["wheatstone-bridge"];
    const calc = computeWheatstoneBridgeState(p);

    simCtx.clearRect(0, 0, w, h);
    const bg = simCtx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "rgba(8, 16, 32, 1)");
    bg.addColorStop(1, "rgba(6, 10, 22, 1)");
    simCtx.fillStyle = bg;
    simCtx.fillRect(0, 0, w, h);

    const cx = w * 0.36;
    const cy = h * 0.52;
    const rx = Math.min(w * 0.22, h * 0.28);
    const ry = Math.min(w * 0.15, h * 0.22);
    const top = { x: cx, y: cy - ry };
    const left = { x: cx - rx, y: cy };
    const right = { x: cx + rx, y: cy };
    const bottom = { x: cx, y: cy + ry };

    drawWheatstoneResistor(top.x, top.y, left.x, left.y, `R1=${(calc.ratio * 1000).toFixed(0)}Ω`, "rgba(112,226,255,0.92)");
    drawWheatstoneResistor(left.x, left.y, bottom.x, bottom.y, "R2=1000Ω", "rgba(112,226,255,0.92)");
    drawWheatstoneResistor(top.x, top.y, right.x, right.y, "Rx=?", "rgba(252,186,120,0.92)");
    drawWheatstoneResistor(right.x, right.y, bottom.x, bottom.y, `Rs=${calc.rs.toFixed(0)}Ω`, "rgba(252,186,120,0.92)");

    const kx = (left.x + right.x) * 0.5;
    simCtx.strokeStyle = "rgba(120, 208, 255, 0.88)";
    simCtx.lineWidth = 2.2;
    simCtx.beginPath();
    simCtx.moveTo(left.x, left.y);
    simCtx.lineTo(kx - 18, cy);
    simCtx.moveTo(kx + 18, cy);
    simCtx.lineTo(right.x, right.y);
    simCtx.stroke();

    if (p.switchPressed) {
      simCtx.strokeStyle = "rgba(130,255,192,0.95)";
      simCtx.lineWidth = 2.4;
      simCtx.beginPath();
      simCtx.moveTo(kx - 18, cy);
      simCtx.lineTo(kx + 18, cy);
      simCtx.stroke();
    } else {
      simCtx.strokeStyle = "rgba(255,210,154,0.9)";
      simCtx.lineWidth = 2.2;
      simCtx.beginPath();
      simCtx.moveTo(kx - 18, cy);
      simCtx.lineTo(kx + 14, cy - 12);
      simCtx.stroke();
    }

    const meterX = w * 0.78;
    const meterY = h * 0.54;
    const meterR = Math.min(w, h) * 0.19;

    simCtx.fillStyle = "rgba(12, 22, 40, 0.9)";
    roundRect(simCtx, meterX - meterR - 18, meterY - meterR - 24, meterR * 2 + 36, meterR * 1.45 + 36, 16);
    simCtx.fill();

    simCtx.strokeStyle = "rgba(220, 236, 255, 0.35)";
    simCtx.lineWidth = 1.5;
    simCtx.beginPath();
    simCtx.arc(meterX, meterY, meterR, degToRad(210), degToRad(-30), false);
    simCtx.stroke();

    const normalized = clamp(p.needleAngleDeg / Math.max(1, p.galvanometerMaxDeg), -1, 1);
    const pointerDeg = 90 - normalized * 120;
    const needleTip = polarPoint(meterX, meterY, meterR * 0.78, pointerDeg);

    simCtx.strokeStyle = "rgba(255, 92, 92, 0.95)";
    simCtx.lineWidth = 2.8;
    simCtx.beginPath();
    simCtx.moveTo(meterX, meterY);
    simCtx.lineTo(needleTip.x, needleTip.y);
    simCtx.stroke();

    const grids = estimateWheatstoneGridDeflection(p.needleAngleDeg, p.galvanometerMaxDeg);
    const deflectText = p.switchPressed ? `${wheatstoneDeflectionText(p.needleAngleDeg)} ${grids} 格` : "开路";
    els.simReadout.textContent = `R1/R2=${calc.ratio.toFixed(2)} · Rs=${calc.rs.toFixed(0)}Ω · dV=${(calc.deltaV * 1000).toFixed(2)}mV · ${deflectText}`;
  }
  function ensureTorsionControlPanel() {
    const controlsRoot = els.simulationModal?.querySelector(".simulation-controls");
    if (!controlsRoot) return null;

    let panel = document.getElementById("torsionControlPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "torsionControlPanel";
      panel.className = "control-row hidden";
      panel.innerHTML = `
        <div class="control-head">
          <label for="torsionObjectSelect">实验对象</label>
          <span id="torsionCycleHint">周期 T：-- s</span>
        </div>
        <select id="torsionObjectSelect" style="width:100%;margin-top:6px;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.18);background:rgba(9,16,30,0.72);color:#e8f3ff;outline:none;">
          <option value="empty-disk">空载圆盘（测 T0）</option>
          <option value="standard-cylinder">标准圆柱体（测 T1）</option>
          <option value="unknown-cylinder">未知圆柱筒（测 T2）</option>
        </select>
        <div style="margin-top:10px;border:1px solid rgba(255,255,255,0.14);border-radius:12px;padding:10px;background:rgba(7,13,25,0.62);">
          <div id="torsionStopwatchDisplay" style="font-size:30px;line-height:1.1;font-weight:700;letter-spacing:1px;text-align:center;color:#e8f3ff;">00.000 s</div>
          <div style="margin-top:10px;display:flex;gap:8px;">
            <button id="torsionTimerToggleBtn" type="button" style="flex:1;padding:8px 10px;border-radius:10px;border:1px solid rgba(112,226,255,0.35);background:rgba(22,86,128,0.35);color:#dff6ff;">开始计时</button>
            <button id="torsionTimerResetBtn" type="button" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.06);color:#e8f3ff;">重置</button>
          </div>
          <div id="torsionTimerInfo" style="margin-top:8px;font-size:12px;color:rgba(214,232,255,0.82);">建议测量 10 个周期计时，以减小读数误差。</div>
        </div>
      `;

      const metrics = controlsRoot.querySelector(".sim-metrics");
      if (metrics) controlsRoot.insertBefore(panel, metrics);
      else controlsRoot.appendChild(panel);

      const objectSelect = panel.querySelector("#torsionObjectSelect");
      const toggleBtn = panel.querySelector("#torsionTimerToggleBtn");
      const resetBtn = panel.querySelector("#torsionTimerResetBtn");

      objectSelect?.addEventListener("change", () => {
        if (SIM.currentExpId !== "torsion-pendulum") return;
        const p = SIM.params["torsion-pendulum"];
        p.objectKey = objectSelect.value;
        p.currentThetaDeg = p.theta0Deg;
        p.prevThetaDeg = p.theta0Deg;
        p.simTimeSec = 0;
        p.isOscillating = true;
        resetTorsionStopwatch(true);
        updateSimulationPanelUI();
        drawCurrentSimulation();
      });

      toggleBtn?.addEventListener("click", () => {
        if (SIM.currentExpId !== "torsion-pendulum") return;
        toggleTorsionStopwatch();
      });

      resetBtn?.addEventListener("click", () => {
        if (SIM.currentExpId !== "torsion-pendulum") return;
        resetTorsionStopwatch(true);
        updateSimulationPanelUI();
      });
    }

    return panel;
  }

  function getTorsionObjectLabel(key) {
    if (key === "standard-cylinder") return "标准圆柱体";
    if (key === "unknown-cylinder") return "未知圆柱筒";
    return "空载圆盘";
  }

  function getTorsionTotalInertia(p, key = p.objectKey) {
    return p.diskInertia + (p.objectInertia[key] || 0);
  }

  function getTorsionPeriodSec(p, key = p.objectKey) {
    const I = Math.max(getTorsionTotalInertia(p, key), 1e-6);
    return TWO_PI * Math.sqrt(I / Math.max(p.torsionK, 1e-6));
  }

  function formatStopwatchMs(ms) {
    return `${(ms / 1000).toFixed(3)} s`;
  }

  function getTorsionElapsedMs(p) {
    const st = p.stopwatch;
    if (!st.running) return st.elapsedMs;
    return st.elapsedMs + (performance.now() - st.startMs);
  }

  function releaseTorsionOscillation() {
    const p = SIM.params["torsion-pendulum"];
    p.simTimeSec = 0;
    p.currentThetaDeg = p.theta0Deg;
    p.prevThetaDeg = p.theta0Deg;
    p.isOscillating = true;
  }

  function toggleTorsionStopwatch() {
    const p = SIM.params["torsion-pendulum"];
    const st = p.stopwatch;

    if (st.running) {
      stopTorsionStopwatch(p, true);
      return;
    }

    if (!p.isOscillating) {
      releaseTorsionOscillation();
    }

    st.running = true;
    st.startMs = performance.now();
    st.elapsedMs = 0;
    st.cycleCount = 0;
    p.prevThetaDeg = p.currentThetaDeg;
    syncTorsionPanelFromState();
  }

  function stopTorsionStopwatch(p, saveRecord) {
    const st = p.stopwatch;
    if (!st.running) return;

    st.elapsedMs = getTorsionElapsedMs(p);
    st.running = false;
    st.startMs = 0;

    if (saveRecord && st.cycleCount > 0) {
      p.measurements[p.objectKey] = {
        elapsedMs: st.elapsedMs,
        cycles: st.cycleCount,
        periodSec: st.elapsedMs / 1000 / st.cycleCount,
      };
    }

    syncTorsionPanelFromState();
  }

  function resetTorsionStopwatch(keepRecords = true) {
    const p = SIM.params["torsion-pendulum"];
    const st = p.stopwatch;

    st.running = false;
    st.startMs = 0;
    st.elapsedMs = 0;
    st.cycleCount = 0;

    if (!keepRecords) {
      p.measurements["empty-disk"] = null;
      p.measurements["standard-cylinder"] = null;
      p.measurements["unknown-cylinder"] = null;
    }

    syncTorsionPanelFromState();
  }

  function syncTorsionPanelFromState() {
    const p = SIM.params["torsion-pendulum"];
    const panel = ensureTorsionControlPanel();
    if (!panel) return;

    const objectSelect = panel.querySelector("#torsionObjectSelect");
    const toggleBtn = panel.querySelector("#torsionTimerToggleBtn");
    const display = panel.querySelector("#torsionStopwatchDisplay");
    const info = panel.querySelector("#torsionTimerInfo");
    const cycleHint = panel.querySelector("#torsionCycleHint");

    if (objectSelect) objectSelect.value = p.objectKey;

    const elapsedMs = getTorsionElapsedMs(p);
    if (display) display.textContent = formatStopwatchMs(elapsedMs);

    if (toggleBtn) {
      toggleBtn.textContent = p.stopwatch.running ? "停止计时" : "开始计时";
      toggleBtn.style.background = p.stopwatch.running ? "rgba(164,52,52,0.35)" : "rgba(22,86,128,0.35)";
      toggleBtn.style.borderColor = p.stopwatch.running ? "rgba(255,160,160,0.38)" : "rgba(112,226,255,0.35)";
    }

    const m0 = p.measurements["empty-disk"]?.elapsedMs;
    const m1 = p.measurements["standard-cylinder"]?.elapsedMs;
    const m2 = p.measurements["unknown-cylinder"]?.elapsedMs;

    if (info) {
      const progress = p.stopwatch.running
        ? `计时中：${p.stopwatch.cycleCount}/${p.stopwatch.targetCycles} 周期`
        : "建议测量 10 个周期计时，以减小读数误差。";
      info.textContent = `${progress}  T0=${m0 ? formatStopwatchMs(m0) : "--"}，T1=${m1 ? formatStopwatchMs(m1) : "--"}，T2=${m2 ? formatStopwatchMs(m2) : "--"}`;
    }

    if (cycleHint) {
      const period = getTorsionPeriodSec(p);
      cycleHint.textContent = `周期 T：${period.toFixed(3)} s`;
    }
  }

  function updateTorsionPendulumState(dt) {
    const p = SIM.params["torsion-pendulum"];
    if (!p.isOscillating) {
      syncTorsionPanelFromState();
      return;
    }

    const period = getTorsionPeriodSec(p);
    const omega = TWO_PI / Math.max(period, 1e-6);

    p.simTimeSec += dt;
    const theta = p.theta0Deg * Math.exp(-p.damping * p.simTimeSec) * Math.cos(omega * p.simTimeSec);

    const prev = p.currentThetaDeg;
    p.prevThetaDeg = prev;
    p.currentThetaDeg = theta;

    const st = p.stopwatch;
    if (st.running) {
      if (prev < 0 && theta >= 0) {
        st.cycleCount += 1;
        if (st.cycleCount >= st.targetCycles) {
          stopTorsionStopwatch(p, true);
        }
      }
      syncTorsionPanelFromState();
    }
  }

  function drawTorsionPendulum() {
    const w = SIM.canvasCssW;
    const h = SIM.canvasCssH;
    if (w < 2 || h < 2) return;

    const p = SIM.params["torsion-pendulum"];
    const cx = w * 0.5;
    const cy = h * 0.55;
    const diskR = Math.min(w, h) * 0.24;

    simCtx.clearRect(0, 0, w, h);

    const bg = simCtx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "rgba(11, 20, 40, 1)");
    bg.addColorStop(1, "rgba(5, 10, 22, 1)");
    simCtx.fillStyle = bg;
    simCtx.fillRect(0, 0, w, h);

    simCtx.strokeStyle = "rgba(172, 200, 240, 0.18)";
    simCtx.lineWidth = 1;
    simCtx.beginPath();
    simCtx.moveTo(cx, 18);
    simCtx.lineTo(cx, cy - diskR * 0.95);
    simCtx.stroke();

    simCtx.fillStyle = "rgba(165, 205, 255, 0.16)";
    simCtx.beginPath();
    simCtx.arc(cx, 18, 8, 0, TWO_PI);
    simCtx.fill();

    simCtx.save();
    simCtx.translate(cx, cy);
    simCtx.scale(1, 0.82);

    const plateGrad = simCtx.createRadialGradient(0, -diskR * 0.2, diskR * 0.05, 0, 0, diskR);
    plateGrad.addColorStop(0, "rgba(198, 214, 238, 0.9)");
    plateGrad.addColorStop(0.45, "rgba(127, 152, 192, 0.92)");
    plateGrad.addColorStop(1, "rgba(58, 74, 98, 0.96)");
    simCtx.fillStyle = plateGrad;
    simCtx.beginPath();
    simCtx.arc(0, 0, diskR, 0, TWO_PI);
    simCtx.fill();

    simCtx.strokeStyle = "rgba(229, 239, 255, 0.5)";
    simCtx.lineWidth = 1.2;
    simCtx.beginPath();
    simCtx.arc(0, 0, diskR, 0, TWO_PI);
    simCtx.stroke();

    drawTorsionObjectOverlay(diskR, p.objectKey);

    simCtx.restore();

    const thetaRad = degToRad(p.currentThetaDeg);
    const lineLen = diskR * 0.9;
    const x1 = cx - lineLen * Math.cos(thetaRad);
    const y1 = cy + lineLen * 0.82 * Math.sin(thetaRad);
    const x2 = cx + lineLen * Math.cos(thetaRad);
    const y2 = cy - lineLen * 0.82 * Math.sin(thetaRad);

    simCtx.strokeStyle = "rgba(255, 88, 88, 0.95)";
    simCtx.lineWidth = 3.2;
    simCtx.beginPath();
    simCtx.moveTo(x1, y1);
    simCtx.lineTo(x2, y2);
    simCtx.stroke();

    simCtx.fillStyle = "rgba(255, 240, 240, 0.95)";
    simCtx.beginPath();
    simCtx.arc(cx, cy, 5, 0, TWO_PI);
    simCtx.fill();

    const T = getTorsionPeriodSec(p);
    const label = getTorsionObjectLabel(p.objectKey);
    els.simReadout.textContent = `对象=${label} · θ=${p.currentThetaDeg.toFixed(2)}° · T=${T.toFixed(3)}s · 10T≈${(10 * T).toFixed(3)}s`;

    syncTorsionPanelFromState();
  }

  function drawTorsionObjectOverlay(diskR, objectKey) {
    if (objectKey === "standard-cylinder") {
      const rg = simCtx.createRadialGradient(-diskR * 0.08, -diskR * 0.08, 2, 0, 0, diskR * 0.28);
      rg.addColorStop(0, "rgba(250, 250, 255, 0.96)");
      rg.addColorStop(1, "rgba(126, 139, 162, 0.95)");
      simCtx.fillStyle = rg;
      simCtx.beginPath();
      simCtx.arc(0, 0, diskR * 0.24, 0, TWO_PI);
      simCtx.fill();
      simCtx.strokeStyle = "rgba(230, 238, 255, 0.65)";
      simCtx.lineWidth = 1;
      simCtx.stroke();
      return;
    }

    if (objectKey === "unknown-cylinder") {
      simCtx.fillStyle = "rgba(164, 182, 208, 0.92)";
      simCtx.beginPath();
      simCtx.arc(0, 0, diskR * 0.26, 0, TWO_PI);
      simCtx.fill();
      simCtx.fillStyle = "rgba(58, 74, 98, 0.98)";
      simCtx.beginPath();
      simCtx.arc(0, 0, diskR * 0.12, 0, TWO_PI);
      simCtx.fill();
      simCtx.strokeStyle = "rgba(230, 238, 255, 0.58)";
      simCtx.lineWidth = 1;
      simCtx.beginPath();
      simCtx.arc(0, 0, diskR * 0.26, 0, TWO_PI);
      simCtx.stroke();
      return;
    }

    simCtx.fillStyle = "rgba(210, 228, 255, 0.62)";
    simCtx.beginPath();
    simCtx.arc(0, 0, diskR * 0.08, 0, TWO_PI);
    simCtx.fill();
  }
  function drawSpectrometerPrism() {
    const w = SIM.canvasCssW;
    const h = SIM.canvasCssH;
    if (w < 2 || h < 2) return;

    const p = SIM.params["spectrometer-prism"];
    const A = clamp(p.prismAngleDeg, 50, 70);
    const theta = normalizeDeg(p.telescopeDeg);
    const { refl1Deg, refl2Deg, phiDeg } = computeSpectrometerReflections(A);

    simCtx.clearRect(0, 0, w, h);

    const bg = simCtx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "rgba(7, 16, 32, 1)");
    bg.addColorStop(1, "rgba(5, 10, 22, 1)");
    simCtx.fillStyle = bg;
    simCtx.fillRect(0, 0, w, h);

    const cx = w * 0.43;
    const cy = h * 0.53;
    const dialR = Math.min(w * 0.31, h * 0.43);

    const dialFill = simCtx.createRadialGradient(cx, cy, dialR * 0.08, cx, cy, dialR);
    dialFill.addColorStop(0, "rgba(22, 36, 66, 0.9)");
    dialFill.addColorStop(1, "rgba(10, 18, 34, 0.92)");
    simCtx.fillStyle = dialFill;
    simCtx.beginPath();
    simCtx.arc(cx, cy, dialR, 0, TWO_PI);
    simCtx.fill();

    simCtx.strokeStyle = "rgba(168, 196, 240, 0.28)";
    simCtx.lineWidth = 1.4;
    simCtx.beginPath();
    simCtx.arc(cx, cy, dialR, 0, TWO_PI);
    simCtx.stroke();

    for (let deg = 0; deg < 360; deg += 5) {
      const major = deg % 30 === 0;
      const r0 = major ? dialR * 0.87 : dialR * 0.91;
      const r1 = dialR * 0.97;
      const p0 = polarPoint(cx, cy, r0, deg);
      const p1 = polarPoint(cx, cy, r1, deg);
      simCtx.strokeStyle = major ? "rgba(211, 226, 255, 0.6)" : "rgba(211, 226, 255, 0.28)";
      simCtx.lineWidth = major ? 1.2 : 0.8;
      simCtx.beginPath();
      simCtx.moveTo(p0.x, p0.y);
      simCtx.lineTo(p1.x, p1.y);
      simCtx.stroke();

      if (major) {
        const labelPos = polarPoint(cx, cy, dialR * 0.8, deg);
        simCtx.fillStyle = "rgba(230, 241, 255, 0.72)";
        simCtx.font = "11px 'Segoe UI', sans-serif";
        simCtx.textAlign = "center";
        simCtx.textBaseline = "middle";
        simCtx.fillText(String(deg), labelPos.x, labelPos.y);
      }
    }

    const apex = { x: cx - dialR * 0.23, y: cy };
    const sideLen = dialR * 0.56;
    const halfA = degToRad(A / 2);
    const upper = {
      x: apex.x + sideLen * Math.cos(halfA),
      y: apex.y - sideLen * Math.sin(halfA),
    };
    const lower = {
      x: apex.x + sideLen * Math.cos(halfA),
      y: apex.y + sideLen * Math.sin(halfA),
    };

    const prismFill = simCtx.createLinearGradient(apex.x, apex.y, upper.x, lower.y);
    prismFill.addColorStop(0, "rgba(90, 192, 255, 0.26)");
    prismFill.addColorStop(1, "rgba(72, 138, 244, 0.14)");
    simCtx.fillStyle = prismFill;
    simCtx.beginPath();
    simCtx.moveTo(apex.x, apex.y);
    simCtx.lineTo(upper.x, upper.y);
    simCtx.lineTo(lower.x, lower.y);
    simCtx.closePath();
    simCtx.fill();

    simCtx.strokeStyle = "rgba(165, 223, 255, 0.9)";
    simCtx.lineWidth = 1.35;
    simCtx.beginPath();
    simCtx.moveTo(apex.x, apex.y);
    simCtx.lineTo(upper.x, upper.y);
    simCtx.lineTo(lower.x, lower.y);
    simCtx.closePath();
    simCtx.stroke();

    const collimatorStartX = cx - dialR * 1.08;
    const collimatorEndX = apex.x - dialR * 0.05;
    simCtx.strokeStyle = "rgba(122, 235, 173, 0.42)";
    simCtx.lineWidth = 12;
    simCtx.lineCap = "round";
    simCtx.beginPath();
    simCtx.moveTo(collimatorStartX, cy);
    simCtx.lineTo(collimatorEndX, cy);
    simCtx.stroke();

    simCtx.strokeStyle = "rgba(160, 255, 196, 0.92)";
    simCtx.lineWidth = 2.2;
    simCtx.beginPath();
    simCtx.moveTo(collimatorStartX, cy);
    simCtx.lineTo(collimatorEndX, cy);
    simCtx.stroke();

    const hitUpper = {
      x: apex.x + (upper.x - apex.x) * 0.34,
      y: apex.y + (upper.y - apex.y) * 0.34,
    };
    const hitLower = {
      x: apex.x + (lower.x - apex.x) * 0.34,
      y: apex.y + (lower.y - apex.y) * 0.34,
    };

    simCtx.strokeStyle = "rgba(128, 247, 173, 0.9)";
    simCtx.lineWidth = 1.5;
    simCtx.beginPath();
    simCtx.moveTo(collimatorStartX, hitUpper.y);
    simCtx.lineTo(hitUpper.x, hitUpper.y);
    simCtx.stroke();

    simCtx.beginPath();
    simCtx.moveTo(collimatorStartX, hitLower.y);
    simCtx.lineTo(hitLower.x, hitLower.y);
    simCtx.stroke();

    const reflLen = dialR * 1.05;
    const reflAngles = [refl1Deg, refl2Deg];
    const hitPoints = [hitUpper, hitLower];

    reflAngles.forEach((deg, idx) => {
      const start = hitPoints[idx];
      const end = polarPoint(start.x, start.y, reflLen, deg);

      simCtx.strokeStyle = "rgba(243, 248, 255, 0.2)";
      simCtx.lineWidth = 5.2;
      simCtx.beginPath();
      simCtx.moveTo(start.x, start.y);
      simCtx.lineTo(end.x, end.y);
      simCtx.stroke();

      simCtx.strokeStyle = "rgba(231, 239, 255, 0.9)";
      simCtx.lineWidth = 1.8;
      simCtx.beginPath();
      simCtx.moveTo(start.x, start.y);
      simCtx.lineTo(end.x, end.y);
      simCtx.stroke();

      const marker = polarPoint(cx, cy, dialR * 0.74, deg);
      simCtx.fillStyle = "rgba(255, 210, 116, 0.94)";
      simCtx.beginPath();
      simCtx.arc(marker.x, marker.y, 3.2, 0, TWO_PI);
      simCtx.fill();
    });

    const tubeEnd = polarPoint(cx, cy, dialR * 1.02, theta);
    const tubeHead = polarPoint(cx, cy, dialR * 0.8, theta);

    simCtx.strokeStyle = "rgba(96, 198, 255, 0.88)";
    simCtx.lineWidth = 5.4;
    simCtx.lineCap = "round";
    simCtx.beginPath();
    simCtx.moveTo(cx, cy);
    simCtx.lineTo(tubeEnd.x, tubeEnd.y);
    simCtx.stroke();

    simCtx.strokeStyle = "rgba(205, 240, 255, 0.95)";
    simCtx.lineWidth = 1.4;
    simCtx.beginPath();
    simCtx.moveTo(cx, cy);
    simCtx.lineTo(tubeEnd.x, tubeEnd.y);
    simCtx.stroke();

    simCtx.fillStyle = "rgba(77, 164, 235, 0.95)";
    simCtx.beginPath();
    simCtx.arc(tubeHead.x, tubeHead.y, 4.6, 0, TWO_PI);
    simCtx.fill();

    const delta1 = signedAngleDeltaDeg(theta, refl1Deg);
    const delta2 = signedAngleDeltaDeg(theta, refl2Deg);
    const pickFirst = Math.abs(delta1) <= Math.abs(delta2);
    const nearestIndex = pickFirst ? 0 : 1;
    const nearestDelta = pickFirst ? delta1 : delta2;

    updateSpectrometerCapture(p, nearestIndex, theta, Math.abs(nearestDelta));
    drawSpectrometerEyepiece(w, h, nearestDelta, p, [refl1Deg, refl2Deg]);

    const t1Text = Number.isFinite(p.theta1Deg) ? `${normalizeDeg(p.theta1Deg).toFixed(2)}°` : "--";
    const t2Text = Number.isFinite(p.theta2Deg) ? `${normalizeDeg(p.theta2Deg).toFixed(2)}°` : "--";
    els.simReadout.textContent = `A=${A.toFixed(2)}° · φ=${phiDeg.toFixed(2)}° · θ=${theta.toFixed(2)}° · θ1=${t1Text} · θ2=${t2Text}`;
  }

  function drawSpectrometerEyepiece(canvasW, canvasH, nearestDelta, p, reflAnglesDeg) {
    const fieldR = Math.min(canvasW, canvasH) * 0.16;
    const ox = canvasW - fieldR - 18;
    const oy = fieldR + 16;

    simCtx.save();

    simCtx.fillStyle = "rgba(6, 10, 20, 0.96)";
    simCtx.beginPath();
    simCtx.arc(ox, oy, fieldR + 7, 0, TWO_PI);
    simCtx.fill();

    simCtx.fillStyle = "rgba(15, 26, 44, 0.95)";
    simCtx.beginPath();
    simCtx.arc(ox, oy, fieldR, 0, TWO_PI);
    simCtx.fill();

    simCtx.strokeStyle = "rgba(201, 224, 255, 0.55)";
    simCtx.lineWidth = 1.4;
    simCtx.beginPath();
    simCtx.arc(ox, oy, fieldR, 0, TWO_PI);
    simCtx.stroke();

    simCtx.beginPath();
    simCtx.arc(ox, oy, fieldR - 1.5, 0, TWO_PI);
    simCtx.clip();

    simCtx.strokeStyle = "rgba(222, 236, 255, 0.55)";
    simCtx.lineWidth = 1;
    simCtx.beginPath();
    simCtx.moveTo(ox - fieldR, oy);
    simCtx.lineTo(ox + fieldR, oy);
    simCtx.stroke();

    simCtx.beginPath();
    simCtx.moveTo(ox, oy - fieldR);
    simCtx.lineTo(ox, oy + fieldR);
    simCtx.stroke();

    const sightWindowDeg = 7;
    const absDelta = Math.abs(nearestDelta);
    if (absDelta < sightWindowDeg) {
      const normalized = clamp(nearestDelta / sightWindowDeg, -1, 1);
      const slitX = ox + normalized * (fieldR * 0.62);
      const glow = Math.exp(-Math.pow(absDelta / 1.2, 2));

      simCtx.strokeStyle = `rgba(232, 248, 255, ${clamp(0.25 + glow * 0.8, 0, 1)})`;
      simCtx.lineWidth = 6;
      simCtx.beginPath();
      simCtx.moveTo(slitX, oy - fieldR * 0.86);
      simCtx.lineTo(slitX, oy + fieldR * 0.86);
      simCtx.stroke();

      simCtx.strokeStyle = `rgba(255, 255, 255, ${clamp(0.4 + glow * 0.6, 0, 1)})`;
      simCtx.lineWidth = 1.8;
      simCtx.beginPath();
      simCtx.moveTo(slitX, oy - fieldR * 0.86);
      simCtx.lineTo(slitX, oy + fieldR * 0.86);
      simCtx.stroke();
    }

    simCtx.restore();

    const measuredA = measuredPrismAngleFromReadings(p.theta1Deg, p.theta2Deg);
    simCtx.fillStyle = "rgba(226, 240, 255, 0.86)";
    simCtx.font = "12px 'Segoe UI', sans-serif";
    simCtx.textAlign = "left";
    simCtx.textBaseline = "alphabetic";
    simCtx.fillText("望远镜目镜视场", ox - fieldR, oy + fieldR + 16);

    const t1 = Number.isFinite(p.theta1Deg) ? `${normalizeDeg(p.theta1Deg).toFixed(2)}°` : "--";
    const t2 = Number.isFinite(p.theta2Deg) ? `${normalizeDeg(p.theta2Deg).toFixed(2)}°` : "--";
    const aText = measuredA == null ? "--" : `${measuredA.toFixed(2)}°`;
    simCtx.fillText(`θ1=${t1}  θ2=${t2}  A_meas=${aText}`, ox - fieldR, oy + fieldR + 32);

    simCtx.fillStyle = "rgba(180, 210, 255, 0.72)";
    simCtx.fillText(`理论角: ${reflAnglesDeg[0].toFixed(2)}° / ${reflAnglesDeg[1].toFixed(2)}°`, ox - fieldR, oy + fieldR + 48);
  }

  function computeSpectrometerReflections(prismAngleDeg) {
    const A = clamp(prismAngleDeg, 0.1, 89.9);
    return {
      refl1Deg: normalizeDeg(180 - A),
      refl2Deg: normalizeDeg(180 + A),
      phiDeg: 2 * A,
    };
  }

  function updateSpectrometerCapture(p, sideIndex, telescopeDeg, absDelta) {
    const lockTol = 0.16;
    const releaseTol = 0.6;

    if (absDelta <= lockTol) {
      const theta = normalizeDeg(telescopeDeg);
      if (sideIndex === 0) {
        p.theta1Deg = theta;
      } else {
        p.theta2Deg = theta;
      }
      p.lastAlignedIndex = sideIndex;
      return;
    }

    if (absDelta > releaseTol) {
      p.lastAlignedIndex = -1;
    }
  }

  function measuredPrismAngleFromReadings(theta1Deg, theta2Deg) {
    if (!Number.isFinite(theta1Deg) || !Number.isFinite(theta2Deg)) return null;
    return Math.abs(signedAngleDeltaDeg(theta1Deg, theta2Deg)) / 2;
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width * 0.5, height * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function forcedAmplitude(freqHz, damping, p) {
    const omega = TWO_PI * freqHz;
    const I = p.inertia;
    const omega0 = TWO_PI * p.naturalFreqHz;
    const k = I * omega0 * omega0;
    const den = Math.sqrt((k - I * omega * omega) ** 2 + (damping * omega) ** 2);
    return den > 1e-12 ? p.drive / den : 0;
  }

  function forcedPhase(freqHz, damping, p) {
    const omega = TWO_PI * freqHz;
    const I = p.inertia;
    const omega0 = TWO_PI * p.naturalFreqHz;
    const k = I * omega0 * omega0;
    return Math.atan2(damping * omega, k - I * omega * omega);
  }

  function resonancePeakFrequencyHz(damping, p) {
    const I = p.inertia;
    const omega0 = TWO_PI * p.naturalFreqHz;
    const term = omega0 * omega0 - (damping * damping) / (2 * I * I);
    return Math.sqrt(Math.max(term, 0)) / TWO_PI;
  }

  function peakAmplitudeForDamping(damping, p) {
    const fPeak = resonancePeakFrequencyHz(damping, p);
    return forcedAmplitude(Math.max(0.2, fPeak), damping, p);
  }

  function estimateNewtonVisibleRingCount(lambdaNm, curvatureMm) {
    const lambda = lambdaNm * 1e-9;
    const R = curvatureMm / 1000;
    const viewRadiusM = 5.2e-3;
    const kVisible = (viewRadiusM * viewRadiusM) / Math.max(R * lambda, 1e-16);
    return Math.max(0, Math.floor(kVisible));
  }

  function updateSimulationPanelUI() {
    const expId = SIM.currentExpId;

    if (expId === "michelson") {
      const p = SIM.params.michelson;
      const color = wavelengthToRGB(p.lambdaNm);
      document.documentElement.style.setProperty("--ring-r", `${color.r}`);
      document.documentElement.style.setProperty("--ring-g", `${color.g}`);
      document.documentElement.style.setProperty("--ring-b", `${color.b}`);

      if (els.simLambdaValue) els.simLambdaValue.textContent = `${p.lambdaNm.toFixed(1)} nm`;
      if (els.simDisplacementValue) {
        const sign = p.displacementUm >= 0 ? "+" : "";
        els.simDisplacementValue.textContent = `${sign}${p.displacementUm.toFixed(3)} μm`;
      }
      if (els.simColorName) els.simColorName.textContent = wavelengthBandName(p.lambdaNm);
      if (els.simOpdValue) {
        const opdNm = p.displacementUm * 2 * 1000;
        const opdSign = opdNm >= 0 ? "+" : "";
        els.simOpdValue.textContent = `${opdSign}${opdNm.toFixed(1)} nm`;
      }
      if (els.simFringeCount) {
        const fringeN = (2 * Math.abs(p.displacementUm) * 1000) / p.lambdaNm;
        els.simFringeCount.textContent = Number.isFinite(fringeN) ? fringeN.toFixed(2) : "0.00";
      }
      return;
    }

    if (expId === "newton-rings") {
      const p = SIM.params["newton-rings"];
      const color = wavelengthToRGB(p.lambdaNm);
      document.documentElement.style.setProperty("--ring-r", `${color.r}`);
      document.documentElement.style.setProperty("--ring-g", `${color.g}`);
      document.documentElement.style.setProperty("--ring-b", `${color.b}`);

      if (els.simLambdaValue) els.simLambdaValue.textContent = `${p.lambdaNm.toFixed(1)} nm`;
      if (els.simDisplacementValue) els.simDisplacementValue.textContent = `${p.curvatureMm.toFixed(0)} mm`;
      if (els.simColorName) els.simColorName.textContent = wavelengthBandName(p.lambdaNm);
      if (els.simOpdValue) {
        const r1mm = Math.sqrt((p.curvatureMm / 1000) * (p.lambdaNm * 1e-9)) * 1000;
        els.simOpdValue.textContent = `${r1mm.toFixed(3)} mm`;
      }
      if (els.simFringeCount) {
        els.simFringeCount.textContent = String(estimateNewtonVisibleRingCount(p.lambdaNm, p.curvatureMm));
      }
      return;
    }

    if (expId === "wheatstone-bridge") {
      const p = SIM.params["wheatstone-bridge"];
      const calc = computeWheatstoneBridgeState(p);
      const grids = estimateWheatstoneGridDeflection(p.needleAngleDeg, p.galvanometerMaxDeg);
      const deflect = p.switchPressed ? `${wheatstoneDeflectionText(p.needleAngleDeg)} ${grids} div` : "open";

      if (els.simLambdaValue) els.simLambdaValue.textContent = `${calc.ratio.toFixed(2)}`;
      if (els.simDisplacementValue) els.simDisplacementValue.textContent = `${calc.rs.toFixed(0)} Ω`;
      if (els.simColorName) els.simColorName.textContent = p.switchPressed ? "已闭合" : "已断开";
      if (els.simOpdValue) els.simOpdValue.textContent = `${(calc.deltaV * 1000).toFixed(2)} mV`;
      if (els.simFringeCount) els.simFringeCount.textContent = deflect;
      return;
    }
    if (expId === "bohr-resonance") {
      const p = SIM.params["bohr-resonance"];
      const amp = forcedAmplitude(p.freqHz, p.damping, p);
      const phase = forcedPhase(p.freqHz, p.damping, p);
      const fRes = resonancePeakFrequencyHz(p.damping, p);

      if (els.simLambdaValue) els.simLambdaValue.textContent = `${p.freqHz.toFixed(2)} Hz`;
      if (els.simDisplacementValue) els.simDisplacementValue.textContent = `${p.damping.toFixed(2)}`;
      if (els.simColorName) els.simColorName.textContent = `${(phase * 180 / Math.PI).toFixed(1)}°`;
      if (els.simOpdValue) els.simOpdValue.textContent = amp.toExponential(2);
      if (els.simFringeCount) els.simFringeCount.textContent = `${fRes.toFixed(2)} Hz`;
      return;
    }

    if (expId === "spectrometer-prism") {
      const p = SIM.params["spectrometer-prism"];
      const A = p.prismAngleDeg;
      const theta = normalizeDeg(p.telescopeDeg);
      const refs = computeSpectrometerReflections(A);
      const d1 = signedAngleDeltaDeg(theta, refs.refl1Deg);
      const d2 = signedAngleDeltaDeg(theta, refs.refl2Deg);
      const nearest = Math.abs(d1) <= Math.abs(d2) ? d1 : d2;
      const measuredA = measuredPrismAngleFromReadings(p.theta1Deg, p.theta2Deg);

      if (els.simLambdaValue) els.simLambdaValue.textContent = `${A.toFixed(2)} °`;
      if (els.simDisplacementValue) els.simDisplacementValue.textContent = `${theta.toFixed(2)} °`;
      if (els.simColorName) els.simColorName.textContent = `${refs.phiDeg.toFixed(2)} °`;
      if (els.simOpdValue) {
        const sign = nearest >= 0 ? "+" : "";
        els.simOpdValue.textContent = `${sign}${nearest.toFixed(2)} °`;
      }
      if (els.simFringeCount) {
        els.simFringeCount.textContent = measuredA == null ? "--" : `${measuredA.toFixed(2)} °`;
      }
      return;
    }

    if (expId === "torsion-pendulum") {
      const p = SIM.params["torsion-pendulum"];
      const T = getTorsionPeriodSec(p);
      const elapsedMs = getTorsionElapsedMs(p);

      if (els.simLambdaValue) els.simLambdaValue.textContent = `${p.theta0Deg.toFixed(1)} °`;
      if (els.simDisplacementValue) els.simDisplacementValue.textContent = "--";
      if (els.simColorName) els.simColorName.textContent = getTorsionObjectLabel(p.objectKey);
      if (els.simOpdValue) els.simOpdValue.textContent = `${T.toFixed(3)} s`;
      if (els.simFringeCount) els.simFringeCount.textContent = formatStopwatchMs(elapsedMs);

      syncTorsionPanelFromState();
    }
  }
  function buildSimulationPrompt(expId) {
    if (expId === "michelson") {
      const p = SIM.params.michelson;
      const lambda = p.lambdaNm.toFixed(1);
      const colorName = wavelengthBandName(p.lambdaNm);
      const sign = p.displacementUm >= 0 ? "+" : "";

      let observed = "当前条纹基本保持稳定";
      let action = "保持微动镜缓慢静止";

      if (SIM.motion === "outward") {
        action = "向前推进微动镜";
        observed = "观察到条纹向外扩展并加快移动";
      } else if (SIM.motion === "inward") {
        action = "向后回退微动镜";
        observed = "观察到条纹向中心收缩并逐渐密集";
      }

      return `我正在“迈克尔逊干涉仪测定激光波长”实验中进行观察。当前激光波长为 ${lambda}nm（${colorName}），微动镜相对零位位移为 ${sign}${p.displacementUm.toFixed(3)}μm，当前我正在${action}，并且${observed}。请结合 2d\\cos\\theta = k\\lambda 与 \\Delta d = N\\frac{\\lambda}{2} 解释条纹变化原因，并判断光程差是在增大还是减小。`;
    }

    if (expId === "newton-rings") {
      const p = SIM.params["newton-rings"];
      const lambda = p.lambdaNm.toFixed(1);
      const colorName = wavelengthBandName(p.lambdaNm);
      const R = p.curvatureMm.toFixed(0);
      const action = describeNewtonAction();

      return `我正在“光的等厚干涉——牛顿环实验”中观察条纹。当前入射光波长为 ${lambda}nm（${colorName}），透镜曲率半径 R=${R}mm，画面显示中心为暗斑，圆环半径随级次逐渐增大。${action}。请结合暗环半径公式 r_k=\\sqrt{kR\\lambda} 与亮环半径公式 r_k=\\sqrt{(k-0.5)R\\lambda}，解释牛顿环分布规律，并说明当波长或曲率半径变化时条纹如何变化。`;
    }

    if (expId === "wheatstone-bridge") {
      const p = SIM.params["wheatstone-bridge"];
      const calc = computeWheatstoneBridgeState(p);
      const grids = estimateWheatstoneGridDeflection(p.needleAngleDeg, p.galvanometerMaxDeg);
      const deflect = p.switchPressed ? `${wheatstoneDeflectionText(p.needleAngleDeg)} ${grids} div` : "switch open";
      const action = describeWheatstoneAction();

      return `我正在进行“用惠斯通电桥测电阻”实验。当前比例臂 R1/R2 = ${calc.ratio.toFixed(2)}，比较臂 Rs = ${calc.rs.toFixed(0)} Ω，开关状态：${p.switchPressed ? "已闭合" : "已断开"}，检流计显示：${deflect}。${action}。请根据平衡条件 Rx=(R1/R2)Rs 和电势差方向，判断下一步应该增大还是减小 Rs，并解释微调依据。`;
    }
    if (expId === "bohr-resonance") {
      const p = SIM.params["bohr-resonance"];
      const f = p.freqHz;
      const c = p.damping;
      const fRes = resonancePeakFrequencyHz(c, p);
      const closeToPeak = Math.abs(f - fRes) <= 0.08;
      const position = closeToPeak ? "恰好处在共振附近" : f < fRes ? "低于共振区" : "高于共振区";
      const dampingLevel = c < 0.2 ? "较小" : c < 0.5 ? "中等" : "较大";
      const action = describeBohrAction();

      return `我目前在“波尔共振仪研究受迫振动”实验中。当前驱动频率为 ${f.toFixed(2)} Hz，${position}，共振频率约为 f_r=${fRes.toFixed(2)} Hz；阻尼系数为 ${dampingLevel}，c=${c.toFixed(2)}。${action}。请结合稳态振幅公式 A = \\frac{M_0}{\\sqrt{(k-I\\omega^2)^2+(c\\omega)^2}} 与对应微分方程，解释为什么振幅会在某频率附近达到最大，以及阻尼变化后峰值高度和共振频率将如何变化。`;
    }

    if (expId === "spectrometer-prism") {
      const p = SIM.params["spectrometer-prism"];
      const refs = computeSpectrometerReflections(p.prismAngleDeg);
      const theta1 = Number.isFinite(p.theta1Deg) ? normalizeDeg(p.theta1Deg) : refs.refl1Deg;
      const theta2 = Number.isFinite(p.theta2Deg) ? normalizeDeg(p.theta2Deg) : refs.refl2Deg;
      const measuredA = Math.abs(signedAngleDeltaDeg(theta1, theta2)) / 2;
      const captureHint = Number.isFinite(p.theta1Deg) && Number.isFinite(p.theta2Deg)
        ? `我分别读得 θ1=${theta1.toFixed(2)}°、θ2=${theta2.toFixed(2)}°，已经记录了两次反射位置。`
        : `我当前望远镜角度为 θ=${normalizeDeg(p.telescopeDeg).toFixed(2)}°，目前只捕捉到一侧反射亮线，还在继续搜索另一侧。`;

      return `我当前正在做“分光计调节和棱镜顶角的测定”实验。待测棱镜顶角设定为 A=${p.prismAngleDeg.toFixed(2)}°，理论反射夹角为 φ=${refs.phiDeg.toFixed(2)}°。${captureHint}。请根据反射法公式 A = \\frac{|\\theta_1 - \\theta_2|}{2}，说明如何由两次读数求出棱镜顶角，并解释双侧反射对称出现的原因。同时比较我当前测得的 A_meas=${measuredA.toFixed(2)}° 与设定值是否一致。`;
    }

    if (expId === "torsion-pendulum") {
      const p = SIM.params["torsion-pendulum"];
      const t0 = p.measurements["empty-disk"]?.elapsedMs ?? 10 * getTorsionPeriodSec(p, "empty-disk") * 1000;
      const t1 = p.measurements["standard-cylinder"]?.elapsedMs ?? 10 * getTorsionPeriodSec(p, "standard-cylinder") * 1000;
      const t2 = p.measurements["unknown-cylinder"]?.elapsedMs ?? 10 * getTorsionPeriodSec(p, "unknown-cylinder") * 1000;
      const periodCurrent = getTorsionPeriodSec(p);
      const obj = getTorsionObjectLabel(p.objectKey);

      return `我正在进行“扭摆法测量物体的转动惯量”实验。当前实验对象为${obj}，初始偏转角为 θ0=${p.theta0Deg.toFixed(1)}°，当前周期约为 T=${periodCurrent.toFixed(3)} s。已记录 10 个周期的计时：空载圆盘 ${formatStopwatchMs(t0)}，标准圆柱体 ${formatStopwatchMs(t1)}，未知圆柱筒 ${formatStopwatchMs(t2)}。其中标准圆柱体已知转动惯量 I1=${p.knownInertia.toFixed(4)} kg·m^2。请根据周期公式 T = 2π\\sqrt{I/K} 推导扭转常量 K，并进一步求出未知物体的转动惯量。同时说明为什么实验通常测量 10 个周期而不是只测 1 个周期。`;
    }

    return `请讲解【${experimentMap.get(expId)?.name || "该实验"}】的关键现象与参数变化之间的关系。`;
  }
  function describeNewtonAction() {
    const a = SIM.lastControlAction;
    if (a.expId !== "newton-rings") return "目前我保持参数不变，继续观察条纹变化。";

    if (a.key === "lambdaNm") {
      if (a.direction > 0) return "我刚刚增大了波长，圆环间距明显变疏。";
      if (a.direction < 0) return "我刚刚减小了波长，圆环分布变得更密。";
    }

    if (a.key === "curvatureMm") {
      if (a.direction > 0) return "我刚刚增大了曲率半径，圆环整体外扩并变疏。";
      if (a.direction < 0) return "我刚刚减小了曲率半径，圆环向内收缩并变密。";
    }

    return "目前我保持参数不变，继续观察条纹变化。";
  }

  function describeBohrAction() {
    const a = SIM.lastControlAction;
    if (a.expId !== "bohr-resonance") return "我正在观察系统在不同频率与阻尼下的共振响应。";

    if (a.key === "freqHz") {
      if (a.direction > 0) return "我刚刚提高了驱动频率，振幅峰位置似乎向高频侧靠近。";
      if (a.direction < 0) return "我刚刚降低了驱动频率，系统响应正远离高频一侧。";
    }

    if (a.key === "damping") {
      if (a.direction > 0) return "我刚刚增大了阻尼，峰值降低且共振曲线更平缓。";
      if (a.direction < 0) return "我刚刚减小了阻尼，振幅增大且峰形更尖锐。";
    }

    return "我正在观察系统在不同频率与阻尼下的共振响应。";
  }

  function describeWheatstoneAction() {
    const a = SIM.lastControlAction;
    if (a.expId !== "wheatstone-bridge") return "";

    if (a.key === "ratio") {
      if (a.direction > 0) return "I just increased R1/R2.";
      if (a.direction < 0) return "I just decreased R1/R2.";
    }

    if (a.key === "rsOhm") {
      if (a.direction > 0) return "I just increased Rs.";
      if (a.direction < 0) return "I just decreased Rs.";
    }

    return "";
  }
  function fillAndSendPrompt(prompt) {
    els.chatInput.value = prompt;
    autoResizeTextarea(els.chatInput);
    sendMessage(prompt);
  }

  async function uploadFiles(files) {
    setUploadStatus(`正在上传 ${files.length} 个文件...`);
    const lastAttachment = [...files]
      .reverse()
      .find((file) => file.type.startsWith("image/") || file.type.startsWith("audio/"));

    const form = new FormData();
    form.append("session_id", APP.sessionId);
    files.forEach((file) => form.append("files", file));

    try {
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || `上传失败 (${response.status})`);
      }

      const docEntries = Array.isArray(data.documents) ? data.documents : [];
      const imgEntries = Array.isArray(data.images) ? data.images : [];
      const audioEntries = Array.isArray(data.audios) ? data.audios : [];
      const skipped = Array.isArray(data.skipped) ? data.skipped : [];

      renderUploadedFileList(docEntries, imgEntries, audioEntries, skipped);

      if (lastAttachment?.type.startsWith("image/") && imgEntries.length > 0) {
        const latest = imgEntries.find((item) => item.name === lastAttachment.name) || imgEntries[imgEntries.length - 1];
        APP.pendingImage = {
          base64: latest.image_base64,
          mime: latest.image_mime || "image/jpeg",
          name: latest.name || "已上传图片",
        };
        APP.pendingAudio = null;
      } else if (lastAttachment?.type.startsWith("audio/") && audioEntries.length > 0) {
        const latest = audioEntries.find((item) => item.name === lastAttachment.name) || audioEntries[audioEntries.length - 1];
        APP.pendingAudio = {
          base64: latest.audio_base64,
          mime: latest.audio_mime || "audio/webm",
          name: latest.name || "已上传音频",
        };
        APP.pendingImage = null;
      }

      updatePendingAttachmentBars();

      const summary = [];
      if (docEntries.length) summary.push(`文档 ${docEntries.length}`);
      if (imgEntries.length) summary.push(`图片 ${imgEntries.length}`);
      if (audioEntries.length) summary.push(`音频 ${audioEntries.length}`);
      if (skipped.length) summary.push(`跳过 ${skipped.length}`);
      setUploadStatus(summary.length ? `上传完成：${summary.join("，")}` : "未检测到有效文件");
    } catch (error) {
      setUploadStatus(`上传失败：${error.message}`);
    }
  }

  function renderUploadedFileList(docEntries, imgEntries = [], audioEntries = [], skipped = []) {
    const items = [];

    docEntries.forEach((doc, index) => {
      const name = doc.name || doc.original_name || `文档 ${index + 1}`;
      const chars = Number(doc.chars || doc.char_count || 0);
      items.push(`${name}：${chars} 字`);
    });

    imgEntries.forEach((item) => {
      items.push(`${item.name || "图片"}：已就绪（视觉分析）`);
    });

    audioEntries.forEach((item) => {
      items.push(`${item.name || "音频"}：已就绪（语音分析）`);
    });

    skipped.forEach((item) => {
      items.push(`${item.name || "未知文件"}：已跳过（${item.reason || "未知原因"}）`);
    });

    if (!els.uploadedFiles) return;
    els.uploadedFiles.innerHTML = "";
    items.slice(-8).forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      els.uploadedFiles.appendChild(li);
    });
  }

  function setUploadStatus(text) {
    if (els.uploadStatus) {
      els.uploadStatus.textContent = text;
    }
  }

  async function clearDocuments() {
    try {
      const response = await fetch(`/api/clear-docs?session_id=${encodeURIComponent(APP.sessionId)}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      APP.pendingImage = null;
      APP.pendingAudio = null;
      updatePendingAttachmentBars();
      renderUploadedFileList([]);
      setUploadStatus("文档已清空");
      await loadSessionCatalog();
    } catch (error) {
      showToast(`清空文档失败：${error.message}`);
    }
  }

  function updatePendingAttachmentBars() {
    if (els.pendingImageBar && els.pendingImageText) {
      if (!APP.pendingImage) {
        els.pendingImageBar.classList.add("hidden");
      } else {
        els.pendingImageText.textContent = `图片【${APP.pendingImage.name}】已就绪，下一条消息将调用视觉模型`;
        els.pendingImageBar.classList.remove("hidden");
      }
    }

    if (els.pendingAudioBar && els.pendingAudioText) {
      if (!APP.pendingAudio) {
        els.pendingAudioBar.classList.add("hidden");
      } else {
        els.pendingAudioText.textContent = `语音【${APP.pendingAudio.name}】已就绪，下一条消息将调用音频模型`;
        els.pendingAudioBar.classList.remove("hidden");
      }
    }
  }

  async function hydrateSession() {
    const response = await fetch(`/api/session?session_id=${encodeURIComponent(APP.sessionId)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    APP.isHydrating = false;
    APP.currentSessionTitle = data.title || "新对话";
    APP.history = buildRecentQuestions(data.messages || []);
    saveHistory(APP.history);
    await loadSessionCatalog();
    renderUploadedFileList(data.documents || []);
    setUploadStatus(data.doc_count ? `已载入 ${data.doc_count} 份文档` : "未上传文件");
    if (data.last_model && els.modelBadge) {
      els.modelBadge.textContent = data.last_model;
    }
    renderConversation(data.messages || []);
    if (!Array.isArray(data.messages) || !data.messages.length) {
      return;
      appendAgentMessage(
        "欢迎使用多模态物理实验教学 Agent。\n\n点击左侧【🧲 物理实验库】可快速选择 11 个经典实验。当前已支持仿真：迈克尔逊干涉、牛顿环、惠斯通电桥、波尔共振、分光计调节与棱镜顶角、扭摆法转动惯量。"
      );
    }
  }

  function renderConversation(messages) {
    els.chatMessages.innerHTML = "";
    messages.forEach((message) => {
      if (message.role === "user") {
        appendUserMessage(message.content || "", { rowId: message.id || `user-${Date.now()}` });
        return;
      }
      const content = message.status === "error" ? (message.content || "上次回复中断") : message.content;
      appendAgentMessage(content || "模型未返回可用结果", { rowId: message.id || `assistant-${Date.now()}` });
    });
    refreshQuickJumpPanel();
  }

  function buildRecentQuestions(messages) {
    return messages
      .filter((message) => message.role === "user")
      .slice(-50)
      .reverse()
      .map((message, index) => ({
        id: message.id || `history-${index}`,
        text: message.content || "",
        at: Date.parse(message.created_at || "") || Date.now(),
      }));
  }

  async function sendMessage(text, options = {}) {
    const hiddenImage = options.hiddenImage || null;
    const effectiveImage = hiddenImage || APP.pendingImage;
    const effectiveAudio = hiddenImage ? null : APP.pendingAudio;
    if (APP.sending || (!text && !effectiveImage && !effectiveAudio)) return;

    APP.sending = true;
    if (els.sendBtn) els.sendBtn.disabled = true;
    if (els.recordBtn) els.recordBtn.disabled = true;

    const inputText = buildOutgoingDisplayText(text, options);
    appendUserMessage(inputText, { rowId: `temp-user-${Date.now()}` });
    if (text) {
      pushHistory(text);
    }

    els.chatInput.value = "";
    autoResizeTextarea(els.chatInput);

    const loadingRow = appendLoadingMessage();
    let streamingRow = null;
    let fullAnswer = "";
    let sseBuffer = "";

    try {
      const payload = {
        session_id: APP.sessionId,
        message: text,
      };

      if (options.externalLabContext) {
        payload.external_lab_context = options.externalLabContext;
      }

      if (effectiveImage?.base64) {
        payload.image_b64 = effectiveImage.base64;
        payload.image_base64 = effectiveImage.base64;
        payload.image_mime = effectiveImage.mime;
      }

      if (effectiveAudio?.base64) {
        payload.audio_base64 = effectiveAudio.base64;
        payload.audio_mime = effectiveAudio.mime;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type") || "";

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `请求失败 (${response.status})`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.detail || errorMessage;
        } catch {
          if (errorText.trim()) errorMessage = errorText.trim();
        }
        throw new Error(errorMessage);
      }

      if (contentType.includes("application/json")) {
        loadingRow.remove();
        const data = await response.json().catch(() => ({}));
        const answer = (data.answer || "").trim() || "模型未返回可用结果";
        appendAgentMessage(answer);
        if (data.model && els.modelBadge) {
          els.modelBadge.textContent = data.model;
        }
        if (!hiddenImage) {
          APP.pendingImage = null;
        }
        if (effectiveAudio?.base64) {
          APP.pendingAudio = null;
        }
        updatePendingAttachmentBars();
        await loadSessionCatalog();
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      if (!reader) {
        throw new Error("浏览器不支持流式响应读取");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const eventBlocks = sseBuffer.split("\n\n");
        sseBuffer = eventBlocks.pop() || "";

        for (const block of eventBlocks) {
          const dataLines = block
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.startsWith("data:"));

          if (!dataLines.length) continue;

          const payloadText = dataLines.map((line) => line.slice(5).trimStart()).join("\n");

          let eventData;
          try {
            eventData = JSON.parse(payloadText);
          } catch {
            continue;
          }

          if (eventData.type === "model") {
            if (eventData.model && els.modelBadge) {
              els.modelBadge.textContent = eventData.model;
            }
            continue;
          }

          if (eventData.type === "chunk") {
            if (!streamingRow) {
              loadingRow.remove();
              streamingRow = createStreamingAgentMessage(els.modelBadge?.textContent || "");
            }
            fullAnswer += eventData.text || "";
            updateStreamingAgentMessage(streamingRow, fullAnswer);
            continue;
          }

          if (eventData.type === "error") {
            throw new Error(eventData.message || "流式输出失败");
          }
        }
      }

      if (streamingRow) {
        finalizeStreamingAgentMessage(streamingRow, fullAnswer || "模型未返回可用结果");
      } else {
        loadingRow.remove();
        appendAgentMessage(fullAnswer || "模型未返回可用结果");
      }

      if (!hiddenImage) {
        APP.pendingImage = null;
      }
      if (effectiveAudio?.base64) {
        APP.pendingAudio = null;
      }
      updatePendingAttachmentBars();
      await loadSessionCatalog();
    } catch (error) {
      loadingRow.remove();
      if (streamingRow && fullAnswer) {
        finalizeStreamingAgentMessage(streamingRow, `${fullAnswer}\n\n> 请求中断：${error.message}`);
      } else {
        appendAgentMessage(`请求失败：${error.message}`);
      }
    } finally {
      APP.sending = false;
      if (els.sendBtn) els.sendBtn.disabled = false;
      if (els.recordBtn) els.recordBtn.disabled = false;
      scrollChatToBottom();
      refreshQuickJumpPanel();
    }
  }

  function normalizeLabPrefix(text) {
    return String(text || "").replace(/^\[PhET课外实验：/u, "[课外仿真实验：");
  }

  function appendUserMessage(text, { rowId = null } = {}) {
    if (!els.chatMessages) return;
    const normalizedText = normalizeLabPrefix(text);

    const row = document.createElement("div");
    row.className = "message-row user fade-up";
    row.id = rowId || `user-row-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    row.dataset.jumpLabel = truncateText(String(normalizedText || "[空消息]").replace(/\s+/g, " "), 18);

    const bubble = document.createElement("div");
    bubble.className = "bubble user";
    bubble.textContent = normalizedText;

    row.appendChild(bubble);
    els.chatMessages.appendChild(row);
    scrollChatToBottom();
    refreshQuickJumpPanel();
  }

  function buildOutgoingDisplayText(text, options = {}) {
    const externalLabContext = options.externalLabContext || null;
    const baseText = text || (APP.pendingAudio ? "[语音提问]" : APP.pendingImage ? "[图片提问]" : "[空消息]");
    if (!externalLabContext?.provider || externalLabContext.provider !== "phet") {
      return baseText;
    }
    const title = externalLabContext.title_zh || externalLabContext.title_en || externalLabContext.slug || "未命名实验";
    return `[课外仿真实验：${title}]\n${baseText}`;
  }

  function appendAgentMessage(rawText, { rowId = null } = {}) {
    if (!els.chatMessages) return;

    const row = document.createElement("div");
    row.className = "message-row agent fade-up";
    row.id = rowId || `assistant-row-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const bubble = document.createElement("div");
    bubble.className = "bubble agent";

    bubble.innerHTML = `<div class="markdown-body">${renderContent(rawText)}</div>`;

    row.appendChild(bubble);
    els.chatMessages.appendChild(row);
    scrollChatToBottom();
  }

  function createStreamingAgentMessage(modelName = "") {
    if (!els.chatMessages) return null;

    const row = document.createElement("div");
    row.className = "message-row agent fade-up";
    row.id = `assistant-stream-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const bubble = document.createElement("div");
    bubble.className = "bubble agent";
    bubble.innerHTML = '<div class="markdown-body streaming-active"><span class="streaming-cursor"></span></div>';

    row.appendChild(bubble);
    row._streamText = "";
    row._renderRAF = null;
    els.chatMessages.appendChild(row);

    if (modelName && els.modelBadge) {
      els.modelBadge.textContent = modelName;
    }

    scrollChatToBottom();
    return row;
  }

  function updateStreamingAgentMessage(row, text) {
    if (!row) return;
    row._streamText = text;
    if (row._renderRAF) return;
    row._renderRAF = requestAnimationFrame(() => {
      row._renderRAF = null;
      const el = row.querySelector(".markdown-body");
      if (!el) return;
      el.innerHTML = renderContent(row._streamText);
      _appendStreamCursor(el);
      scrollChatToBottom();
    });
  }

  function _appendStreamCursor(container) {
    let target = container;
    while (target.lastElementChild) {
      const last = target.lastElementChild;
      const tag = (last.tagName || "").toLowerCase();
      if (["br", "hr", "img", "svg", "canvas", "table"].includes(tag)) break;
      if (last.classList.contains("katex-display") || last.classList.contains("katex")) break;
      target = last;
    }
    const cursor = document.createElement("span");
    cursor.className = "streaming-cursor";
    target.appendChild(cursor);
  }

  function finalizeStreamingAgentMessage(row, text) {
    if (!row) return;
    if (row._renderRAF) {
      cancelAnimationFrame(row._renderRAF);
      row._renderRAF = null;
    }
    const contentEl = row.querySelector(".markdown-body");
    if (!contentEl) return;
    contentEl.classList.remove("streaming-active");
    contentEl.innerHTML = renderContent(text);
    scrollChatToBottom();
  }

  function renderContent(rawText) {
    const source = String(rawText ?? "");
    const mathBlocks = [];

    let protectedText = source
      .replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
        const token = `@@MATH_BLOCK_${mathBlocks.length}@@`;
        mathBlocks.push(match);
        return token;
      });

    protectedText = protectedText
      .replace(/\\\[([\s\S]*?)\\\]/g, (match) => {
        const token = `@@MATH_BLOCK_${mathBlocks.length}@@`;
        mathBlocks.push(match);
        return token;
      })
      .replace(/\\\(([\s\S]*?)\\\)/g, (match) => {
        const token = `@@MATH_BLOCK_${mathBlocks.length}@@`;
        mathBlocks.push(match);
        return token;
      })
      .replace(/\$(?!\$)((?:[^$\n\\]|\\.)*?)\$(?!\$)/g, (match) => {
        const token = `@@MATH_BLOCK_${mathBlocks.length}@@`;
        mathBlocks.push(match);
        return token;
      });

    let html = window.marked ? marked.parse(protectedText) : escapeHtml(protectedText);
    html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
    html = html.replace(/@@MATH_BLOCK_(\d+)@@/g, (_, index) => mathBlocks[Number(index)] || "");

    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;

    renderMath(wrapper);
    return wrapper.innerHTML;
  }

  function appendLoadingMessage() {
    if (!els.chatMessages) return document.createElement("div");

    const row = document.createElement("div");
    row.className = "message-row agent fade-up";

    const bubble = document.createElement("div");
    bubble.className = "bubble agent loading";
    bubble.textContent = "正在思考中...";

    row.appendChild(bubble);
    els.chatMessages.appendChild(row);
    scrollChatToBottom();
    return row;
  }

  function renderMath(root) {
    if (!window.renderMathInElement || !root) return;

    renderMathInElement(root, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
    });
  }

  function scrollChatToBottom() {
    if (!els.chatMessages) return;
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }

  function autoResizeTextarea(textarea) {
    if (!textarea) return;
    const preservedScrollers = [];
    let parent = textarea.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      if (/(auto|scroll|overlay)/.test(style.overflowY)) {
        preservedScrollers.push([parent, parent.scrollTop]);
      }
      parent = parent.parentElement;
    }
    const pageScrollTop = window.scrollY;
    const maxHeight = Number(textarea.dataset.maxHeight || 148);
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
    preservedScrollers.forEach(([element, top]) => {
      element.scrollTop = top;
    });
    window.scrollTo(window.scrollX, pageScrollTop);
  }

  function pushHistory(text) {
    APP.history.unshift({
      id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      text,
      at: Date.now(),
    });

    APP.history = APP.history.slice(0, 50);
    saveHistory(APP.history);
  }

  function renderSessionCatalog() {
    if (!els.historyList) return;

    els.historyList.innerHTML = "";
    const projects = APP.sessionCatalog.folders || [];
    const sessions = APP.sessionCatalog.sessions || [];
    const rootSessions = sessions.filter((item) => !item.folder_id);

    if (!projects.length && !rootSessions.length) {
      const li = document.createElement("li");
      li.className = "history-empty";
      li.textContent = "开始提问后，对话会出现在这里";
      els.historyList.appendChild(li);
      return;
    }

    projects.forEach((project) => {
      const li = document.createElement("li");
      const projectSessions = sessions.filter((item) => item.folder_id === project.id);
      const isOpen = APP.folderOpenMap[project.id] !== false;
      const menuOpen = APP.openMenuId === `folder:${project.id}`;

      li.className = "history-folder";
      li.innerHTML = `
        <div class="folder-shell" data-drop-folder="${project.id}">
          <div class="folder-header">
            <button type="button" class="folder-info text-btn" data-action="toggle-folder" data-folder-id="${project.id}">
              <span class="folder-chevron"><i class="ri-${isOpen ? "arrow-down-s-line" : "arrow-right-s-line"}"></i></span>
              <span class="folder-leading-icon"><i class="ri-folder-2-line"></i></span>
              <span class="folder-name">${escapeHtml(project.name)}</span>
              <span class="folder-count">${project.session_count ?? projectSessions.length}</span>
            </button>
            <div class="row-hover-actions">
              <button type="button" class="row-menu-trigger" data-action="toggle-folder-menu" data-folder-id="${project.id}" aria-label="项目操作">
                <i class="ri-more-2-fill"></i>
              </button>
              <div class="row-popover-menu${menuOpen ? "" : " hidden"}">
                <button type="button" class="row-popover-item" data-action="new-session-in-folder" data-folder-id="${project.id}">
                  <i class="ri-chat-new-line"></i>
                  <span>新建对话</span>
                </button>
                <button type="button" class="row-popover-item" data-action="rename-folder" data-folder-id="${project.id}">
                  <i class="ri-edit-line"></i>
                  <span>重命名项目</span>
                </button>
                <button type="button" class="row-popover-item danger" data-action="delete-folder" data-folder-id="${project.id}">
                  <i class="ri-delete-bin-6-line"></i>
                  <span>删除项目</span>
                </button>
              </div>
            </div>
          </div>
          <ul class="folder-session-list${isOpen ? "" : " hidden"}">
            ${projectSessions.map((session) => renderSessionRow(session)).join("") || '<li class="history-empty-subtle">拖拽对话到这个项目</li>'}
          </ul>
        </div>
      `;
      els.historyList.appendChild(li);
    });

    if (rootSessions.length) {
      const li = document.createElement("li");
      li.className = "root-session-group";
      li.innerHTML = `
        <div class="root-session-list" data-drop-folder="root">
          ${rootSessions.map((session) => renderSessionRow(session)).join("")}
        </div>
      `;
      els.historyList.appendChild(li);
    }
  }

  function renderSessionRow(session) {
    const updatedAt = formatTime(Date.parse(session.updated_at || "") || Date.now());
    const title = escapeHtml(session.title || "新对话");
    const activeClass = session.session_id === APP.sessionId ? " active" : "";
    const menuOpen = APP.openMenuId === `session:${session.session_id}`;
    const sessionMeta = `${updatedAt}${session.doc_count ? ` · ${session.doc_count} 文档` : ""}`;

    return `
      <div class="session-row${activeClass}" data-session-id="${session.session_id}" draggable="true">
        <div class="session-row-main">
          <span class="session-row-icon"><i class="ri-message-3-line"></i></span>
          <div class="session-row-body">
            <div class="session-row-title">${title}</div>
            <div class="session-row-meta">${sessionMeta}</div>
          </div>
        </div>
        <div class="row-hover-actions">
          <button type="button" class="row-menu-trigger" data-action="toggle-session-menu" data-session-id="${session.session_id}" aria-label="对话操作">
            <i class="ri-more-2-fill"></i>
          </button>
          <div class="row-popover-menu${menuOpen ? "" : " hidden"}">
            <button type="button" class="row-popover-item" data-action="rename-session" data-session-id="${session.session_id}">
              <i class="ri-edit-line"></i>
              <span>重命名</span>
            </button>
            <button type="button" class="row-popover-item" data-action="move-session-picker" data-session-id="${session.session_id}">
              <i class="ri-folder-transfer-line"></i>
              <span>${session.folder_id ? "移动项目" : "加入项目"}</span>
            </button>
            ${session.folder_id ? `
              <button type="button" class="row-popover-item" data-action="move-session-root" data-session-id="${session.session_id}">
                <i class="ri-link-unlink-m"></i>
                <span>移出项目</span>
              </button>
            ` : ""}
            <button type="button" class="row-popover-item danger" data-action="delete-session" data-session-id="${session.session_id}">
              <i class="ri-delete-bin-6-line"></i>
              <span>删除对话</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderHistory() {
    if (!els.historyList) return;
    renderSessionCatalog();
    queueMenuPlacementSync();
    return;

    els.historyList.innerHTML = "";
    const navFolders = APP.sessionCatalog.folders || [];
    const navSessions = APP.sessionCatalog.sessions || [];

    if (!navFolders.length && !navSessions.length) {
      const li = document.createElement("li");
      li.className = "history-empty";
      li.textContent = "开始提问后，对话会出现在这里";
      els.historyList.appendChild(li);
      return;
    }

    const navGroups = [
      ...navFolders.map((folder) => ({
        ...folder,
        sessions: navSessions.filter((item) => item.folder_id === folder.id),
      })),
      {
        id: "__default__",
        name: "默认",
        session_count: navSessions.filter((item) => !item.folder_id).length,
        sessions: navSessions.filter((item) => !item.folder_id),
        isDefault: true,
      },
    ];

    navGroups.forEach((group) => {
      const li = document.createElement("li");
      li.className = `history-folder${group.isDefault ? " default-folder" : ""}`;
      const isOpen = APP.folderOpenMap[group.id] !== false;
      const folderMenuOpen = APP.openMenuId === `folder:${group.id}`;
      const sessionHtml = group.sessions
        .map((session) => {
          const updatedAt = formatTime(Date.parse(session.updated_at || "") || Date.now());
          const title = escapeHtml(session.title || "新对话");
          const activeClass = session.session_id === APP.sessionId ? " active" : "";
          const menuOpen = APP.openMenuId === `session:${session.session_id}`;
          return `
            <li>
              <div class="session-row${activeClass}" data-session-id="${session.session_id}" draggable="true">
                <div class="session-row-main">
                  <span class="session-row-icon"><i class="ri-message-3-line"></i></span>
                  <div class="session-row-body">
                    <div class="session-row-title">${title}</div>
                    <div class="session-row-meta">${updatedAt}${session.doc_count ? ` · ${session.doc_count} 文档` : ""}</div>
                  </div>
                </div>
                <div class="row-hover-actions">
                  <button type="button" class="row-menu-trigger" data-action="toggle-session-menu" data-session-id="${session.session_id}" aria-label="对话操作">
                    <i class="ri-more-2-fill"></i>
                  </button>
                  <div class="row-popover-menu${menuOpen ? "" : " hidden"}">
                    <button type="button" class="row-popover-item" data-action="rename-session" data-session-id="${session.session_id}">
                      <i class="ri-edit-line"></i>
                      <span>重命名</span>
                    </button>
                    ${session.folder_id ? `
                      <button type="button" class="row-popover-item" data-action="move-session-root" data-session-id="${session.session_id}">
                        <i class="ri-folder-transfer-line"></i>
                        <span>移回默认</span>
                      </button>
                    ` : ""}
                    <button type="button" class="row-popover-item danger" data-action="delete-session" data-session-id="${session.session_id}">
                      <i class="ri-delete-bin-6-line"></i>
                      <span>删除</span>
                    </button>
                  </div>
                </div>
              </div>
            </li>
          `;
        })
        .join("");

      li.innerHTML = `
        <div class="folder-shell" data-drop-folder="${group.isDefault ? "root" : group.id}">
          <div class="folder-header">
            <button type="button" class="folder-info text-btn" data-action="toggle-folder" data-folder-id="${group.id}">
              <span class="folder-chevron"><i class="ri-${isOpen ? "arrow-down-s-line" : "arrow-right-s-line"}"></i></span>
              <span class="folder-leading-icon"><i class="ri-${group.isDefault ? "folder-open-line" : "folder-2-line"}"></i></span>
              <span class="folder-name">${escapeHtml(group.name)}</span>
              <span class="folder-count">${group.session_count ?? group.sessions.length}</span>
            </button>
            ${group.isDefault ? "" : `
              <div class="row-hover-actions">
                <button type="button" class="row-menu-trigger" data-action="toggle-folder-menu" data-folder-id="${group.id}" aria-label="文件夹操作">
                  <i class="ri-more-2-fill"></i>
                </button>
                <div class="row-popover-menu${folderMenuOpen ? "" : " hidden"}">
                  <button type="button" class="row-popover-item" data-action="rename-folder" data-folder-id="${group.id}">
                    <i class="ri-edit-line"></i>
                    <span>重命名</span>
                  </button>
                  <button type="button" class="row-popover-item danger" data-action="delete-folder" data-folder-id="${group.id}">
                    <i class="ri-delete-bin-6-line"></i>
                    <span>删除</span>
                  </button>
                </div>
              </div>
            `}
          </div>
          <ul class="folder-session-list${isOpen ? "" : " hidden"}">
            ${sessionHtml || `<li class="history-empty-subtle">${group.isDefault ? "还没有对话" : "拖拽对话到这个文件夹"}</li>`}
          </ul>
        </div>
      `;
      els.historyList.appendChild(li);
    });
    return;

    const folders = APP.sessionCatalog.folders || [];
    const sessions = APP.sessionCatalog.sessions || [];
    if (!sessions.length) {
      const li = document.createElement("li");
      li.className = "history-empty";
      li.textContent = "暂无对话记录";
      els.historyList.appendChild(li);
      return;
    }

    const groups = [
      {
        id: "__ungrouped__",
        name: "未分组",
        sessions: sessions.filter((item) => !item.folder_id),
        session_count: sessions.filter((item) => !item.folder_id).length,
      },
      ...folders.map((folder) => ({
        ...folder,
        sessions: sessions.filter((item) => item.folder_id === folder.id),
      })),
    ].filter((group) => group.sessions.length > 0);

    groups.forEach((group) => {
      const li = document.createElement("li");
      li.className = "history-folder";
      const isOpen = APP.folderOpenMap[group.id] !== false;
      const sessionHtml = group.sessions
        .map((session) => {
          const updatedAt = formatTime(Date.parse(session.updated_at || "") || Date.now());
          const title = escapeHtml(session.title || "新对话");
          const preview = escapeHtml((session.last_message || "").replace(/\s+/g, " ").trim() || "暂无消息");
          const activeClass = session.session_id === APP.sessionId ? " active" : "";
          return `
            <li>
              <div class="history-session-card${activeClass}" data-session-id="${session.session_id}">
                <div class="session-main">
                  <div class="session-title-wrap">
                    <div class="session-title">${title}</div>
                    <div class="session-meta">${updatedAt} · ${session.doc_count || 0} 份文档</div>
                  </div>
                  <div class="folder-actions">
                    <button type="button" class="mini-icon-btn" data-action="rename-session" data-session-id="${session.session_id}" title="重命名">
                      <i class="ri-edit-line"></i>
                    </button>
                    <button type="button" class="mini-icon-btn" data-action="move-session" data-session-id="${session.session_id}" title="移动到文件夹">
                      <i class="ri-folder-transfer-line"></i>
                    </button>
                  </div>
                </div>
                <div class="session-preview">${preview}</div>
              </div>
            </li>
          `;
        })
        .join("");

      li.innerHTML = `
        <div class="folder-header">
          <button type="button" class="folder-info text-btn" data-action="toggle-folder" data-folder-id="${group.id}">
            <i class="ri-${isOpen ? "arrow-down-s-line" : "arrow-right-s-line"}"></i>
            <span class="folder-name">${escapeHtml(group.name)}</span>
            <span class="folder-count">${group.session_count}</span>
          </button>
          <div class="folder-actions">
            ${group.id !== "__ungrouped__" ? `<button type="button" class="mini-icon-btn" data-action="rename-folder" data-folder-id="${group.id}" title="重命名文件夹"><i class="ri-pencil-line"></i></button>` : ""}
          </div>
        </div>
        <ul class="folder-session-list${isOpen ? "" : " hidden"}">${sessionHtml}</ul>
      `;
      els.historyList.appendChild(li);
    });
  }

  function refreshQuickJumpPanel() {
    if (!els.quickJumpPanel || !els.quickJumpList || !els.chatMessages) return;
    if (APP.phet.isOpen) {
      els.quickJumpPanel.classList.add("hidden");
      els.quickJumpList.innerHTML = "";
      return;
    }
    const jumpRows = Array.from(els.chatMessages.querySelectorAll(".message-row.user"));
    const jumpItems = jumpRows
      .map((row, index) => ({
        id: row.id || `jump-${index}`,
        label: row.dataset.jumpLabel || truncateText(row.textContent?.trim() || "对话", 18),
      }))
      .slice(-7);

    APP.quickJumpItems = jumpItems;
    if (!jumpItems.length) {
      els.quickJumpPanel.classList.add("hidden");
      els.quickJumpList.innerHTML = "";
      return;
    }

    els.quickJumpPanel.classList.remove("hidden");
    els.quickJumpList.innerHTML = jumpItems
      .map((item) => `
        <button
          type="button"
          class="quick-jump-btn${item.id === APP.quickJumpActiveId ? " active" : ""}"
          data-target-id="${item.id}"
          data-tooltip="${escapeAttribute(item.label)}"
          aria-label="${escapeAttribute(item.label)}"
        >
          <span class="quick-jump-line"></span>
        </button>
      `)
      .join("");
    updateQuickJumpActive();
    return;

    const rows = Array.from(els.chatMessages.querySelectorAll(".message-row.user"));
    const items = rows
      .map((row, index) => ({
        id: row.id || `jump-${index}`,
        label: row.dataset.jumpLabel || truncateText(row.textContent?.trim() || "对话", 18),
      }))
      .slice(-6);

    APP.quickJumpItems = items;
    if (!items.length) {
      els.quickJumpPanel.classList.add("hidden");
      els.quickJumpList.innerHTML = "";
      return;
    }

    els.quickJumpPanel.classList.remove("hidden");
    els.quickJumpList.innerHTML = items
      .map((item) => `
        <button type="button" class="quick-jump-btn${item.id === APP.quickJumpActiveId ? " active" : ""}" data-target-id="${item.id}">
          <span class="quick-jump-label">${escapeHtml(item.label)}</span>
          <span class="quick-jump-dot"></span>
        </button>
      `)
      .join("");
    updateQuickJumpActive();
  }

  function updateQuickJumpActive() {
    if (!els.quickJumpList || !APP.quickJumpItems.length) return;
    const containerTop = els.chatMessages.getBoundingClientRect().top;
    let activeId = APP.quickJumpItems[APP.quickJumpItems.length - 1]?.id || null;
    for (const item of APP.quickJumpItems) {
      const row = document.getElementById(item.id);
      if (!row) continue;
      const distance = row.getBoundingClientRect().top - containerTop;
      if (distance <= 80) {
        activeId = item.id;
      }
    }
    APP.quickJumpActiveId = activeId;
    Array.from(els.quickJumpList.querySelectorAll(".quick-jump-btn")).forEach((button) => {
      button.classList.toggle("active", button.getAttribute("data-target-id") === activeId);
    });
  }

  function toggleFloatingMenu(menuId) {
    APP.openMenuId = APP.openMenuId === menuId ? null : menuId;
    renderHistory();
  }

  function closeFloatingMenus() {
    if (!APP.openMenuId) return;
    APP.openMenuId = null;
    renderHistory();
  }

  function clearDropTargets() {
    els.historyList?.querySelectorAll(".drag-over").forEach((node) => {
      node.classList.remove("drag-over");
    });
  }

  function queueMenuPlacementSync() {
    window.requestAnimationFrame(() => {
      syncOpenMenuPlacement();
    });
  }

  function syncOpenMenuPlacement() {
    const historyList = els.historyList;
    if (!historyList) return;
    historyList.querySelectorAll(".row-hover-actions").forEach((node) => {
      node.classList.remove("menu-open-up");
    });
    const openMenu = historyList.querySelector(".row-popover-menu:not(.hidden)");
    if (!openMenu) return;
    const anchor = openMenu.parentElement;
    if (!anchor) return;
    const listRect = historyList.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const estimatedHeight = Math.max(openMenu.offsetHeight || 0, 156);
    const spaceBelow = listRect.bottom - anchorRect.bottom;
    const spaceAbove = anchorRect.top - listRect.top;
    if (spaceBelow < estimatedHeight + 12 && spaceAbove > spaceBelow) {
      anchor.classList.add("menu-open-up");
    }
  }

  function wavelengthToRGB(wlNm) {
    const wl = clamp(wlNm, 380, 780);
    let r = 0;
    let g = 0;
    let b = 0;

    if (wl >= 380 && wl < 440) {
      r = -(wl - 440) / (440 - 380);
      b = 1;
    } else if (wl < 490) {
      g = (wl - 440) / (490 - 440);
      b = 1;
    } else if (wl < 510) {
      g = 1;
      b = -(wl - 510) / (510 - 490);
    } else if (wl < 580) {
      r = (wl - 510) / (580 - 510);
      g = 1;
    } else if (wl < 645) {
      r = 1;
      g = -(wl - 645) / (645 - 580);
    } else {
      r = 1;
    }

    let attenuation = 1;
    if (wl < 420) {
      attenuation = 0.35 + (0.65 * (wl - 380)) / 40;
    } else if (wl > 700) {
      attenuation = 0.35 + (0.65 * (780 - wl)) / 80;
    }

    const gamma = 0.8;
    return {
      r: Math.round(255 * Math.pow(r * attenuation, gamma)),
      g: Math.round(255 * Math.pow(g * attenuation, gamma)),
      b: Math.round(255 * Math.pow(b * attenuation, gamma)),
    };
  }

  function wavelengthBandName(nm) {
    if (nm < 450) return "紫光";
    if (nm < 495) return "蓝光";
    if (nm < 570) return "绿光";
    if (nm < 590) return "黄光";
    if (nm < 620) return "橙光";
    return "红光";
  }

  function showToast(message) {
    const root = els.toastRoot;
    if (!root) return;

    root.classList.remove("hidden");
    root.style.position = "fixed";
    root.style.right = "18px";
    root.style.bottom = "18px";
    root.style.zIndex = "80";
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.gap = "8px";

    const item = document.createElement("div");
    item.textContent = message;
    item.style.maxWidth = "420px";
    item.style.padding = "10px 12px";
    item.style.borderRadius = "10px";
    item.style.border = "1px solid rgba(255,255,255,0.2)";
    item.style.background = "rgba(16, 26, 50, 0.86)";
    item.style.backdropFilter = "blur(12px)";
    item.style.color = "#e8f1ff";
    item.style.fontSize = "13px";
    item.style.boxShadow = "0 10px 30px rgba(0,0,0,0.28)";

    root.appendChild(item);

    setTimeout(() => {
      item.style.opacity = "0";
      item.style.transform = "translateY(4px)";
      item.style.transition = "all 0.25s ease";
      setTimeout(() => {
        item.remove();
        if (!root.childElementCount) {
          root.classList.add("hidden");
        }
      }, 260);
    }, 2400);
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem("physics_agent_history_v2");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveHistory(history) {
    localStorage.setItem("physics_agent_history_v2", JSON.stringify(history));
  }

  function loadFolderOpenMap() {
    try {
      const raw = localStorage.getItem("physics_agent_folder_open_map");
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveFolderOpenMap(map) {
    localStorage.setItem("physics_agent_folder_open_map", JSON.stringify(map || {}));
  }

  function generateSessionId() {
    return window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `sid-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  function getOrCreateSessionId() {
    const key = "physics_agent_session_id";
    const existing = localStorage.getItem(key);
    if (existing) return existing;

    const sid = generateSessionId();
    localStorage.setItem(key, sid);
    return sid;
  }

  function setCurrentSessionId(sessionId) {
    APP.sessionId = sessionId;
    localStorage.setItem("physics_agent_session_id", sessionId);
  }

  function truncateText(text, max) {
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttribute(text) {
    return escapeHtml(text);
  }

  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  function normalizeDeg(deg) {
    const d = deg % 360;
    return d < 0 ? d + 360 : d;
  }

  function signedAngleDeltaDeg(fromDeg, toDeg) {
    return ((toDeg - fromDeg + 540) % 360) - 180;
  }

  function polarPoint(cx, cy, r, deg) {
    const rad = degToRad(deg);
    return {
      x: cx + r * Math.cos(rad),
      y: cy - r * Math.sin(rad),
    };
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }
})();

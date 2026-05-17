import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const shellDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(shellDir, "..", "..");
const sourceStaticDir = path.join(repoRoot, "static");
const targetWebDir = path.join(shellDir, "www");
const targetStaticDir = path.join(targetWebDir, "static");
const targetLiteDir = path.join(targetStaticDir, "mobile-lite");
const runtimeConfigPath = path.join(shellDir, "runtime-config.json");
const exportLiteAssetsScript = path.join(shellDir, "scripts", "export-lite-assets.py");

const rootFiles = [
  "index.html",
  "manifest.webmanifest",
  "offline.html",
  "sw.js",
  "app-icon-192.png",
  "app-icon-512.png",
];

const staticFiles = [
  "app.js",
  "lite-backend.js",
  "style.css",
];

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function parseBooleanValue(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

async function loadRuntimeConfig() {
  const defaults = {
    appMode: "capacitor",
    backendMode: "lite",
    apiBaseUrl: "",
    defaultApiBaseUrl: "",
    apiBaseUrlVersion: "",
    lockApiBaseUrl: false,
    showConnectionSettings: false,
    showModelKeySettings: true,
    modelApiKey: "",
    disableServiceWorker: true,
  };

  let fileConfig = {};
  try {
    const raw = await readFile(runtimeConfigPath, "utf8");
    fileConfig = JSON.parse(raw);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw new Error(`Failed to read runtime-config.json: ${error.message}`);
    }
  }

  const merged = {
    ...defaults,
    ...(fileConfig && typeof fileConfig === "object" ? fileConfig : {}),
  };

  if (process.env.PHYSICS_AGENT_API_BASE_URL !== undefined) {
    merged.apiBaseUrl = process.env.PHYSICS_AGENT_API_BASE_URL;
  }
  if (process.env.PHYSICS_AGENT_BACKEND_MODE !== undefined) {
    merged.backendMode = String(process.env.PHYSICS_AGENT_BACKEND_MODE || "").trim().toLowerCase() || merged.backendMode;
  }
  if (process.env.PHYSICS_AGENT_DEFAULT_API_BASE_URL !== undefined) {
    merged.defaultApiBaseUrl = process.env.PHYSICS_AGENT_DEFAULT_API_BASE_URL;
  }
  if (process.env.PHYSICS_AGENT_API_BASE_URL_VERSION !== undefined) {
    merged.apiBaseUrlVersion = String(process.env.PHYSICS_AGENT_API_BASE_URL_VERSION || "").trim();
  }
  if (process.env.PHYSICS_AGENT_LOCK_API_BASE_URL !== undefined) {
    merged.lockApiBaseUrl = parseBooleanValue(process.env.PHYSICS_AGENT_LOCK_API_BASE_URL, merged.lockApiBaseUrl);
  }
  if (process.env.PHYSICS_AGENT_SHOW_CONNECTION_SETTINGS !== undefined) {
    merged.showConnectionSettings = parseBooleanValue(
      process.env.PHYSICS_AGENT_SHOW_CONNECTION_SETTINGS,
      merged.showConnectionSettings,
    );
  }
  if (process.env.PHYSICS_AGENT_SHOW_MODEL_KEY_SETTINGS !== undefined) {
    merged.showModelKeySettings = parseBooleanValue(
      process.env.PHYSICS_AGENT_SHOW_MODEL_KEY_SETTINGS,
      merged.showModelKeySettings,
    );
  }
  if (process.env.PHYSICS_AGENT_MODEL_API_KEY !== undefined) {
    merged.modelApiKey = String(process.env.PHYSICS_AGENT_MODEL_API_KEY || "").trim();
  }
  if (process.env.PHYSICS_AGENT_DISABLE_SERVICE_WORKER !== undefined) {
    merged.disableServiceWorker = parseBooleanValue(
      process.env.PHYSICS_AGENT_DISABLE_SERVICE_WORKER,
      merged.disableServiceWorker,
    );
  }

  merged.apiBaseUrl = normalizeBaseUrl(merged.apiBaseUrl);
  merged.defaultApiBaseUrl = normalizeBaseUrl(merged.defaultApiBaseUrl);

  return merged;
}

async function runLiteAssetExport() {
  await mkdir(targetLiteDir, { recursive: true });

  const pythonCandidates = [
    process.env.PYTHON,
    "python",
  ].filter(Boolean);

  let lastError = null;
  for (const candidate of pythonCandidates) {
    try {
      await new Promise((resolve, reject) => {
        const child = spawn(candidate, [exportLiteAssetsScript, targetLiteDir], {
          cwd: shellDir,
          stdio: "inherit",
          shell: true,
        });
        child.on("error", reject);
        child.on("close", (code) => {
          if (code === 0) {
            resolve();
            return;
          }
          reject(new Error(`lite asset export exited with code ${code ?? 1}`));
        });
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("lite asset export failed");
}

const capacitorRuntimeConfig = `(function () {
  window.__PHYSICS_AGENT_RUNTIME__ = Object.assign(
${JSON.stringify(await loadRuntimeConfig(), null, 4)
  .split("\n")
  .map((line) => `    ${line}`)
  .join("\n")},
    window.__PHYSICS_AGENT_RUNTIME__ || {}
  );
})();
`;

await rm(targetWebDir, { recursive: true, force: true });
await mkdir(targetStaticDir, { recursive: true });
await runLiteAssetExport();

for (const fileName of rootFiles) {
  await cp(path.join(sourceStaticDir, fileName), path.join(targetWebDir, fileName));
}

for (const fileName of staticFiles) {
  await cp(path.join(sourceStaticDir, fileName), path.join(targetStaticDir, fileName));
}

await writeFile(path.join(targetStaticDir, "mobile-config.js"), capacitorRuntimeConfig, "utf8");

console.log(`Capacitor web assets synced to ${targetWebDir}`);

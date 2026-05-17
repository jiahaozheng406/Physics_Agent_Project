import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const shellDir = path.resolve(scriptDir, "..");
const androidProjectDir = path.join(shellDir, "android");

const studioCandidates = [
  process.env.CAPACITOR_ANDROID_STUDIO_PATH,
  "D:\\Android\\android\\bin\\studio64.exe",
  "D:\\Android\\android\\bin\\studio.exe",
  "C:\\Program Files\\Android\\Android Studio\\bin\\studio64.exe",
  "C:\\Program Files\\Android\\Android Studio\\bin\\studio.exe",
  "C:\\Program Files (x86)\\Android\\Android Studio\\bin\\studio64.exe",
  "C:\\Program Files (x86)\\Android\\Android Studio\\bin\\studio.exe",
  "C:\\Users\\shuta\\AppData\\Local\\Programs\\Android Studio\\bin\\studio64.exe",
  "C:\\Users\\shuta\\AppData\\Local\\Programs\\Android Studio\\bin\\studio.exe",
].filter(Boolean);

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

let studioPath = "";
for (const candidate of studioCandidates) {
  if (await exists(candidate)) {
    studioPath = candidate;
    break;
  }
}

if (!studioPath) {
  console.error("未检测到 Android Studio，可手动设置 CAPACITOR_ANDROID_STUDIO_PATH 后重试。");
  process.exit(1);
}

const child = spawn(studioPath, [androidProjectDir], {
  cwd: shellDir,
  detached: true,
  stdio: "ignore",
});

child.unref();
console.log(`已打开 Android Studio: ${studioPath}`);

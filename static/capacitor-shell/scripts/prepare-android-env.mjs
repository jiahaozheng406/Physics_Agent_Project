import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const shellDir = path.resolve(scriptDir, "..");
const androidDir = path.join(shellDir, "android");
const localPropertiesPath = path.join(androidDir, "local.properties");

const sdkCandidates = [
  process.env.ANDROID_SDK_ROOT,
  process.env.ANDROID_HOME,
  "D:\\Android\\Sdk",
  "C:\\Users\\shuta\\AppData\\Local\\Android\\Sdk",
  "C:\\Program Files (x86)\\Android\\android-sdk",
].filter(Boolean);

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function escapeForGradle(targetPath) {
  return targetPath.replaceAll("\\", "\\\\");
}

let sdkPath = "";
for (const candidate of sdkCandidates) {
  if (await exists(candidate)) {
    sdkPath = candidate;
    break;
  }
}

if (!sdkPath) {
  console.warn("未检测到 Android SDK 路径，已跳过 local.properties 写入。");
  process.exit(0);
}

const fileContent = `sdk.dir=${escapeForGradle(sdkPath)}\n`;
await writeFile(localPropertiesPath, fileContent, "utf8");
console.log(`已写入 Android SDK 路径: ${sdkPath}`);

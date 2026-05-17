import { access, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const shellDir = path.resolve(scriptDir, "..");
const androidDir = path.join(shellDir, "android");
const distDir = path.join(shellDir, "dist");
const gradleTask = process.argv[2] || "assembleDebug";
const extraArgs = process.argv.slice(3);
const userProfile = process.env.USERPROFILE || "C:\\Users\\shuta";

const javaHomeCandidates = [
  "D:\\Android\\android\\jbr",
  process.env.JAVA_HOME,
  "C:\\Program Files\\Android\\Android Studio\\jbr",
  "C:\\Program Files\\Android\\Android Studio\\jre",
  "C:\\Program Files\\Java\\jdk-21",
].filter(Boolean);

const gradleUserHomeCandidates = [
  process.env.GRADLE_USER_HOME,
  path.join(userProfile, ".gradle"),
  path.join(shellDir, ".gradle-user-home"),
].filter(Boolean);

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function resolveOutputArtifact(taskName) {
  if (/bundle.*release/i.test(taskName)) {
    return {
      source: path.join(androidDir, "app", "build", "outputs", "bundle", "release", "app-release.aab"),
      target: path.join(distDir, "PhysicsAgent-android-release.aab"),
    };
  }

  if (/assemble.*release/i.test(taskName)) {
    return {
      source: path.join(androidDir, "app", "build", "outputs", "apk", "release", "app-release.apk"),
      target: path.join(distDir, "PhysicsAgent-android-release.apk"),
    };
  }

  return {
    source: path.join(androidDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
    target: path.join(distDir, "PhysicsAgent-android-debug.apk"),
  };
}

let javaHome = "";
for (const candidate of javaHomeCandidates) {
  if (await exists(path.join(candidate, "bin", "java.exe"))) {
    javaHome = candidate;
    break;
  }
}

if (!javaHome) {
  console.error("No usable JDK was found. Please check Android Studio JBR or JAVA_HOME.");
  process.exit(1);
}

let gradleUserHome = "";
for (const candidate of gradleUserHomeCandidates) {
  if (await exists(candidate)) {
    gradleUserHome = candidate;
    break;
  }
}

if (!gradleUserHome) {
  gradleUserHome = path.join(shellDir, ".gradle-user-home");
}

const gradlewPath = path.join(androidDir, "gradlew.bat");
const child = spawn(
  gradlewPath,
  ["-p", androidDir, "--no-daemon", "--max-workers=1", gradleTask, ...extraArgs],
  {
    cwd: shellDir,
    stdio: "inherit",
    env: {
      ...process.env,
      JAVA_HOME: javaHome,
      GRADLE_USER_HOME: gradleUserHome,
    },
    shell: true,
  }
);

child.on("close", async (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
    return;
  }

  const artifact = resolveOutputArtifact(gradleTask);
  if (!(await exists(artifact.source))) {
    console.error(`Build finished, but output artifact was not found: ${artifact.source}`);
    process.exit(1);
    return;
  }

  await mkdir(distDir, { recursive: true });
  await copyFile(artifact.source, artifact.target);
  console.log(`Copied build artifact to ${artifact.target}`);
  process.exit(0);
});

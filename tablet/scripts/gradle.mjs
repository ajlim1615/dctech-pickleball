// Runs the Android Gradle wrapper from the android/ folder on any OS.
// Capacitor 8 needs JDK 21+. Set DESK_JAVA_HOME to pick one; otherwise a JDK 21 in the
// usual Windows location is used when JAVA_HOME points at an older one.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const androidDir = path.resolve(import.meta.dirname, "../android");
const wrapper = path.join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");

const env = { ...process.env };
const fallbackJdk = "C:/Program Files/Java/jdk-21";
if (env.DESK_JAVA_HOME) {
  env.JAVA_HOME = env.DESK_JAVA_HOME;
} else if (!/jdk-?2\d/i.test(env.JAVA_HOME ?? "") && existsSync(fallbackJdk)) {
  env.JAVA_HOME = fallbackJdk;
}

const result = spawnSync(`"${wrapper}"`, process.argv.slice(2), {
  cwd: androidDir,
  stdio: "inherit",
  shell: true,
  env,
});
process.exit(result.status ?? 1);

import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { KeepAwake } from "@capacitor-community/keep-awake";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * Hands a file to Android's share sheet (save to Files, Drive, Gmail, chat...).
 * In a desktop browser it downloads the file instead.
 */
export async function shareFile(name: string, content: Uint8Array | string, mime: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    const blob = new Blob([typeof content === "string" ? content : new Uint8Array(content)], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const written =
    typeof content === "string"
      ? await Filesystem.writeFile({ path: name, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 })
      : await Filesystem.writeFile({ path: name, data: toBase64(content), directory: Directory.Cache });
  await Share.share({ title: name, files: [written.uri] });
}

/** Keeps the screen on while a session is live. Does nothing in a browser. */
export async function keepAwake(on: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep());
  } catch {
    // Not fatal: the screen just follows the tablet's own sleep setting.
  }
}

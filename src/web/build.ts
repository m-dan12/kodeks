import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { extractJson, validateText, type CardKind, type Issue } from "../validate.js";
import { toLongStoryShort } from "../lss/export.js";
import type { Character, Monster, Npc } from "../types.js";
import { monsterPdf, npcPdf } from "./pdf.js";

export { slug } from "./slug.js";

export const native = Capacitor.isNativePlatform();

export type Outcome =
  | { status: "empty" }
  | { status: "error"; report: string; issues: Issue[]; source: string }
  | { status: "ok"; kind: CardKind; name: string; warnings: string[]; pdfUrl?: string; lssJson?: string; source: string };

const toBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/** В браузере файл скачивается; в приложении на телефоне открывается системное окно «Поделиться». */
export async function deliver(name: string, blob: Blob): Promise<void> {
  if (native) {
    const safe = name.replace(/[\/:*?"<>|]/g, "_");
    const saved = await Filesystem.writeFile({ path: safe, data: await toBase64(blob), directory: Directory.Cache });
    await Share.share({ title: safe, url: saved.uri, dialogTitle: "Открыть или сохранить" });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Проверяет текст анкеты и собирает файл: PDF для монстра и НИП, файл Long Story Short для персонажа. */
export async function build(text: string): Promise<Outcome> {
  if (!text.trim()) return { status: "empty" };
  const checked = validateText(text);
  if (!checked.ok) return { status: "error", report: checked.report, issues: checked.issues, source: extractJson(text) };
  const data = checked.data as { name: string };
  const source = extractJson(text);
  if (checked.kind === "character") {
    const out = toLongStoryShort(checked.data as Character);
    return { status: "ok", kind: "character", name: data.name, warnings: out.warnings, lssJson: JSON.stringify(out.file), source };
  }
  const { blob, warnings } =
    checked.kind === "monster" ? await monsterPdf(checked.data as Monster) : await npcPdf(checked.data as Npc);
  return { status: "ok", kind: checked.kind, name: data.name, warnings, pdfUrl: URL.createObjectURL(blob), source };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

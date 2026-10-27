import type { Issue } from "../validate.js";

/** Строки текста, к которым относится ошибка: ищем поле по последнему названию в пути. */
export function errorLines(source: string, issues: Issue[]): Map<number, string> {
  const lines = source.split("\n");
  const out = new Map<number, string>();
  for (const i of issues) {
    const keys = i.path.split(".").map((s) => s.replace(/\[\d+\]/g, "")).filter(Boolean);
    const m = /«([a-z_]+)»/.exec(i.message);
    const key = (i.message.includes("лишнее поле") && m ? m[1] : keys[keys.length - 1]) ?? "";
    if (!key) continue;
    const at = lines.findIndex((l) => new RegExp(`^\\s*(${key}\\s*=|\\[{1,2}[\\w.]*${key}\\])`).test(l));
    if (at >= 0 && !out.has(at)) out.set(at, i.message);
  }
  return out;
}

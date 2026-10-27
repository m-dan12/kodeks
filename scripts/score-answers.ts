/**
 * Проверяет ответы моделей из папки: имена файлов вида «модель.формат.задача.txt».
 * Печатает, прошёл ли ответ проверку, и первые ошибки.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateText } from "../src/validate.js";

const dir = process.argv[2] ?? "out/experiment/answers";
let pass = 0;
const files = readdirSync(dir).filter((f) => f.endsWith(".txt")).sort();
for (const f of files) {
  const r = validateText(readFileSync(join(dir, f), "utf8"));
  if (r.ok) pass++;
  console.log(`${r.ok ? "OK  " : "FAIL"} ${f}`);
  if (!r.ok) console.log(r.issues.slice(0, 6).map((i) => `       - ${i.path ? i.path + ": " : ""}${i.message}`).join("\n"));
}
console.log(`\nПрошло с первого раза: ${pass} из ${files.length}`);

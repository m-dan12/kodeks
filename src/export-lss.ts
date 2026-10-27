import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { validateText } from "./validate.js";
import { toLongStoryShort } from "./lss/export.js";
import type { Character } from "./types.js";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Использование: npm run export:lss -- <персонаж.json> <результат.json>");
  process.exit(2);
}

const checked = validateText(readFileSync(input, "utf8"));
if (!checked.ok) {
  console.error(checked.report);
  process.exit(1);
}
if (checked.kind !== "character") {
  console.error(`В Long Story Short экспортируются только персонажи (kind: "character"), а в файле ${checked.kind}.`);
  process.exit(1);
}

const { file, derived, warnings } = toLongStoryShort(checked.data as Character);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(file), "utf8");
console.log(`Готово: ${output}`);
console.log(`Хиты ${derived.hpMax}, КД ${derived.ac}, мастерство +${derived.proficiency}, ячейки ${derived.slots.join("/") || "нет"}`);
for (const w of warnings) console.log(`Внимание: ${w}`);

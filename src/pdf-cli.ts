import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { validateText } from "./validate.js";
import { renderMonsterPdf, renderNpcPdf } from "./pdf/render.js";
import type { Monster, Npc } from "./types.js";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Использование: npm run pdf -- <карточка.json> <результат.pdf>");
  process.exit(2);
}

const checked = validateText(readFileSync(input, "utf8"));
if (!checked.ok) {
  console.error(checked.report);
  process.exit(1);
}
if (checked.kind === "character") {
  console.error('Бланк персонажа (kind: "character") экспортируется в Long Story Short: npm run export:lss.');
  process.exit(1);
}

const { pdf, warnings } =
  checked.kind === "monster" ? await renderMonsterPdf(checked.data as Monster) : await renderNpcPdf(checked.data as Npc);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, pdf);
console.log(`Готово: ${output} (${Math.round(pdf.length / 1024)} КБ)`);
for (const w of warnings) console.log(`Внимание: ${w}`);

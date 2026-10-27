import { readFileSync } from "node:fs";
import { validateText } from "./validate.js";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Использование: npm run validate -- <файл.json> [...]");
  process.exit(2);
}

let failed = false;
for (const file of files) {
  const result = validateText(readFileSync(file, "utf8"));
  if (result.ok) {
    console.log(`OK    ${file} (${result.kind})`);
  } else {
    failed = true;
    console.log(`ОШИБКИ ${file}\n${result.report}\n`);
  }
}
process.exit(failed ? 1 : 0);

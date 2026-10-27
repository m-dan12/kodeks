import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CR_TABLE } from "../src/rules/cr.js";

export const root = join(import.meta.dirname, "..");
export const read = (...p: string[]) => readFileSync(join(root, ...p), "utf8");

interface SpellEntry {
  name_ru: string;
  name_en?: string;
  level: number;
}

export function spellsSection(): string {
  const spells = (JSON.parse(read("data", "lss-spells.json")) as { spells: SpellEntry[] }).spells;
  const lines: string[] = [];
  for (let level = 0; level <= 9; level++) {
    const names = spells
      .filter((s) => s.level === level)
      .map((s) => (s.name_en ? `${s.name_ru} (${s.name_en})` : s.name_ru))
      .sort((a, b) => a.localeCompare(b, "ru"));
    lines.push(`**${level === 0 ? "Заговоры" : `${level} уровень`}:** ${names.join("; ")}`, "");
  }
  return lines.join("\n").trim();
}

export function crTable(): string {
  const head = "| CR | Мастерство | КД | Хиты | Бонус атаки | Урон за раунд | Сл | Опыт |\n|---|---|---|---|---|---|---|---|";
  const rows = CR_TABLE.map(
    (r) => `| ${r.cr} | +${r.proficiency} | ${r.ac} | ${r.hpMin}–${r.hpMax} | +${r.attack} | ${r.dprMin}–${r.dprMax} | ${r.saveDc} | ${r.xp} |`,
  );
  return [head, ...rows].join("\n");
}

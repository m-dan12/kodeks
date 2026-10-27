import { validateText, type CardKind } from "../validate.js";
import { compute } from "../rules/calc.js";
import { computeMonster } from "../rules/monster.js";
import { CLASSES, ABILITY_RU_SHORT } from "../rules/tables.js";
import { TYPE_RU, monsterTypeLine } from "../i18n/ru.js";
import type { AbilityKey, Build, Monster } from "../types.js";
import type { SavedCard } from "./library.js";

export interface Summary {
  subtitle: string;
  /** Строка под именем в панели предпросмотра. */
  typeLine: string;
  ac?: number;
  hp?: number;
  /** Третий показатель: опасность у монстра, уровень у остальных. */
  third?: { label: string; value: string };
  abilities?: { key: AbilityKey; label: string; score: number }[];
  features: string[];
}

const ORDER: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const cache = new Map<string, Summary>();

function abilityRow(a: Record<AbilityKey, number>): Summary["abilities"] {
  return ORDER.map((key) => ({ key, label: ABILITY_RU_SHORT[key], score: a[key] }));
}

/** Короткие показатели карточки для списка и панели. Считаются из сохранённой анкеты, при ошибке остаётся только подпись. */
export function summarize(card: SavedCard): Summary {
  const hit = cache.get(card.id + card.savedAt);
  if (hit) return hit;
  let out: Summary = { subtitle: "", typeLine: "", features: [] };
  try {
    const r = validateText(card.json);
    if (r.ok && r.kind === "monster") {
      const m = r.data as Monster;
      const d = computeMonster(m);
      const t = TYPE_RU[m.type]?.name ?? m.type;
      out = {
        subtitle: `${t.charAt(0).toUpperCase()}${t.slice(1)}${m.alignment ? ` · ${m.alignment.charAt(0).toUpperCase()}${m.alignment.slice(1)}` : ""}`,
        typeLine: monsterTypeLine(m.size, m.type, m.subtype, m.alignment),
        ac: m.armor_class.value,
        hp: d.hpAverage,
        third: { label: "Опасность", value: m.challenge_rating },
        abilities: abilityRow(m.abilities),
        features: [...(m.traits ?? []).map((x) => x.name), ...(m.legendary_actions ? ["Легендарные действия"] : [])].slice(0, 8),
      };
    } else if (r.ok) {
      const b = r.data as Build;
      const d = compute(b);
      const classes = b.classes.map((c) => `${CLASSES[c.class].nameRu} ${c.level}`).join(" / ");
      out = {
        subtitle: `${classes} · ${b.race.name}`,
        typeLine: `${classes} · ${b.race.name}${b.alignment ? `, ${b.alignment}` : ""}`,
        ac: d.ac,
        hp: d.hpMax,
        third: { label: "Уровень", value: String(d.level) },
        abilities: abilityRow(b.abilities),
        features: (b.features ?? []).map((x) => x.name).slice(0, 8),
      };
    }
  } catch {
    /* сводка необязательна */
  }
  cache.set(card.id + card.savedAt, out);
  return out;
}

export const KIND_LABEL: Record<CardKind, string> = { monster: "Монстр", npc: "НИП", character: "Персонаж" };

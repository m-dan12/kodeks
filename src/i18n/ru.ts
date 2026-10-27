import type { AbilityKey, DamageType, MonsterSize } from "../types.js";
import type { SkillKey } from "../types.js";
import { SKILL_RU } from "../rules/tables.js";

type Gender = "m" | "f" | "n";

export const SIZE_RU: Record<MonsterSize, Record<Gender, string>> = {
  tiny: { m: "Крошечный", f: "Крошечная", n: "Крошечное" },
  small: { m: "Маленький", f: "Маленькая", n: "Маленькое" },
  medium: { m: "Средний", f: "Средняя", n: "Среднее" },
  large: { m: "Большой", f: "Большая", n: "Большое" },
  huge: { m: "Огромный", f: "Огромная", n: "Огромное" },
  gargantuan: { m: "Громадный", f: "Громадная", n: "Громадное" },
};

export const TYPE_RU: Record<string, { name: string; gender: Gender }> = {
  aberration: { name: "аберрация", gender: "f" },
  beast: { name: "зверь", gender: "m" },
  celestial: { name: "небожитель", gender: "m" },
  construct: { name: "конструкт", gender: "m" },
  dragon: { name: "дракон", gender: "m" },
  elemental: { name: "элементаль", gender: "m" },
  fey: { name: "фея", gender: "f" },
  fiend: { name: "исчадие", gender: "n" },
  giant: { name: "великан", gender: "m" },
  humanoid: { name: "гуманоид", gender: "m" },
  monstrosity: { name: "чудовище", gender: "n" },
  ooze: { name: "слизь", gender: "f" },
  plant: { name: "растение", gender: "n" },
  undead: { name: "нежить", gender: "f" },
};

/** «Большое чудовище (гоблиноид), без мировоззрения». */
export function monsterTypeLine(size: MonsterSize, type: string, subtype: string | undefined, alignment: string): string {
  const t = TYPE_RU[type] ?? { name: type, gender: "m" as Gender };
  const sub = subtype ? ` (${subtype})` : "";
  return `${SIZE_RU[size][t.gender]} ${t.name}${sub}, ${alignment}`;
}

/** Фраза «N (формула) … урона»: физический урон прилагательным, энергетический творительным падежом. */
const PHYSICAL: Partial<Record<DamageType, string>> = {
  piercing: "колющего",
  slashing: "рубящего",
  bludgeoning: "дробящего",
};
const ENERGY: Partial<Record<DamageType, string>> = {
  acid: "кислотой",
  cold: "холодом",
  fire: "огнём",
  force: "силовым полем",
  lightning: "электричеством",
  necrotic: "некротической энергией",
  poison: "ядом",
  psychic: "психической энергией",
  radiant: "излучением",
  thunder: "звуком",
};

export const damageText = (avg: number, formula: string, type: DamageType): string =>
  PHYSICAL[type]
    ? `${avg} (${formula}) ${PHYSICAL[type]} урона`
    : `${avg} (${formula}) урона ${ENERGY[type]}`;

export const DAMAGE_PLAIN: Record<DamageType, string> = {
  acid: "кислота", bludgeoning: "дробящий", cold: "холод", fire: "огонь", force: "силовое поле",
  lightning: "электричество", necrotic: "некротическая энергия", piercing: "колющий", poison: "яд",
  psychic: "психическая энергия", radiant: "излучение", slashing: "рубящий", thunder: "звук",
};

export const ATTACK_TYPE_RU = {
  melee_weapon: "Рукопашная атака оружием",
  ranged_weapon: "Дальнобойная атака оружием",
  melee_spell: "Рукопашная атака заклинанием",
  ranged_spell: "Дальнобойная атака заклинанием",
} as const;

/** Родительный падеж: «спасбросок Ловкости». */
export const ABILITY_GENITIVE: Record<AbilityKey, string> = {
  str: "Силы", dex: "Ловкости", con: "Телосложения", int: "Интеллекта", wis: "Мудрости", cha: "Харизмы",
};

export const ABILITY_RU_CAPS: Record<AbilityKey, string> = {
  str: "СИЛА", dex: "ЛОВКОСТЬ", con: "ТЕЛОСЛ.", int: "ИНТЕЛЛ.", wis: "МУДРОСТЬ", cha: "ХАРИЗМА",
};

export const skillName = (s: SkillKey): string => SKILL_RU[s];

export const MINUS = "−";
export const signed = (n: number): string => (n >= 0 ? `+${n}` : `${MINUS}${Math.abs(n)}`);

export function usageLabel(u: { type: string; times?: number; rest?: "short" | "long"; recharge_min?: number } | undefined): string {
  if (!u) return "";
  switch (u.type) {
    case "at_will": return "(неограниченно)";
    case "per_day": return `(${u.times}/день)`;
    case "per_rest": return `(${u.times}/${u.rest === "short" ? "короткий" : "продолжительный"} отдых)`;
    case "recharge": return u.recharge_min === 6 ? "(перезарядка 6)" : `(перезарядка ${u.recharge_min}–6)`;
    default: return "";
  }
}

export const SPEED_RU: Record<string, string> = {
  walk: "", burrow: "копая", climb: "лазая", fly: "летая", swim: "плавая",
};

/** Прочие скорости помимо ходьбы: «лазая 40 фт., летая 80 фт.». */
export function speedExtras(s: { burrow?: number; climb?: number; fly?: number; swim?: number; hover?: boolean }): string | undefined {
  const parts: string[] = [];
  for (const k of ["burrow", "climb", "fly", "swim"] as const) {
    const v = s[k];
    if (v) parts.push(`${SPEED_RU[k]} ${v} фт.${k === "fly" && s.hover ? " (парит)" : ""}`);
  }
  return parts.length ? parts.join(", ") : undefined;
}

import type { AbilityKey, ClassKey, DamageType, SkillKey } from "../types.js";

export type CasterType = "full" | "half" | "third" | "pact" | "none";

export interface ClassInfo {
  nameRu: string;
  hitDie: number;
  saves: [AbilityKey, AbilityKey];
  spellAbility?: AbilityKey;
  caster: CasterType;
}

export const CLASSES: Record<ClassKey, ClassInfo> = {
  barbarian: { nameRu: "Варвар", hitDie: 12, saves: ["str", "con"], caster: "none" },
  bard: { nameRu: "Бард", hitDie: 8, saves: ["dex", "cha"], spellAbility: "cha", caster: "full" },
  cleric: { nameRu: "Жрец", hitDie: 8, saves: ["wis", "cha"], spellAbility: "wis", caster: "full" },
  druid: { nameRu: "Друид", hitDie: 8, saves: ["int", "wis"], spellAbility: "wis", caster: "full" },
  fighter: { nameRu: "Воин", hitDie: 10, saves: ["str", "con"], spellAbility: "int", caster: "none" },
  monk: { nameRu: "Монах", hitDie: 8, saves: ["str", "dex"], caster: "none" },
  paladin: { nameRu: "Паладин", hitDie: 10, saves: ["wis", "cha"], spellAbility: "cha", caster: "half" },
  ranger: { nameRu: "Следопыт", hitDie: 10, saves: ["str", "dex"], spellAbility: "wis", caster: "half" },
  rogue: { nameRu: "Плут", hitDie: 8, saves: ["dex", "int"], spellAbility: "int", caster: "none" },
  sorcerer: { nameRu: "Чародей", hitDie: 6, saves: ["con", "cha"], spellAbility: "cha", caster: "full" },
  warlock: { nameRu: "Колдун", hitDie: 8, saves: ["wis", "cha"], spellAbility: "cha", caster: "pact" },
  wizard: { nameRu: "Волшебник", hitDie: 6, saves: ["int", "wis"], spellAbility: "int", caster: "full" },
};

/** Ячейки заклинателя по уровню заклинателя 1–20: индекс 0 соответствует 1 уровню заклинаний. */
export const FULL_CASTER_SLOTS: number[][] = [
  [], // уровень 0 нет
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** Колдун: [число ячеек, уровень ячеек] по уровню колдуна. */
export const PACT_SLOTS: [number, number][] = [
  [0, 0],
  [1, 1], [2, 1], [2, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5],
  [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [4, 5], [4, 5], [4, 5], [4, 5],
];

/** Минимум опыта для уровня 1–20. */
export const XP_FOR_LEVEL = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

export const SKILL_ABILITY: Record<SkillKey, AbilityKey> = {
  acrobatics: "dex", animal_handling: "wis", arcana: "int", athletics: "str", deception: "cha",
  history: "int", insight: "wis", intimidation: "cha", investigation: "int", medicine: "wis",
  nature: "int", perception: "wis", performance: "cha", persuasion: "cha", religion: "int",
  sleight_of_hand: "dex", stealth: "dex", survival: "wis",
};

export const SKILL_RU: Record<SkillKey, string> = {
  acrobatics: "Акробатика", animal_handling: "Уход за животными", arcana: "Магия", athletics: "Атлетика",
  deception: "Обман", history: "История", insight: "Проницательность", intimidation: "Запугивание",
  investigation: "Анализ", medicine: "Медицина", nature: "Природа", perception: "Внимательность",
  performance: "Выступление", persuasion: "Убеждение", religion: "Религия", sleight_of_hand: "Ловкость рук",
  stealth: "Скрытность", survival: "Выживание",
};

export const ABILITY_RU: Record<AbilityKey, string> = {
  str: "Сила", dex: "Ловкость", con: "Телосложение", int: "Интеллект", wis: "Мудрость", cha: "Харизма",
};

export const ABILITY_RU_SHORT: Record<AbilityKey, string> = {
  str: "Сил", dex: "Лов", con: "Тел", int: "Инт", wis: "Муд", cha: "Хар",
};

/** Сокращения типов урона для строки атаки. */
export const DAMAGE_RU_SHORT: Record<DamageType, string> = {
  acid: "кисл", bludgeoning: "дроб", cold: "холод", fire: "огонь", force: "сила", lightning: "элек",
  necrotic: "некр", piercing: "кол", poison: "яд", psychic: "псих", radiant: "изл", slashing: "руб",
  thunder: "звук",
};

export const ALL_ABILITIES: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

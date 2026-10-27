/** Справочник снаряжения SRD: по названию из анкеты приложение само подставляет кости, тип урона, свойства и базу КД. */

export interface WeaponInfo {
  name: string;
  /** Другие написания: английское название и частые варианты. */
  aliases: string[];
  melee: boolean;
  dice: string;
  type: "bludgeoning" | "piercing" | "slashing";
  properties: string[];
  versatile?: string;
  range?: [number, number];
}

const w = (
  name: string,
  aliases: string[],
  melee: boolean,
  dice: string,
  type: WeaponInfo["type"],
  properties: string[] = [],
  extra: { versatile?: string; range?: [number, number] } = {},
): WeaponInfo => ({ name, aliases, melee, dice, type, properties, ...extra });

export const WEAPONS: WeaponInfo[] = [
  // простое рукопашное
  w("Боевой посох", ["quarterstaff", "посох"], true, "1d6", "bludgeoning", ["versatile"], { versatile: "1d8" }),
  w("Булава", ["mace"], true, "1d6", "bludgeoning"),
  w("Дубинка", ["club"], true, "1d4", "bludgeoning", ["light"]),
  w("Кинжал", ["dagger"], true, "1d4", "piercing", ["finesse", "light", "thrown"], { range: [20, 60] }),
  w("Копьё", ["spear", "копье"], true, "1d6", "piercing", ["thrown", "versatile"], { versatile: "1d8", range: [20, 60] }),
  w("Лёгкий молот", ["light hammer", "легкий молот"], true, "1d4", "bludgeoning", ["light", "thrown"], { range: [20, 60] }),
  w("Метательное копьё", ["javelin", "метательное копье", "дротик метательный"], true, "1d6", "piercing", ["thrown"], { range: [30, 120] }),
  w("Палица", ["greatclub"], true, "1d8", "bludgeoning", ["two_handed"]),
  w("Ручной топор", ["handaxe", "топорик"], true, "1d6", "slashing", ["light", "thrown"], { range: [20, 60] }),
  w("Серп", ["sickle"], true, "1d4", "slashing", ["light"]),
  // простое дальнобойное
  w("Дротик", ["dart"], false, "1d4", "piercing", ["finesse", "thrown"], { range: [20, 60] }),
  w("Короткий лук", ["shortbow"], false, "1d6", "piercing", ["ammunition", "two_handed"], { range: [80, 320] }),
  w("Лёгкий арбалет", ["light crossbow", "легкий арбалет"], false, "1d8", "piercing", ["ammunition", "loading", "two_handed"], { range: [80, 320] }),
  w("Праща", ["sling"], false, "1d4", "bludgeoning", ["ammunition"], { range: [30, 120] }),
  // воинское рукопашное
  w("Алебарда", ["halberd"], true, "1d10", "slashing", ["heavy", "reach", "two_handed"]),
  w("Боевая кирка", ["war pick"], true, "1d8", "piercing"),
  w("Боевой молот", ["warhammer"], true, "1d8", "bludgeoning", ["versatile"], { versatile: "1d10" }),
  w("Боевой топор", ["battleaxe"], true, "1d8", "slashing", ["versatile"], { versatile: "1d10" }),
  w("Глефа", ["glaive"], true, "1d10", "slashing", ["heavy", "reach", "two_handed"]),
  w("Двуручный меч", ["greatsword"], true, "2d6", "slashing", ["heavy", "two_handed"]),
  w("Длинное копьё", ["pike", "длинное копье"], true, "1d10", "piercing", ["heavy", "reach", "two_handed"]),
  w("Длинный меч", ["longsword"], true, "1d8", "slashing", ["versatile"], { versatile: "1d10" }),
  w("Кнут", ["whip", "хлыст"], true, "1d4", "slashing", ["finesse", "reach"]),
  w("Короткий меч", ["shortsword"], true, "1d6", "piercing", ["finesse", "light"]),
  w("Молот", ["maul"], true, "2d6", "bludgeoning", ["heavy", "two_handed"]),
  w("Моргенштерн", ["morningstar"], true, "1d8", "piercing"),
  w("Рапира", ["rapier"], true, "1d8", "piercing", ["finesse"]),
  w("Секира", ["greataxe", "большой топор"], true, "1d12", "slashing", ["heavy", "two_handed"]),
  w("Скимитар", ["scimitar", "сабля"], true, "1d6", "slashing", ["finesse", "light"]),
  w("Трезубец", ["trident"], true, "1d6", "piercing", ["thrown", "versatile"], { versatile: "1d8", range: [20, 60] }),
  w("Цеп", ["flail"], true, "1d8", "bludgeoning"),
  // воинское дальнобойное
  w("Длинный лук", ["longbow"], false, "1d8", "piercing", ["ammunition", "heavy", "two_handed"], { range: [150, 600] }),
  w("Ручной арбалет", ["hand crossbow"], false, "1d6", "piercing", ["ammunition", "light", "loading"], { range: [30, 120] }),
  w("Тяжёлый арбалет", ["heavy crossbow", "тяжелый арбалет"], false, "1d10", "piercing", ["ammunition", "heavy", "loading", "two_handed"], { range: [100, 400] }),
];

export interface ArmorInfo {
  name: string;
  aliases: string[];
  base: number;
  dex: "full" | "max_2" | "none";
}

export const ARMORS: ArmorInfo[] = [
  { name: "Стёганый доспех", aliases: ["padded", "стеганый", "стёганый", "стеганый доспех"], base: 11, dex: "full" },
  { name: "Кожаный доспех", aliases: ["leather", "кожаный"], base: 11, dex: "full" },
  { name: "Проклёпанная кожа", aliases: ["studded leather", "проклепанная кожа", "проклёпанный кожаный", "проклепанный кожаный"], base: 12, dex: "full" },
  { name: "Шкурный доспех", aliases: ["hide", "шкурный"], base: 12, dex: "max_2" },
  { name: "Кольчужная рубаха", aliases: ["chain shirt"], base: 13, dex: "max_2" },
  { name: "Чешуйчатый доспех", aliases: ["scale mail", "чешуйчатый"], base: 14, dex: "max_2" },
  { name: "Кираса", aliases: ["breastplate"], base: 14, dex: "max_2" },
  { name: "Полулаты", aliases: ["half plate", "полу-латы"], base: 15, dex: "max_2" },
  { name: "Колечный доспех", aliases: ["ring mail", "колечный"], base: 14, dex: "none" },
  { name: "Кольчуга", aliases: ["chain mail", "кольчужный доспех"], base: 16, dex: "none" },
  { name: "Наборный доспех", aliases: ["splint", "наборный"], base: 17, dex: "none" },
  { name: "Латы", aliases: ["plate", "латный доспех"], base: 18, dex: "none" },
];

export const norm = (s: string): string =>
  s.toLowerCase().replace(/ё/g, "е").replace(/[«»"'.]/g, "").replace(/\s+/g, " ").trim();

function find<T extends { name: string; aliases: string[] }>(list: T[], query: string): T | undefined {
  const q = norm(query);
  return list.find((x) => norm(x.name) === q || x.aliases.some((a) => norm(a) === q));
}

export const findWeapon = (name: string) => find(WEAPONS, name);
export const findArmor = (name: string) => find(ARMORS, name);

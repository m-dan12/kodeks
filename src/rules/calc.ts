import type { AbilityKey, Build, DamagePart, SkillKey, Weapon } from "../types.js";
import {
  ALL_ABILITIES, CLASSES, DAMAGE_RU_SHORT, FULL_CASTER_SLOTS, PACT_SLOTS, SKILL_ABILITY, XP_FOR_LEVEL,
} from "./tables.js";

export const abilityMod = (score: number): number => Math.floor((score - 10) / 2);
export const proficiencyBonus = (level: number): number => 2 + Math.floor((level - 1) / 4);
export const signed = (n: number): string => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
const signedAscii = (n: number): string => (n >= 0 ? `+${n}` : `-${Math.abs(n)}`);

export interface SkillResult { skill: SkillKey; ability: AbilityKey; bonus: number; level: 0 | 1 | 2 }
export interface SaveResult { ability: AbilityKey; bonus: number; proficient: boolean }
export interface AttackRow { name: string; bonus: number; damage: string; note?: string }
export interface SpellStats { class: string; ability: AbilityKey; dc: number; attack: number }

export interface Derived {
  level: number;
  proficiency: number;
  mods: Record<AbilityKey, number>;
  saves: Record<AbilityKey, SaveResult>;
  skills: Record<SkillKey, SkillResult>;
  hpMax: number;
  hitDice: { die: number; count: number }[];
  ac: number;
  initiative: number;
  speed: number;
  passivePerception: number;
  experience: number;
  slots: number[];
  pact?: { count: number; level: number };
  spellStats: SpellStats[];
  attacks: AttackRow[];
}

export function totalLevel(b: Pick<Build, "classes">): number {
  return b.classes.reduce((sum, c) => sum + c.level, 0);
}

export function computeHp(b: Build, conMod: number): number {
  if (b.hit_points?.override) return b.hit_points.override;
  let hp = 0;
  let first = true;
  for (const c of b.classes) {
    const die = CLASSES[c.class].hitDie;
    for (let i = 0; i < c.level; i++) {
      const gain = first ? die : Math.floor(die / 2) + 1;
      hp += Math.max(1, gain + conMod);
      first = false;
    }
  }
  return hp;
}

export function computeAc(b: Build, dexMod: number): number {
  const d = b.defense;
  if (d?.override) return d.override.value;
  const a = d?.armor;
  let ac: number;
  if (a) {
    const dex = a.dex === "none" ? 0 : a.dex === "max_2" ? Math.min(dexMod, 2) : dexMod;
    ac = a.base + dex + (a.magic_bonus ?? 0);
  } else {
    ac = 10 + dexMod;
  }
  return ac + (d?.shield ? 2 : 0) + (d?.other_bonus ?? 0);
}

/** Ячейки по общей таблице. Один класс-заклинатель считается по своей таблице, несколько по сумме уровней. */
export function computeSlots(b: Build): { slots: number[]; pact?: { count: number; level: number } } {
  const casting = b.classes.filter((c) => CLASSES[c.class].caster !== "none" || hasThirdCasterSubclass(b, c.class));
  let pact: { count: number; level: number } | undefined;
  const regular = casting.filter((c) => CLASSES[c.class].caster !== "pact");
  const warlock = casting.find((c) => CLASSES[c.class].caster === "pact");
  if (warlock) {
    const [count, level] = PACT_SLOTS[warlock.level];
    pact = { count, level };
  }
  let casterLevel = 0;
  const single = regular.length === 1 && b.classes.length === 1;
  for (const c of regular) {
    const type = CLASSES[c.class].caster === "none" ? "third" : CLASSES[c.class].caster;
    if (type === "full") casterLevel += c.level;
    else if (type === "half") casterLevel += single ? (c.level >= 2 ? Math.ceil(c.level / 2) : 0) : Math.floor(c.level / 2);
    else if (type === "third") casterLevel += single ? (c.level >= 3 ? Math.ceil(c.level / 3) : 0) : Math.floor(c.level / 3);
  }
  const slots = casterLevel > 0 ? [...FULL_CASTER_SLOTS[Math.min(casterLevel, 20)]] : [];
  return { slots, pact };
}

/** Воин и плут считаются заклинателями третьей части, если в spellcasting есть запись для их класса. */
function hasThirdCasterSubclass(b: Build, cls: string): boolean {
  return (cls === "fighter" || cls === "rogue") && !!b.spellcasting?.some((s) => s.class === cls);
}

export function diceCount(dice: string): { n: number; die: number } {
  const [n, die] = dice.split("d").map(Number);
  return { n, die };
}

/** Заговор растёт на 5, 11 и 17 уровне по общему уровню персонажа. */
export function cantripDiceCount(base: number, level: number): number {
  return base * (1 + (level >= 5 ? 1 : 0) + (level >= 11 ? 1 : 0) + (level >= 17 ? 1 : 0));
}

function formatDamage(dice: string, mod: number, type: keyof typeof DAMAGE_RU_SHORT, count?: number): string {
  const { n, die } = diceCount(dice);
  const m = mod === 0 ? "" : signedAscii(mod);
  return `${count ?? n}к${die}${m} ${DAMAGE_RU_SHORT[type]}`;
}

function weaponAbility(w: Weapon, mods: Record<AbilityKey, number>): AbilityKey {
  if (w.ability) return w.ability;
  if (!w.melee) return "dex";
  if (w.properties?.includes("finesse")) return mods.dex > mods.str ? "dex" : "str";
  return "str";
}

export function weaponAbilityOf(w: Weapon, mods: Record<AbilityKey, number>): AbilityKey {
  return weaponAbility(w, mods);
}

export function weaponRow(w: Weapon, mods: Record<AbilityKey, number>, prof: number): AttackRow {
  const ability = weaponAbility(w, mods);
  const magic = w.magic_bonus ?? 0;
  const bonus = mods[ability] + (w.proficient === false ? 0 : prof) + magic;
  const dmgMod = mods[ability] + magic + (w.damage_bonus ?? 0);
  const notes: string[] = [];
  if (w.note) notes.push(w.note);
  else if (w.crit_range && w.crit_range < 20) notes.push(`крит. на ${w.crit_range}–20`);
  if (w.versatile_dice) notes.push(`двумя руками ${formatDamage(w.versatile_dice, dmgMod, w.damage.type)}`);
  if (w.range_normal) notes.push(`дальность ${w.range_normal}${w.range_long ? `/${w.range_long}` : ""}`);
  return {
    name: w.name,
    bonus,
    damage: formatDamage(w.damage.dice, dmgMod, w.damage.type),
    note: notes.length ? notes.join("; ") : undefined,
  };
}

function spellDamage(parts: DamagePart[], level: number, mods: Record<AbilityKey, number>): string {
  return parts
    .map((p) => {
      const { n } = diceCount(p.dice);
      const count = p.scales_with_level === "cantrip" ? cantripDiceCount(n, level) : n;
      const mod = (p.ability ? mods[p.ability] : 0) + (p.bonus ?? 0);
      return formatDamage(p.dice, mod, p.type, count);
    })
    .join(" + ");
}

export function compute(b: Build, opts: { experience?: number } = {}): Derived {
  const level = totalLevel(b);
  const prof = proficiencyBonus(level);
  const mods = Object.fromEntries(ALL_ABILITIES.map((a) => [a, abilityMod(b.abilities[a])])) as Record<AbilityKey, number>;

  const starter = CLASSES[b.classes[0].class];
  const saveProfs = new Set<AbilityKey>(b.save_proficiencies ?? starter.saves);
  const saves = Object.fromEntries(
    ALL_ABILITIES.map((a) => [a, { ability: a, proficient: saveProfs.has(a), bonus: mods[a] + (saveProfs.has(a) ? prof : 0) }]),
  ) as Record<AbilityKey, SaveResult>;

  const profMap = new Map((b.skill_proficiencies ?? []).map((s) => [s.skill, s.expertise ? 2 : 1] as const));
  const skills = Object.fromEntries(
    (Object.keys(SKILL_ABILITY) as SkillKey[]).map((s) => {
      const lvl = (profMap.get(s) ?? 0) as 0 | 1 | 2;
      const ability = SKILL_ABILITY[s];
      return [s, { skill: s, ability, level: lvl, bonus: mods[ability] + lvl * prof }];
    }),
  ) as Record<SkillKey, SkillResult>;

  const hitDice = new Map<number, number>();
  for (const c of b.classes) hitDice.set(CLASSES[c.class].hitDie, (hitDice.get(CLASSES[c.class].hitDie) ?? 0) + c.level);

  const { slots, pact } = computeSlots(b);
  const spellStats: SpellStats[] = (b.spellcasting ?? []).map((s) => {
    const ability = s.ability ?? CLASSES[s.class].spellAbility ?? "int";
    return { class: s.class, ability, dc: 8 + prof + mods[ability], attack: prof + mods[ability] };
  });

  const attacks: AttackRow[] = (b.weapons ?? []).map((w) => weaponRow(w, mods, prof));
  for (const entry of b.spellcasting ?? []) {
    const stats = spellStats.find((s) => s.class === entry.class)!;
    for (const sp of entry.spells) {
      if (!sp.attack) continue;
      attacks.push({
        name: sp.name,
        bonus: stats.attack,
        damage: spellDamage(sp.attack.damage, level, mods),
        note: sp.attack.range ? `дальность ${sp.attack.range} фт.` : undefined,
      });
    }
  }

  return {
    level,
    proficiency: prof,
    mods,
    saves,
    skills,
    hpMax: computeHp(b, mods.con),
    hitDice: [...hitDice.entries()].map(([die, count]) => ({ die, count })).sort((a, c) => c.die - a.die),
    ac: computeAc(b, mods.dex),
    initiative: mods.dex,
    speed: b.speed?.walk ?? 30,
    passivePerception: 10 + skills.perception.bonus,
    experience: opts.experience ?? XP_FOR_LEVEL[level - 1],
    slots,
    pact,
    spellStats,
    attacks,
  };
}

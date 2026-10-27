import type { AbilityKey, ClassKey, Npc, SkillKey, Spell } from "../types.js";
import { compute, type Derived } from "../rules/calc.js";
import { ALL_ABILITIES, CLASSES, SKILL_ABILITY, SKILL_RU } from "../rules/tables.js";
import { ABILITY_RU_CAPS, signed, usageLabel } from "../i18n/ru.js";

export interface NpcSpellGroup {
  level: number;
  title: string;
  slots?: number;
  spells: { name: string; marks: string; muted: boolean }[];
}

export interface NpcCardModel {
  name: string;
  subtitle: string;
  classLine: string;
  level: number;
  source: string;
  ac: string;
  acNote?: string;
  hp: string;
  hitDice: string;
  speed: string;
  initiative: string;
  proficiency: string;
  abilities: { name: string; score: number; mod: string }[];
  saves: { name: string; bonus: string; proficient: boolean }[];
  skills: { name: string; ability: string; bonus: string; level: 0 | 1 | 2 }[];
  passive: number;
  attacks: { name: string; bonus: string; damage: string; note?: string }[];
  features: { name: string; text: string }[];
  spellStats: { label: string; dc: number; attack: string }[];
  spellGroups: NpcSpellGroup[];
  pact?: string;
  proficiencies: { label: string; value: string }[];
  equipment: { name: string; note?: string }[];
  currency?: string;
  roleplay: { label: string; text: string }[];
  notes: { title: string; text: string }[];
}

const ABILITY_SHORT: Record<AbilityKey, string> = { str: "Сил", dex: "Лов", con: "Тел", int: "Инт", wis: "Муд", cha: "Хар" };

const ruDice = (s: string): string => s.replace(/(\d)d(\d)/g, "$1к$2");

/** Подстановки в тексте: {prof}, {level}, {level.fighter}, {mod.int}. Неизвестное остаётся как есть. */
export function substitute(text: string, d: Derived, npc: Npc): string {
  return ruDice(
    text.replace(/\{([a-z]+)(?:\.([a-z]+))?\}/g, (whole, key: string, arg?: string) => {
      if (key === "prof") return String(d.proficiency);
      if (key === "level" && !arg) return String(d.level);
      if (key === "level" && arg) {
        const c = npc.classes.find((x) => x.class === (arg as ClassKey));
        return c ? String(c.level) : whole;
      }
      if (key === "mod" && arg && (ALL_ABILITIES as string[]).includes(arg)) return signed(d.mods[arg as AbilityKey]);
      return whole;
    }),
  );
}

function classLine(npc: Npc): string {
  return npc.classes
    .map((c) => `${CLASSES[c.class].nameRu} ${c.level}${c.subclass ? ` (${c.subclass})` : ""}`)
    .join(" / ");
}

function spellMarks(s: Spell): string {
  const m: string[] = [];
  if (s.concentration) m.push("К");
  if (s.ritual) m.push("Р");
  return m.join(" ");
}

function spellGroups(npc: Npc, d: Derived): NpcSpellGroup[] {
  const byLevel = new Map<number, Spell[]>();
  for (const entry of npc.spellcasting ?? []) {
    for (const s of entry.spells) byLevel.set(s.level, [...(byLevel.get(s.level) ?? []), s]);
  }
  return [...byLevel.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, spells]) => ({
      level,
      title: level === 0 ? "Заговоры" : `${level} уровень`,
      slots: level > 0 ? d.slots[level - 1] : undefined,
      spells: spells.map((s) => ({ name: s.name, marks: spellMarks(s), muted: s.prepared === false })),
    }));
}

function sourceLabel(npc: Npc): string {
  const s = npc.source;
  if (!s) return "";
  if (s.type === "official") return s.book ?? "официальный";
  return s.note ? `кастомный (${s.note})` : "кастомный";
}

export function buildNpcCard(npc: Npc): { model: NpcCardModel; derived: Derived } {
  const d = compute(npc);
  const sub = (t: string) => substitute(t, d, npc);

  const hitDice = d.hitDice.map((h) => `${h.count}к${h.die}`).join(" + ");
  const armor = npc.defense?.armor;
  const acNote = npc.defense?.override?.note ?? [armor?.name, npc.defense?.shield ? "щит" : undefined].filter(Boolean).join(" + ");

  const features = (npc.features ?? []).map((f) => ({
    name: `${f.name}${f.usage ? ` ${usageLabel(f.usage)}` : ""}`,
    text: sub(f.text),
  }));

  const proficiencies: { label: string; value: string }[] = [];
  const p = npc.proficiencies;
  if (p?.armor?.length) proficiencies.push({ label: "Доспехи", value: p.armor.join(", ") });
  if (p?.weapons?.length) proficiencies.push({ label: "Оружие", value: p.weapons.join(", ") });
  if (p?.tools?.length) proficiencies.push({ label: "Инструменты", value: p.tools.join(", ") });
  if (npc.languages?.length) proficiencies.push({ label: "Языки", value: npc.languages.join(", ") });

  const cur = npc.equipment?.currency;
  const currency = cur
    ? (["pp", "gp", "ep", "sp", "cp"] as const)
        .filter((k) => cur[k])
        .map((k) => `${cur[k]} ${({ pp: "пм", gp: "зм", ep: "эм", sp: "см", cp: "мм" })[k]}`)
        .join(", ") || undefined
    : undefined;

  const rp = npc.roleplay;
  const roleplay = [
    rp?.speech && { label: "Речь", text: rp.speech },
    rp?.wants && { label: "Хочет", text: rp.wants },
    rp?.hides && { label: "Скрывает", text: rp.hides },
    rp?.in_combat && { label: "В бою", text: rp.in_combat },
  ].filter(Boolean) as { label: string; text: string }[];

  const pr = npc.personality;
  if (pr?.appearance) roleplay.unshift({ label: "Внешность", text: pr.appearance });
  if (pr?.traits) roleplay.push({ label: "Черты", text: pr.traits });
  if (pr?.ideals) roleplay.push({ label: "Идеалы", text: pr.ideals });
  if (pr?.bonds) roleplay.push({ label: "Привязанности", text: pr.bonds });
  if (pr?.flaws) roleplay.push({ label: "Слабости", text: pr.flaws });

  const notes = (npc.dm_notes ?? []).map((n) => ({
    title: n.kind === "doubt" ? "Сомнение модели" : n.kind === "balance" ? "Баланс" : "Заметка",
    text: n.text,
  }));

  const model: NpcCardModel = {
    name: npc.name,
    subtitle: [npc.race.name, npc.background, npc.alignment].filter(Boolean).join(" · "),
    classLine: classLine(npc),
    level: d.level,
    source: sourceLabel(npc),
    ac: String(d.ac),
    acNote: acNote || undefined,
    hp: String(d.hpMax),
    hitDice,
    speed: String(d.speed),
    initiative: signed(d.initiative),
    proficiency: signed(d.proficiency),
    abilities: ALL_ABILITIES.map((a) => ({ name: ABILITY_RU_CAPS[a], score: npc.abilities[a], mod: signed(d.mods[a]) })),
    saves: ALL_ABILITIES.map((a) => ({
      name: ABILITY_RU_CAPS[a].replace("ТЕЛОСЛ.", "ТЕЛОСЛОЖЕНИЕ").replace("ИНТЕЛЛ.", "ИНТЕЛЛЕКТ"),
      bonus: signed(d.saves[a].bonus),
      proficient: d.saves[a].proficient,
    })),
    skills: (Object.keys(SKILL_ABILITY) as SkillKey[])
      .map((s) => ({
        name: SKILL_RU[s],
        ability: ABILITY_SHORT[SKILL_ABILITY[s]],
        bonus: signed(d.skills[s].bonus),
        level: d.skills[s].level,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru")),
    passive: d.passivePerception,
    attacks: d.attacks.map((a) => ({ name: a.name, bonus: signed(a.bonus), damage: ruDice(a.damage), note: a.note })),
    features,
    spellStats: d.spellStats.map((s) => ({
      label: `${CLASSES[s.class as ClassKey].nameRu}, ${ABILITY_SHORT[s.ability]}`,
      dc: s.dc,
      attack: signed(s.attack),
    })),
    spellGroups: spellGroups(npc, d),
    pact: d.pact ? `${d.pact.count} ячейки ${d.pact.level} уровня (колдун)` : undefined,
    proficiencies,
    equipment: (npc.equipment?.items ?? []).map((i) => ({
      name: `${i.name}${i.quantity && i.quantity > 1 ? ` ×${i.quantity}` : ""}`,
      note: i.description ?? i.note,
    })),
    currency,
    roleplay,
    notes,
  };
  return { model, derived: d };
}

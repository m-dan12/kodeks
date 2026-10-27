import type { AbilityKey, AttackAction, Monster, MonsterAction, SaveAction } from "../types.js";
import type { ComputedAction, MonsterDerived } from "../rules/monster.js";
import { ALL_ABILITIES } from "../rules/tables.js";
import {
  ABILITY_GENITIVE, ABILITY_RU_CAPS, ATTACK_TYPE_RU, DAMAGE_PLAIN, damageText, monsterTypeLine, signed,
  skillName, speedExtras, usageLabel,
} from "../i18n/ru.js";

const CONDITION_RU: Record<string, string> = {
  blinded: "ослеплённый", charmed: "очарованный", deafened: "оглохший", exhaustion: "истощение",
  frightened: "напуганный", grappled: "схваченный", incapacitated: "недееспособный", invisible: "невидимый",
  paralyzed: "парализованный", petrified: "окаменевший", poisoned: "отравленный", prone: "лежащий ничком",
  restrained: "опутанный", stunned: "ошеломлённый", unconscious: "без сознания",
};

export interface Entry {
  name: string;
  lead?: string;
  text: string;
}

export interface Section {
  title: string;
  intro?: string;
  entries: Entry[];
}

export interface StatblockModel {
  name: string;
  typeLine: string;
  source: string;
  cr: string;
  xp: string;
  ac: string;
  acNote?: string;
  hp: string;
  hpFormula: string;
  speed: string;
  speedExtra?: string;
  initiative: string;
  abilities: { name: string; score: number; mod: string; save: string; saveProf: boolean }[];
  props: { label: string; value: string }[];
  sections: Section[];
  notes: { title: string; text: string }[];
  crCheck: { rows: { label: string; value: string }[]; verdict: string; status: "ok" | "tolerable" | "mismatch" };
  warnings: string[];
}

const crLabel = (cr: string) => cr;

/** В русских книгах кости пишут как «2к8». */
const ruDice = (s: string): string => s.replace(/(\d)d(\d)/g, "$1к$2");

function sourceLabel(m: Monster): string {
  if (m.source.type === "official") return m.source.book ?? "официальный";
  return m.source.note ? `кастомный (${m.source.note})` : "кастомный";
}

function rangeText(a: AttackAction): string {
  const melee = a.attack_type.startsWith("melee");
  if (melee) return `досягаемость ${a.reach ?? 5} фт.`;
  return a.range_long ? `дистанция ${a.range_normal}/${a.range_long} фт.` : `дистанция ${a.range_normal ?? 30} фт.`;
}

function attackEntry(a: AttackAction, c: ComputedAction): Entry {
  const hits = c.damage.map((d) => damageText(d.average, ruDice(d.formula), d.type)).join(" плюс ");
  const rider = a.on_hit_text ? ` ${a.on_hit_text}` : "";
  return {
    name: `${a.name}${usage(a)}`,
    lead: `${ATTACK_TYPE_RU[a.attack_type]}:`,
    text: `${signed(c.toHit ?? 0)} к попаданию, ${rangeText(a)}, ${a.targets ?? "одна цель"}. Попадание: ${hits}.${rider}`,
  };
}

function saveEntry(a: SaveAction, c: ComputedAction): Entry {
  const area = a.area ? `${a.area[0].toUpperCase()}${a.area.slice(1)}${a.area.endsWith(".") ? "" : "."} ` : "";
  const dmg = c.damage.map((d) => damageText(d.average, ruDice(d.formula), d.type)).join(" плюс ");
  const half = a.on_success === "half" ? "; при успехе вдвое меньше" : a.on_success === "none" ? "; при успехе урона нет" : "";
  const fail = dmg ? ` Провал: ${dmg}${half}.` : "";
  const effect = a.effect_text ? ` ${a.effect_text}` : "";
  return {
    name: `${a.name}${usage(a)}`,
    text: `${area}Спасбросок ${ABILITY_GENITIVE[a.save_ability]} Сл ${c.dc}.${fail}${effect}`.trim(),
  };
}

function usage(a: MonsterAction): string {
  const label = usageLabel(a.usage);
  const cost = a.legendary_cost && a.legendary_cost > 1 ? ` (стоит ${a.legendary_cost} действия)` : "";
  return `${label ? ` ${label}` : ""}${cost}`;
}

function toEntries(actions: MonsterAction[] | undefined, derived: MonsterDerived): Entry[] {
  const byId = new Map(derived.actions.filter((a) => a.id).map((a) => [a.id!, a]));
  return (actions ?? []).map((a): Entry => {
    switch (a.kind) {
      case "attack": return attackEntry(a, byId.get(a.id)!);
      case "save": return saveEntry(a, byId.get(a.id)!);
      case "multiattack": return { name: a.name ?? "Мультиатака", text: a.text };
      default: return { name: `${a.name}${usage(a)}`, text: a.text };
    }
  });
}

function damageList(list: Monster["damage_vulnerabilities"]): string {
  return (list ?? []).map((d) => DAMAGE_PLAIN[d]).join(", ");
}

export function buildStatblock(m: Monster, d: MonsterDerived): StatblockModel {
  const props: { label: string; value: string }[] = [];
  if (d.saves.length) props.push({ label: "Спасброски", value: d.saves.map((s) => `${ABILITY_GENITIVE[s.ability]} ${signed(s.bonus)}`).join(", ") });
  if (d.skills.length) props.push({ label: "Навыки", value: d.skills.map((s) => `${skillName(s.skill)} ${signed(s.bonus)}`).join(", ") });
  if (m.damage_vulnerabilities?.length) props.push({ label: "Уязвимости", value: damageList(m.damage_vulnerabilities) });
  if (m.damage_resistances?.length || m.damage_notes) {
    props.push({ label: "Сопротивления", value: [damageList(m.damage_resistances), m.damage_notes].filter(Boolean).join("; ") });
  }
  if (m.damage_immunities?.length) props.push({ label: "Иммунитет к урону", value: damageList(m.damage_immunities) });
  if (m.condition_immunities?.length) {
    props.push({ label: "Иммунитет к состояниям", value: m.condition_immunities.map((c) => CONDITION_RU[c] ?? c).join(", ") });
  }
  const senses: string[] = [];
  const s = m.senses ?? {};
  if (s.blindsight) senses.push(`слепое зрение ${s.blindsight} фт.${s.blind_beyond ? " (слеп за пределами этого радиуса)" : ""}`);
  if (s.darkvision) senses.push(`тёмное зрение ${s.darkvision} фт.`);
  if (s.tremorsense) senses.push(`чувство вибрации ${s.tremorsense} фт.`);
  if (s.truesight) senses.push(`истинное зрение ${s.truesight} фт.`);
  senses.push(`пассивная внимательность ${d.passivePerception}`);
  props.push({ label: "Чувства", value: senses.join(", ") });
  const langs = (m.languages ?? []).join(", ");
  props.push({ label: "Языки", value: [langs || "—", m.languages_note].filter(Boolean).join("; ") });
  props.push({ label: "Бонус мастерства", value: signed(d.proficiency) });

  const sections: Section[] = [];
  if (m.traits?.length) {
    sections.push({ title: "Особенности", entries: m.traits.map((t) => ({ name: `${t.name}${t.usage ? ` ${usageLabel(t.usage)}` : ""}`, text: t.text })) });
  }
  if (m.actions?.length) sections.push({ title: "Действия", entries: toEntries(m.actions, d) });
  if (m.bonus_actions?.length) sections.push({ title: "Бонусные действия", entries: toEntries(m.bonus_actions, d) });
  if (m.reactions?.length) sections.push({ title: "Реакции", entries: toEntries(m.reactions, d) });
  if (m.legendary_actions) {
    const n = m.legendary_actions.per_round ?? 3;
    sections.push({
      title: "Легендарные действия",
      intro:
        m.legendary_actions.intro ??
        `Существо может совершить ${n} легендарных действия, выбирая из перечисленных ниже. Одновременно можно использовать только одно легендарное действие, и только в конце хода другого существа. Потраченные легендарные действия восстанавливаются в начале хода существа.`,
      entries: toEntries(m.legendary_actions.actions, d),
    });
  }
  if (m.lair) {
    const entries: Entry[] = [];
    if (m.lair.description) entries.push({ name: "Логово", text: m.lair.description });
    for (const t of m.lair.lair_actions ?? []) entries.push({ name: "Действие логова", text: t });
    for (const t of m.lair.regional_effects ?? []) entries.push({ name: "Региональный эффект", text: t });
    if (entries.length) sections.push({ title: "Логово", entries });
  }

  const notes: { title: string; text: string }[] = [];
  if (m.tactics) notes.push({ title: "Тактика", text: m.tactics });
  if (m.description) notes.push({ title: "Описание", text: m.description });
  for (const n of m.dm_notes ?? []) {
    notes.push({ title: n.kind === "doubt" ? "Сомнение модели" : n.kind === "balance" ? "Баланс" : "Заметка", text: n.text });
  }

  const cr = d.cr;
  const steps = Math.abs(cr.difference);
  const verdict =
    cr.status === "ok"
      ? "Заявленная опасность совпадает с расчётной."
      : cr.status === "tolerable"
        ? `Расхождение в ${steps} ступень: в пределах допуска.`
        : `Заявлено ${cr.declared}, по цифрам выходит около ${cr.calculated}. Проверьте хиты, КД и урон.`;

  return {
    name: m.name,
    typeLine: monsterTypeLine(m.size, m.type, m.subtype, m.alignment),
    source: sourceLabel(m),
    cr: crLabel(m.challenge_rating),
    xp: d.xp.toLocaleString("ru-RU").replace(/ /g, " "),
    ac: String(m.armor_class.value),
    acNote: m.armor_class.note,
    hp: String(d.hpAverage),
    hpFormula: ruDice(d.hpFormula),
    speed: m.speed.walk !== undefined ? String(m.speed.walk) : "—",
    speedExtra: speedExtras(m.speed),
    initiative: signed(d.initiative),
    abilities: ALL_ABILITIES.map((a: AbilityKey) => {
      const save = d.saves.find((x) => x.ability === a);
      return {
        name: ABILITY_RU_CAPS[a],
        score: m.abilities[a],
        mod: signed(d.mods[a]),
        save: signed(save ? save.bonus : d.mods[a]),
        saveProf: !!save,
      };
    }),
    props,
    sections,
    notes,
    crCheck: {
      rows: [
        { label: "Защита", value: `≈ ${cr.defensive}` },
        { label: "Нападение", value: `≈ ${cr.offensive}` },
        { label: "Расчёт", value: `≈ ${cr.calculated}` },
        { label: "Заявлено", value: cr.declared },
      ],
      verdict,
      status: cr.status,
    },
    warnings: d.warnings,
  };
}

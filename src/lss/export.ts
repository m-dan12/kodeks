import spellsData from "../../data/lss-spells.json";
import type { AbilityKey, Character, SkillKey, Spell } from "../types.js";
import { compute, weaponAbilityOf, weaponRow, type Derived } from "../rules/calc.js";
import { ALL_ABILITIES, CLASSES } from "../rules/tables.js";
import { bulletList, doc, emptyParagraph, paragraph, paragraphs, resource, text, type PmDoc, type PmNode } from "./richtext.js";

/** Ключи навыков в Long Story Short: с пробелами. */
const LSS_SKILL_KEY: Record<SkillKey, string> = {
  acrobatics: "acrobatics", animal_handling: "animal handling", arcana: "arcana", athletics: "athletics",
  deception: "deception", history: "history", insight: "insight", intimidation: "intimidation",
  investigation: "investigation", medicine: "medicine", nature: "nature", perception: "perception",
  performance: "performance", persuasion: "persuasion", religion: "religion",
  sleight_of_hand: "sleight of hand", stealth: "stealth", survival: "survival",
};

interface LssSpellEntry { id: string; name_ru: string; name_en?: string; level: number }
const spellCatalog: LssSpellEntry[] = (spellsData as { spells: LssSpellEntry[] }).spells;
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/s+/g, " ").trim();
const spellIdByName = new Map<string, LssSpellEntry>();
for (const e of spellCatalog) {
  spellIdByName.set(norm(e.name_ru), e);
  if (e.name_en) spellIdByName.set(norm(e.name_en), e);
}
const lssSpell = (s: Spell): LssSpellEntry | undefined =>
  spellIdByName.get(norm(s.name_en ?? "")) ?? spellIdByName.get(norm(s.name));
const lssSpellId = (s: Spell): string | undefined => lssSpell(s)?.id;

const randomHex = (n: number): string =>
  [...globalThis.crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");

const signed = (n: number) => (n >= 0 ? `+${n}` : `-${Math.abs(n)}`);

export interface ExportOptions {
  /** Для воспроизводимых тестов. */
  now?: Date;
  idSource?: () => string;
}

export interface LssExport {
  /** Готовый объект: JSON.stringify(...) даёт файл для импорта в Long Story Short. */
  file: Record<string, unknown>;
  derived: Derived;
  warnings: string[];
}

interface ResourceRecord {
  id: string;
  name: string;
  current: number;
  max: number;
  location: "traits" | "feats" | "equipment";
  isLongRest?: boolean;
  icon?: string;
  notes?: string;
  notesVisibility?: boolean;
}

export function toLongStoryShort(c: Character, opts: ExportOptions = {}): LssExport {
  const now = opts.now ?? new Date();
  const stamp = now.getTime();
  let counter = 0;
  const nextId = opts.idSource ?? (() => String(stamp + counter++));
  const warnings: string[] = [];

  const d = compute(c, { experience: c.experience });
  const cls = c.classes[0];
  const info = CLASSES[cls.class];

  const stats = Object.fromEntries(
    ALL_ABILITIES.map((a) => [a, { name: a, score: c.abilities[a], modifier: d.mods[a], race: 0 }]),
  );
  const saves = Object.fromEntries(
    ALL_ABILITIES.map((a) => [a, { name: a, isProf: d.saves[a].proficient }]),
  );
  const skills = Object.fromEntries(
    Object.values(d.skills).map((s) => [
      LSS_SKILL_KEY[s.skill],
      { baseStat: s.ability, name: LSS_SKILL_KEY[s.skill], ...(s.level ? { isProf: s.level } : {}) },
    ]),
  );

  // Особенности: с ограничением по использованию становятся «ресурсами» (счётчиками) листа.
  const resources: Record<string, ResourceRecord> = {};
  const traitsNodes: PmNode[] = [];
  const featsNodes: PmNode[] = [];
  for (const f of c.features ?? []) {
    const target = f.origin.type === "class" ? traitsNodes : featsNodes;
    const location = f.origin.type === "class" ? "traits" : "feats";
    const times = f.usage && (f.usage.type === "per_rest" || f.usage.type === "per_day") ? f.usage.times ?? 1 : 0;
    if (times > 0) {
      const id = `resource-${nextId()}`;
      const long = f.usage!.type === "per_day" || f.usage!.rest === "long";
      resources[id] = {
        id, name: f.name, current: times, max: times, location,
        isLongRest: long, icon: long ? "long-rest" : "", notes: f.text, notesVisibility: true,
      };
      target.push(resource(id, location));
    } else {
      target.push(paragraph(text(f.name, ["bold"]), `. ${f.text}`));
    }
  }

  // Заклинания: идентификаторы заклинаний LSS нам неизвестны, поэтому список идёт текстом.
  const spells = (c.spellcasting ?? []).flatMap((s) => s.spells);
  const linked = spells.filter((s) => lssSpellId(s));
  const unlinked = spells.filter((s) => !lssSpellId(s));
  if (unlinked.length) {
    warnings.push(
      `Нет идентификатора LSS для заклинаний: ${unlinked.map((s) => s.name).join(", ")}. Они записаны текстовым блоком «Заклинания».`,
    );
  }
  const idsOf = (list: Spell[]) => [...new Set(list.map((s) => lssSpellId(s)!))];
  const bookIds = idsOf(linked);
  const preparedIds = idsOf(linked.filter((s) => s.prepared !== false));

  const weaponsList = (c.weapons ?? []).map((w) => {
    const row = weaponRow(w, d.mods, d.proficiency);
    return {
      id: `weapon-${nextId()}`,
      name: { value: w.name },
      mod: { value: signed(row.bonus) },
      dmg: { value: row.damage },
      ...(w.ability ? { ability: weaponAbilityOf(w, d.mods), isProf: w.proficient !== false } : {}),
    };
  });
  // Атаки заклинаниями (заговоры) идут туда же.
  for (const row of d.attacks.slice(c.weapons?.length ?? 0)) {
    weaponsList.push({
      id: `weapon-${nextId()}`,
      name: { value: row.name },
      mod: { value: signed(row.bonus) },
      dmg: { value: row.damage },
    });
  }

  if (c.classes.length > 1) warnings.push("Мультикласс в бланк игрока не экспортируется: взят первый класс.");
  if (info.caster === "pact") warnings.push("Ячейки колдуна (магия договора) не заполнены: формат LSS для них неизвестен.");

  const slotsBlock: Record<string, { value: number; filled: number }> = {};
  d.slots.forEach((n, i) => {
    if (n > 0) slotsBlock[`slots-${i + 1}`] = { value: n, filled: 0 };
  });

  const eq = c.equipment;
  const ordinary = (eq?.items ?? []).filter((i) => !i.magic);
  const magic = (eq?.items ?? []).filter((i) => i.magic);
  const cur = eq?.currency ?? {};
  const p = c.personality;
  const allies = p.relationships ?? [];

  const inner = {
    isDefault: true,
    jsonType: "character",
    template: "ph",
    name: { value: c.name },
    info: {
      charClass: { name: "charClass", value: info.nameRu },
      charSubclass: { name: "charSubclass", value: cls.subclass ?? "" },
      level: { name: "level", value: d.level },
      background: { name: "background", value: c.background ?? "" },
      playerName: { name: "playerName", value: c.player_name ?? "" },
      race: { name: "race", value: c.race.name },
      alignment: { name: "alignment", value: c.alignment ?? "" },
      experience: { name: "experience", value: d.experience },
      size: { value: c.race.size ?? "medium" },
    },
    subInfo: Object.fromEntries(
      (["age", "height", "weight", "eyes", "skin", "hair"] as const).map((k) => [k, { name: k, value: c.body?.[k] ?? "" }]),
    ),
    spellsInfo: {
      base: { name: "base", value: "", code: (c.spellcasting?.[0]?.ability ?? info.spellAbility ?? "int") as AbilityKey },
      save: { name: "save", value: "" },
      mod: { name: "mod", value: "" },
      available: { classes: info.caster === "none" ? [] : [cls.class] },
    },
    spells: slotsBlock,
    spellsPact: {},
    bonuses: [],
    proficiency: d.proficiency,
    stats,
    saves,
    skills,
    vitality: {
      "hp-dice-current": { value: d.level },
      "hp-dice-multi": {},
      "hp-max-con-bonus": { value: 0 },
      darkvision: { value: 0 },
      speed: { value: d.speed },
      "hp-max": { value: d.hpMax },
      "hit-die": { value: `d${info.hitDie}` },
      "hp-current": { value: d.hpMax },
      "hp-temp": { value: 0 },
      isDying: false,
      deathFails: 0,
      deathSuccesses: 0,
      shield: { value: !!c.defense?.shield },
      ac: { value: d.ac },
    },
    attunementsList: [{ id: `attunement-${nextId()}`, checked: false, value: "" }],
    weaponsList,
    weapons: {},
    text: {
      ...(unlinked.length ? { "notes-1": { value: { data: spellsDoc(unlinked) }, customLabel: "Заклинания" } } : {}),
      prof: { value: { data: profDoc(c) } },
      feats: { value: { data: doc(...(featsNodes.length ? featsNodes : [])) } },
      equipment: { value: { data: doc(...ordinary.map((i) => paragraph(`- ${i.name}${i.quantity && i.quantity > 1 ? ` (x${i.quantity})` : ""}${i.note ? `: ${i.note}` : ""}`))) } },
      items: { value: { data: doc(...magic.flatMap((i) => [paragraph(text(i.name, ["underline"])), ...(i.description ? [paragraph(i.description)] : []), emptyParagraph()])) } },
      traits: { value: { data: doc(...traitsNodes) }, isHidden: false },
      personality: { value: { data: doc(...paragraphs(p.traits)) } },
      ideals: { value: { data: doc(...paragraphs(p.ideals)) } },
      bonds: { value: { data: doc(...paragraphs(p.bonds)) } },
      flaws: { value: { data: doc(...paragraphs(p.flaws)) } },
      allies: { value: { data: doc(...(allies.length ? [bulletList(allies.map((a) => [paragraph(`${a.name} — ${a.relation}`)]))] : [])) } },
      appearance: { value: { data: p.appearance ? doc(...paragraphs(p.appearance)) : "" }, isHidden: !p.appearance },
      background: { value: { data: doc(...paragraphs(p.backstory)) }, isHidden: false },
      attacks: { value: { data: doc() } },
      features: { isHidden: false },
    },
    coins: {
      gp: { value: cur.gp ?? 0 }, sp: { value: cur.sp ?? 0 }, cp: { value: cur.cp ?? 0 },
      pp: { value: cur.pp ?? 0 }, ep: { value: cur.ep ?? 0 },
    },
    resources,
    bonusesSkills: {},
    bonusesStats: {},
    conditions: [],
    wizardStep: "initial",
    createdAt: now.toISOString(),
    inspiration: !!c.inspiration,
  };

  const file = {
    tags: [],
    disabledBlocks: {
      "info-left": [], "info-right": [], "subinfo-left": [], "subinfo-right": [], "notes-left": [], "notes-right": [],
      _id: randomHex(12),
    },
    edition: "2014",
    spells: { mode: "cards", prepared: preparedIds, book: bookIds, edition: "2014" },
    data: JSON.stringify(inner),
    lastWriterSessionId: `${stamp}-${randomHex(6)}`,
    sheetEdition: "2014",
    jsonType: "character",
    version: "2",
  };

  return { file, derived: d, warnings };
}

function profDoc(c: Character): PmDoc {
  const pr = c.proficiencies ?? {};
  const line = (label: string, values: string[] | undefined) =>
    paragraph(text(label, ["bold"]), `: ${values && values.length ? values.join(", ") : "нет"}`);
  return doc(
    line("Оружие", pr.weapons),
    line("Доспехи", pr.armor),
    line("Языки", c.languages),
    line("Инструменты", pr.tools),
  );
}

function spellsDoc(spells: Spell[]): PmDoc {
  const byLevel = new Map<number, string[]>();
  for (const s of spells) byLevel.set(s.level, [...(byLevel.get(s.level) ?? []), s.name]);
  const lines = [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, names]) => paragraph(text(level === 0 ? "Заговоры" : `${level} уровень`, ["bold"]), `: ${names.join(", ")}`));
  return doc(...lines);
}

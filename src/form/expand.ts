/**
 * Анкета → строгий файл. Анкета короче строгой схемы: модель выбирает (класс, оружие по названию, заклинания по названию),
 * а приложение подставляет всё, что можно вывести. Любое поле строгой схемы в анкете тоже допустимо и передаётся как есть.
 */
import spellDir from "../../data/lss-spells.json" with { type: "json" };
import { CLASSES } from "../rules/tables.js";
import { findArmor, findWeapon, norm } from "./gear.js";

export interface FormIssue {
  path: string;
  message: string;
}

type Obj = Record<string, unknown>;

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
const SKILLS = new Set([
  "acrobatics", "animal_handling", "arcana", "athletics", "deception", "history", "insight", "intimidation",
  "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleight_of_hand",
  "stealth", "survival",
]);
const SRD = { type: "official", book: "SRD 5.1" } as const;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => String(v).trim();

interface SpellEntry {
  name_ru: string;
  name_en?: string;
  level: number;
}
const SPELLS = new Map<string, SpellEntry>();
for (const s of (spellDir as { spells: SpellEntry[] }).spells) {
  SPELLS.set(norm(s.name_ru), s);
  if (s.name_en) SPELLS.set(norm(s.name_en), s);
}

const CLASS_BY_NAME = new Map<string, string>();
for (const [key, info] of Object.entries(CLASSES)) {
  CLASS_BY_NAME.set(key, key);
  CLASS_BY_NAME.set(norm(info.nameRu), key);
}

class Ctx {
  issues: FormIssue[] = [];
  bad(path: string, message: string): void {
    this.issues.push({ path, message });
  }
}

function classKey(raw: string): string | undefined {
  return CLASS_BY_NAME.get(norm(raw));
}

/** «15 14 14 14 10 8», [15, …] или объект → объект характеристик. Порядок: str dex con int wis cha. */
function abilities(v: unknown, c: Ctx): unknown {
  if (isObj(v)) return v;
  const nums = Array.isArray(v) ? v.map(Number) : typeof v === "string" ? v.split(/[\s,;]+/).filter(Boolean).map(Number) : [];
  if (nums.length !== 6 || nums.some((n) => !Number.isInteger(n))) {
    c.bad("abilities", "характеристики пишутся шестью целыми числами в порядке: сила, ловкость, телосложение, интеллект, мудрость, харизма. Например: «15 14 14 14 10 8».");
    return v;
  }
  return Object.fromEntries(ABILITIES.map((k, i) => [k, nums[i]]));
}

function speed(v: unknown): unknown {
  return typeof v === "number" ? { walk: v } : v;
}

function sourceOf(item: Obj, fallback?: Obj): Obj | undefined {
  if (isObj(item.source)) return item.source;
  if (item.custom === true) return item.note_source ? { type: "custom", note: str(item.note_source) } : { type: "custom" };
  if (typeof item.book === "string") return { type: "official", book: item.book };
  return fallback;
}

/** «1/short», «1/long», «3/day», «recharge 5», «at will» → usage. */
function usage(v: unknown, path: string, c: Ctx): unknown {
  if (v === undefined || isObj(v)) return v;
  const s = norm(str(v));
  let m;
  if (/^(at will|always|без ограничений)$/.test(s)) return { type: "at_will" };
  if ((m = s.match(/^recharge\s*(\d)/) ?? s.match(/^перезарядка\s*(\d)/))) return { type: "recharge", recharge_min: Number(m[1]) };
  if ((m = s.match(/^(\d+)\s*\/\s*(short|long|day)$/))) {
    const times = Number(m[1]);
    return m[2] === "day" ? { type: "per_day", times } : { type: "per_rest", times, rest: m[2] };
  }
  c.bad(path, `не понятно ограничение «${str(v)}». Пишите так: «1/short», «1/long», «3/day», «recharge 5» или «at will».`);
  return undefined;
}

function classes(v: unknown, c: Ctx): unknown {
  if (!Array.isArray(v)) return v;
  return v.map((item, i) => {
    if (typeof item !== "string") return item;
    const m = item.trim().match(/^(\S+)\s+(\d+)\s*(.*)$/);
    const key = m ? classKey(m[1]) : undefined;
    if (!m || !key) {
      c.bad(`classes[${i}]`, `строка «${item}» не разобрана. Пишите «класс уровень подкласс», например «fighter 3 Чемпион». Классы: ${Object.keys(CLASSES).join(", ")}.`);
      return item;
    }
    return m[3] ? { class: key, subclass: m[3].trim(), level: Number(m[2]) } : { class: key, level: Number(m[2]) };
  });
}

function skills(v: unknown, path: string, c: Ctx): unknown {
  if (!Array.isArray(v)) return v;
  return v.map((item, i) => {
    if (typeof item !== "string") return item;
    const expertise = item.trim().endsWith("*");
    const key = item.trim().replace(/\*$/, "").trim();
    if (!SKILLS.has(key)) c.bad(`${path}[${i}]`, `навык «${key}» неизвестен. Допустимо: ${[...SKILLS].join(", ")}.`);
    return expertise ? { skill: key, expertise: true } : { skill: key };
  });
}

function notes(form: Obj): Obj[] | undefined {
  const out: Obj[] = [];
  const add = (v: unknown, kind: string) => {
    if (Array.isArray(v)) for (const t of v) out.push({ kind, text: str(t) });
  };
  add(form.notes, "other");
  add(form.doubts, "doubt");
  if (Array.isArray(form.dm_notes)) return [...(form.dm_notes as Obj[]), ...out];
  return out.length ? out : undefined;
}

function sourceTop(form: Obj, fallbackNote: string): Obj {
  if (isObj(form.source)) return form.source;
  if (typeof form.book === "string") return { type: "official", book: form.book };
  return { type: "custom", note: fallbackNote };
}

function drop(out: Obj, keys: string[]): void {
  for (const k of keys) delete out[k];
}

/* ---------- NPC и персонаж ---------- */

function weapons(v: unknown, c: Ctx): unknown {
  if (!Array.isArray(v)) return v;
  return v.map((item, i) => {
    const path = `weapons[${i}]`;
    const form: Obj = typeof item === "string" ? { name: item } : isObj(item) ? item : {};
    if (isObj(form.damage) || "melee" in form) {
      return form.source ? form : { ...form, source: sourceOf(form) ?? { type: "custom" } };
    }
    const info = findWeapon(str(form.name));
    const out: Obj = { name: info ? info.name : str(form.name) };
    if (info) {
      out.melee = info.melee;
      out.damage = { dice: info.dice, type: info.type };
      if (info.properties.length) out.properties = info.properties;
      if (info.versatile) out.versatile_dice = info.versatile;
      if (info.range) [out.range_normal, out.range_long] = info.range;
      out.source = sourceOf(form) ?? SRD;
    } else if (typeof form.dice === "string" && typeof form.damage_type === "string") {
      out.melee = form.melee !== false && !form.ranged;
      out.damage = { dice: form.dice, type: form.damage_type };
      out.source = sourceOf(form) ?? { type: "custom" };
    } else {
      c.bad(path, `оружия «${str(form.name)}» нет в справочнике. Для особого оружия укажите: dice (например «1d8»), damage_type (например «slashing») и при необходимости ranged = true.`);
      return item;
    }
    for (const k of ["ability", "magic_bonus", "damage_bonus", "crit_range", "proficient", "note", "range_normal", "range_long", "versatile_dice", "properties"]) {
      if (form[k] !== undefined) out[k] = form[k];
    }
    return out;
  });
}

function features(v: unknown, c: Ctx): unknown {
  if (!Array.isArray(v)) return v;
  return v.map((item, i) => {
    if (!isObj(item) || isObj(item.origin)) return item;
    const path = `features[${i}]`;
    let origin: Obj = { type: "other" };
    if (typeof item.from === "string") {
      const m = item.from.trim().match(/^(\S+)(?:\s+(\d+))?$/);
      const key = m ? classKey(m[1]) : undefined;
      if (key) origin = m![2] ? { type: "class", class: key, level: Number(m![2]) } : { type: "class", class: key };
      else if (m && ["race", "background", "feat", "item", "other"].includes(m[1])) origin = { type: m[1] };
      else c.bad(`${path}.from`, `не понятно «${item.from}». Пишите «fighter 3» (класс и уровень), «race», «background», «feat», «item» или «other».`);
    }
    const out: Obj = { name: item.name, text: item.text, origin };
    const u = usage(item.uses ?? item.usage, `${path}.uses`, c);
    if (u) out.usage = u;
    out.source = sourceOf(item) ?? SRD;
    return out;
  });
}

function spellItem(raw: unknown, level0: boolean, notPrepared: boolean, path: string, c: Ctx): Obj | undefined {
  const form: Obj = typeof raw === "string" ? { name: raw } : isObj(raw) ? raw : {};
  const name = str(form.name ?? "");
  const found = SPELLS.get(norm(name));
  const level = typeof form.level === "number" ? form.level : level0 ? 0 : found?.level;
  if (level === undefined) {
    c.bad(path, `заклинания «${name}» нет в справочнике Long Story Short, а уровень не указан. Напишите его таблицей: { name = "...", name_en = "...", level = 2 }.`);
    return undefined;
  }
  const out: Obj = { name: found?.name_ru ?? name, level };
  const en = form.name_en ?? found?.name_en;
  if (en) out.name_en = en;
  if (form.school) out.school = form.school;
  if (form.ritual) out.ritual = true;
  if (form.concentration) out.concentration = true;
  if (notPrepared) out.prepared = false;
  if (typeof form.dice === "string" && typeof form.damage === "string") {
    out.attack = {
      attack_type: form.melee ? "melee_spell" : "ranged_spell",
      ...(typeof form.range === "number" ? { range: form.range } : {}),
      damage: [{ dice: form.dice, type: form.damage, ...(level === 0 ? { scales_with_level: "cantrip" } : {}) }],
    };
  }
  out.source = sourceOf(form) ?? (found ? SRD : { type: "custom" });
  return out;
}

function spellcasting(v: unknown, c: Ctx): unknown {
  if (!isObj(v)) return v;
  return Object.entries(v).map(([cls, groups]) => {
    const key = classKey(cls);
    if (!key) c.bad(`spells.${cls}`, `неизвестный класс «${cls}». Допустимо: ${Object.keys(CLASSES).join(", ")}.`);
    const g = isObj(groups) ? groups : {};
    const out: Obj[] = [];
    const take = (list: unknown, name: string, level0: boolean, notPrepared: boolean) => {
      if (!Array.isArray(list)) return;
      list.forEach((raw, i) => {
        const s = spellItem(raw, level0, notPrepared, `spells.${cls}.${name}[${i}]`, c);
        if (s) out.push(s);
      });
    };
    take(g.cantrips, "cantrips", true, false);
    take(g.prepared, "prepared", false, false);
    take(g.other, "other", false, true);
    return { class: key ?? cls, ...(typeof g.ability === "string" ? { ability: g.ability } : {}), spells: out };
  });
}

function equipment(form: Obj): unknown {
  if (isObj(form.equipment)) return form.equipment;
  const items: Obj[] = [];
  for (const raw of Array.isArray(form.equipment) ? form.equipment : []) {
    if (isObj(raw)) {
      items.push(raw);
      continue;
    }
    const m = str(raw).match(/^(.*?)\s*(?:[x×х]\s*(\d+))?$/i);
    items.push(m?.[2] ? { name: m[1], quantity: Number(m[2]) } : { name: str(raw) });
  }
  for (const raw of Array.isArray(form.magic_items) ? form.magic_items : []) {
    if (isObj(raw)) items.push({ ...raw, magic: true });
  }
  if (!items.length && !form.money) return undefined;
  return { ...(items.length ? { items } : {}), ...(isObj(form.money) ? { currency: form.money } : {}) };
}

function expandPerson(form: Obj, c: Ctx): Obj {
  const out: Obj = {
    schema_version: "1.0",
    ruleset: "dnd5e-2014",
    ...form,
  };
  out.race = typeof form.race === "string" ? { name: form.race } : form.race;
  out.classes = classes(form.classes, c);
  out.abilities = abilities(form.abilities, c);
  out.speed = speed(form.speed ?? 30);

  if (form.skills !== undefined) out.skill_proficiencies = skills(form.skills, "skills", c);
  if (Array.isArray(form.saves)) out.save_proficiencies = form.saves;

  if (!isObj(form.defense) && (form.armor !== undefined || form.shield !== undefined || form.ac !== undefined)) {
    const d: Obj = {};
    if (form.ac !== undefined) {
      d.override = { value: form.ac, ...(form.ac_note ? { note: str(form.ac_note) } : {}) };
    } else if (form.armor !== undefined) {
      const raw = isObj(form.armor) ? form.armor : { name: str(form.armor) };
      const bonus = str(raw.name).match(/^(.*?)\s*\+(\d)$/);
      const info = findArmor(bonus ? bonus[1] : str(raw.name));
      if (isObj(form.armor) && typeof raw.base === "number") d.armor = raw;
      else if (info) d.armor = { name: info.name, base: info.base, dex: info.dex, ...(bonus ? { magic_bonus: Number(bonus[2]) } : {}) };
      else c.bad("armor", `доспеха «${str(raw.name)}» нет в справочнике. Допустимо: Стёганый, Кожаный, Проклёпанная кожа, Шкурный, Кольчужная рубаха, Чешуйчатый, Кираса, Полулаты, Колечный, Кольчуга, Наборный, Латы. Для особого напишите ac = число.`);
    }
    if (form.shield === true) d.shield = true;
    if (typeof form.ac_bonus === "number") d.other_bonus = form.ac_bonus;
    out.defense = d;
  }

  if (form.weapons !== undefined) out.weapons = weapons(form.weapons, c);
  if (form.features !== undefined) out.features = features(form.features, c);
  if (form.spells !== undefined) out.spellcasting = spellcasting(form.spells, c);
  const eq = equipment(form);
  if (eq) out.equipment = eq;
  else delete out.equipment;
  if (typeof form.hp === "number") out.hit_points = { override: form.hp };

  const dm = notes(form);
  if (dm) out.dm_notes = dm;
  out.source = sourceTop(form, form.kind === "character" ? "персонаж игрока" : "придуманный NPC");

  drop(out, ["skills", "saves", "armor", "shield", "ac", "ac_note", "ac_bonus", "spells", "magic_items", "money", "notes", "doubts", "book", "hp"]);
  return out;
}

/* ---------- Монстр ---------- */

const HIT_DIE: Record<string, number> = { tiny: 4, small: 6, medium: 8, large: 10, huge: 12, gargantuan: 20 };

function damageParts(form: Obj, c: Ctx, path: string): Obj[] | undefined {
  if (isObj(form.damage) || Array.isArray(form.damage)) return form.damage as Obj[];
  if (typeof form.dice !== "string") return undefined;
  const parts: Obj[] = [];
  const first: Obj = { dice: form.dice, type: form.damage };
  if (typeof form.ability === "string" && form.add_mod !== false && form.kind !== "save") first.ability = form.ability;
  parts.push(first);
  for (const [i, e] of (Array.isArray(form.extra) ? form.extra : []).entries()) {
    const m = str(e).match(/^(\S+)\s+(\S+)$/);
    if (!m) c.bad(`${path}.extra[${i}]`, `«${str(e)}» не разобрано. Пишите «кости тип», например «1d6 fire».`);
    else parts.push({ dice: m[1], type: m[2] });
  }
  return parts;
}

interface ActionCtx {
  ids: Map<string, string>;
  n: number;
}

function action(raw: unknown, path: string, c: Ctx, ac: ActionCtx): unknown {
  if (!isObj(raw)) return raw;
  const kind = (raw.kind as string | undefined) ?? (raw.plan ? "multiattack" : raw.save ? "save" : raw.dice ? "attack" : "text");
  const u = usage(raw.uses ?? raw.usage, `${path}.uses`, c);
  const common: Obj = { kind };
  if (u) common.usage = u;
  if (raw.cost !== undefined) common.legendary_cost = raw.cost;
  if (raw.legendary_cost !== undefined) common.legendary_cost = raw.legendary_cost;
  const src = sourceOf(raw);
  if (src) common.source = src;

  if (kind === "text") return { ...common, name: raw.name, text: raw.text };
  if (kind === "multiattack") {
    const plan = (Array.isArray(raw.plan) ? raw.plan : []).map((p, i) => {
      if (isObj(p)) return p;
      const m = str(p).match(/^(.*?)\s*(?:[x×х]\s*(\d+))?$/i);
      const name = m ? m[1] : str(p);
      const id = ac.ids.get(norm(name));
      if (!id) c.bad(`${path}.plan[${i}]`, `в мультиатаке указана «${name}», но такого действия нет в списке атак. Названия должны совпадать.`);
      return { ref: id ?? name, count: m?.[2] ? Number(m[2]) : 1 };
    });
    return { kind, ...(raw.name ? { name: raw.name } : {}), text: raw.text, plan, ...(src ? { source: src } : {}) };
  }

  const id = ac.ids.get(norm(str(raw.name))) ?? `a${ac.n++}`;
  const damage = damageParts(raw, c, path);
  if (kind === "save") {
    const dcRaw = raw.dc;
    const dc = isObj(dcRaw) ? dcRaw : typeof dcRaw === "number" ? { mode: "fixed", value: dcRaw } : { mode: "auto", ability: dcRaw };
    return {
      ...common, id, name: raw.name, ...(raw.area ? { area: raw.area } : {}), save_ability: raw.save, dc,
      ...(damage ? { damage } : {}), ...(raw.on_success ? { on_success: raw.on_success } : {}),
      ...(raw.text ? { effect_text: raw.text } : {}),
    };
  }
  const ranged = raw.ranged === true || typeof raw.range === "string";
  const spell = raw.spell === true;
  const out: Obj = {
    ...common, id, name: raw.name,
    attack_type: raw.attack_type ?? (spell ? (ranged ? "ranged_spell" : "melee_spell") : ranged ? "ranged_weapon" : "melee_weapon"),
    ability: raw.ability,
    ...(damage ? { damage } : {}),
  };
  if (typeof raw.reach === "number") out.reach = raw.reach;
  if (typeof raw.range === "string") {
    const m = raw.range.match(/^(\d+)(?:\s*\/\s*(\d+))?$/);
    if (m) {
      out.range_normal = Number(m[1]);
      if (m[2]) out.range_long = Number(m[2]);
    } else c.bad(`${path}.range`, `дальность «${raw.range}» не разобрана. Пишите «80/320» или «60».`);
  }
  if (raw.to_hit !== undefined) out.to_hit_bonus = raw.to_hit;
  if (raw.proficient !== undefined) out.proficient = raw.proficient;
  if (raw.text) out.on_hit_text = raw.text;
  return out;
}

function actionList(v: unknown, path: string, c: Ctx, ac: ActionCtx): unknown {
  if (!Array.isArray(v)) return v;
  return v.map((a, i) => action(a, `${path}[${i}]`, c, ac));
}

function expandMonster(form: Obj, c: Ctx): Obj {
  const out: Obj = { schema_version: "1.0", ruleset: "dnd5e-2014", ...form };
  out.abilities = abilities(form.abilities, c);
  if (form.speed !== undefined) out.speed = speed(form.speed);
  if (form.cr !== undefined) out.challenge_rating = str(form.cr);
  if (typeof form.ac === "number") out.armor_class = { value: form.ac, ...(form.ac_note ? { note: str(form.ac_note) } : {}) };
  if (Array.isArray(form.saves)) out.saving_throws = form.saves;
  if (form.skills !== undefined) out.skills = skills(form.skills, "skills", c);
  for (const [short, long] of [["resist", "damage_resistances"], ["immune", "damage_immunities"], ["vulnerable", "damage_vulnerabilities"], ["condition_immune", "condition_immunities"]] as const) {
    if (form[short] !== undefined) out[long] = form[short];
  }

  if (typeof form.hp === "number" && !isObj(form.hit_dice)) {
    const die = HIT_DIE[str(form.size)];
    const con = isObj(out.abilities) ? Number((out.abilities as Obj).con) : NaN;
    if (die && Number.isFinite(con)) {
      const perDie = die / 2 + 0.5 + Math.floor((con - 10) / 2);
      out.hit_dice = { count: Math.min(60, Math.max(1, Math.round(form.hp / perDie))), die };
    } else {
      c.bad("hp", "не удалось посчитать кости хитов: нужны корректные size и abilities.");
    }
  }

  if (Array.isArray(form.traits)) {
    out.traits = form.traits.map((t) => {
      if (!isObj(t)) return t;
      const o: Obj = { name: t.name, text: t.text };
      const u = usage(t.uses ?? t.usage, "traits", c);
      if (u) o.usage = u;
      const s = sourceOf(t);
      if (s) o.source = s;
      return o;
    });
  }

  // идентификаторы атак назначаются по названиям, чтобы мультиатака ссылалась на них
  const ac: ActionCtx = { ids: new Map(), n: 1 };
  const all: Obj[] = [];
  for (const key of ["actions", "bonus_actions", "reactions", "legendary"] as const) {
    if (Array.isArray(form[key])) all.push(...(form[key] as Obj[]));
  }
  for (const a of all) {
    if (isObj(a) && typeof a.name === "string" && !a.plan && (a.dice || a.save || a.kind === "attack" || a.kind === "save") && !ac.ids.has(norm(a.name))) {
      ac.ids.set(norm(a.name), `a${ac.n++}`);
    }
  }
  ac.n = ac.ids.size + 1;
  if (Array.isArray(form.actions)) out.actions = actionList(form.actions, "actions", c, ac);
  if (Array.isArray(form.bonus_actions)) out.bonus_actions = actionList(form.bonus_actions, "bonus_actions", c, ac);
  if (Array.isArray(form.reactions)) out.reactions = actionList(form.reactions, "reactions", c, ac);
  if (Array.isArray(form.legendary)) {
    out.legendary_actions = {
      ...(typeof form.legendary_per_round === "number" ? { per_round: form.legendary_per_round } : {}),
      ...(typeof form.legendary_intro === "string" ? { intro: form.legendary_intro } : {}),
      actions: actionList(form.legendary, "legendary", c, ac),
    };
  }

  const dm = notes(form);
  if (dm) out.dm_notes = dm;
  out.source = sourceTop(form, "придуманный монстр");
  drop(out, ["cr", "ac", "ac_note", "saves", "resist", "immune", "vulnerable", "condition_immune", "hp", "legendary", "legendary_per_round", "legendary_intro", "notes", "doubts", "book"]);
  return out;
}

/** Строгий файл (есть schema_version) не трогаем. Иначе разворачиваем анкету. */
export function expandForm(data: unknown): { data: unknown; issues: FormIssue[] } {
  if (!isObj(data) || "schema_version" in data) return { data, issues: [] };
  const c = new Ctx();
  const kind = data.kind;
  const out = kind === "monster" ? expandMonster(data, c) : kind === "npc" || kind === "character" ? expandPerson(data, c) : data;
  return { data: out, issues: c.issues };
}

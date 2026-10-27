import type { AbilityKey, DamagePart, Monster, MonsterAction, SkillKey } from "../types.js";
import { ALL_ABILITIES, SKILL_ABILITY } from "./tables.js";
import { abilityMod } from "./calc.js";
import { checkCr, crRow, type CrCheck } from "./cr.js";

export interface ComputedDamage {
  /** Средний урон, округлённый вниз, как в книгах. */
  average: number;
  /** Запись «1d10 + 5». */
  formula: string;
  type: DamagePart["type"];
}

export interface ComputedAction {
  id?: string;
  name: string;
  kind: MonsterAction["kind"];
  /** Бонус попадания для атак. */
  toHit?: number;
  /** Сл спасброска для эффектов. */
  dc?: number;
  damage: ComputedDamage[];
  /** Средний урон за применение, всеми составляющими. */
  averageTotal: number;
}

export interface MonsterDerived {
  proficiency: number;
  xp: number;
  mods: Record<AbilityKey, number>;
  hpAverage: number;
  hpFormula: string;
  saves: { ability: AbilityKey; bonus: number }[];
  skills: { skill: SkillKey; bonus: number }[];
  initiative: number;
  passivePerception: number;
  actions: ComputedAction[];
  damagePerRound: number;
  cr: CrCheck;
  warnings: string[];
}

const avgDice = (dice: string): number => {
  const [n, die] = dice.split("d").map(Number);
  return (n * (die + 1)) / 2;
};

function computeDamage(parts: DamagePart[], mods: Record<AbilityKey, number>): ComputedDamage[] {
  return parts.map((p) => {
    const mod = (p.ability ? mods[p.ability] : 0) + (p.bonus ?? 0);
    const average = Math.floor(avgDice(p.dice) + mod);
    const formula = mod === 0 ? p.dice : `${p.dice} ${mod > 0 ? "+" : "−"} ${Math.abs(mod)}`;
    return { average: Math.max(0, average), formula, type: p.type };
  });
}

export function computeMonster(m: Monster): MonsterDerived {
  const warnings: string[] = [];
  const row = crRow(m.challenge_rating);
  const prof = row.proficiency;
  const mods = Object.fromEntries(ALL_ABILITIES.map((a) => [a, abilityMod(m.abilities[a])])) as Record<AbilityKey, number>;

  const hpAverage = m.hp_override ?? Math.floor((m.hit_dice.count * (m.hit_dice.die + 1)) / 2 + m.hit_dice.count * mods.con);
  const conTotal = m.hit_dice.count * mods.con;
  const hpFormula = `${m.hit_dice.count}d${m.hit_dice.die}${conTotal === 0 ? "" : ` ${conTotal > 0 ? "+" : "−"} ${Math.abs(conTotal)}`}`;

  const saves = (m.saving_throws ?? []).map((ability) => ({ ability, bonus: mods[ability] + prof }));
  const skills = (m.skills ?? []).map((s) => ({
    skill: s.skill,
    bonus: mods[SKILL_ABILITY[s.skill]] + prof * (s.expertise ? 2 : 1),
  }));
  const perception = skills.find((s) => s.skill === "perception")?.bonus ?? mods.wis;

  const all: MonsterAction[] = [
    ...(m.actions ?? []),
    ...(m.bonus_actions ?? []),
    ...(m.reactions ?? []),
    ...(m.legendary_actions?.actions ?? []),
  ];
  const computed = new Map<string, ComputedAction>();
  const actions: ComputedAction[] = [];
  for (const a of all) {
    const c = computeAction(a, mods, prof);
    if (!c) continue;
    actions.push(c);
    if (c.id) computed.set(c.id, c);
  }

  const { dpr, value, kind } = offense(m, computed, warnings);
  const cr = checkCr({
    hp: hpAverage,
    ac: m.armor_class.value,
    damagePerRound: dpr,
    offensiveValue: value,
    offensiveKind: kind,
    declaredCr: m.challenge_rating,
  });
  if (m.damage_resistances?.length || m.damage_immunities?.length) {
    warnings.push("Сопротивления и иммунитеты в расчёте опасности не учтены: DMG повышает эффективные хиты, итог может быть чуть выше.");
  }
  if (m.legendary_actions) warnings.push("Легендарные действия в расчёте опасности не учтены.");

  return {
    proficiency: prof,
    xp: row.xp,
    mods,
    hpAverage,
    hpFormula,
    saves,
    skills,
    initiative: mods.dex,
    passivePerception: 10 + perception,
    actions,
    damagePerRound: dpr,
    cr,
    warnings,
  };
}

function computeAction(a: MonsterAction, mods: Record<AbilityKey, number>, prof: number): ComputedAction | undefined {
  switch (a.kind) {
    case "attack": {
      const toHit = mods[a.ability] + (a.proficient === false ? 0 : prof) + (a.to_hit_bonus ?? 0);
      const damage = computeDamage(a.damage, mods);
      return { id: a.id, name: a.name, kind: "attack", toHit, damage, averageTotal: damage.reduce((s, d) => s + d.average, 0) };
    }
    case "save": {
      const dc = a.dc.mode === "fixed" ? a.dc.value : 8 + prof + mods[a.dc.ability];
      const damage = computeDamage(a.damage ?? [], mods);
      return { id: a.id, name: a.name, kind: "save", dc, damage, averageTotal: damage.reduce((s, d) => s + d.average, 0) };
    }
    case "multiattack":
      return { name: a.name ?? "Мультиатака", kind: "multiattack", damage: [], averageTotal: 0 };
    default:
      return undefined;
  }
}

/** Урон за раунд: мультиатака (все попадают) либо лучшее одиночное действие; бонус атаки или Сл главного источника урона. */
function offense(
  m: Monster,
  computed: Map<string, ComputedAction>,
  warnings: string[],
): { dpr: number; value: number; kind: "attack" | "save" } {
  const candidates: { dpr: number; value: number; kind: "attack" | "save" }[] = [];
  const multi = (m.actions ?? []).find((a) => a.kind === "multiattack");
  if (multi && multi.kind === "multiattack") {
    let dpr = 0;
    let value = 0;
    for (const step of multi.plan) {
      const ref = computed.get(step.ref);
      if (!ref) {
        warnings.push(`В мультиатаке указано действие «${step.ref}», которого нет в списке действий.`);
        continue;
      }
      dpr += ref.averageTotal * step.count;
      value = Math.max(value, ref.toHit ?? 0);
    }
    candidates.push({ dpr, value, kind: "attack" });
  }
  for (const a of computed.values()) {
    if (a.kind === "attack") candidates.push({ dpr: a.averageTotal, value: a.toHit ?? 0, kind: "attack" });
    if (a.kind === "save" && a.averageTotal > 0) candidates.push({ dpr: a.averageTotal, value: a.dc ?? 0, kind: "save" });
  }
  if (!candidates.length) return { dpr: 0, value: 0, kind: "attack" };
  return candidates.reduce((best, c) => (c.dpr > best.dpr ? c : best));
}

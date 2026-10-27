import type { ReactNode } from "react";
import { CLASSES, SKILL_RU } from "../rules/tables.js";
import { TYPE_RU } from "../i18n/ru.js";
import { Icon } from "./icons.js";
import { Check, Dropdown } from "./ui.js";

/* ---------- Работа с черновиком: неизменяемые правки по пути ---------- */

export type Path = (string | number)[];
type Obj = Record<string | number, unknown>;

export function getIn(o: unknown, p: Path): unknown {
  return p.reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Obj)[k] : undefined), o);
}

const isEmpty = (v: unknown): boolean => v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v));

/** Возвращает копию с новым значением. Пустое значение удаляет поле, а пустой объект вокруг него исчезает. */
export function setIn<T>(o: T, p: Path, v: unknown): T {
  if (p.length === 0) return v as T;
  const [k, ...rest] = p;
  const base: Obj = Array.isArray(o) ? ([...o] as unknown as Obj) : { ...((o as Obj) ?? {}) };
  const child = rest.length ? setIn(base[k], rest, v) : v;
  if (isEmpty(child) || (child && typeof child === "object" && !Array.isArray(child) && Object.keys(child).length === 0 && rest.length)) {
    if (Array.isArray(base)) (base as unknown[]).splice(Number(k), 1);
    else delete base[k];
  } else base[k] = child;
  return base as unknown as T;
}

/** Убирает пустые строки и пустые списки, чтобы анкета не тащила лишнего. */
export function clean<T>(v: T): T {
  if (Array.isArray(v)) return v.map(clean) as unknown as T;
  if (v && typeof v === "object") {
    const out: Obj = {};
    for (const [k, x] of Object.entries(v as Obj)) {
      const c = clean(x);
      if (c === "" || c === undefined || (typeof c === "number" && Number.isNaN(c))) continue;
      out[k] = c;
    }
    return out as T;
  }
  return v;
}

export interface Ed {
  d: unknown;
  set(p: Path, v: unknown): void;
}

/* ---------- Поля ---------- */

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`fld${wide ? " wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function T({ e, p, label, area, wide }: { e: Ed; p: Path; label: string; area?: boolean; wide?: boolean }) {
  const v = (getIn(e.d, p) as string | undefined) ?? "";
  return (
    <Field label={label} wide={wide || area}>
      {area ? (
        <textarea value={v} rows={Math.min(8, Math.max(3, Math.ceil(v.length / 70)))} onChange={(x) => e.set(p, x.target.value)} />
      ) : (
        <input type="text" value={v} onChange={(x) => e.set(p, x.target.value)} />
      )}
    </Field>
  );
}

export function N({ e, p, label, min, max }: { e: Ed; p: Path; label: string; min?: number; max?: number }) {
  const v = getIn(e.d, p);
  return (
    <Field label={label}>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={typeof v === "number" ? v : ""}
        onChange={(x) => e.set(p, x.target.value === "" ? undefined : Number(x.target.value))}
      />
    </Field>
  );
}

export function Sel({ e, p, label, options, optional, num }: { e: Ed; p: Path; label: string; options: [string, string][]; optional?: boolean; num?: boolean }) {
  const v = String(getIn(e.d, p) ?? "");
  const opts = [...(optional ? [{ value: "", label: "—" }] : []), ...options.map(([value, name]) => ({ value, label: name }))];
  return (
    <div className="fld">
      <span>{label}</span>
      <Dropdown value={v} options={opts} ariaLabel={label} variant="field" onChange={(x) => e.set(p, x === "" ? undefined : num ? Number(x) : x)} />
    </div>
  );
}

/** Флажок: включён — в анкете true, выключен — поля нет. */
export function B({ e, p, label }: { e: Ed; p: Path; label: string }) {
  const v = getIn(e.d, p) === true;
  return (
    <div className="fld bool">
      <span>{label}</span>
      <Check checked={v} onChange={(x) => e.set(p, x ? true : undefined)} label={label} />
    </div>
  );
}

/** Список строк через запятую. */
export function Csv({ e, p, label }: { e: Ed; p: Path; label: string }) {
  const v = ((getIn(e.d, p) as string[] | undefined) ?? []).join(", ");
  return (
    <Field label={label} wide>
      <input
        type="text"
        defaultValue={v}
        key={v}
        onBlur={(x) =>
          e.set(
            p,
            x.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
      />
    </Field>
  );
}

/** Набор переключателей по списку значений. */
export function Toggles({ e, p, label, options }: { e: Ed; p: Path; label: string; options: [string, string][] }) {
  const cur = (getIn(e.d, p) as string[] | undefined) ?? [];
  return (
    <div className="fld wide">
      <span>{label}</span>
      <div className="tgl">
        {options.map(([k, name]) => (
          <button
            key={k}
            type="button"
            className={`chip${cur.includes(k) ? " on" : ""}`}
            aria-pressed={cur.includes(k)}
            onClick={() => e.set(p, cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k])}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Навыки: нажатие переключает «нет → владеет → компетентность». */
export function SkillToggles({ e, p }: { e: Ed; p: Path }) {
  const cur = (getIn(e.d, p) as { skill: string; expertise?: boolean }[] | undefined) ?? [];
  const next = (skill: string) => {
    const found = cur.find((s) => s.skill === skill);
    if (!found) return [...cur, { skill }];
    if (!found.expertise) return cur.map((s) => (s.skill === skill ? { skill, expertise: true } : s));
    return cur.filter((s) => s.skill !== skill);
  };
  return (
    <div className="fld wide">
      <span>Навыки (нажатие: владеет, затем компетентность, затем нет)</span>
      <div className="tgl">
        {(Object.keys(SKILL_RU) as (keyof typeof SKILL_RU)[]).map((k) => {
          const f = cur.find((s) => s.skill === k);
          return (
            <button key={k} type="button" className={`chip${f ? " on" : ""}`} onClick={() => e.set(p, next(k))}>
              {SKILL_RU[k]}
              {f?.expertise ? " ×2" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Group({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <section className="cd">
      <h2 className="t">{title}</h2>
      {hint && <p className="mute small hint">{hint}</p>}
      <div className="fgrid">{children}</div>
    </section>
  );
}

/** Список блоков: у каждого свои поля, внизу кнопки добавления. */
export function Items({
  e,
  p,
  title,
  render,
  adders,
}: {
  e: Ed;
  p: Path;
  title: string;
  render: (i: number, base: Path) => ReactNode;
  adders: { label: string; make: () => unknown }[];
}) {
  const list = (getIn(e.d, p) as unknown[] | undefined) ?? [];
  return (
    <section className="cd">
      <h2 className="t">{title}</h2>
      <div className="items">
        {list.map((_, i) => (
          <div key={i} className="item">
            <div className="fgrid">{render(i, [...p, i])}</div>
            <button type="button" className="ib" aria-label="Удалить" onClick={() => e.set(p, list.filter((_, j) => j !== i))}>
              <Icon name="trash" size={17} />
            </button>
          </div>
        ))}
      </div>
      <div className="actions">
        {adders.map((a) => (
          <button key={a.label} type="button" className="btn" onClick={() => e.set(p, [...list, a.make()])}>
            <Icon name="plus" size={15} /> {a.label}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------- Справочники ---------- */

export const ABILITY_OPTS: [string, string][] = [
  ["str", "Сила"], ["dex", "Ловкость"], ["con", "Телосложение"], ["int", "Интеллект"], ["wis", "Мудрость"], ["cha", "Харизма"],
];
export const ABILITY_SHORT: [string, string][] = [
  ["str", "Сил"], ["dex", "Лов"], ["con", "Тел"], ["int", "Инт"], ["wis", "Мдр"], ["cha", "Хар"],
];
export const CLASS_OPTS: [string, string][] = Object.entries(CLASSES).map(([k, v]) => [k, v.nameRu]);
export const DAMAGE_OPTS: [string, string][] = [
  ["acid", "кислота"], ["bludgeoning", "дробящий"], ["cold", "холод"], ["fire", "огонь"], ["force", "силовое поле"],
  ["lightning", "молния"], ["necrotic", "некротический"], ["piercing", "колющий"], ["poison", "яд"], ["psychic", "психический"],
  ["radiant", "излучение"], ["slashing", "рубящий"], ["thunder", "звук"],
];
export const CONDITION_OPTS: [string, string][] = [
  ["blinded", "ослеплённый"], ["charmed", "очарованный"], ["deafened", "оглохший"], ["exhaustion", "истощение"],
  ["frightened", "напуганный"], ["grappled", "схваченный"], ["incapacitated", "недееспособный"], ["invisible", "невидимый"],
  ["paralyzed", "парализованный"], ["petrified", "окаменевший"], ["poisoned", "отравленный"], ["prone", "лежащий ничком"],
  ["restrained", "опутанный"], ["stunned", "ошеломлённый"], ["unconscious", "без сознания"],
];
export const SIZE_OPTS: [string, string][] = [
  ["tiny", "Крошечный"], ["small", "Маленький"], ["medium", "Средний"], ["large", "Большой"], ["huge", "Огромный"], ["gargantuan", "Громадный"],
];
export const TYPE_OPTS: [string, string][] = Object.entries(TYPE_RU).map(([k, v]) => [k, v.name]);
export const DIE_OPTS: [string, string][] = ["4", "6", "8", "10", "12", "20"].map((d) => [d, `к${d}`]);

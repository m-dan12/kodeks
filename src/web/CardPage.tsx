import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { stringify } from "smol-toml";
import { validateData, validateText, type Issue } from "../validate.js";
import type { Monster, Npc } from "../types.js";
import { computeMonster } from "../rules/monster.js";
import { buildStatblock } from "../pdf/statblock-model.js";
import { buildNpcCard } from "../pdf/npc-model.js";
import { Icon } from "./icons.js";
import { Modal, Switch, useConfirm } from "./ui.js";
import type { SavedCard } from "./library.js";
import {
  ABILITY_OPTS, ABILITY_SHORT, B, CLASS_OPTS, CONDITION_OPTS, Csv, DAMAGE_OPTS, DIE_OPTS, N, Group, Items, SIZE_OPTS, SkillToggles, Sel, T,
  Toggles, TYPE_OPTS, clean, getIn, setIn, type Ed, type Path,
} from "./edit.js";

interface Props {
  card: SavedCard;
  folderName?: string;
  onBack(): void;
  onSave(name: string, source: string): void;
  onFav(): void;
  onExport(): void;
  onLss?(): void;
  onPrint(): void;
}

type Data = Record<string, unknown>;

export function CardPage({ card, folderName, onBack, onSave, onFav, onExport, onLss, onPrint }: Props) {
  const confirm = useConfirm();
  const parsed = useMemo(() => validateText(card.json), [card.json]);
  const [draft, setDraft] = useState<Data | null>(null);
  const [errors, setErrors] = useState<Issue[]>([]);
  const editing = draft !== null;

  if (!parsed.ok) {
    return (
      <>
        <Bar name={card.name} fav={card.fav} onBack={onBack} onFav={onFav} onExport={onExport} onLss={onLss} onPrint={onPrint} />
        <div className="fix">
          <h2>
            <Icon name="alert" size={22} /> Карточка не проходит проверку
          </h2>
          <ol>
            {parsed.issues.map((i, n) => (
              <li key={n}>
                {i.path && <code>{i.path}</code>} {i.message}
              </li>
            ))}
          </ol>
        </div>
      </>
    );
  }

  const data = parsed.data as Data;
  const kind = parsed.kind;
  const ed: Ed = { d: draft, set: (p: Path, v: unknown) => setDraft((d) => setIn(d, p, v)) };

  function save() {
    const r = validateData(clean(draft));
    if (!r.ok) {
      setErrors(r.issues);
      return;
    }
    const next = r.data as Data;
    onSave(String(next.name), stringify(next));
    setDraft(null);
    setErrors([]);
  }

  async function toggleEdit() {
    if (editing) {
      if (JSON.stringify(clean(draft)) !== JSON.stringify(clean(data)) && !(await confirm("Отменить несохранённые изменения?", { title: "Правка", ok: "Отменить правки", danger: true }))) return;
      setDraft(null);
      setErrors([]);
    } else {
      setDraft(structuredClone(data));
    }
  }

  return (
    <>
      <Bar name={card.name} folder={folderName} fav={card.fav} editing={editing} onBack={onBack} onFav={onFav} onExport={onExport} onLss={onLss} onPrint={onPrint} onToggle={() => void toggleEdit()} />
      {editing && (
        <div className="editbar" role="region" aria-label="Правка">
          <span>Идёт правка. Расчётные числа (КД, ХП, бонусы) пересчитаются при сохранении.</span>
          <span className="spacer" />
          <button type="button" className="btn" onClick={() => void toggleEdit()}>
            Отмена
          </button>
          <button type="button" className="btn dark" onClick={save}>
            <Icon name="check" size={16} /> Сохранить
          </button>
        </div>
      )}
      {errors.length > 0 && (
        <div className="fix" aria-live="polite">
          <h2>
            <Icon name="alert" size={22} /> Не сохранено
          </h2>
          <ol>
            {errors.map((i, n) => (
              <li key={n}>
                {i.path && <code>{i.path}</code>} {i.message}
              </li>
            ))}
          </ol>
        </div>
      )}
      {editing ? (
        kind === "monster" ? (
          <MonsterForm e={ed} />
        ) : (
          <PersonForm e={ed} kind={kind} />
        )
      ) : kind === "monster" ? (
        <MonsterView m={data as unknown as Monster} id={card.id} />
      ) : (
        <PersonView p={data as unknown as Npc} kind={kind} id={card.id} />
      )}
    </>
  );
}

function Bar({
  name, folder, fav, editing, onBack, onFav, onExport, onLss, onPrint, onToggle,
}: {
  name: string;
  folder?: string;
  fav?: boolean;
  editing?: boolean;
  onBack(): void;
  onFav(): void;
  onExport(): void;
  onLss?(): void;
  onPrint(): void;
  onToggle?(): void;
}) {
  const [more, setMore] = useState(false);
  const slot = document.getElementById("mbar-slot");
  const mbar = (
    <div className="mbar">
      <button type="button" className="mb" aria-label="Назад" onClick={onBack}>
        <Icon name="back" size={22} />
      </button>
      <span className="mcrumb">
        <span className="c1">{folder ?? "Библиотека"}</span>
        <span className="c2">{name}</span>
      </span>
      <span id="mini-slot" className="mini-slot" />
      <div className="macts">
        <button type="button" className={`mb${fav ? " on" : ""}`} aria-label={fav ? "Убрать из избранного" : "В избранное"} aria-pressed={!!fav} onClick={onFav}>
          <Icon name="star" size={22} fill={!!fav} />
        </button>
        {onToggle && (
          <button type="button" className={`mb${editing ? " on" : ""}`} aria-label="Правка" aria-pressed={!!editing} onClick={onToggle}>
            <Icon name="edit" size={22} />
          </button>
        )}
        <button type="button" className="mb" aria-label="Экспорт и другое" onClick={() => setMore(true)}>
          <Icon name="dots" size={22} />
        </button>
      </div>
    </div>
  );
  return (
    <>
      {slot && createPortal(mbar, slot)}
      {more && (
        <Modal title={name} onClose={() => setMore(false)}>
          <div className="mvlist">
            <button type="button" className="mvopt" onClick={() => { setMore(false); onExport(); }}>
              <Icon name="download" size={20} />
              <span>Экспорт PDF</span>
            </button>
            <button type="button" className="mvopt" onClick={() => { setMore(false); onPrint(); }}>
              <Icon name="print" size={20} />
              <span>Печатная версия</span>
            </button>
            {onLss && (
              <button type="button" className="mvopt" onClick={() => { setMore(false); onLss(); }}>
                <Icon name="share" size={20} />
                <span>Файл для LSS</span>
              </button>
            )}
          </div>
        </Modal>
      )}
      <div className="cbar d-only">
        <nav className="crumbs2" aria-label="Путь">
          <button type="button" onClick={onBack}>
            Библиотека
          </button>
          {folder && (
            <>
              <Icon name="right" size={12} />
              <span>{folder}</span>
            </>
          )}
          <Icon name="right" size={12} />
          <b>{name}</b>
        </nav>
        {onToggle && <Switch checked={!!editing} onChange={onToggle} label="Правка" />}
        <button type="button" className={`ib bd${fav ? " on" : ""}`} aria-label={fav ? "Убрать из избранного" : "В избранное"} aria-pressed={!!fav} data-tip={fav ? "Убрать из избранного" : "В избранное"} onClick={onFav}>
          <Icon name="star" size={18} fill={!!fav} />
        </button>
        {onLss && (
          <button type="button" className="btn" onClick={onLss}>
            <Icon name="share" /> Файл для LSS
          </button>
        )}
        <button type="button" className="ib bd" aria-label="Печать" data-tip="Печатная версия" onClick={onPrint}>
          <Icon name="print" size={18} />
        </button>
        <button type="button" className="btn accent" onClick={onExport}>
          <Icon name="download" /> Экспорт PDF
        </button>
      </div>
    </>
  );
}

/* ---------- Просмотр монстра ---------- */

function MonsterView({ m, id }: { m: Monster; id: string }) {
  const sb = useMemo(() => buildStatblock(m, computeMonster(m)), [m]);
  const hp = useHp(id, Number(sb.hp) || 1);
  const notes = [...sb.notes];
  return (
    <div className="mgrid">
      <section className="cd stat">
        <h1 className="sheet-name">{sb.name}</h1>
        <div className="subline">{sb.typeLine}</div>
        <HpCard hp={hp} dice={sb.hpFormula} />
        <div className="tiles3 m-only">
          <div className="cs"><small>Класс доспеха</small><b>{sb.ac}</b>{sb.acNote && <em>{sb.acNote}</em>}</div>
          <div className="cs"><small>Инициатива</small><b>{sb.abilities[1]?.mod ?? "+0"}</b></div>
          <div className="cs"><small>Скорость</small><b>{sb.speed}<i> фт</i></b></div>
        </div>
        <div className="rule" />
        <div className="kv d-only">
          <p><strong>Класс доспеха</strong> <span>{sb.ac}{sb.acNote ? ` (${sb.acNote})` : ""}</span></p>
          <p><strong>Хиты</strong> <span>{sb.hp} ({sb.hpFormula})</span></p>
          <p><strong>Скорость</strong> <span>{sb.speed} фт.{sb.speedExtra ? `, ${sb.speedExtra}` : ""}</span></p>
        </div>
        <div className="hr" />
        <div className="ab6">
          {sb.abilities.map((a) => (
            <div key={a.name} className="ab">
              <small><span className="t-full">{a.name}</span><span className="t-short">{a.name.slice(0, 3).toUpperCase()}</span></small>
              <b>{a.mod}</b>
              <span>{a.score}</span>
            </div>
          ))}
        </div>
        <div className="hr" />
        <div className="kv">
          {sb.props.map((p) => (
            <p key={p.label}><strong>{p.label}</strong> <span>{p.value}</span></p>
          ))}
          <p><strong>Опасность</strong> <span>{sb.cr} ({sb.xp} опыта)</span></p>
        </div>
        {sb.sections.map((s, i) => (
          <div key={s.title}>
            <div className={i === 0 ? "rule" : undefined} style={i === 0 ? { margin: "14px 0 10px" } : undefined} />
            <h2 className={`t sec${i === 0 ? " m-only" : ""}`}>{s.title}</h2>
            {s.intro && <p className="mute intro">{s.intro}</p>}
            {s.entries.map((en, k) => (
              <p key={k} className="ft2">
                <strong>{en.name}<i className="d-only">.</i></strong> <span>{en.lead ? `${en.lead} ` : ""}{en.text}</span>
              </p>
            ))}
          </div>
        ))}
        {sb.warnings.length > 0 && (
          <div className="warnbox">
            <Icon name="alert" size={18} />
            <ul>
              {sb.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <aside className="side">
        <section className="cd">
          <div className="portrait">{sb.name.trim().charAt(0).toUpperCase()}</div>
        </section>
        <section className="cd">
          <h2 className="t">Источник</h2>
          <div className="pl">
            <span>{sb.source || "—"}</span>
          </div>
          <p className="mute small" style={{ marginTop: 10 }}>Правила 2014. Значения посчитаны приложением.</p>
        </section>
        <section className="cd">
          <h2 className="t">Баланс</h2>
          <p className="small">{sb.crCheck.verdict}</p>
        </section>
        {notes.length > 0 && (
          <section className="cd">
            <h2 className="t">Заметки</h2>
            {notes.map((n, i) => (
              <p key={i} className="small mute" style={{ marginBottom: 8 }}>
                <b style={{ color: "var(--ink)" }}>{n.title}.</b> {n.text}
              </p>
            ))}
          </section>
        )}
      </aside>
    </div>
  );
}

/* ---------- Просмотр персонажа и НИП ---------- */

const HP_KEY = "dnd-cards.hp";

function readHp(id: string): { cur?: number; temp?: number } {
  try {
    return (JSON.parse(localStorage.getItem(HP_KEY) ?? "{}") as Record<string, { cur?: number; temp?: number }>)[id] ?? {};
  } catch {
    return {};
  }
}

function writeHp(id: string, v: { cur?: number; temp?: number }): void {
  try {
    const all = JSON.parse(localStorage.getItem(HP_KEY) ?? "{}") as Record<string, unknown>;
    all[id] = v;
    localStorage.setItem(HP_KEY, JSON.stringify(all));
  } catch {
    /* хранилище недоступно */
  }
}

function useHp(id: string, max: number) {
  const [state, setState] = useState(() => readHp(id));
  const cur = Math.min(max, state.cur ?? max);
  const temp = state.temp ?? 0;
  const set = (delta: { cur?: number; temp?: number }) =>
    setState((prev) => {
      const v = {
        cur: Math.max(0, Math.min(max, (prev.cur ?? max) + (delta.cur ?? 0))),
        temp: Math.max(0, (prev.temp ?? 0) + (delta.temp ?? 0)),
      };
      writeHp(id, v);
      return v;
    });
  const reset = () => {
    const v = { cur: max, temp: 0 };
    setState(v);
    writeHp(id, v);
  };
  return { cur, temp, max, set, reset };
}
type Hp = ReturnType<typeof useHp>;

/** Текущие хиты: меняются кнопками и запоминаются для этой карточки (компьютер). */
function HpBox({ hp, dice }: { hp: Hp; dice: string }) {
  const { cur, max, temp, set, reset } = hp;
  return (
    <div className="cs hp">
      <small>Хиты</small>
      <div className="hpline">
        <button type="button" className="ib bd round" aria-label="Уменьшить хиты" data-tip="Минус 1" onClick={() => set({ cur: -1 })}>
          <Icon name="min" />
        </button>
        <b className={cur === 0 ? "zero" : undefined} aria-live="polite">{cur}</b>
        <button type="button" className="ib bd round" aria-label="Увеличить хиты" data-tip="Плюс 1" onClick={() => set({ cur: 1 })}>
          <Icon name="plus" />
        </button>
      </div>
      <em>
        из {max} · {dice} ·{" "}
        <button type="button" className="tmp" aria-label="Временные хиты, нажмите чтобы добавить 1" data-tip="Врем. хиты +1" onClick={() => set({ temp: 1 })} onContextMenu={(ev) => { ev.preventDefault(); set({ temp: -1 }); }}>
          врем. {temp}
        </button>
      </em>
      {(cur !== max || temp !== 0) && (
        <button type="button" className="tmp reset" onClick={reset}>
          Восстановить
        </button>
      )}
    </div>
  );
}

/** Крупный счётчик хитов для телефона. */
function HpCard({ hp, dice }: { hp: Hp; dice: string }) {
  const { cur, max, temp, set, reset } = hp;
  return (
    <div className="hpcard m-only">
      <div className="hpmain">
        <button type="button" className="rb" aria-label="Минус один хит" onClick={() => set({ cur: -1 })}>
          <Icon name="min" size={22} />
        </button>
        <div className="hpnum">
          <div className={`n${cur === 0 ? " zero" : ""}`} aria-live="polite">{cur}<span> / {max}</span></div>
          <div className="u">хиты · {dice}</div>
        </div>
        <button type="button" className="rb" aria-label="Плюс один хит" onClick={() => set({ cur: 1 })}>
          <Icon name="plus" size={22} />
        </button>
      </div>
      <div className="hpbar"><i style={{ width: `${max ? Math.round((cur / max) * 100) : 0}%` }} /></div>
      <div className="hpfoot">
        <span className="tmpgrp">
          <button type="button" onClick={() => set({ temp: 1 })}>Временные хиты: {temp}</button>
          {temp > 0 && <button type="button" className="tmpm" aria-label="Минус один временный хит" onClick={() => set({ temp: -1 })}>−1</button>}
        </span>
        <button type="button" onClick={reset} disabled={cur === max && temp === 0}>Восстановить</button>
      </div>
    </div>
  );
}

/** Маленький счётчик в верхней панели вкладки «Бой». */
function MiniHp({ hp }: { hp: Hp }) {
  return (
    <span className="minihp">
      <button type="button" className="rb sm" aria-label="Минус один хит" onClick={() => hp.set({ cur: -1 })}>
        <Icon name="min" size={18} />
      </button>
      <b aria-live="polite">{hp.cur}</b>
      <button type="button" className="rb sm" aria-label="Плюс один хит" onClick={() => hp.set({ cur: 1 })}>
        <Icon name="plus" size={18} />
      </button>
    </span>
  );
}

const SLOTS_KEY = "dnd-cards.slots";

function readSlots(id: string): Record<string, number> {
  try {
    return (JSON.parse(localStorage.getItem(SLOTS_KEY) ?? "{}") as Record<string, Record<string, number>>)[id] ?? {};
  } catch {
    return {};
  }
}

function writeSlots(id: string, v: Record<string, number>): void {
  try {
    const all = JSON.parse(localStorage.getItem(SLOTS_KEY) ?? "{}") as Record<string, unknown>;
    all[id] = v;
    localStorage.setItem(SLOTS_KEY, JSON.stringify(all));
  } catch {
    /* хранилище недоступно */
  }
}

type Tab = "obz" | "boy" | "zak" | "ono";
const TABS: [Tab, string][] = [["obz", "Обзор"], ["boy", "Бой"], ["zak", "Заклинания"], ["ono", "О нём"]];

function PersonView({ p, kind, id }: { p: Npc; kind: "npc" | "character"; id: string }) {
  const { model: m, derived: d } = useMemo(() => buildNpcCard(p), [p]);
  const hp = useHp(id, Number(m.hp) || 1);
  const [tab, setTab] = useState<Tab>("obz");
  const [allSkills, setAllSkills] = useState(false);
  const [used, setUsed] = useState(() => readSlots(id));
  const slotGroups = m.spellGroups.filter((g) => g.slots !== undefined && g.slots > 0);
  const tabs = TABS.filter(([t]) => t !== "zak" || m.spellGroups.length > 0);
  const flipSlot = (level: number, n: number, total: number) =>
    setUsed((prev) => {
      const left = total - (prev[level] ?? 0);
      // нажатие на свободную ячейку тратит её и все правее, на потраченную возвращает её и все левее
      const next = { ...prev, [level]: n < left ? total - n : total - n - 1 };
      writeSlots(id, next);
      return next;
    });
  const longRest = () => {
    setUsed({});
    writeSlots(id, {});
    hp.reset();
  };
  const ch = p as unknown as { player_name?: string; experience?: number; personality?: Record<string, string>; body?: Record<string, string>; role?: string };
  const BODY: [string, string][] = [["age", "Возраст"], ["height", "Рост"], ["weight", "Вес"], ["eyes", "Глаза"], ["skin", "Кожа"], ["hair", "Волосы"]];
  const body = BODY.filter(([k]) => ch.body?.[k]);
  // внешность, черты и идеалы уже показаны в блоке «Личность»
  const roleplay = m.roleplay.filter((r) => ["Речь", "Хочет", "Скрывает", "В бою"].includes(r.label));
  const pe = ch.personality ?? {};
  return (
    <div className="person" data-tab={tab}>
      <section className="cd head2">
        <div className="av sq">{m.name.trim().charAt(0).toUpperCase()}</div>
        <div className="grow">
          <h1 className="sheet-name">{m.name}</h1>
          {kind === "npc" && ch.role && <span className="rolechip m-only">{ch.role}</span>}
          <div className="mute d-only">{[m.classLine, m.subtitle].filter(Boolean).join(" · ")}</div>
        </div>
        <p className="sub2 m-only">{[m.classLine, m.subtitle].filter(Boolean).join(" · ")}</p>
        <div className="hmeta">
          {kind === "character" && (
            <>
              <div><small>Опыт</small><b>{d.experience.toLocaleString("ru-RU")}</b></div>
              {ch.player_name && <div><small>Игрок</small><b className="sans">{ch.player_name}</b></div>}
            </>
          )}
          {kind === "npc" && ch.role && <div><small>Роль</small><b className="sans">{ch.role}</b></div>}
        </div>
      </section>

      <div className="hpwrap"><HpCard hp={hp} dice={m.hitDice} /></div>
      <section className="cd keyrow">
        <div className="cs"><small>Класс доспеха</small><b>{m.ac}</b>{m.acNote && <em>{m.acNote}</em>}</div>
        <div className="cs"><small>Инициатива</small><b>{m.initiative}</b></div>
        <div className="cs"><small>Скорость</small><b>{m.speed}<i> фт.</i></b></div>
        <HpBox hp={hp} dice={m.hitDice} />
        <div className="cs"><small>Мастерство</small><b>{m.proficiency}</b></div>
        <div className="cs"><small>Пасс. воспр.</small><b>{m.passive}</b></div>
        {m.spellStats[0] && (
          <div className="cs m-only"><small>Спасбросок закл.</small><b>{m.spellStats[0].dc}</b><em>атака {m.spellStats[0].attack}</em></div>
        )}
      </section>

      <div className="mtabs m-only" role="tablist" aria-label="Разделы карточки">
        {tabs.map(([t, label]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      <div className="ab6 big" data-t="obz">
        {m.abilities.map((a, i) => (
          <div key={a.name} className="ab2">
            <h3><span className="t-full">{a.name}</span><span className="t-short">{a.name.slice(0, 3).toUpperCase()}</span><span>{a.score}</span></h3>
            <div className="md">{a.mod}</div>
            <div className="sv"><span className={`dot${m.saves[i].proficient ? " on" : ""}`} /><span className="t-full">Спасбросок</span><span className="t-short">Спас.</span><b>{m.saves[i].bonus}</b></div>
          </div>
        ))}
      </div>

      <div className="masonry">
      <div className="cols3">
        <div className="col">
          <section className={`cd sk-wrap${allSkills ? " is-open" : ""}`} data-t="obz">
            <h2 className="t">Навыки</h2>
            {m.skills.map((s) => (
              <div key={s.name} className={`sr${s.level > 0 ? "" : " np"}`}>
                <span className={`dot${s.level > 0 ? " on" : ""}${s.level === 2 ? " x2" : ""}`} />
                {s.name} <em>{s.ability}</em>
                <b>{s.bonus}</b>
              </div>
            ))}
            <button type="button" className="allsk m-only" aria-expanded={allSkills} onClick={() => setAllSkills((v) => !v)}>
              {allSkills ? "Только освоенные" : `Все навыки · ${m.skills.length}`}
              <Icon name="chevron" size={14} />
            </button>
          </section>
          {(m.equipment.length > 0 || m.currency) && (
            <section className="cd" data-t="ono">
              <h2 className="t">Снаряжение</h2>
              {m.equipment.map((it, i) => (
                <div key={i} className="cn">{it.name}</div>
              ))}
              {m.currency && <div className="mute small cur">{m.currency}</div>}
            </section>
          )}
        </div>
        <div className="col">
          {m.attacks.length > 0 && (
            <section className="cd" data-t="boy">
              <h2 className="t">Атаки</h2>
              <div className="at head"><span>Оружие</span><span>Бонус</span><span>Урон</span></div>
              {m.attacks.map((a, i) => (
                <div key={i} className="at">
                  <span><b>{a.name}</b>{a.note && <small>{a.note}</small>}</span>
                  <b>{a.bonus}</b>
                  <b>{a.damage}</b>
                </div>
              ))}
            </section>
          )}
          {m.spellGroups.length > 0 && (
            <section className="cd" data-t="zak">
              <h2 className="t">Заклинания</h2>
              <div className="sstats">
                {m.spellStats.map((s) => (
                  <div key={s.label} className="mt"><small>{s.label}</small><b>Сл {s.dc} · {s.attack}</b></div>
                ))}
              </div>
              {m.pact && <p className="mute small">{m.pact}</p>}
              {m.spellGroups.map((g) => (
                <div key={g.level} className="sg">
                  <div className="lb">{g.title}{g.slots !== undefined ? ` · ячеек ${g.slots}` : ""}</div>
                  <div className="pl">
                    {g.spells.map((s) => (
                      <span key={s.name} className={s.muted ? "muted" : undefined}>
                        {s.name}
                        {s.marks && <i className="k">{s.marks}</i>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <p className="mute small">К: концентрация, Р: ритуал.</p>
            </section>
          )}
          {m.proficiencies.length > 0 && (
            <section className="cd" data-t="ono">
              <h2 className="t">Владения и языки</h2>
              {m.proficiencies.map((x) => (
                <div key={x.label} className="sg">
                  <div className="lb">{x.label}</div>
                  <div>{x.value}</div>
                </div>
              ))}
            </section>
          )}
        </div>
        <div className="col">
          {m.features.length > 0 && (
            <section className="cd" data-t="boy">
              <h2 className="t">Умения</h2>
              {m.features.map((f, i) => (
                <div key={i} className="ft"><strong>{f.name}<i className="d-only">.</i></strong> <span>{f.text}</span></div>
              ))}
            </section>
          )}
          {slotGroups.length > 0 && (
            <section className="cd m-only" data-t="boy">
              <h2 className="t">Ячейки заклинаний</h2>
              {slotGroups.map((g) => {
                const total = g.slots ?? 0;
                const spent = Math.min(total, used[g.level] ?? 0);
                return (
                  <div key={g.level} className="slrow">
                    <span className="sln">{g.level} круг</span>
                    <span className="pips">
                      {Array.from({ length: total }, (_, n) => (
                        <button key={n} type="button" className={`pip${n >= total - spent ? " off" : ""}`} aria-label={`Ячейка ${g.level} круга ${n + 1}`} aria-pressed={n < total - spent} onClick={() => flipSlot(g.level, n, total)} />
                      ))}
                    </span>
                    <small>осталось {total - spent} из {total}</small>
                  </div>
                );
              })}
              <button type="button" className="rest" onClick={longRest}>Долгий отдых</button>
            </section>
          )}
        </div>
      </div>

      <div className="cols3 low">
        {(pe.backstory || pe.traits || pe.ideals || pe.bonds || pe.flaws || pe.goals) && (
          <section className="cd wide2" data-t="ono">
            <h2 className="t">Личность</h2>
            {pe.backstory && <p className="para">{pe.backstory}</p>}
            {(
              [["traits", "Черты"], ["ideals", "Идеалы"], ["bonds", "Привязанности"], ["flaws", "Слабости"], ["goals", "Цели"]] as [string, string][]
            ).map(([k, label]) => pe[k] && (
              <div key={k} className="sg">
                <div className="lb">{label}</div>
                <div>{pe[k]}</div>
              </div>
            ))}
          </section>
        )}
        {(pe.appearance || body.length > 0) && (
          <section className="cd" data-t="ono">
            <h2 className="t">Внешность</h2>
            {pe.appearance && <p className="para">{pe.appearance}</p>}
            <div className="bgrid">
              {body.map(([k, label]) => (
                <div key={k}><div className="lb">{label}</div>{ch.body?.[k]}</div>
              ))}
            </div>
          </section>
        )}
        {kind === "npc" && roleplay.length > 0 && (
          <section className="cd" data-t="ono">
            <h2 className="t">Отыгрыш</h2>
            {roleplay.map((r) => (
              <div key={r.label} className="sg">
                <div className="lb">{r.label}</div>
                <div>{r.text}</div>
              </div>
            ))}
          </section>
        )}
        {m.notes.length > 0 && (
          <section className="cd" data-t="ono">
            <h2 className="t">Заметки</h2>
            {m.notes.map((n, i) => (
              <div key={i} className="sg">
                <div className="lb">{n.title}</div>
                <div>{n.text}</div>
              </div>
            ))}
          </section>
        )}
      </div>
      </div>
    </div>
  );
}

/* ---------- Формы правки ---------- */

const ACTION_DEFAULTS = {
  text: () => ({ kind: "text", name: "Новое действие", text: "Описание." }),
  attack: () => ({
    kind: "attack",
    id: `atk${Math.random().toString(36).slice(2, 6)}`,
    name: "Новая атака",
    attack_type: "melee_weapon",
    ability: "str",
    reach: 5,
    damage: [{ dice: "1d6", type: "slashing", ability: "str" }],
  }),
};

function ActionFields({ e, base }: { e: Ed; base: Path }) {
  const kind = getIn(e.d, [...base, "kind"]);
  const dmg: Path = [...base, "damage", 0];
  return (
    <>
      <T e={e} p={[...base, "name"]} label="Название" />
      {kind === "attack" && (
        <>
          <Sel e={e} p={[...base, "ability"]} label="Характеристика" options={ABILITY_OPTS} />
          <N e={e} p={[...base, "reach"]} label="Досягаемость, фт." />
          <N e={e} p={[...base, "range_normal"]} label="Дальность, фт." />
          <N e={e} p={[...base, "range_long"]} label="Макс. дальность, фт." />
          <N e={e} p={[...base, "to_hit_bonus"]} label="Бонус к попаданию (сверх расчёта)" />
          <T e={e} p={[...dmg, "dice"]} label="Кости урона" />
          <Sel e={e} p={[...dmg, "type"]} label="Тип урона" options={DAMAGE_OPTS} />
          <N e={e} p={[...dmg, "bonus"]} label="Прибавка к урону" />
          <T e={e} p={[...base, "on_hit_text"]} label="Дополнительный эффект при попадании" area />
        </>
      )}
      {kind === "save" && (
        <>
          <Sel e={e} p={[...base, "save_ability"]} label="Спасбросок" options={ABILITY_OPTS} />
          <T e={e} p={[...base, "area"]} label="Область" />
          <N e={e} p={[...base, "dc", "value"]} label="Сл (если задана вручную)" />
          <T e={e} p={[...dmg, "dice"]} label="Кости урона" />
          <Sel e={e} p={[...dmg, "type"]} label="Тип урона" options={DAMAGE_OPTS} />
          <Sel e={e} p={[...base, "on_success"]} label="При успехе" optional options={[["half", "половина урона"], ["none", "ничего"], ["special", "особый эффект"]]} />
          <T e={e} p={[...base, "effect_text"]} label="Эффект" area />
        </>
      )}
      {(kind === "text" || kind === "multiattack") && <T e={e} p={[...base, "text"]} label="Текст" area />}
    </>
  );
}

function MonsterForm({ e }: { e: Ed }) {
  const actionLists: [string, string][] = [
    ["actions", "Действия"],
    ["bonus_actions", "Бонусные действия"],
    ["reactions", "Реакции"],
  ];
  return (
    <div className="forms">
      <Group title="Основное">
        <T e={e} p={["name"]} label="Название" />
        <T e={e} p={["name_en"]} label="Название по-английски" />
        <Sel e={e} p={["size"]} label="Размер" options={SIZE_OPTS} />
        <Sel e={e} p={["type"]} label="Тип" options={TYPE_OPTS} />
        <T e={e} p={["subtype"]} label="Подтип" />
        <T e={e} p={["alignment"]} label="Мировоззрение" />
        <T e={e} p={["challenge_rating"]} label="Опасность (например 1/2 или 17)" />
      </Group>
      <Group title="Защита и скорость" hint="Хиты считаются по костям и телосложению; число ниже перекрывает расчёт.">
        <N e={e} p={["armor_class", "value"]} label="Класс доспеха" />
        <T e={e} p={["armor_class", "note"]} label="Чем обеспечен" />
        <N e={e} p={["hit_dice", "count"]} label="Костей хитов" min={1} />
        <Sel e={e} p={["hit_dice", "die"]} label="Кость" options={DIE_OPTS} num />
        <N e={e} p={["hp_override"]} label="Хиты вручную" />
        <N e={e} p={["speed", "walk"]} label="Ходьба, фт." />
        <N e={e} p={["speed", "fly"]} label="Полёт, фт." />
        <N e={e} p={["speed", "swim"]} label="Плавание, фт." />
        <N e={e} p={["speed", "climb"]} label="Лазание, фт." />
        <N e={e} p={["speed", "burrow"]} label="Копание, фт." />
      </Group>
      <Group title="Характеристики">
        {ABILITY_SHORT.map(([k, label]) => (
          <N key={k} e={e} p={["abilities", k]} label={label} min={1} max={30} />
        ))}
      </Group>
      <Group title="Спасброски и навыки">
        <Toggles e={e} p={["saving_throws"]} label="Спасброски с мастерством" options={ABILITY_OPTS} />
        <SkillToggles e={e} p={["skills"]} />
      </Group>
      <Group title="Сопротивления и чувства">
        <Toggles e={e} p={["damage_vulnerabilities"]} label="Уязвимости" options={DAMAGE_OPTS} />
        <Toggles e={e} p={["damage_resistances"]} label="Сопротивления" options={DAMAGE_OPTS} />
        <Toggles e={e} p={["damage_immunities"]} label="Иммунитет к урону" options={DAMAGE_OPTS} />
        <T e={e} p={["damage_notes"]} label="Пояснение к урону" />
        <Toggles e={e} p={["condition_immunities"]} label="Иммунитет к состояниям" options={CONDITION_OPTS} />
        <N e={e} p={["senses", "darkvision"]} label="Тёмное зрение, фт." />
        <N e={e} p={["senses", "blindsight"]} label="Слепое зрение, фт." />
        <N e={e} p={["senses", "tremorsense"]} label="Чувство вибрации, фт." />
        <N e={e} p={["senses", "truesight"]} label="Истинное зрение, фт." />
        <Csv e={e} p={["languages"]} label="Языки (через запятую)" />
        <T e={e} p={["languages_note"]} label="Пояснение к языкам" />
      </Group>
      <Items
        e={e}
        p={["traits"]}
        title="Особенности"
        render={(_, b) => (
          <>
            <T e={e} p={[...b, "name"]} label="Название" />
            <T e={e} p={[...b, "text"]} label="Текст" area />
          </>
        )}
        adders={[{ label: "Добавить особенность", make: () => ({ name: "Новая особенность", text: "Описание." }) }]}
      />
      {actionLists.map(([key, title]) => (
        <Items
          key={key}
          e={e}
          p={[key]}
          title={title}
          render={(_, b) => <ActionFields e={e} base={b} />}
          adders={[
            { label: "Атака", make: ACTION_DEFAULTS.attack },
            { label: "Текстовое действие", make: ACTION_DEFAULTS.text },
          ]}
        />
      ))}
      <Group title="Легендарные действия">
        <N e={e} p={["legendary_actions", "per_round"]} label="Действий за раунд" />
        <T e={e} p={["legendary_actions", "intro"]} label="Вводный текст" area />
      </Group>
      <Items
        e={e}
        p={["legendary_actions", "actions"]}
        title="Список легендарных действий"
        render={(_, b) => (
          <>
            <ActionFields e={e} base={b} />
            <N e={e} p={[...b, "legendary_cost"]} label="Стоимость" min={1} />
          </>
        )}
        adders={[
          { label: "Атака", make: ACTION_DEFAULTS.attack },
          { label: "Текстовое действие", make: ACTION_DEFAULTS.text },
        ]}
      />
      <Group title="Описание и тактика">
        <T e={e} p={["description"]} label="Описание" area />
        <T e={e} p={["tactics"]} label="Тактика" area />
      </Group>
      <NotesEditor e={e} />
    </div>
  );
}

function NotesEditor({ e }: { e: Ed }) {
  return (
    <Items
      e={e}
      p={["dm_notes"]}
      title="Заметки мастера"
      render={(_, b) => <T e={e} p={[...b, "text"]} label="Текст" area />}
      adders={[{ label: "Добавить заметку", make: () => ({ kind: "note", text: "" }) }]}
    />
  );
}

function PersonForm({ e, kind }: { e: Ed; kind: "npc" | "character" }) {
  const isChar = kind === "character";
  return (
    <div className="forms">
      <Group title="Основное">
        <T e={e} p={["name"]} label="Имя" />
        <T e={e} p={["race", "name"]} label="Раса" />
        <T e={e} p={["background"]} label="Предыстория (происхождение)" />
        <T e={e} p={["alignment"]} label="Мировоззрение" />
        {isChar ? <T e={e} p={["player_name"]} label="Игрок" /> : <T e={e} p={["role"]} label="Роль" />}
        {isChar && <N e={e} p={["experience"]} label="Опыт" min={0} />}
      </Group>
      <Items
        e={e}
        p={["classes"]}
        title="Классы"
        render={(_, b) => (
          <>
            <Sel e={e} p={[...b, "class"]} label="Класс" options={CLASS_OPTS} />
            <T e={e} p={[...b, "subclass"]} label="Архетип" />
            <N e={e} p={[...b, "level"]} label="Уровень" min={1} max={20} />
          </>
        )}
        adders={isChar ? [] : [{ label: "Добавить класс", make: () => ({ class: "fighter", level: 1 }) }]}
      />
      <Group title="Характеристики">
        {ABILITY_SHORT.map(([k, label]) => (
          <N key={k} e={e} p={["abilities", k]} label={label} min={1} max={30} />
        ))}
      </Group>
      <Group title="Защита и скорость" hint="КД и хиты считаются по доспеху, классу и телосложению. Поля ниже перекрывают расчёт.">
        <N e={e} p={["defense", "override", "value"]} label="КД вручную" />
        <T e={e} p={["defense", "override", "note"]} label="Пояснение к КД" />
        <N e={e} p={["hit_points", "override"]} label="Хиты вручную" />
        <N e={e} p={["speed", "walk"]} label="Скорость, фт." />
      </Group>
      <Group title="Навыки и владения">
        <SkillToggles e={e} p={["skill_proficiencies"]} />
        <Csv e={e} p={["languages"]} label="Языки (через запятую)" />
        <Csv e={e} p={["proficiencies", "armor"]} label="Доспехи (через запятую)" />
        <Csv e={e} p={["proficiencies", "weapons"]} label="Оружие (через запятую)" />
        <Csv e={e} p={["proficiencies", "tools"]} label="Инструменты (через запятую)" />
      </Group>
      <Items
        e={e}
        p={["weapons"]}
        title="Оружие"
        render={(_, b) => (
          <>
            <T e={e} p={[...b, "name"]} label="Название" />
            <T e={e} p={[...b, "damage", "dice"]} label="Кости урона" />
            <Sel e={e} p={[...b, "damage", "type"]} label="Тип урона" options={DAMAGE_OPTS} />
            <N e={e} p={[...b, "magic_bonus"]} label="Магический бонус" />
            <N e={e} p={[...b, "damage_bonus"]} label="Прибавка к урону" />
            <T e={e} p={[...b, "note"]} label="Пометка" />
          </>
        )}
        adders={[{ label: "Добавить оружие", make: () => ({ name: "Новое оружие", melee: true, damage: { dice: "1d6", type: "slashing" } }) }]}
      />
      <Items
        e={e}
        p={["features"]}
        title="Умения"
        render={(_, b) => (
          <>
            <T e={e} p={[...b, "name"]} label="Название" />
            <T e={e} p={[...b, "text"]} label="Текст" area />
          </>
        )}
        adders={[{ label: "Добавить умение", make: () => ({ name: "Новое умение", text: "Описание.", origin: { type: "other" } }) }]}
      />
      <Items
        e={e}
        p={["equipment", "items"]}
        title="Снаряжение"
        render={(_, b) => (
          <>
            <T e={e} p={[...b, "name"]} label="Предмет" />
            <N e={e} p={[...b, "quantity"]} label="Количество" min={1} />
            <T e={e} p={[...b, "note"]} label="Пометка" />
          </>
        )}
        adders={[{ label: "Добавить предмет", make: () => ({ name: "Предмет" }) }]}
      />
      <Group title="Деньги">
        {(["pp", "gp", "ep", "sp", "cp"] as const).map((k) => (
          <N key={k} e={e} p={["equipment", "currency", k]} label={{ pp: "Платина", gp: "Золото", ep: "Электрум", sp: "Серебро", cp: "Медь" }[k]} min={0} />
        ))}
      </Group>
      <Group title="Личность" hint={isChar ? "Эти поля обязательны для персонажа игрока." : undefined}>
        <T e={e} p={["personality", "traits"]} label="Черты характера" area />
        <T e={e} p={["personality", "ideals"]} label="Идеалы" area />
        <T e={e} p={["personality", "bonds"]} label="Привязанности" area />
        <T e={e} p={["personality", "flaws"]} label="Слабости" area />
        <T e={e} p={["personality", "backstory"]} label="Предыстория" area />
        <T e={e} p={["personality", "appearance"]} label="Внешность" area />
        <T e={e} p={["personality", "goals"]} label="Цели" area />
      </Group>
      {isChar ? (
        <Group title="Тело">
          {(["age", "height", "weight", "eyes", "skin", "hair"] as const).map((k) => (
            <T key={k} e={e} p={["body", k]} label={{ age: "Возраст", height: "Рост", weight: "Вес", eyes: "Глаза", skin: "Кожа", hair: "Волосы" }[k]} />
          ))}
        </Group>
      ) : (
        <Group title="Отыгрыш">
          <T e={e} p={["roleplay", "speech"]} label="Манера речи" />
          <T e={e} p={["roleplay", "wants"]} label="Чего хочет" />
          <T e={e} p={["roleplay", "hides"]} label="Что скрывает" />
          <T e={e} p={["roleplay", "in_combat"]} label="В бою" />
        </Group>
      )}
      {((getIn(e.d, ["spellcasting"]) as unknown[] | undefined) ?? []).map((_, i) => (
        <Items
          key={i}
          e={e}
          p={["spellcasting", i, "spells"]}
          title={`Заклинания: ${CLASS_OPTS.find(([k]) => k === getIn(e.d, ["spellcasting", i, "class"]))?.[1] ?? "класс"}`}
          render={(_, b) => (
            <>
              <T e={e} p={[...b, "name"]} label="Название" />
              <N e={e} p={[...b, "level"]} label="Уровень (0 — заговор)" min={0} max={9} />
              <T e={e} p={[...b, "school"]} label="Школа" />
              <B e={e} p={[...b, "concentration"]} label="Концентрация" />
              <B e={e} p={[...b, "ritual"]} label="Ритуал" />
            </>
          )}
          adders={[{ label: "Добавить заклинание", make: () => ({ name: "Новое заклинание", level: 1, source: { type: "custom" } }) }]}
        />
      ))}
      <NotesEditor e={e} />
    </div>
  );
}


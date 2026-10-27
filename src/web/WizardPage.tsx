import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CardKind, Issue } from "../validate.js";
import { CR_TABLE } from "../rules/cr.js";
import { build, copyText, type Outcome } from "./build.js";
import { errorLines } from "./errorLines.js";
import { Icon } from "./icons.js";
import { KIND_ICON, KIND_RU } from "./LibraryPage.js";
import { kitFor, type Settings } from "./settings.js";
import { Dropdown, Switch } from "./ui.js";

const KINDS: { kind: CardKind; title: string; hint: string; example: string }[] = [
  { kind: "character", title: "Персонаж игрока", hint: "Бланк игрока. Файл для импорта в Long Story Short", example: "Эльфийка-следопыт, выросла в лесу, не доверяет магам" },
  { kind: "npc", title: "НИП", hint: "Человек в мире мастера. Классы, умения, заклинания, PDF", example: "Хитрый кузнец-полуорк, бывший наёмник, держит кузницу в порту" },
  { kind: "monster", title: "Монстр", hint: "Статблок для мастера. Опасность, действия, PDF", example: "Болотная ведьма, хозяйка топей, колдует и призывает пиявок" },
];

/** Правила + разделитель + задание. Хвост «Дальше» из инструкции не нужен: задание идёт в этом же сообщении. */
export function joinPrompt(kit: string, request: string): string {
  const rules = kit.replace(/\n# Дальше[\s\S]*$/, "").trimEnd();
  return `${rules}\n\n---\n\n# Задание\n\n${request}\n\nОтветь одной анкетой в блоке \`\`\`toml по правилам выше.\n`;
}

const STEPS = ["Кто это", "Параметры", "Промт", "Ответ нейросети"];
const LEVELS = Array.from({ length: 20 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} уровень` }));
const CRS = CR_TABLE.map((r) => ({ value: r.cr, label: `Опасность ${r.cr}` }));

interface Props {
  settings: Settings;
  initialKind: CardKind | null;
  onDone(source: string, kind: CardKind, name: string): void;
  onCancel(): void;
}

export function WizardPage({ settings, initialKind, onDone, onCancel }: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<CardKind | null>(initialKind);
  const [desc, setDesc] = useState("");
  const [level, setLevel] = useState("1");
  const [cr, setCr] = useState("1");
  const [homebrew, setHomebrew] = useState(settings.homebrew);
  const [copied, setCopied] = useState<"" | "kit" | "req" | "report">("");
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<Outcome>({ status: "empty" });
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const info = KINDS.find((k) => k.kind === kind);
  const request = useMemo(() => {
    if (!kind) return "";
    const parts = [desc.trim() || info?.example || ""];
    parts.push(kind === "monster" ? `Опасность ${cr}.` : `Уровень ${level}.`);
    parts.push(homebrew ? "Можно вводить собственные умения с пометкой «хоумрул»." : "Только официальные умения и заклинания.");
    return parts.filter(Boolean).join(" ");
  }, [kind, desc, info, level, cr, homebrew]);

  /** Правила и задание одним сообщением: правила, разделитель, затем «Задание». */
  const prompt = useMemo(() => (kind ? joinPrompt(kitFor(settings, kind), request) : ""), [kind, settings, request]);

  function flash(what: "kit" | "req" | "report") {
    setCopied(what);
    setTimeout(() => setCopied(""), 1800);
  }

  async function run(source: string) {
    setBusy(true);
    setDirty(false);
    try {
      const next = await build(source);
      if (next.status === "ok") {
        if (next.pdfUrl) URL.revokeObjectURL(next.pdfUrl);
        onDone(next.source, next.kind, next.name);
        return;
      }
      setOutcome(next);
    } catch (e) {
      setOutcome({ status: "error", report: "", issues: [{ path: "", message: `Не удалось собрать файл: ${e instanceof Error ? e.message : String(e)}` }], source });
    } finally {
      setBusy(false);
    }
  }

  async function pasteReply() {
    try {
      const clip = await navigator.clipboard.readText();
      setText(clip);
      setOutcome({ status: "empty" });
      void run(clip);
    } catch {
      /* буфер недоступен: остаётся ручная вставка */
    }
  }

  async function toPrompt() {
    setStep(2);
    if (kind && (await copyText(joinPrompt(kitFor(settings, kind), request)))) flash("kit");
  }

  const err = outcome.status === "error" ? outcome : null;
  const shownText = err ? err.source : text;
  const marks = useMemo(() => (err ? errorLines(err.source, err.issues) : new Map<number, string>()), [err]);
  const lineCount = Math.max(shownText.split("\n").length, 8);
  const realLines = shownText.trim() ? shownText.split("\n").length : 0;
  const found = /^\s*kind\s*=/m.test(shownText);
  const errWord = err ? (err.issues.length === 1 ? "ошибку" : err.issues.length < 5 ? "ошибки" : "ошибок") : "";
  const slot = document.getElementById("mbar-slot");

  return (
    <main className="main wiz"><div className="mscroll">
      {slot &&
        createPortal(
          <div className="mbar">
            <button type="button" className="mb" aria-label="Назад" onClick={() => (step > 0 ? setStep(step - 1) : onCancel())}>
              <Icon name="back" size={22} />
            </button>
            <span className="mtitle">Новое существо</span>
            <button type="button" className="mcancel" onClick={onCancel}>Отмена</button>
          </div>,
          slot,
        )}
      <div className="mseg m-only" aria-hidden="true">
        {STEPS.map((l, i) => (
          <i key={l} className={i <= step ? "on" : ""} />
        ))}
      </div>
      <p className="mstep m-only">Шаг {step + 1} из {STEPS.length}</p>
      <div className="crumb2 d-only">Новое существо{kind ? ` · ${KIND_RU[kind]}` : ""}</div>
      <div className="lhead">
        <div className="grow">
          <h1>{err && step === 3 ? <><span className="d-only">{STEPS[step]}</span><span className="m-only">Нужно поправить анкету</span></> : STEPS[step]}</h1>
          <div className="sub">
            {err && step === 3 ? (
              <>
                <span className="d-only">Вставьте ответ нейросети целиком.</span>
                <span className="m-only">Нашли {err.issues.length} {errWord}. Проверка остановилась до создания карточки: ничего не сохранено.</span>
              </>
            ) : (
              ["Выберите, кого создаём.", "Задайте основные параметры. Остальное нейросеть придумает сама.", "Скопируйте инструкцию и запрос в чат с нейросетью.", "Скопируйте ответ нейросети целиком и вставьте сюда. Лишний текст вокруг анкеты не помешает."][step]
            )}
          </div>
        </div>
      </div>

      <ol className="steps d-only" aria-label="Шаги">
        {STEPS.map((label, i) => (
          <li key={label} className={i < step ? "done" : i === step ? "now" : ""} aria-current={i === step ? "step" : undefined}>
            <i>{i < step ? <Icon name="check" size={12} /> : i + 1}</i>
            {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <>
          <div className="kinds" role="radiogroup" aria-label="Тип существа">
            {KINDS.map((k) => (
              <button key={k.kind} type="button" role="radio" aria-checked={kind === k.kind} className={`kind${kind === k.kind ? " on" : ""}`} onClick={() => setKind(k.kind)}>
                <Icon name={KIND_ICON[k.kind]} size={22} />
                <b>{k.title}</b>
                <span>{k.hint}</span>
              </button>
            ))}
          </div>
          <label className="fld wide">
            <span>Кто это (необязательно)</span>
            <textarea className="big" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={info?.example ?? "Опишите в паре фраз: кто, чем живёт, какой характер"} />
          </label>
          <div className="actions">
            <button type="button" className="btn dark" disabled={!kind} onClick={() => setStep(1)}>
              Дальше <Icon name="arrow" />
            </button>
          </div>
        </>
      )}

      {step === 1 && kind && (
        <>
          <section className="cd setcard">
            <div className="srow">
              <div className="grow">
                <b>{kind === "monster" ? "Опасность" : "Уровень"}</b>
                <p className="mute">{kind === "monster" ? "Ожидаемая сложность монстра (CR)." : "Общий уровень существа. Для мультикласса нейросеть разделит его сама."}</p>
              </div>
              {kind === "monster" ? (
                <Dropdown value={cr} options={CRS} onChange={setCr} ariaLabel="Опасность" />
              ) : (
                <Dropdown value={level} options={LEVELS} onChange={setLevel} ariaLabel="Уровень" />
              )}
            </div>
            <div className="srow">
              <div className="grow">
                <b>Разрешить хоумрулы</b>
                <p className="mute">Нейросеть может вводить собственные умения с пометкой.</p>
              </div>
              <Switch checked={homebrew} onChange={setHomebrew} tone="accent" />
            </div>
            <div className="srow">
              <div className="grow">
                <b>Правила</b>
                <p className="mute">Промт учитывает выбранную редакцию.</p>
              </div>
              <span className="tag">5e 2014</span>
            </div>
          </section>
          <div className="actions">
            <button type="button" className="btn" onClick={() => setStep(0)}>
              <Icon name="back" /> Назад
            </button>
            <button type="button" className="btn dark" onClick={() => void toPrompt()}>
              Дальше <Icon name="arrow" />
            </button>
          </div>
        </>
      )}

      {step === 2 && kind && (
        <>
          <section className="cd todo">
            <div>
              <span className="no">1</span>
              <span>
                <b>Промт для «{KIND_RU[kind]}»</b>
                <br />
                <span className="mute">Правила и ваше задание уже собраны в одно сообщение. Вставьте его в чат с любой нейросетью. Оно уже скопировано.</span>
              </span>
              <button type="button" className="btn" onClick={async () => (await copyText(prompt)) && flash("kit")}>
                <Icon name={copied === "kit" ? "check" : "copy"} /> {copied === "kit" ? "Скопировано" : "Скопировать"}
              </button>
            </div>
            <pre className="preview-box" aria-hidden="true">{prompt.slice(0, 300)}…</pre>
            <div className="sep" aria-hidden="true">
              <i />
              <span>Задание</span>
              <i />
            </div>
            <pre className="preview-box task" aria-hidden="true">{request}</pre>
            <div>
              <span className="no">2</span>
              <span>
                <b>Скопируйте ответ целиком</b>
                <br />
                <span className="mute">Пояснения вокруг анкеты не страшны: приложение найдёт блок TOML само.</span>
              </span>
            </div>
          </section>
          <div className="actions">
            <button type="button" className="btn" onClick={() => setStep(1)}>
              <Icon name="back" /> Назад
            </button>
            <button type="button" className="btn dark" onClick={() => setStep(3)}>
              Ответ получен <Icon name="arrow" />
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className={err ? "split" : undefined}>
            <section className="codecard" aria-label="Ответ нейросети">
              <div className="codehead">
                <b>TOML</b>
                <span className="mute">{lineCount} строк</span>
                {err && <span className="errc">{err.issues.length} {err.issues.length === 1 ? "ошибка" : err.issues.length < 5 ? "ошибки" : "ошибок"}</span>}
                <span className="grow" />
                <button type="button" className="pill d-only" onClick={() => void pasteReply()} disabled={busy}>
                  <Icon name="paste" size={15} /> {err ? "Вставить заново" : "Вставить из буфера"}
                </button>
              </div>
              <div className="codebody">
                <div className="gut" aria-hidden="true">
                  {Array.from({ length: lineCount }, (_, i) => (
                    <div key={i} className={marks.has(i) ? "bad" : undefined}>{i + 1}</div>
                  ))}
                </div>
                <div className="codeedit">
                  <div className="hl" aria-hidden="true">
                    {Array.from({ length: lineCount }, (_, i) => (
                      <div key={i} className={marks.has(i) ? "bad" : undefined}>{marks.has(i) ? <span>{marks.get(i)}</span> : " "}</div>
                    ))}
                  </div>
                  <textarea
                    ref={taRef}
                    value={shownText}
                    wrap="off"
                    spellCheck={false}
                    rows={lineCount}
                    aria-label="Текст анкеты"
                    placeholder={'Вставьте сюда ответ нейросети целиком.\nПриложение само найдёт анкету TOML (kind = "monster" и так далее).'}
                    onChange={(e) => {
                      setText(e.target.value);
                      setDirty(true);
                      if (err) setOutcome({ ...err, source: e.target.value });
                    }}
                  />
                </div>
              </div>
            </section>
            {!err && realLines > 0 && (
              <p className="mstatus m-only">
                <Icon name={found ? "checkcircle" : "alert"} size={16} />
                {found ? "Анкета найдена" : "Анкета не распознана"} · {realLines} {realLines % 10 === 1 && realLines !== 11 ? "строка" : realLines % 10 >= 2 && realLines % 10 <= 4 && (realLines < 12 || realLines > 14) ? "строки" : "строк"}
              </p>
            )}
            {err && (
              <aside className="fix" aria-live="polite">
                <h2>
                  <Icon name="alert" size={20} /> Что исправить
                </h2>
                <ol>
                  {err.issues.map((i, n) => (
                    <li key={n}>
                      {i.path && <code>{i.path}</code>} {i.message}
                    </li>
                  ))}
                </ol>
                <button type="button" className="btn dark d-only" onClick={async () => (await copyText(err.report || err.issues.map((i) => i.message).join("\n"))) && flash("report")}>
                  <Icon name={copied === "report" ? "check" : "copy"} /> {copied === "report" ? "Скопировано" : "Скопировать запрос для чата"}
                </button>
              </aside>
            )}
          </div>
          <div className={`mact m-only${err ? " col" : ""}`}>
            {err ? (
              <>
                {dirty && (
                  <button type="button" className="btn accent" disabled={busy || !shownText.trim()} onClick={() => void run(shownText)}>
                    {busy ? "Собираю…" : "Проверить и создать"}
                  </button>
                )}
                <button type="button" className={`btn${dirty ? "" : " accent"}`} onClick={async () => (await copyText(err.report || err.issues.map((i) => i.message).join("\n"))) && flash("report")}>
                  <Icon name={copied === "report" ? "check" : "copy"} size={18} /> {copied === "report" ? "Скопировано" : "Скопировать просьбу исправить"}
                </button>
                {!dirty && <button type="button" className="btn" onClick={() => taRef.current?.focus()}>Править текст самому</button>}
              </>
            ) : (
              <>
                <button type="button" className="btn" onClick={() => void pasteReply()} disabled={busy}>
                  <Icon name="paste" size={18} /> Вставить
                </button>
                <button type="button" className="btn accent" disabled={busy || !shownText.trim()} onClick={() => void run(shownText)}>
                  {busy ? "Собираю…" : "Проверить и создать"}
                </button>
              </>
            )}
          </div>
          <div className="actions d-only">
            <button type="button" className="btn" onClick={() => setStep(kind ? 2 : 0)}>
              <Icon name="back" /> Назад
            </button>
            <span className="mute small grow">Исправьте ошибки в тексте или попросите нейросеть. Бланк соберётся, когда проверка пройдёт.</span>
            <button type="button" className="btn dark" disabled={busy || !shownText.trim()} onClick={() => void run(shownText)}>
              {busy ? "Собираю…" : "Собрать бланк"}
            </button>
          </div>
        </>
      )}
    </div></main>
  );
}

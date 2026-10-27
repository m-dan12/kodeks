import { useRef, useState } from "react";
import type { CardKind } from "../validate.js";
import { deliver } from "./build.js";
import { Icon } from "./icons.js";
import { KIND_RU } from "./LibraryPage.js";
import { loadFolders, loadLibrary, replaceAll, type Folder, type SavedCard } from "./library.js";
import { DEFAULT_KITS, type ExportMode, type Settings } from "./settings.js";
import { Dropdown, Segmented, Switch, useConfirm } from "./ui.js";
import { APP_VERSION } from "./version.js";

type Tab = "general" | "rules" | "prompts" | "export" | "data" | "about";
const TABS: { value: Tab; label: string }[] = [
  { value: "general", label: "Общие" },
  { value: "rules", label: "Правила" },
  { value: "prompts", label: "Промты" },
  { value: "export", label: "Экспорт" },
  { value: "data", label: "Данные" },
  { value: "about", label: "О программе" },
];

interface Props {
  settings: Settings;
  library: SavedCard[];
  folders: Folder[];
  onSettings(s: Settings): void;
  onImport(cards: SavedCard[], folders: Folder[]): void;
  onClear(): void;
  onToast(text: string): void;
  onCheckUpdate(): void;
}

function Row({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="srow">
      <div className="grow">
        <b>{title}</b>
        <p className="mute small">{hint}</p>
      </div>
      {children}
    </div>
  );
}

export function SettingsPage({ settings, library, folders, onSettings, onImport, onClear, onToast, onCheckUpdate }: Props) {
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("prompts");
  const [drill, setDrill] = useState(false);
  const open = (t: Tab) => {
    setTab(t);
    setDrill(true);
  };
  const [kind, setKind] = useState<CardKind>("character");
  const [draft, setDraft] = useState<Partial<Record<CardKind, string>>>({});
  const file = useRef<HTMLInputElement>(null);
  const text = draft[kind] ?? settings.prompts[kind] ?? DEFAULT_KITS[kind];
  const custom = !!settings.prompts[kind];

  function savePrompt() {
    const next = { ...settings.prompts };
    if (text.trim() && text.trim() !== DEFAULT_KITS[kind].trim()) next[kind] = text;
    else delete next[kind];
    onSettings({ ...settings, prompts: next });
    setDraft((d) => ({ ...d, [kind]: undefined }));
    onToast("Промт сохранён");
  }

  function resetPrompt() {
    const next = { ...settings.prompts };
    delete next[kind];
    onSettings({ ...settings, prompts: next });
    setDraft((d) => ({ ...d, [kind]: undefined }));
    onToast("Возвращён стандартный промт");
  }

  async function backup() {
    const blob = new Blob([JSON.stringify({ app: "kodeks", version: 1, cards: library, folders }, null, 2)], { type: "application/json" });
    await deliver(`kodeks-biblioteka-${new Date().toISOString().slice(0, 10)}.json`, blob);
  }

  async function restore(f: File | undefined) {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as { cards?: SavedCard[]; folders?: Folder[] };
      if (!Array.isArray(data.cards)) throw new Error("нет списка карточек");
      const cards = data.cards.filter((c) => c && typeof c.name === "string" && typeof c.json === "string" && ["monster", "npc", "character"].includes(c.kind));
      if (!(await confirm(`В файле ${cards.length} карточек. Заменить ими текущую библиотеку (${library.length})?`, { title: "Загрузка копии", ok: "Заменить", danger: true }))) return;
      replaceAll(cards, data.folders ?? []);
      onImport(loadLibrary(), loadFolders());
      onToast("Копия загружена");
    } catch (e) {
      onToast(`Не удалось прочитать файл: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      if (file.current) file.current.value = "";
    }
  }

  async function clear() {
    if (await confirm(`Удалить все карточки (${library.length}) и полки? Это нельзя отменить.`, { title: "Очистка библиотеки", ok: "Удалить всё", danger: true })) {
      onClear();
      onToast("Библиотека очищена");
    }
  }

  return (
    <main className="main settings" data-drill={drill ? "1" : undefined}><div className="mscroll">
      <h1>Настройки</h1>
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => void restore(e.target.files?.[0])} />
      <div className="mlist m-only">
        <div className="grp">Создание</div>
        <button type="button" className="li" onClick={() => open("prompts")}>
          <span className="lic"><Icon name="file" size={18} /></span>
          <span className="lit"><b>Промты для нейросети</b><span className="s">Свои тексты для персонажа, НИП и монстра</span></span>
          <span className="lir"><Icon name="right" size={18} /></span>
        </button>
        <div className="li">
          <span className="lic"><Icon name="shield" size={18} /></span>
          <span className="lit"><b>Разрешать хоумрулы</b><span className="s">Нейросеть может вводить свои умения с пометкой</span></span>
          <Switch checked={settings.homebrew} onChange={(v) => onSettings({ ...settings, homebrew: v })} />
        </div>
        <div className="grp">Экспорт</div>
        <button type="button" className="li" onClick={() => open("export")}>
          <span className="lic"><Icon name="print" size={18} /></span>
          <span className="lit"><b>Режим по умолчанию</b><span className="s">Постранично для печати или целый экран</span></span>
          <span className="lir">{settings.exportMode === "print" ? "Постранично" : "Целый экран"}<Icon name="right" size={18} /></span>
        </button>
        <div className="li">
          <span className="lic"><Icon name="file" size={18} /></span>
          <span className="lit"><b>Имя файла латиницей</b><span className="s">«Страж» станет strazh.pdf</span></span>
          <Switch checked={settings.translit} onChange={(v) => onSettings({ ...settings, translit: v })} />
        </div>
        <div className="grp">Данные</div>
        <button type="button" className="li" onClick={() => void backup()}>
          <span className="lic"><Icon name="download" size={18} /></span>
          <span className="lit"><b>Резервная копия</b><span className="s">{library.length} карточек и {folders.length} полок в один файл</span></span>
        </button>
        <button type="button" className="li" onClick={() => file.current?.click()}>
          <span className="lic"><Icon name="file" size={18} /></span>
          <span className="lit"><b>Загрузить копию</b><span className="s">Заменит текущую библиотеку</span></span>
        </button>
        <button type="button" className="li danger" disabled={!library.length && !folders.length} onClick={() => void clear()}>
          <span className="lic"><Icon name="trash" size={18} /></span>
          <span className="lit"><b>Очистить библиотеку</b><span className="s">Спросим подтверждение перед удалением</span></span>
        </button>
        <div className="grp">О программе</div>
        <button type="button" className="li" onClick={onCheckUpdate}>
          <span className="lic"><Icon name="download" size={18} /></span>
          <span className="lit"><b>Проверить обновления</b><span className="s">Версия {APP_VERSION}</span></span>
        </button>
        <p className="mfoot">Кодекс {APP_VERSION} · D&amp;D 5e (2014) · работает без интернета</p>
      </div>
      <div className="sgrid">
        <button type="button" className="mback m-only" onClick={() => setDrill(false)}>
          <Icon name="back" size={18} /> Настройки
        </button>
        <nav className="subnav" aria-label="Разделы настроек">
          {TABS.map((t) => (
            <button key={t.value} type="button" className={`fi${tab === t.value ? " on" : ""}`} aria-current={tab === t.value ? "page" : undefined} onClick={() => setTab(t.value)}>
              {t.label}
            </button>
          ))}
        </nav>
        <section className="cd spanel">
          {tab === "general" && (
            <>
              <h2 className="t">Общие</h2>
              <Row title="Язык интерфейса" hint="Приложение целиком на русском.">
                <Dropdown value="ru" options={[{ value: "ru", label: "Русский" }]} onChange={() => undefined} ariaLabel="Язык интерфейса" />
              </Row>
              <Row title="Где хранятся данные" hint="Библиотека лежит только на этом устройстве, интернет не нужен. Резервную копию можно сделать в разделе «Данные».">
                <span className="tag">на устройстве</span>
              </Row>
            </>
          )}

          {tab === "rules" && (
            <>
              <h2 className="t">Правила</h2>
              <Row title="Редакция правил" hint="Расчёты и справочники работают по D&D 5e, редакция 2014.">
                <Dropdown value="2014" options={[{ value: "2014", label: "5e 2014" }]} onChange={() => undefined} ariaLabel="Редакция правил" />
              </Row>
              <Row title="Разрешить хоумрулы по умолчанию" hint="Нейросеть может вводить собственные умения с пометкой. Значение подставляется в новый запрос.">
                <Switch checked={settings.homebrew} onChange={(v) => onSettings({ ...settings, homebrew: v })} tone="accent" />
              </Row>
            </>
          )}

          {tab === "prompts" && (
            <>
              <h2 className="t">Промты</h2>
              <Segmented value={kind} options={(["character", "npc", "monster"] as CardKind[]).map((k) => ({ value: k, label: KIND_RU[k] }))} onChange={(v) => setKind(v as CardKind)} ariaLabel="Вид существа" />
              <Row title="Формат ответа" hint="Нейросеть возвращает анкету TOML. Бланк для Long Story Short приложение собирает само.">
                <Dropdown value="toml" options={[{ value: "toml", label: "TOML" }]} onChange={() => undefined} ariaLabel="Формат ответа" />
              </Row>
              <Row title="Редакция правил" hint="Промт учитывает выбранную редакцию.">
                <Dropdown value="2014" options={[{ value: "2014", label: "5e 2014" }]} onChange={() => undefined} ariaLabel="Редакция правил в промте" />
              </Row>
              <Row title="Язык ответа" hint="Названия, умения и описания.">
                <Dropdown value="ru" options={[{ value: "ru", label: "Русский" }]} onChange={() => undefined} ariaLabel="Язык ответа" />
              </Row>
              <Row title="Разрешить хоумрулы" hint="Нейросеть может вводить собственные умения с пометкой.">
                <Switch checked={settings.homebrew} onChange={(v) => onSettings({ ...settings, homebrew: v })} tone="accent" />
              </Row>
              <label className="fld wide">
                <span>Текст промта{custom ? " (изменён)" : " (стандартный)"}</span>
                <textarea className="promptbox" value={text} spellCheck={false} onChange={(e) => setDraft((d) => ({ ...d, [kind]: e.target.value }))} />
              </label>
              <div className="actions">
                <button type="button" className="btn dark" onClick={savePrompt}>
                  Сохранить
                </button>
                <button type="button" className="btn" disabled={!custom && draft[kind] === undefined} onClick={resetPrompt}>
                  Вернуть стандартный
                </button>
              </div>
            </>
          )}

          {tab === "export" && (
            <>
              <h2 className="t">Экспорт</h2>
              <Row title="Режим по умолчанию" hint="Постранично: A4 для печати. Целый экран: по одному листу на существо, удобно читать с экрана.">
                <Segmented value={settings.exportMode} options={[{ value: "print", label: "Постранично" }, { value: "screen", label: "Целый экран" }]} onChange={(v) => onSettings({ ...settings, exportMode: v as ExportMode })} ariaLabel="Режим экспорта" />
              </Row>
              <Row title="Имя файла латиницей" hint="«Проклятие Страда» превращается в proklyatie-strada.pdf. Так файл открывается везде.">
                <Switch checked={settings.translit} onChange={(v) => onSettings({ ...settings, translit: v })} tone="accent" />
              </Row>
            </>
          )}

          {tab === "data" && (
            <>
              <h2 className="t">Данные</h2>
              <Row title="Резервная копия" hint={`Сохраняет все карточки (${library.length}) и полки (${folders.length}) в один файл.`}>
                <button type="button" className="btn" onClick={() => void backup()}>
                  <Icon name="download" /> Скачать копию
                </button>
              </Row>
              <Row title="Загрузить копию" hint="Текущая библиотека будет заменена содержимым файла.">
                <button type="button" className="btn" onClick={() => file.current?.click()}>
                  <Icon name="file" /> Выбрать файл
                </button>
              </Row>
              <Row title="Очистить библиотеку" hint="Удаляет все карточки и полки на этом устройстве.">
                <button type="button" className="btn danger-o" disabled={!library.length && !folders.length} onClick={() => void clear()}>
                  <Icon name="trash" /> Очистить
                </button>
              </Row>
            </>
          )}

          {tab === "about" && (
            <>
              <h2 className="t">О программе</h2>
              <Row title="Кодекс" hint="Карточки существ для D&D 5e: нейросеть придумывает, приложение считает и проверяет. Работает без интернета.">
                <span className="tag">версия {APP_VERSION}</span>
              </Row>
              <Row title="Обновления" hint="При запуске приложение смотрит новые релизы на GitHub и предлагает скачать. Проверить можно и вручную.">
                <button type="button" className="btn" onClick={onCheckUpdate}>
                  <Icon name="download" /> Проверить
                </button>
              </Row>
              <Row title="Формат обмена с нейросетью" hint="Анкета TOML: короче и надёжнее JSON. Бланк Long Story Short собирается приложением.">
                <span className="fmt">TOML</span>
              </Row>
            </>
          )}
        </section>
      </div>
    </div></main>
  );
}

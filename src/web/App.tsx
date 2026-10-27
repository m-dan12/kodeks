import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import type { CardKind } from "../validate.js";
import { build, deliver, slug } from "./build.js";
import { CardPage } from "./CardPage.js";
import { ExportDialog } from "./ExportDialog.js";
import { Icon, Logo } from "./icons.js";
import { KIND_ICON, LibraryPage, type Scope } from "./LibraryPage.js";
import { PrintPage } from "./PrintPage.js";
import {
  addFolder, clearLibrary, duplicateCard, folderTree, loadFolders, loadLibrary, patchCard, patchCards, removeCards, saveCard, unfile, updateCard,
  type Folder, type SavedCard,
} from "./library.js";
import { loadSettings, saveSettings, type Settings } from "./settings.js";
import { SettingsPage } from "./SettingsPage.js";
import { ConfirmProvider, Modal, Resizer, usePanelWidth } from "./ui.js";
import { checkUpdate, openUpdate, platform, skipVersion, skipped, type Update } from "./update.js";
import { APP_VERSION } from "./version.js";
import { WizardPage } from "./WizardPage.js";

interface Controls {
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
}
const controls = (window as unknown as { codex?: Controls }).codex;

type Section = "library" | "card" | "print" | "create" | "settings";

export function App() {
  const [section, setSection] = useState<Section>("library");
  const [scope, setScope] = useState<Scope>({ by: "all" });
  const [query, setQuery] = useState("");
  const [library, setLibrary] = useState<SavedCard[]>(() => loadLibrary());
  const [folders, setFolders] = useState<Folder[]>(() => loadFolders());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [openId, setOpenId] = useState<string | null>(null);
  const [wizardKind, setWizardKind] = useState<CardKind | null>(null);
  const [wizardKey, setWizardKey] = useState(0);
  const [exporting, setExporting] = useState<SavedCard[] | null>(null);
  const [toast, setToast] = useState("");
  const [update, setUpdate] = useState<Update | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [newRoot, setNewRoot] = useState<string | null>(null);
  const [navW, setNavW, resetNavW] = usePanelWidth("nav", 232, 180, 360);
  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Кнопка «Назад» на телефоне: из любого раздела ведёт в библиотеку, и только оттуда выходит из приложения
  const isRoot = section === "library" && scope.by === "all";
  const rootRef = useRef(isRoot);
  rootRef.current = isRoot;
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = CapApp.addListener("backButton", () => {
      if (document.querySelector(".scrim")) {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      } else if (rootRef.current) {
        void CapApp.exitApp();
      } else {
        setSection("library");
        setScope({ by: "all" });
        setQuery("");
      }
    });
    return () => void sub.then((h) => h.remove());
  }, []);
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    const mark = (history.state as { k?: number } | null)?.k === 1;
    if (!isRoot && !mark) history.pushState({ k: 1 }, "");
    else if (isRoot && mark) history.back();
  }, [isRoot]);
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    const onPop = () => {
      setSection("library");
      setScope({ by: "all" });
      setQuery("");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // При запуске смотрим последний релиз на GitHub и предлагаем обновиться. Без сети молча пропускаем.
  // В режиме разработки проверку можно проверить так: ?updateTest=0.0.1 (версия, которую считаем установленной).
  useEffect(() => {
    const fake = import.meta.env.DEV ? new URLSearchParams(location.search).get("updateTest") : null;
    if (!fake && !platform()) return;
    const t = window.setTimeout(() => {
      checkUpdate(fake ?? APP_VERSION)
        .then((u) => u && (fake || u.version !== skipped()) && setUpdate(u))
        .catch(() => undefined);
    }, 2000);
    return () => window.clearTimeout(t);
  }, []);

  async function checkNow() {
    say("Проверяю обновления…");
    try {
      const u = await checkUpdate();
      if (u) setUpdate(u);
      else say("Установлена последняя версия");
    } catch {
      say("Не удалось проверить: нет сети");
    }
  }

  function say(text: string) {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  }

  const go = (s: Section, sc: Scope = { by: "all" }) => {
    setSection(s);
    setScope(sc);
    if (s !== "library") setQuery("");
  };

  function startNew(kind: CardKind | null = null) {
    setWizardKind(kind);
    setWizardKey((k) => k + 1);
    setSection("create");
  }

  function openCard(card: SavedCard) {
    setOpenId(card.id);
    setSection("card");
  }

  function wizardDone(source: string, kind: CardKind, name: string) {
    const next = saveCard(library, { name, kind, json: source });
    setLibrary(next);
    const card = next.find((c) => c.kind === kind && c.name === name);
    if (card) openCard(card);
    say("Сохранено в библиотеку");
  }

  function changeSettings(s: Settings) {
    setSettings(s);
    saveSettings(s);
  }

  async function exportLss(card: SavedCard) {
    const out = await build(card.json);
    if (out.status !== "ok" || !out.lssJson) return say("Не удалось собрать файл для Long Story Short");
    await deliver(`${settings.translit ? slug(card.name) : card.name}.lss.json`, new Blob([out.lssJson], { type: "application/json" }));
  }

  const counts = useMemo(() => {
    const own = new Map<string, number>();
    for (const c of library) if (c.folder) own.set(c.folder, (own.get(c.folder) ?? 0) + 1);
    const total = (id: string) => folderTree(folders, id).reduce((n, x) => n + (own.get(x) ?? 0), 0);
    return { all: library.length, fav: library.filter((c) => c.fav).length, total };
  }, [library, folders]);

  const activeFolder = scope.by === "folder" ? scope.id : undefined;

  function treeItems(parent: string | undefined, depth: number): ReactNode[] {
    return folders
      .filter((f) => f.parent === parent)
      .flatMap((f) => {
        const kids = folders.some((x) => x.parent === f.id);
        const expanded = open.has(f.id);
        const on = section === "library" && activeFolder === f.id;
        return [
          <div key={f.id} className={`tr${on ? " on" : ""}`} style={{ paddingLeft: 10 + depth * 16 }}>
            {kids ? (
              <button
                type="button"
                className={`chv${expanded ? "" : " c"}`}
                aria-label={expanded ? "Свернуть" : "Развернуть"}
                aria-expanded={expanded}
                onClick={() =>
                  setOpen((s) => {
                    const n = new Set(s);
                    if (!n.delete(f.id)) n.add(f.id);
                    return n;
                  })
                }
              >
                <Icon name="chevron" size={13} />
              </button>
            ) : (
              <span className="chv0" />
            )}
            <button type="button" className="trb" onClick={() => go("library", { by: "folder", id: f.id })}>
              <Icon name="folder" size={15} />
              <span className="nm2">{f.name}</span>
              <b>{counts.total(f.id)}</b>
            </button>
          </div>,
          ...(kids && expanded ? treeItems(f.id, depth + 1) : []),
        ];
      });
  }

  function submitRoot(e: FormEvent) {
    e.preventDefault();
    if (newRoot) setFolders(addFolder(folders, newRoot));
    setNewRoot(null);
  }

  const card = library.find((c) => c.id === openId);
  const scopeName = scope.by === "folder" ? folders.find((f) => f.id === scope.id)?.name : undefined;
  const label =
    section === "create"
      ? "Новое существо"
      : section === "settings"
        ? "Настройки"
        : section === "card" || section === "print"
          ? (card?.name ?? "Карточка")
          : scope.by === "fav"
            ? "Избранное"
            : (scopeName ?? "Библиотека");

  return (
    <ConfirmProvider>
      <div className="window" data-sec={section}>
        <div className="strip">
          <span className="brand">
            <Logo size={20} />
          </span>
          <span className="where">Кодекс · {label}</span>
          <span className="grow" />
          {controls && (
            <div className="wc-group">
              <button type="button" className="wc" aria-label="Свернуть" onClick={() => controls.minimize()}>
                <Icon name="min" />
              </button>
              <button type="button" className="wc" aria-label="Развернуть" onClick={() => controls.toggleMaximize()}>
                <Icon name="max" />
              </button>
              <button type="button" className="wc close" aria-label="Закрыть" onClick={() => controls.close()}>
                <Icon name="x" />
              </button>
            </div>
          )}
        </div>
        <div id="mbar-slot" className="mbar-slot" />
        <div className="body">
          <nav className="nav" aria-label="Основная навигация" style={{ width: navW }}>
            <div className="navin">
            <button
              type="button"
              className="logo"
              onClick={() => {
                setQuery("");
                go("library");
              }}
              aria-label="Кодекс: вся библиотека"
            >
              <Logo size={32} />
              <b>Кодекс</b>
            </button>
            <label className="search">
              <Icon name="search" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (section !== "library") setSection("library");
                }}
                placeholder="Найти существо"
                aria-label="Найти существо"
              />
              <kbd>Ctrl K</kbd>
            </label>
            <button type="button" className="newbtn" onClick={() => startNew()}>
              <Icon name="plus" size={16} /> Новое существо
            </button>
            <button type="button" className={`ni${section === "library" && scope.by === "fav" ? " on" : ""}`} onClick={() => go("library", { by: "fav" })}>
              <Icon name="star" /> <span>Избранное</span>
              <b>{counts.fav}</b>
            </button>
            <button type="button" className={`ni${section === "library" && scope.by === "all" ? " on" : ""}`} onClick={() => go("library")}>
              <Icon name="lib" /> <span>Библиотека</span>
              <b>{counts.all}</b>
            </button>
            <div className="nh">
              <span>Полки</span>
              <button type="button" aria-label="Новая полка" data-tip="Новая полка" onClick={() => setNewRoot("")}>
                <Icon name="plus" />
              </button>
            </div>
            {treeItems(undefined, 0)}
            {library
              .filter((c) => !c.folder)
              .map((c) => (
                <div key={c.id} className={`tr leaf${section === "card" && openId === c.id ? " on" : ""}`} style={{ paddingLeft: 10 }}>
                  <span className="chv0" />
                  <button type="button" className="trb" onClick={() => openCard(c)} aria-label={`Открыть: ${c.name}`}>
                    <Icon name={KIND_ICON[c.kind]} size={15} />
                    <span className="nm2">{c.name}</span>
                  </button>
                </div>
              ))}
            {newRoot !== null && (
              <form className="newfolder" onSubmit={submitRoot}>
                <input
                  autoFocus
                  value={newRoot}
                  onChange={(e) => setNewRoot(e.target.value)}
                  onBlur={() => setNewRoot(null)}
                  onKeyDown={(e) => e.key === "Escape" && setNewRoot(null)}
                  placeholder="Название полки"
                  aria-label="Название полки"
                />
              </form>
            )}
            <button type="button" className={`ni push${section === "settings" ? " on" : ""}`} onClick={() => go("settings")}>
              <Icon name="gear" /> <span>Настройки</span>
            </button>
            </div>
          </nav>
          <Resizer value={navW} min={180} max={360} onChange={setNavW} onReset={resetNavW} side="left" label="Ширина меню" className="rz-nav" />

          {section === "library" && (
            <LibraryPage
              library={library}
              folders={folders}
              scope={scope}
              query={query}
              onQuery={(q) => setQuery(q)}
              onScope={(s) => go("library", s)}
              onOpen={openCard}
              onNew={() => startNew()}
              onFav={(id) => setLibrary((l) => patchCard(l, id, { fav: !l.find((c) => c.id === id)?.fav }))}
              onMove={(ids, folder) => setLibrary((l) => patchCards(l, ids, { folder }))}
              onRemove={(ids) => setLibrary((l) => removeCards(l, ids))}
              onDuplicate={(id) => {
                setLibrary((l) => duplicateCard(l, id));
                say("Копия создана");
              }}
              onExport={setExporting}
              onFolders={setFolders}
              onUnfile={(ids) => setLibrary((l) => unfile(l, ids))}
            />
          )}
          {section === "create" && <WizardPage key={wizardKey} settings={settings} initialKind={wizardKind} onDone={wizardDone} onCancel={() => go("library")} />}
          {section === "settings" && (
            <SettingsPage
              settings={settings}
              library={library}
              folders={folders}
              onSettings={changeSettings}
              onImport={(c, f) => {
                setLibrary(c);
                setFolders(f);
              }}
              onClear={() => {
                setLibrary(clearLibrary());
                setFolders([]);
                try {
                  localStorage.removeItem("dnd-cards.folders");
                } catch {
                  /* хранилище недоступно */
                }
              }}
              onToast={say}
              onCheckUpdate={() => void checkNow()}
            />
          )}
          {section === "print" && card && (
            <main className="main sheet"><div className="mscroll">
              <PrintPage key={card.id} card={card} onBack={() => setSection("card")} onExport={() => setExporting([card])} />
            </div></main>
          )}
          {section === "card" && (
            <main className="main sheet"><div className="mscroll">
              {card ? (
                <CardPage
                  key={card.id + card.savedAt}
                  card={card}
                  folderName={folders.find((f) => f.id === card.folder)?.name}
                  onBack={() => go("library")}
                  onFav={() => setLibrary((l) => patchCard(l, card.id, { fav: !card.fav }))}
                  onSave={(name, source) => {
                    setLibrary((l) => updateCard(l, card.id, { name, json: source }));
                    say("Изменения сохранены");
                  }}
                  onExport={() => setExporting([card])}
                  onPrint={() => setSection("print")}
                  onLss={card.kind === "character" ? () => void exportLss(card) : undefined}
                />
              ) : (
                <p className="mute">Карточка не найдена.</p>
              )}
            </div></main>
          )}
        </div>

        <nav className="bar" aria-label="Разделы">
          <button type="button" className={section === "library" && scope.by !== "fav" ? "on" : ""} onClick={() => go("library")}>
            <Icon name="lib" size={22} /> Библиотека
          </button>
          <button type="button" className={section === "create" ? "on" : ""} onClick={() => startNew()}>
            <Icon name="plus" size={22} /> Создать
          </button>
          <button type="button" className={section === "library" && scope.by === "fav" ? "on" : ""} onClick={() => go("library", { by: "fav" })}>
            <Icon name="star" size={22} /> Избранное
          </button>
          <button type="button" className={section === "settings" ? "on" : ""} onClick={() => go("settings")}>
            <Icon name="gear" size={22} /> Настройки
          </button>
        </nav>
      </div>

      {update && (
        <Modal title="Доступно обновление" onClose={() => setUpdate(null)} width={520}>
          <p className="confirm-text">
            Вышла версия <b>{update.version}</b>, у вас {update.current}.
          </p>
          {update.notes && <pre className="upd-notes">{update.notes.slice(0, 700)}</pre>}
          <div className="modal-foot">
            <button type="button" className="btn" onClick={() => { skipVersion(update.version); setUpdate(null); }}>
              Пропустить
            </button>
            <button type="button" className="btn" onClick={() => setUpdate(null)}>
              Позже
            </button>
            <button type="button" className="btn accent" data-autofocus onClick={() => { void openUpdate(update); setUpdate(null); }}>
              Скачать
            </button>
          </div>
        </Modal>
      )}
      {exporting && <ExportDialog cards={exporting} scopeName={scopeName} settings={settings} onClose={() => setExporting(null)} onToast={say} />}
      {toast && (
        <div className="toast" role="status">
          <Icon name="checkcircle" /> {toast}
        </div>
      )}
    </ConfirmProvider>
  );
}

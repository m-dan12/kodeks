import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { CardKind } from "../validate.js";
import { Icon, type IconName } from "./icons.js";
import { addFolder, folderTree, removeFolder, type Folder, type SavedCard } from "./library.js";
import { summarize } from "./summary.js";
import { Check, Dropdown, Modal, Resizer, useConfirm, usePanelWidth } from "./ui.js";

export type Scope = { by: "all" } | { by: "fav" } | { by: "folder"; id: string };

export const KIND_RU: Record<CardKind, string> = { character: "Персонаж", npc: "НИП", monster: "Монстр" };
export const KIND_PLURAL: Record<CardKind, string> = { character: "Персонажи", npc: "НИП", monster: "Монстры" };
export const KIND_ICON: Record<CardKind, IconName> = { character: "user", npc: "users", monster: "skull" };
const KINDS: CardKind[] = ["character", "npc", "monster"];
const PAGE = 8;

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
export const creatures = (n: number): string => `${n} ${plural(n, "существо", "существа", "существ")}`;

/** «2 часа назад», «Вчера», «18 октября». */
export function when(ts: number): string {
  const min = Math.floor((Date.now() - ts) / 60_000);
  if (min < 1) return "Только что";
  if (min < 60) return `${min} ${plural(min, "минуту", "минуты", "минут")} назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ${plural(h, "час", "часа", "часов")} назад`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Вчера";
  if (d < 7) return `${d} ${plural(d, "день", "дня", "дней")} назад`;
  return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

type Sort = "new" | "old" | "name";
const SORTS = [
  { value: "new", label: "Сначала новые" },
  { value: "old", label: "Сначала старые" },
  { value: "name", label: "По имени" },
];

interface Props {
  library: SavedCard[];
  folders: Folder[];
  scope: Scope;
  query: string;
  onQuery(q: string): void;
  onScope(s: Scope): void;
  onOpen(card: SavedCard): void;
  onNew(): void;
  onFav(id: string): void;
  onMove(ids: string[], folder: string | undefined): void;
  onRemove(ids: string[]): void;
  onDuplicate(id: string): void;
  onExport(cards: SavedCard[]): void;
  onFolders(next: Folder[]): void;
  onUnfile(ids: string[]): void;
}

/** Узкое окно: правой панели нет, поэтому нажатие на строку сразу открывает карточку. */
function useNarrow(): boolean {
  const query = "(max-width: 1180px)";
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setNarrow(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return narrow;
}

export function LibraryPage(p: Props) {
  const confirm = useConfirm();
  const narrow = useNarrow();
  const [prevW, setPrevW, resetPrevW] = usePanelWidth("preview", 300, 260, 520);
  const [kindF, setKindF] = useState<CardKind | null>(null);
  const [sort, setSort] = useState<Sort>("new");
  const [view, setView] = useState<"list" | "tiles">("list");
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [newShelf, setNewShelf] = useState<string | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTo, setMoveTo] = useState<string>("-");
  const [moveNew, setMoveNew] = useState("");
  const press = useRef<{ timer: number; fired: boolean }>({ timer: 0, fired: false });

  const folderId = p.scope.by === "folder" ? p.scope.id : undefined;
  const inScope = useMemo(() => {
    const ids = folderId ? new Set(folderTree(p.folders, folderId)) : null;
    const q = p.query.trim().toLowerCase();
    return p.library.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (p.scope.by === "fav") return !!c.fav;
      if (ids) return !!c.folder && ids.has(c.folder);
      return true;
    });
  }, [p.library, p.folders, p.scope, p.query, folderId]);

  const sorted = useMemo(
    () =>
      inScope
        .filter((c) => !kindF || c.kind === kindF)
        .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name, "ru") : sort === "old" ? a.savedAt - b.savedAt : b.savedAt - a.savedAt)),
    [inScope, kindF, sort],
  );
  const shown = showAll ? sorted : sorted.slice(0, PAGE);
  const current = sorted.find((c) => c.id === detailId) ?? shown[0];
  const picked = sorted.filter((c) => selected.has(c.id));

  const shelves = p.folders.filter((f) => f.parent === folderId);
  const countIn = (id: string) => {
    const ids = new Set(folderTree(p.folders, id));
    return p.library.filter((c) => c.folder && ids.has(c.folder)).length;
  };
  const folder = p.folders.find((f) => f.id === folderId);
  const title = p.scope.by === "fav" ? "Избранное" : (folder?.name ?? "Библиотека");

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  }

  /** Телефон: долгое нажатие включает выбор, пока что-то выбрано, нажатие переключает отметку. */
  const touch = (c: SavedCard) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (!narrow || e.pointerType === "mouse") return;
      press.current.fired = false;
      window.clearTimeout(press.current.timer);
      press.current.timer = window.setTimeout(() => {
        press.current.fired = true;
        toggle(c.id);
        navigator.vibrate?.(12);
      }, 450);
    },
    onPointerUp: () => window.clearTimeout(press.current.timer),
    onPointerLeave: () => window.clearTimeout(press.current.timer),
    onPointerCancel: () => window.clearTimeout(press.current.timer),
    onContextMenu: (e: React.MouseEvent) => {
      if (narrow) e.preventDefault();
    },
    onClick: () => {
      if (press.current.fired) {
        press.current.fired = false;
        return;
      }
      if (narrow && selected.size > 0) return toggle(c.id);
      if (narrow) p.onOpen(c);
      else {
        setDetailId(c.id);
        setPreviewOpen(true);
      }
    },
  });

  function doMove() {
    let target: string | undefined = moveTo === "-" ? undefined : moveTo;
    if (moveTo === "+") {
      const name = moveNew.trim();
      if (!name) return;
      const next = addFolder(p.folders, name, folderId);
      p.onFolders(next);
      target = next[next.length - 1]?.id;
    }
    p.onMove(picked.map((c) => c.id), target);
    setSelected(new Set());
    setMoveOpen(false);
    setMoveNew("");
  }

  async function dropCards(cards: SavedCard[]) {
    const text = cards.length === 1 ? `Удалить «${cards[0].name}»? Это нельзя отменить.` : `Удалить выбранные карточки (${cards.length})? Это нельзя отменить.`;
    if (!(await confirm(text, { title: "Удаление", ok: "Удалить", danger: true }))) return;
    p.onRemove(cards.map((c) => c.id));
    setSelected(new Set());
  }

  async function dropShelf() {
    if (!folder) return;
    if (!(await confirm(`Удалить полку «${folder.name}»? Существа останутся в библиотеке.`, { title: "Удаление полки", ok: "Удалить", danger: true }))) return;
    p.onUnfile(folderTree(p.folders, folder.id));
    p.onFolders(removeFolder(p.folders, folder.id));
    p.onScope(folder.parent ? { by: "folder", id: folder.parent } : { by: "all" });
  }

  function submitShelf(e: FormEvent) {
    e.preventDefault();
    if (newShelf) p.onFolders(addFolder(p.folders, newShelf, folderId));
    setNewShelf(null);
  }

  const folderOptions = [
    { value: "", label: "Без полки", icon: "folder" as IconName },
    ...p.folders.map((f) => ({ value: f.id, label: f.name, icon: "folder" as IconName })),
  ];

  const row = (c: SavedCard) => {
    const sm = summarize(c);
    const isCur = current?.id === c.id && previewOpen;
    return (
      <div key={c.id} className={`rw${isCur ? " cur" : ""}`}>
        <Check checked={selected.has(c.id)} onChange={() => toggle(c.id)} label={`Выбрать ${c.name}`} />
        <button type="button" className="who" {...touch(c)} onDoubleClick={() => p.onOpen(c)}>
          <span className="av">{c.name.trim().charAt(0).toUpperCase()}</span>
          <span className="wt">
            <span className="nm">{c.name}</span>
            <span className="sb"><span className="sbk"><Icon name={KIND_ICON[c.kind]} size={14} /></span><span className="sbt">{sm.subtitle || KIND_RU[c.kind]}</span></span>
          </span>
        </button>
        <span className="ty"><Icon name={KIND_ICON[c.kind]} size={16} />{KIND_RU[c.kind]}</span>
        <span className="st">{sm.ac !== undefined && <><span className="stc"><i>КД</i><b>{sm.ac}</b></span><span className="stc"><i>ХП</i><b>{sm.hp}</b></span></>}</span>
        <span className="md">{when(c.savedAt)}</span>
        <button type="button" className={`star${c.fav ? " on" : ""}`} aria-label={c.fav ? "Убрать из избранного" : "Добавить в избранное"} aria-pressed={!!c.fav} data-tip={c.fav ? "Убрать из избранного" : "В избранное"} onClick={() => p.onFav(c.id)}>
          <Icon name="star" size={16} fill={!!c.fav} />
        </button>
      </div>
    );
  };

  const tile = (c: SavedCard) => {
    const sm = summarize(c);
    return (
      <div key={c.id} className={`tl${current?.id === c.id && previewOpen ? " cur" : ""}`}>
        <div className="tl-top">
          <Check checked={selected.has(c.id)} onChange={() => toggle(c.id)} label={`Выбрать ${c.name}`} />
          <button type="button" className={`star${c.fav ? " on" : ""}`} aria-label={c.fav ? "Убрать из избранного" : "Добавить в избранное"} aria-pressed={!!c.fav} data-tip={c.fav ? "Убрать из избранного" : "В избранное"} onClick={() => p.onFav(c.id)}>
            <Icon name="star" size={16} fill={!!c.fav} />
          </button>
        </div>
        <button type="button" className="tl-body" onClick={() => (narrow ? p.onOpen(c) : (setDetailId(c.id), setPreviewOpen(true)))} onDoubleClick={() => p.onOpen(c)}>
          <span className="av big">{c.name.trim().charAt(0).toUpperCase()}</span>
          <span className="nm">{c.name}</span>
          <span className="sb">{sm.subtitle || KIND_RU[c.kind]}</span>
        </button>
        <div className="tl-foot">
          <span className="ty"><Icon name={KIND_ICON[c.kind]} size={16} />{KIND_RU[c.kind]}</span>
          <span className="st">{sm.ac !== undefined && <><span className="stc"><i>КД</i><b>{sm.ac}</b></span><span className="stc"><i>ХП</i><b>{sm.hp}</b></span></>}</span>
        </div>
      </div>
    );
  };

  const sm = current ? summarize(current) : null;
  const folderOf = current?.folder ? p.folders.find((f) => f.id === current.folder) : undefined;
  const totalShelves = p.folders.length;

  return (
    <>
      <main className="main lib" data-sel={picked.length ? "1" : undefined}><div className="mscroll">
        {picked.length > 0 && (
          <div className="selbar m-only">
            <b>Выбрано {picked.length}</b>
            <button type="button" onClick={() => setSelected(new Set())}>Сбросить</button>
          </div>
        )}
        <div className="lhead">
          <div className="grow">
            <h1>{title}</h1>
            <div className="sub">
              {creatures(inScope.length)}
              {p.scope.by !== "fav" && ` · ${totalShelves} ${plural(totalShelves, "полка", "полки", "полок")}`}<span className="d-only"> · всё хранится на этом устройстве</span>
            </div>
          </div>
          {folder && (
            <button type="button" className="pill" onClick={dropShelf}>
              <Icon name="trash" size={15} /> Удалить полку
            </button>
          )}
          <span className="d-only"><Dropdown value={sort} options={SORTS} onChange={(v) => setSort(v as Sort)} ariaLabel="Сортировка" icon="sort" /></span>
          <div className="vt d-only" role="group" aria-label="Вид">
            <button type="button" aria-label="Список" aria-pressed={view === "list"} data-tip="Список" onClick={() => setView("list")}>
              <Icon name="list" />
            </button>
            <button type="button" aria-label="Плитки" aria-pressed={view === "tiles"} data-tip="Плитки" onClick={() => setView("tiles")}>
              <Icon name="grid" />
            </button>
          </div>
        </div>

        <label className="msearch m-only">
          <Icon name="search" size={20} />
          <input type="search" value={p.query} onChange={(e) => p.onQuery(e.target.value)} placeholder="Найти существо" aria-label="Найти существо" />
        </label>

        {p.scope.by !== "fav" && (
          <div className="mhd mshelf m-only">
            <h2>Полки</h2>
            <button type="button" onClick={() => setNewShelf("")}>
              <Icon name="plus" size={16} /> Полка
            </button>
          </div>
        )}
        {p.scope.by !== "fav" && (
          <div className="shelves">
            {shelves.map((f) => (
              <button key={f.id} type="button" className="shelf" onClick={() => p.onScope({ by: "folder", id: f.id })}>
                <span className="sq"><Icon name="folder" /></span>
                <span className="wt">
                  <span className="nm2">{f.name}</span>
                  <span className="sb">{creatures(countIn(f.id))}</span>
                </span>
              </button>
            ))}
            {newShelf === null ? (
              <button type="button" className="shelf add" onClick={() => setNewShelf("")}>
                <Icon name="plus" /> Полка
              </button>
            ) : (
              <form className="shelf adding" onSubmit={submitShelf}>
                <Icon name="folder" />
                <input autoFocus value={newShelf} onChange={(e) => setNewShelf(e.target.value)} onBlur={() => setNewShelf(null)} onKeyDown={(e) => e.key === "Escape" && setNewShelf(null)} placeholder="Название полки" aria-label="Название новой полки" />
              </form>
            )}
          </div>
        )}

        <div className="pills">
          <button type="button" className={`pill${!kindF ? " on" : ""}`} onClick={() => setKindF(null)}>
            Все <span>{inScope.length}</span>
          </button>
          {KINDS.map((k) => (
            <button key={k} type="button" className={`pill${kindF === k ? " on" : ""}`} onClick={() => setKindF(k)}>
              <Icon name={KIND_ICON[k]} size={15} />
              {KIND_PLURAL[k]} <span>{inScope.filter((c) => c.kind === k).length}</span>
            </button>
          ))}
        </div>

        {picked.length > 0 && (
          <div className="bulk" role="toolbar" aria-label="Действия с выбранными">
            <b>Выбрано {picked.length}</b>
            <button type="button" className="go" onClick={() => p.onExport(picked)}>
              <Icon name="download" size={15} /> Экспорт
            </button>
            <span className="d-only">
              <Dropdown
                value=""
                options={[{ value: "-", label: "Без полки", icon: "folder" }, ...p.folders.map((f) => ({ value: f.id, label: f.name, icon: "folder" as IconName }))]}
                onChange={(v) => {
                  p.onMove(picked.map((c) => c.id), v === "-" ? undefined : v);
                  setSelected(new Set());
                }}
                ariaLabel="Переместить на полку"
                label="Переместить"
                icon="folder"
                variant="ghost"
              />
            </span>
            <button type="button" className="mv m-only" onClick={() => setMoveOpen(true)}>
              <Icon name="folder" size={22} /> Переместить
            </button>
            <button type="button" onClick={() => void dropCards(picked)}>
              <Icon name="trash" size={15} /> Удалить
            </button>
            <button type="button" className="d-only" onClick={() => setSelected(new Set())}>
              <Icon name="x" size={15} /> Сбросить
            </button>
          </div>
        )}

        {sorted.length === 0 ? (
          <div className="empty">
            <Icon name="lib" size={28} />
            <p>{p.library.length ? "Ничего не найдено. Измените поиск или фильтр." : "Пока пусто. Готовые существа появятся здесь, их можно открыть снова в любой момент."}</p>
            {!p.library.length && (
              <button type="button" className="btn dark" onClick={p.onNew}>
                <Icon name="plus" /> Новое существо
              </button>
            )}
          </div>
        ) : view === "list" ? (
          <>
            <div className="mhd m-only">
              <h2>Существа</h2>
              <Dropdown value={sort} options={SORTS} onChange={(v) => setSort(v as Sort)} ariaLabel="Сортировка" icon="sort" label={sort === "new" ? "Новые" : sort === "old" ? "Старые" : "По имени"} />
            </div>
            <div className="rows">{shown.map(row)}</div>
          </>
        ) : (
          <div className="tiles">{shown.map(tile)}</div>
        )}

        {sorted.length > PAGE && (
          <div className="lfoot">
            <span>
              Показаны {shown.length} из {sorted.length}
            </span>
            <button type="button" className="more" onClick={() => setShowAll((s) => !s)}>
              {showAll ? "Свернуть" : "Показать все"}
              <Icon name="chevron" size={14} />
            </button>
          </div>
        )}
      </div></main>

      {moveOpen && (
        <Modal title="Переместить на полку" onClose={() => setMoveOpen(false)} aside={creatures(picked.length)}>
          <div className="mvlist" role="radiogroup" aria-label="Полка">
            {[{ id: "-", name: "Без полки" }, ...p.folders.map((f) => ({ id: f.id, name: f.name }))].map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={moveTo === o.id} className="mvopt" onClick={() => setMoveTo(o.id)}>
                <Icon name="folder" size={20} />
                <span>{o.name}</span>
                <i className={`rd${moveTo === o.id ? " on" : ""}`} />
              </button>
            ))}
            <button type="button" role="radio" aria-checked={moveTo === "+"} className="mvopt" onClick={() => setMoveTo("+")}>
              <Icon name="plus" size={20} />
              <span>Новая полка…</span>
              <i className={`rd${moveTo === "+" ? " on" : ""}`} />
            </button>
            {moveTo === "+" && <input className="mvnew" autoFocus value={moveNew} onChange={(e) => setMoveNew(e.target.value)} placeholder="Название полки" aria-label="Название новой полки" />}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={() => setMoveOpen(false)}>Отмена</button>
            <button type="button" className="btn dark" disabled={moveTo === "+" && !moveNew.trim()} onClick={doMove}>Переместить</button>
          </div>
        </Modal>
      )}

      {current && sm && previewOpen && (
        <>
        <Resizer value={prevW} min={260} max={520} onChange={setPrevW} onReset={resetPrevW} side="right" label="Ширина предпросмотра" className="rz-prev" />
        <aside className="preview" aria-label="Предпросмотр" style={{ width: prevW }}>
          <button type="button" className="pclose" aria-label="Закрыть предпросмотр" data-tip="Закрыть предпросмотр" onClick={() => setPreviewOpen(false)}>
            <Icon name="x" size={18} />
          </button>
          <div className="pscroll">
          <div className="phead">
            <span className="av big">{current.name.trim().charAt(0).toUpperCase()}</span>
            <div className="wt">
              <div className="pname">{current.name}</div>
              <div className="sb">{sm.typeLine || KIND_RU[current.kind]}</div>
            </div>
          </div>
          {sm.ac !== undefined && (
            <div className="pstats">
              <div><small>КД</small><b>{sm.ac}</b></div>
              <div><small>ХП</small><b>{sm.hp}</b></div>
              {sm.third && <div><small>{sm.third.label}</small><b>{sm.third.value}</b></div>}
            </div>
          )}
          {sm.abilities && (
            <div className="pabil">
              {sm.abilities.map((a) => (
                <div key={a.key}><small>{a.label}</small>{a.score}</div>
              ))}
            </div>
          )}
          {sm.features.length > 0 && (
            <div>
              <div className="lb pl-title">Особенности</div>
              <div className="pfeat">
                {sm.features.map((f) => (
                  <span key={f}>{f}</span>
                ))}
              </div>
            </div>
          )}
          <div className="pfacts">
            <span className="lb">Полка</span>
            <span>
              <Dropdown
                value={current.folder ?? ""}
                options={folderOptions}
                onChange={(v) => p.onMove([current.id], v || undefined)}
                ariaLabel="Полка"
                variant="field"
                label={folderOf?.name ?? "Без полки"}
              />
            </span>
            <span className="lb">Правила</span>
            <span>5e 2014</span>
            <span className="lb">Создан</span>
            <span>{new Date(current.savedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</span>
          </div>
          <div className="pfoot">
            <button type="button" className="open" onClick={() => p.onOpen(current)}>
              Открыть карточку <Icon name="right" />
            </button>
            <div className="prow">
              <button type="button" className="ghost grow" onClick={() => p.onExport([current])}>
                <Icon name="download" /> Экспорт PDF
              </button>
              <button type="button" className="ghost sq42" aria-label="Дублировать" data-tip="Дублировать" onClick={() => p.onDuplicate(current.id)}>
                <Icon name="copy" />
              </button>
              <button type="button" className="ghost sq42" aria-label="Удалить" data-tip="Удалить" onClick={() => void dropCards([current])}>
                <Icon name="trash" />
              </button>
            </div>
          </div>
          </div>
        </aside>
        </>
      )}
    </>
  );
}

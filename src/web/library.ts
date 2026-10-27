import type { CardKind } from "../validate.js";

export interface SavedCard {
  id: string;
  name: string;
  kind: CardKind;
  /** Исходный текст анкеты (TOML; у старых карточек может быть JSON). */
  json: string;
  savedAt: number;
  fav?: boolean;
  folder?: string;
}

/** Полка. Полки вкладываются друг в друга через parent. */
export interface Folder {
  id: string;
  name: string;
  parent?: string;
}

const KEY = "dnd-cards.library";
const FOLDERS = "dnd-cards.folders";

function read<T>(key: string): T[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

function write(key: string, list: unknown[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* хранилище недоступно: библиотека просто не сохранится */
  }
}

export const loadLibrary = (): SavedCard[] => read<SavedCard>(KEY);
export const loadFolders = (): Folder[] => read<Folder>(FOLDERS);

/** Карточка с тем же видом и именем заменяется (избранное и полка сохраняются), остальные добавляются сверху. */
export function saveCard(list: SavedCard[], card: Pick<SavedCard, "name" | "kind" | "json">): SavedCard[] {
  const old = list.find((c) => c.kind === card.kind && c.name === card.name);
  const rest = list.filter((c) => c !== old);
  const next = [{ ...card, id: crypto.randomUUID(), savedAt: Date.now(), fav: old?.fav, folder: old?.folder }, ...rest];
  write(KEY, next);
  return next;
}

export function removeCard(list: SavedCard[], id: string): SavedCard[] {
  const next = list.filter((c) => c.id !== id);
  write(KEY, next);
  return next;
}

export function removeCards(list: SavedCard[], ids: string[]): SavedCard[] {
  const set = new Set(ids);
  const next = list.filter((c) => !set.has(c.id));
  write(KEY, next);
  return next;
}

export function patchCard(list: SavedCard[], id: string, patch: Partial<Pick<SavedCard, "fav" | "folder">>): SavedCard[] {
  const next = list.map((c) => (c.id === id ? { ...c, ...patch } : c));
  write(KEY, next);
  return next;
}

export function patchCards(list: SavedCard[], ids: string[], patch: Partial<Pick<SavedCard, "fav" | "folder">>): SavedCard[] {
  const set = new Set(ids);
  const next = list.map((c) => (set.has(c.id) ? { ...c, ...patch } : c));
  write(KEY, next);
  return next;
}

/** Копия карточки: то же содержимое, имя с пометкой, сверху списка. */
export function duplicateCard(list: SavedCard[], id: string): SavedCard[] {
  const src = list.find((c) => c.id === id);
  if (!src) return list;
  const names = new Set(list.map((c) => c.name));
  let name = `${src.name} (копия)`;
  for (let n = 2; names.has(name); n++) name = `${src.name} (копия ${n})`;
  const json = src.json.replace(/^(name\s*=\s*)".*"/m, (_, head: string) => `${head}"${name.replace(/"/g, '\\"')}"`);
  const next = [{ ...src, id: crypto.randomUUID(), name, savedAt: Date.now(), json }, ...list];
  write(KEY, next);
  return next;
}

/** Правка карточки: меняются имя и текст анкеты, остальное (полка, избранное) остаётся. */
export function updateCard(list: SavedCard[], id: string, patch: Pick<SavedCard, "name" | "json">): SavedCard[] {
  const next = list.map((c) => (c.id === id ? { ...c, ...patch, savedAt: Date.now() } : c));
  write(KEY, next);
  return next;
}

export function addFolder(list: Folder[], name: string, parent?: string): Folder[] {
  const clean = name.trim();
  if (!clean || list.some((f) => f.name === clean && f.parent === parent)) return list;
  const next = [...list, { id: crypto.randomUUID(), name: clean, parent }];
  write(FOLDERS, next);
  return next;
}

/** Идентификаторы полки и всех вложенных в неё. */
export function folderTree(list: Folder[], id: string): string[] {
  const out = [id];
  for (const f of list) if (f.parent === id) out.push(...folderTree(list, f.id));
  return out;
}

export function removeFolder(list: Folder[], id: string): Folder[] {
  const gone = new Set(folderTree(list, id));
  const next = list.filter((f) => !gone.has(f.id));
  write(FOLDERS, next);
  return next;
}

/** Карточки удалённых полок остаются в библиотеке, но без полки. */
export function unfile(list: SavedCard[], folderIds: string[]): SavedCard[] {
  const set = new Set(folderIds);
  const next = list.map((c) => (c.folder && set.has(c.folder) ? { ...c, folder: undefined } : c));
  write(KEY, next);
  return next;
}

export function clearLibrary(): SavedCard[] {
  write(KEY, []);
  return [];
}

/** Полная замена данных: нужна для импорта резервной копии. */
export function replaceAll(cards: SavedCard[], folders: Folder[]): void {
  write(KEY, cards);
  write(FOLDERS, folders);
}

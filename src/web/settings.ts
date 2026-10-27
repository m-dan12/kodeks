import type { CardKind } from "../validate.js";
import monsterKit from "../../llm/kits/monster.md?raw";
import npcKit from "../../llm/kits/npc.md?raw";
import characterKit from "../../llm/kits/character.md?raw";

export const DEFAULT_KITS: Record<CardKind, string> = { monster: monsterKit, npc: npcKit, character: characterKit };

export type ExportMode = "print" | "screen";

export interface Settings {
  homebrew: boolean;
  exportMode: ExportMode;
  /** Имя файла латиницей: «Проклятие Страда» → proklyatie-strada.pdf */
  translit: boolean;
  /** Свои тексты инструкций; если нет, берётся стандартный. */
  prompts: Partial<Record<CardKind, string>>;
}

export const DEFAULT_SETTINGS: Settings = { homebrew: true, exportMode: "print", translit: true, prompts: {} };

const KEY = "dnd-cards.settings";

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...raw, prompts: { ...(raw.prompts ?? {}) } };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* хранилище недоступно */
  }
}

export const kitFor = (s: Settings, kind: CardKind): string => s.prompts[kind]?.trim() || DEFAULT_KITS[kind];

import { Document } from "@react-pdf/renderer";
import { pdf } from "@react-pdf/renderer";
import { registerFonts } from "../pdf/fonts.js";
import { buildStatblock } from "../pdf/statblock-model.js";
import { buildNpcCard } from "../pdf/npc-model.js";
import { StatblockDocument, StatblockPage } from "../pdf/Statblock.js";
import { NpcDocument, NpcPage } from "../pdf/NpcPage.js";
import { SCREEN_PAGE, setPrintMode, type PageFormat } from "../pdf/theme.js";
import type { ReactElement } from "react";
import { computeMonster } from "../rules/monster.js";
import { validateText } from "../validate.js";
import type { Monster, Npc } from "../types.js";
import type { ExportMode } from "./settings.js";
import type { SavedCard } from "./library.js";

// Шрифты лежат в assets/fonts и попадают в сборку (и в офлайн-кэш) как обычные файлы.
const fontUrls = import.meta.glob("../../assets/fonts/*.ttf", { query: "?url", import: "default", eager: true }) as Record<string, string>;
const urlOf = (name: string): string => {
  const hit = Object.entries(fontUrls).find(([path]) => path.endsWith(`/${name}`));
  if (!hit) throw new Error(`Нет файла шрифта ${name}`);
  return new URL(hit[1], window.location.href).href;
};

export async function monsterPdf(m: Monster): Promise<{ blob: Blob; warnings: string[] }> {
  registerFonts(urlOf);
  setPrintMode(false);
  const model = buildStatblock(m, computeMonster(m));
  const blob = await pdf(<StatblockDocument m={model} />).toBlob();
  return { blob, warnings: model.warnings };
}

export async function npcPdf(n: Npc): Promise<{ blob: Blob; warnings: string[] }> {
  registerFonts(urlOf);
  setPrintMode(false);
  const blob = await pdf(<NpcDocument m={buildNpcCard(n).model} />).toBlob();
  return { blob, warnings: [] };
}

/** Страницы в готовом PDF: у каждой в словаре стоит /Type /Page (но не /Pages). */
async function countPages(blob: Blob): Promise<number> {
  const text = new TextDecoder("latin1").decode(await blob.arrayBuffer());
  return Math.max(1, (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length);
}

type Prepared = { id: string; page: (size: PageFormat) => ReactElement };

function prepare(card: SavedCard): Prepared | null {
  const r = validateText(card.json);
  if (!r.ok) return null;
  if (r.kind === "monster") {
    const model = buildStatblock(r.data as Monster, computeMonster(r.data as Monster));
    return { id: card.id, page: (size) => <StatblockPage key={card.id} m={model} size={size} /> };
  }
  // персонаж игрока выгружается той же карточкой, что и НИП
  const model = buildNpcCard(r.data as unknown as Npc).model;
  return { id: card.id, page: (size) => <NpcPage key={card.id} m={model} size={size} /> };
}

export interface ExportResult {
  blob: Blob;
  /** Сколько страниц займёт каждое существо. */
  pages: Record<string, number>;
  /** Карточки, которые не прошли проверку и в PDF не попали. */
  skipped: string[];
}

/** Один PDF из нескольких существ. print: A4 чёрным по белому; screen: длинный лист на существо. */
export async function exportPdf(cards: SavedCard[], mode: ExportMode): Promise<ExportResult> {
  registerFonts(urlOf);
  setPrintMode(mode === "print");
  const size = mode === "print" ? "A4" : SCREEN_PAGE;
  const ready: Prepared[] = [];
  const skipped: string[] = [];
  for (const c of cards) {
    const p = prepare(c);
    if (p) ready.push(p);
    else skipped.push(c.id);
  }
  const pages: Record<string, number> = {};
  for (const p of ready) pages[p.id] = await countPages(await pdf(<Document>{p.page(size)}</Document>).toBlob());
  const blob = await pdf(<Document language="ru" title="Кодекс">{ready.map((p) => p.page(size))}</Document>).toBlob();
  setPrintMode(false);
  return { blob, pages, skipped };
}

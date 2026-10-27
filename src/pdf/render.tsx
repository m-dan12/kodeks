import { renderToBuffer } from "@react-pdf/renderer";
import { registerFonts } from "./fonts-node.js";
import { buildStatblock } from "./statblock-model.js";
import { buildNpcCard } from "./npc-model.js";
import { StatblockDocument } from "./Statblock.js";
import { NpcDocument } from "./NpcPage.js";
import { computeMonster } from "../rules/monster.js";
import type { Monster, Npc } from "../types.js";

export async function renderMonsterPdf(monster: Monster): Promise<{ pdf: Buffer; warnings: string[] }> {
  registerFonts();
  const derived = computeMonster(monster);
  const model = buildStatblock(monster, derived);
  const pdf = await renderToBuffer(<StatblockDocument m={model} />);
  return { pdf, warnings: model.warnings };
}

export async function renderNpcPdf(npc: Npc): Promise<{ pdf: Buffer; warnings: string[] }> {
  registerFonts();
  const { model } = buildNpcCard(npc);
  const pdf = await renderToBuffer(<NpcDocument m={model} />);
  return { pdf, warnings: [] };
}

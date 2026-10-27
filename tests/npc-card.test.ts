import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildNpcCard, substitute } from "../src/pdf/npc-model.js";
import { compute } from "../src/rules/calc.js";
import { renderNpcPdf } from "../src/pdf/render.js";
import type { Npc } from "../src/types.js";

const eldrik = JSON.parse(readFileSync("examples/eldrik.json", "utf8")) as Npc;

test("карточка NPC: показатели считаются из ядра", () => {
  const { model } = buildNpcCard(eldrik);
  assert.equal(model.level, 5);
  assert.equal(model.proficiency, "+3");
  assert.equal(model.ac, "18");
  assert.equal(model.hp, "40");
  assert.equal(model.hitDice, "3к10 + 2к6");
  assert.equal(model.classLine, "Воин 3 (Чемпион) / Волшебник 2");
  assert.equal(model.skills.length, 18);
  assert.equal(model.passive, 13);
});

test("подстановки в тексте умений", () => {
  const d = compute(eldrik);
  assert.equal(substitute("1d10+{level.fighter}", d, eldrik), "1к10+3");
  assert.equal(substitute("бонус {prof}, Инт {mod.int}", d, eldrik), "бонус 3, Инт +2");
  assert.equal(substitute("{level.cleric}", d, eldrik), "{level.cleric}");
});

test("PDF карточки NPC собирается", async () => {
  const { pdf } = await renderNpcPdf(eldrik);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
});

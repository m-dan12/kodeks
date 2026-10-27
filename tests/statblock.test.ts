import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeMonster } from "../src/rules/monster.js";
import { buildStatblock } from "../src/pdf/statblock-model.js";
import { renderMonsterPdf } from "../src/pdf/render.js";
import type { Monster } from "../src/types.js";

const owlbear = (): Monster => JSON.parse(readFileSync("examples/owlbear.json", "utf8"));

test("модель статблока: русские формулировки как в книге", () => {
  const m = owlbear();
  const model = buildStatblock(m, computeMonster(m));
  assert.equal(model.typeLine, "Большое чудовище, без мировоззрения");
  assert.equal(model.hpFormula, "7к10 + 21");
  assert.equal(model.xp, "700");
  const actions = model.sections.find((s) => s.title === "Действия")!;
  assert.equal(actions.entries[1].name, "Клюв");
  assert.equal(actions.entries[1].lead, "Рукопашная атака оружием:");
  assert.equal(actions.entries[1].text, "+7 к попаданию, досягаемость 5 фт., одна цель. Попадание: 10 (1к10 + 5) колющего урона.");
  assert.equal(actions.entries[2].text, "+7 к попаданию, досягаемость 5 фт., одна цель. Попадание: 14 (2к8 + 5) рубящего урона.");
  assert.ok(model.props.some((p) => p.label === "Чувства" && p.value === "тёмное зрение 60 фт., пассивная внимательность 13"));
  assert.equal(model.crCheck.status, "tolerable");
});

test("энергетический урон и спасбросок оформляются по-русски", () => {
  const m = owlbear();
  m.actions = [
    {
      kind: "save", id: "breath", name: "Огненное дыхание", area: "конус 15 фт.", save_ability: "dex",
      dc: { mode: "fixed", value: 13 }, damage: [{ dice: "6d6", type: "fire" }], on_success: "half",
      usage: { type: "recharge", recharge_min: 5 },
    },
  ];
  const model = buildStatblock(m, computeMonster(m));
  const e = model.sections.find((s) => s.title === "Действия")!.entries[0];
  assert.equal(e.name, "Огненное дыхание (перезарядка 5–6)");
  assert.equal(e.text, "Конус 15 фт. Спасбросок Ловкости Сл 13. Провал: 21 (6к6) урона огнём; при успехе вдвое меньше.");
});

test("PDF собирается: одна страница, шрифты встроены", async () => {
  const { pdf } = await renderMonsterPdf(owlbear());
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  const text = pdf.toString("latin1");
  assert.equal((text.match(/\/Type \/Page\b(?!s)/g) ?? []).length, 1);
  assert.ok(text.includes("OpenSans") && text.includes("PTSerif"));
  assert.ok(pdf.length > 20_000);
});

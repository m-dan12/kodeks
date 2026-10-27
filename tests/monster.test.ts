import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeMonster } from "../src/rules/monster.js";
import type { Monster } from "../src/types.js";

const owlbear = (): Monster => JSON.parse(readFileSync("examples/owlbear.json", "utf8"));

test("совомедведь SRD: цифры совпадают с книгой", () => {
  const d = computeMonster(owlbear());
  assert.equal(d.proficiency, 2);
  assert.equal(d.hpAverage, 59);
  assert.equal(d.hpFormula, "7d10 + 21");
  assert.equal(d.xp, 700);
  assert.equal(d.passivePerception, 13);
  assert.equal(d.initiative, 1);
  const beak = d.actions.find((a) => a.id === "beak")!;
  const claws = d.actions.find((a) => a.id === "claws")!;
  assert.equal(beak.toHit, 7);
  assert.equal(beak.damage[0].average, 10);
  assert.equal(beak.damage[0].formula, "1d10 + 5");
  assert.equal(claws.damage[0].average, 14);
  assert.equal(claws.damage[0].formula, "2d8 + 5");
  assert.equal(d.damagePerRound, 24);
});

test("опасность совомедведя: расчёт 2 против заявленной 3 допустим", () => {
  const { cr } = computeMonster(owlbear());
  assert.equal(cr.defensive, "1/2");
  assert.equal(cr.offensive, "4");
  assert.equal(cr.calculated, "2");
  assert.equal(cr.declared, "3");
  assert.equal(cr.status, "tolerable");
});

test("заведомо завышенная опасность ловится", () => {
  const m = owlbear();
  m.challenge_rating = "8";
  const { cr } = computeMonster(m);
  assert.equal(cr.status, "mismatch");
  assert.ok(cr.difference >= 2);
});

test("заведомо заниженная опасность тоже ловится", () => {
  const m = owlbear();
  m.challenge_rating = "1/2";
  assert.equal(computeMonster(m).cr.status, "mismatch");
});

test("битая ссылка мультиатаки даёт предупреждение", () => {
  const m = owlbear();
  if (m.actions![0].kind === "multiattack") m.actions![0].plan.push({ ref: "bite", count: 1 });
  assert.ok(computeMonster(m).warnings.some((w) => w.includes("bite")));
});

test("эффект с спасброском: Сл считается из характеристики", () => {
  const m = owlbear();
  m.actions = [
    {
      kind: "save", id: "breath", name: "Дыхание", save_ability: "dex",
      dc: { mode: "auto", ability: "con" },
      damage: [{ dice: "6d6", type: "fire" }], on_success: "half",
    },
  ];
  const d = computeMonster(m);
  const breath = d.actions[0];
  assert.equal(breath.dc, 8 + 2 + 3);
  assert.equal(breath.averageTotal, 21);
});

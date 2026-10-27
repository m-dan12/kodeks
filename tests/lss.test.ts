import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toLongStoryShort } from "../src/lss/export.js";
import { validateData } from "../src/validate.js";
import type { Character } from "../src/types.js";

const severin = JSON.parse(readFileSync("examples/severin.json", "utf8")) as Character;
const ref = JSON.parse(readFileSync("reference/lss-severin.json", "utf8"));
const refData = JSON.parse(ref.data);
const out = toLongStoryShort(severin, { now: new Date("2026-02-01T00:00:00Z") });
const data = JSON.parse(out.file.data as string);

test("карточка Северина проходит проверку по схеме", () => {
  const r = validateData(severin);
  assert.equal(r.ok, true, r.ok ? "" : r.report);
});

test("верхний уровень и набор ключей данных совпадают с эталоном LSS", () => {
  assert.deepEqual(Object.keys(out.file).sort(), Object.keys(ref).sort());
  const missing = Object.keys(refData).filter((k) => !(k in data));
  // avatar приложение не знает: портрет добавляют в LSS
  assert.deepEqual(missing, ["avatar"]);
});

test("расчёт совпадает с эталоном: хиты, КД, мастерство, скорость, кость хитов", () => {
  // В эталоне максимум хитов 14 (это значение 2 уровня: 8 + 6): лист не обновлён после повышения до 3 уровня
  // или хиты брошены. По среднему: 6+2 + 2×(4+2) = 20.
  assert.equal(data.vitality["hp-max"].value, 20);
  assert.equal(data.vitality.ac.value, refData.vitality.ac.value);
  assert.equal(data.proficiency, refData.proficiency);
  assert.equal(data.vitality.speed.value, refData.vitality.speed.value);
  assert.equal(data.vitality["hit-die"].value, refData.vitality["hit-die"].value);
  assert.equal(data.vitality["hp-dice-current"].value, refData.vitality["hp-dice-current"].value);
});

test("характеристики, спасброски и навыки совпадают с эталоном", () => {
  for (const a of ["str", "dex", "con", "int", "wis", "cha"]) {
    assert.equal(data.stats[a].score, refData.stats[a].score, a);
    assert.equal(data.saves[a].isProf, refData.saves[a].isProf, `save ${a}`);
  }
  for (const [k, v] of Object.entries<{ isProf?: number }>(refData.skills)) {
    assert.equal(data.skills[k]?.isProf, v.isProf, `skill ${k}`);
    assert.equal(data.skills[k]?.baseStat, (v as { baseStat: string }).baseStat, `skill ${k} baseStat`);
  }
});

test("ячейки заклинаний 3 уровня волшебника: 4 и 2", () => {
  assert.equal(data.spells["slots-1"].value, refData.spells["slots-1"].value);
  assert.equal(data.spells["slots-2"].value, refData.spells["slots-2"].value);
  assert.equal(data.spells["slots-3"], undefined);
});

test("оружие: кинжал из чернил +6 и 1к4+4 кол", () => {
  const dagger = data.weaponsList.find((w: { name: { value: string } }) => w.name.value === "Кинжал из чернил");
  const refDagger = refData.weaponsList.find((w: { name: { value: string } }) => w.name.value === "Кинжал из чернил");
  assert.equal(dagger.dmg.value, refDagger.dmg.value);
  assert.equal(dagger.mod.value, "+6");
  assert.equal(dagger.ability, "int");
});

test("особенности с ограничением превращаются в счётчики", () => {
  const names = Object.values<{ name: string; max: number }>(data.resources).map((r) => `${r.name}:${r.max}`);
  assert.ok(names.includes("Знамение:2"));
  assert.ok(names.includes("Везунчик:3"));
  assert.ok(names.includes("Магическое восстановление:1"));
});

test("известные заклинания привязываются к карточкам LSS по идентификатору", () => {
  const prepared = out.file.spells as { prepared: string[]; book: string[] };
  assert.ok(prepared.prepared.includes("65d3c169f3d820fa1add42cf"), "Чудо-ягоды");
  assert.ok(prepared.prepared.includes("65d3c16ff3d820fa1add46fe"), "Искусство друидов");
  assert.ok(prepared.prepared.includes("65d3c16af3d820fa1add42f9"), "Нанесение ран");
  assert.equal(new Set(prepared.book).size, prepared.book.length);
});

test("все заклинания примера найдены в каталоге LSS 2014", () => {
  const prepared = out.file.spells as { prepared: string[]; book: string[] };
  assert.equal(prepared.book.length, 6);
  assert.equal(out.warnings.some((w) => w.includes("Нет идентификатора")), false);
  assert.equal(data.text["notes-1"], undefined);
});

test("заклинание, которого нет в каталоге, уходит в текст и в предупреждение", () => {
  const c = structuredClone(severin);
  c.spellcasting![0].spells.push({ name: "Придуманное заклинание", level: 2, source: { type: "custom" } });
  const r = toLongStoryShort(c);
  const warn = r.warnings.find((w) => w.includes("Нет идентификатора"));
  assert.ok(warn?.includes("Придуманное заклинание"));
  assert.ok(JSON.parse(r.file.data as string).text["notes-1"]);
});

test("названия сопоставляются без учёта регистра и «ё»", () => {
  const c = structuredClone(severin);
  c.spellcasting![0].spells = [{ name: "ВОЛШЕБНАЯ СТРЕЛА", level: 1, source: { type: "official", book: "SRD 5.1" } }];
  const r = toLongStoryShort(c);
  assert.equal((r.file.spells as { book: string[] }).book.length, 1);
});

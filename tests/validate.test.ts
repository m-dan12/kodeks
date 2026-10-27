import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateData, validateText } from "../src/validate.js";

const load = (name: string) => JSON.parse(readFileSync(`examples/${name}.json`, "utf8"));

test("примеры из examples проходят проверку", () => {
  assert.equal(validateData(load("owlbear")).ok, true);
  assert.equal(validateData(load("eldrik")).ok, true);
});

test("JSON внутри Markdown-ограждения и текста извлекается", () => {
  const text = "Вот файл:\n```json\n" + JSON.stringify(load("owlbear")) + "\n```\nГотово!";
  assert.equal(validateText(text).ok, true);
});

test("не-JSON даёт понятную ошибку", () => {
  const r = validateText("просто текст без скобок");
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.report, /не найдена анкета/);
});

test("неизвестный kind", () => {
  const r = validateData({ kind: "dragon" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.issues[0].path, "kind");
});

test("лишнее поле, нет обязательного, неверный enum и кости", () => {
  const m = load("owlbear");
  delete m.alignment;
  m.size = "огромный";
  m.armor_class.extra = 1;
  m.actions[1].damage[0].dice = "1d10+5";
  const r = validateData(m);
  assert.equal(r.ok, false);
  if (r.ok) return;
  const report = r.report;
  assert.match(report, /нет обязательного поля «alignment»/);
  assert.match(report, /Поле «size»: значение "огромный" недопустимо/);
  assert.match(report, /Поле «armor_class»: лишнее поле «extra»/);
  assert.match(report, /Поле «actions\[1\]\.damage\[0\]\.dice»: .*неверный формат/);
});

test("официальный источник без книги отклоняется", () => {
  const m = load("owlbear");
  m.source = { type: "official" };
  const r = validateData(m);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.report, /нет обязательного поля «book»/);
});

test("неизвестный вид действия указан по имени", () => {
  const m = load("owlbear");
  m.actions[1].kind = "bite";
  const r = validateData(m);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.report, /actions\[1\]/);
});

test("per_rest требует times и rest", () => {
  const n = load("eldrik");
  n.features[1].usage = { type: "per_rest" };
  const r = validateData(n);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.report, /«times»/);
    assert.match(r.report, /«rest»/);
  }
});

test("для класса в origin обязателен class", () => {
  const n = load("eldrik");
  n.features[0].origin = { type: "class" };
  const r = validateData(n);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.report, /нет обязательного поля «class»/);
});

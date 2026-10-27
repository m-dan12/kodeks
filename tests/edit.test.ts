import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stringify } from "smol-toml";
import { validateData, validateText } from "../src/validate.js";
import { clean, getIn, setIn } from "../src/web/edit.js";

for (const name of ["eldrik", "owlbear", "severin", "ember-wyrm"]) {
  test(`правка ${name}: сохранённая в TOML модель снова проходит проверку и не меняется`, () => {
    const first = validateText(readFileSync(`examples/forms/${name}.toml`, "utf8"));
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const text = stringify(clean(first.data) as Record<string, unknown>);
    const second = validateText(text);
    assert.equal(second.ok, true, second.ok ? "" : second.report);
    if (second.ok) assert.deepEqual(JSON.parse(JSON.stringify(second.data)), JSON.parse(JSON.stringify(first.data)));
  });
}

test("setIn меняет значение по пути и не трогает исходник", () => {
  const src = { a: { b: [1, 2, 3] }, c: "x" };
  const next = setIn(src, ["a", "b", 1], 9);
  assert.deepEqual(getIn(next, ["a", "b"]), [1, 9, 3]);
  assert.deepEqual(src.a.b, [1, 2, 3]);
});

test("пустое значение убирает поле и пустую группу вокруг него", () => {
  const next = setIn({ senses: { darkvision: 60 }, name: "X" }, ["senses", "darkvision"], undefined);
  assert.deepEqual(next, { name: "X" });
});

test("правка имени и числа проходит проверку, а потеря обязательного поля даёт ошибку", () => {
  const first = validateText(readFileSync("examples/forms/owlbear.toml", "utf8"));
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const ok = validateData(clean(setIn(setIn(first.data, ["name"], "Мутант"), ["armor_class", "value"], 15)));
  assert.equal(ok.ok, true);
  const bad = validateData(clean(setIn(first.data, ["armor_class", "value"], undefined)));
  assert.equal(bad.ok, false);
});

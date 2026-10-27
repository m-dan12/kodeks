import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse as parseToml } from "smol-toml";
import { expandForm } from "../src/form/expand.js";
import { validateText } from "../src/validate.js";

const form = (name: string) => readFileSync(`examples/forms/${name}.toml`, "utf8");
const json = (name: string) => JSON.parse(readFileSync(`examples/${name}.json`, "utf8"));
const expanded = (name: string) => expandForm(parseToml(form(name))).data as Record<string, unknown>;

for (const name of ["eldrik", "owlbear", "severin", "ember-wyrm"]) {
  test(`анкета ${name}: TOML и тот же TOML в ограждении среди пояснений проходят проверку`, () => {
    assert.equal(validateText(form(name)).ok, true);
    assert.equal(validateText("```toml\n" + form(name) + "\n```").ok, true);
    assert.equal(validateText("Вот анкета:\n```toml\n" + form(name) + "\n```\nГотово").ok, true);
  });
}

test("анкета Эльдрика даёт те же классы, оружие, умения и защиту, что строгий JSON", () => {
  const a = expanded("eldrik");
  const b = json("eldrik");
  for (const key of ["classes", "abilities", "defense", "weapons", "features", "equipment", "skill_proficiencies", "speed"]) {
    assert.deepEqual(JSON.parse(JSON.stringify(a[key])), b[key], key);
  }
});

test("анкета совомедведя подбирает кости хитов по средним хитам", () => {
  assert.deepEqual(expanded("owlbear").hit_dice, { count: 7, die: 10 });
  assert.deepEqual(expanded("ember-wyrm").hit_dice, { count: 12, die: 10 });
});

test("мультиатака находит атаки по названию", () => {
  const actions = expanded("ember-wyrm").actions as { id?: string; plan?: { ref: string; count: number }[] }[];
  const plan = actions[0].plan!;
  assert.equal(plan[1].count, 2);
  assert.equal(actions.find((a) => a.id === plan[0].ref) !== undefined, true);
});

test("строгий JSON по-прежнему принимается", () => {
  assert.equal(validateText(JSON.stringify(json("eldrik"))).ok, true);
});

test("неизвестное оружие и неверная строка класса дают понятные ошибки", () => {
  const text = form("eldrik").replace('name = "Лёгкий арбалет"', 'name = "Волшебная дубина"').replace('"wizard 2"', '"маг-ниндзя"');
  const r = validateText(text);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.report, /classes\[1\]/);
  assert.match(r.report, /оружия «Волшебная дубина» нет в справочнике/);
});

test("неизвестный навык и неверное число характеристик", () => {
  const r = validateText(form("eldrik").replace('"athletics"', '"бег"').replace('"15 14 14 14 10 8"', '"15 14 14"'));
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.report, /навык «бег» неизвестен/);
  assert.match(r.report, /шестью целыми числами/);
});

test("заклинание вне справочника без уровня просит уровень", () => {
  const r = validateText(form("eldrik").replace('"Щит"', '"Заклинание из головы"'));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.report, /нет в справочнике Long Story Short, а уровень не указан/);
});

test("синтаксическая ошибка TOML называет формат и место", () => {
  const r = validateText('kind = "npc"\nname = Эльдрик\n');
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.report, /не корректный TOML/);
});

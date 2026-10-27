import { test } from "node:test";
import assert from "node:assert/strict";
import { duplicateCard, folderTree, type Folder, type SavedCard } from "../src/web/library.js";
import { slug } from "../src/web/slug.js";
import { errorLines } from "../src/web/errorLines.js";

const card = (id: string, name: string): SavedCard => ({ id, name, kind: "npc", json: `kind = "npc"\nname = "${name}"\n`, savedAt: 1 });

test("полки вкладываются: дерево собирает потомков", () => {
  const f: Folder[] = [
    { id: "a", name: "A" },
    { id: "b", name: "B", parent: "a" },
    { id: "c", name: "C", parent: "b" },
    { id: "d", name: "D" },
  ];
  assert.deepEqual(folderTree(f, "a").sort(), ["a", "b", "c"]);
  assert.deepEqual(folderTree(f, "d"), ["d"]);
});

test("копия карточки получает новое имя и правит имя внутри анкеты", () => {
  const list = [card("1", "Борин")];
  const once = duplicateCard(list, "1");
  assert.equal(once[0].name, "Борин (копия)");
  assert.match(once[0].json, /name = "Борин \(копия\)"/);
  const twice = duplicateCard(once, "1");
  assert.equal(twice[0].name, "Борин (копия 2)");
});

test("имя файла: кириллица превращается в латиницу", () => {
  assert.equal(slug("Проклятие Страда"), "proklyatie-strada");
  assert.equal(slug("Ёж & Щука!"), "ezh-shchuka");
  assert.equal(slug("???"), "kodeks");
});

test("строки с ошибкой находятся по названию поля", () => {
  const src = 'kind = "npc"\nname = "X"\nfoo = 1\n[roleplay]\nspeech = "a"';
  const marks = errorLines(src, [{ path: "", message: "лишнее поле «foo»: такого поля в схеме нет." }, { path: "roleplay.speech", message: "пусто" }]);
  assert.equal(marks.has(2), true);
  assert.equal(marks.has(4), true);
  assert.equal(marks.has(0), false);
});

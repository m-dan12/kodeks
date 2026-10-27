import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const kind of ["monster", "npc", "character"]) {
  test(`комплект для LLM (${kind}) собран полностью и целиком на TOML`, () => {
    const kit = readFileSync(`llm/kits/${kind}.md`, "utf8");
    assert.ok(!kit.includes("{{"), "остались неподставленные шаблоны");
    assert.ok(kit.includes(`kind = "${kind}"`), "в комплекте нет поля kind");
    assert.ok(kit.includes("```toml"), "в комплекте нет примера TOML");
    assert.ok(!/yaml|json schema|schema_version/i.test(kit), "в комплекте остались следы YAML или JSON-схемы");
    assert.ok(kit.includes("# Примеры"));
    assert.equal(kit.includes("## Справочник заклинаний"), kind !== "monster");
    assert.equal(kit.includes("| CR |"), kind === "monster");
  });
}

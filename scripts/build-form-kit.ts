/**
 * Комплекты для LLM в виде анкеты: llm/kits/{monster,npc,character}.md.
 * Короче JSON-комплектов: без схемы, только описание полей, справочник и живой пример.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateText, type CardKind } from "../src/validate.js";
import { ARMORS, WEAPONS } from "../src/form/gear.js";
import { crTable, read, root, spellsSection } from "./kit-parts.js";

interface Spec {
  kind: CardKind;
  what: string;
  output: string;
  doc: "person" | "monster";
  examples: { file: string; title: string }[];
}

const SPECS: Spec[] = [
  {
    kind: "monster",
    what: "статблок монстра для мастера",
    output: "PDF статблока",
    doc: "monster",
    examples: [
      { file: "owlbear", title: "Официальный монстр (SRD): совомедведь" },
      { file: "ember-wyrm", title: "Придуманный монстр с дыханием, реакцией и легендарными действиями" },
    ],
  },
  {
    kind: "npc",
    what: "NPC, собранный по классам (в том числе мультикласс)",
    output: "PDF карточки NPC",
    doc: "person",
    examples: [{ file: "eldrik", title: "NPC: воин 3 / волшебник 2" }],
  },
  {
    kind: "character",
    what: "бланк персонажа игрока",
    output: "файл для импорта в Long Story Short",
    doc: "person",
    examples: [{ file: "severin", title: "Персонаж игрока" }],
  },
];

const NPC_TAIL = `## Отыгрыш

\`[roleplay]\` — группа из четырёх коротких фраз: \`speech\` (манера речи), \`wants\` (чего хочет), \`hides\` (что скрывает), \`in_combat\` (как ведёт себя в бою).`;

const CHARACTER_TAIL = `## Характер и предыстория (обязательно)

Игрок может не знать правил или хотеть сосредоточиться на характере, поэтому механику выбираешь ты, а душу персонажу придумываешь вместе с игроком. Если игрок не назвал расу, класс, уровень (по умолчанию 1), идею персонажа или чего он хочет от игры, спроси одним сообщением, не больше пяти коротких вопросов.

\`[personality]\` — группа. Обязательны \`traits\` (черты), \`ideals\` (идеалы), \`bonds\` (привязанности), \`flaws\` (слабости), \`backstory\` (предыстория, 3–6 предложений с зацепками для мастера). Пиши живо и конкретно: по одному-два предложения на поле. Необязательны \`appearance\`, \`goals\` и список \`[[personality.relationships]]\` с полями \`name\`, \`relation\`.

\`[body]\` — группа строк: \`age\`, \`height\`, \`weight\`, \`eyes\`, \`skin\`, \`hair\`.

\`experience\` — очки опыта числом. Опусти, если нет причины задавать: возьмётся минимум для уровня.`;

function exampleText(file: string, kind: CardKind): string {
  const text = read("examples", "forms", `${file}.toml`).trim();
  const checked = validateText(text);
  if (!checked.ok || checked.kind !== kind) {
    throw new Error(`Пример ${file} не проходит проверку:
${checked.ok ? "" : checked.report}`);
  }
  return text;
}

function build(spec: Spec): string {
  const fill = (s: string, vars: Record<string, string>) => s.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);
  const syntax = read("llm", "form", "syntax-toml.md");
  const common = fill(read("llm", "form", "common.md"), {
    WHAT: spec.what,
    OUTPUT: spec.output,
    FORMAT: "TOML",
    FENCE: "toml",
    SYNTAX: syntax.trim(),
  });

  const person = spec.kind !== "monster";
  const doc =
    spec.doc === "monster"
      ? fill(read("llm", "form", "monster.md"), { CR_TABLE: crTable() })
      : fill(read("llm", "form", "person.md"), {
          ROLE_NAME: spec.kind === "npc" ? "NPC" : "персонажа игрока",
          KIND: spec.kind,
          ROLE_FIELD: spec.kind === "npc" ? "- `role` — роль одним-двумя словами, например «телохранитель»." : "- `player_name` — имя игрока, если известно.",
          CLASSES_NOTE:
            spec.kind === "npc"
              ? "Общий уровень — сумма. Первый класс стартовый. Подбирай уровень под роль: рядовой 1–3, ветеран 4–6, командир или мастер 7–10, легенда 11 и выше."
              : "Для персонажа игрока ровно один класс: мультиклассы пока не поддерживаются.",
          ARMORS: ARMORS.map((a) => a.name).join(", "),
          WEAPONS: WEAPONS.map((w) => w.name).join(", "),
          TAIL: spec.kind === "npc" ? NPC_TAIL : CHARACTER_TAIL,
          SPELLS: spellsSection(),
        });

  const examples = spec.examples
    .map((e) => `### ${e.title}\n\n\`\`\`toml\n${exampleText(e.file, spec.kind)}\n\`\`\``)
    .join("\n\n");

  void person;
  return [
    common.trim(),
    doc.trim(),
    `# Примеры\n\nЭти анкеты прошли проверку. Ориентируйся на их стиль и уровень детализации.\n\n${examples}`,
    `# Дальше\n\nСледующим сообщением придёт описание того, кого нужно создать. Отвечай одной анкетой в блоке \`\`\`toml по правилам выше.`,
  ]
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .concat("\n");
}

mkdirSync(join(root, "llm", "kits"), { recursive: true });
for (const spec of SPECS) {
  const text = build(spec);
  writeFileSync(join(root, "llm", "kits", `${spec.kind}.md`), text);
  console.log(`llm/kits/${spec.kind}.md: ${(text.length / 1024).toFixed(1)} КБ`);
}

import Ajv2020 from "ajv/dist/2020.js";
import type { ErrorObject } from "ajv";
import common from "../schema/common.schema.json";
import monster from "../schema/monster.schema.json";
import npc from "../schema/npc.schema.json";
import character from "../schema/character.schema.json";
import { parse as parseToml } from "smol-toml";
import { expandForm } from "./form/expand.js";

export type CardKind = "monster" | "npc" | "character";

export interface Issue {
  /** Путь к полю вида «actions[1].damage[0].dice»; пусто для корня. */
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; kind: CardKind; data: unknown }
  | { ok: false; kind?: CardKind; issues: Issue[]; report: string };

const ajv = new Ajv2020({ allErrors: true, discriminator: true, strict: true, strictRequired: false, verbose: true });
for (const schema of [common, monster, npc, character]) {
  ajv.addSchema(schema as Record<string, unknown>);
}
const validators = Object.fromEntries(
  (["monster", "npc", "character"] as const).map((kind) => [
    kind,
    ajv.getSchema(`https://dnd-cards.local/schema/${kind}.schema.json`)!,
  ]),
) as Record<CardKind, ReturnType<typeof ajv.compile>>;

/** Основной формат ответа модели: анкета TOML. Строгий JSON принимается только для старых сохранённых карточек. */
export type DocFormat = "json" | "toml";

function sniff(body: string): DocFormat {
  return body.startsWith("{") ? "json" : "toml";
}

/** Достаёт файл из вставки: убирает ограждения ``` и текст вокруг, определяет формат. */
export function extractDocument(text: string): { body: string; format: DocFormat; fenced: boolean } {
  const tagged: Record<string, DocFormat> = { json: "json", toml: "toml" };
  const blocks = [...text.matchAll(/```([a-z]*)[ \t]*\r?\n?([\s\S]*?)```/gi)];
  const block = blocks.find((b) => tagged[b[1].toLowerCase()]) ?? blocks[0];
  if (block) {
    const body = block[2].trim();
    return { body, format: tagged[block[1].toLowerCase()] ?? sniff(body), fenced: true };
  }
  const trimmed = text.trim();
  return { body: trimmed, format: sniff(trimmed), fenced: false };
}

/** Совместимость: текст файла без ограждений. */
export const extractJson = (text: string): string => extractDocument(text).body;

const FORMAT_NAME: Record<DocFormat, string> = { json: "JSON", toml: "TOML" };

function parseBody(body: string, format: DocFormat): unknown {
  return format === "json" ? JSON.parse(body) : parseToml(body);
}

const NOT_FOUND = "в ответе не найдена анкета. Ожидается блок ```toml с полем kind.";

const isRecord = (v: unknown): boolean => typeof v === "object" && v !== null && !Array.isArray(v);

export function parseDocument(text: string): { ok: true; data: unknown } | { ok: false; message: string } {
  const { body, format, fenced } = extractDocument(text);
  if (!fenced && format === "toml" && !/^\s*kind\s*=/m.test(body)) return { ok: false, message: NOT_FOUND };
  let error: string | undefined;
  try {
    const data = parseBody(body, format);
    if (isRecord(data)) return { ok: true, data };
  } catch (e) {
    error = `это не корректный ${FORMAT_NAME[format]} (${(e as Error).message.split("\n")[0]}). Проверьте синтаксис и пришлите анкету целиком.`;
  }
  if (!fenced) {
    // ответ без ограждения: JSON мог оказаться внутри обычного текста
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        const data = JSON.parse(body.slice(start, end + 1));
        if (isRecord(data)) return { ok: true, data };
      } catch {
        /* остаётся исходная ошибка */
      }
    }
  }
  return { ok: false, message: error ?? NOT_FOUND };
}

function toPath(instancePath: string): string {
  return instancePath
    .split("/")
    .filter(Boolean)
    .map((seg) => seg.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce((acc, seg) => (/^\d+$/.test(seg) ? `${acc}[${seg}]` : acc ? `${acc}.${seg}` : seg), "");
}

function shorten(value: unknown): string {
  const s = JSON.stringify(value);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}

function describe(err: ErrorObject): Issue | null {
  const path = toPath(err.instancePath);
  const p = err.params as Record<string, unknown>;
  const schema = err.parentSchema as { description?: string } | undefined;
  const hint = schema?.description ? ` Подсказка: ${schema.description}` : "";
  switch (err.keyword) {
    case "required":
      return { path, message: `нет обязательного поля «${p.missingProperty}».` };
    case "additionalProperties":
      return { path, message: `лишнее поле «${p.additionalProperty}»: такого поля в схеме нет. Уберите его или проверьте название.` };
    case "enum":
      return { path, message: `значение ${shorten(err.data)} недопустимо. Допустимо: ${(p.allowedValues as unknown[]).map((v) => JSON.stringify(v)).join(", ")}.` };
    case "const":
      return { path, message: `ожидается ровно ${shorten(p.allowedValue)}, получено ${shorten(err.data)}.` };
    case "type":
      return { path, message: `ожидается тип «${p.type}», получено ${shorten(err.data)}.` };
    case "minimum":
    case "maximum":
    case "exclusiveMinimum":
    case "exclusiveMaximum":
      return { path, message: `число ${shorten(err.data)} вне допустимого диапазона (${err.message}).` };
    case "multipleOf":
      return { path, message: `число ${shorten(err.data)} должно быть кратно ${p.multipleOf}.` };
    case "minItems":
      return { path, message: `в списке должно быть не меньше ${p.limit} элементов.` };
    case "uniqueItems":
      return { path, message: "в списке есть повторяющиеся элементы." };
    case "minLength":
      return { path, message: "пустая строка. Если текста нет, уберите поле." };
    case "pattern":
      return { path, message: `значение ${shorten(err.data)} имеет неверный формат.${hint}` };
    case "discriminator":
      return { path, message: `неизвестное значение поля «${p.tag}»: ${shorten(p.tagValue ?? err.data)}.` };
    case "oneOf":
    case "if":
      return null; // шум: настоящая причина придёт отдельной ошибкой
    default:
      return { path, message: err.message ?? `нарушено правило «${err.keyword}».` };
  }
}

export function formatReport(issues: Issue[]): string {
  const lines = issues.map((i, n) => `${n + 1}. ${i.path ? `Поле «${i.path}»: ` : ""}${i.message}`);
  return [
    `Файл не прошёл проверку: ${issues.length} ${plural(issues.length, "ошибка", "ошибки", "ошибок")}.`,
    "Исправьте их и пришлите анкету целиком, одним блоком ```toml, без пояснений.",
    "",
    ...lines,
  ].join("\n");
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function fail(issues: Issue[], kind?: CardKind): ValidationResult {
  return { ok: false, kind, issues, report: formatReport(issues) };
}

/** Проверяет текст: анкета TOML (в том числе внутри ответа модели с пояснениями). */
export function validateText(text: string): ValidationResult {
  const parsed = parseDocument(text);
  if (!parsed.ok) return fail([{ path: "", message: parsed.message }]);
  const expanded = expandForm(parsed.data);
  const result = validateData(expanded.data);
  if (expanded.issues.length === 0) return result;
  const k = (expanded.data as { kind?: unknown }).kind;
  const kind = k === "monster" || k === "npc" || k === "character" ? k : undefined;
  // ошибки разбора анкеты точнее: показываем их первыми, а остальные ошибки схемы по тем же полям отбрасываем
  const paths = expanded.issues.map((i) => i.path.replace(/\[\d+\]/g, ""));
  const rest = result.ok ? [] : result.issues.filter((i) => !paths.some((p) => i.path.replace(/\[\d+\]/g, "").startsWith(p.split(".")[0])));
  return fail([...expanded.issues, ...rest], kind);
}

export function validateData(data: unknown): ValidationResult {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return fail([{ path: "", message: "ожидается JSON-объект." }]);
  }
  const kind = (data as { kind?: unknown }).kind;
  if (kind !== "monster" && kind !== "npc" && kind !== "character") {
    return fail([{ path: "kind", message: `поле «kind» должно быть «monster», «npc» или «character», получено ${shorten(kind)}.` }]);
  }
  const validate = validators[kind];
  if (validate(data)) return { ok: true, kind, data };
  const seen = new Set<string>();
  const issues: Issue[] = [];
  for (const err of validate.errors ?? []) {
    const issue = describe(err);
    if (!issue) continue;
    const key = `${issue.path}|${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push(issue);
  }
  return fail(issues, kind);
}

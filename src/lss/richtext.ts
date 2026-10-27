/** Минимальные конструкторы документов ProseMirror/TipTap, как их хранит Long Story Short. */

export type PmNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PmNode[];
  marks?: { type: string }[];
  text?: string;
};

export type PmDoc = { type: "doc"; content: PmNode[] };

export const text = (value: string, marks: string[] = []): PmNode => ({
  type: "text",
  ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}),
  text: value,
});

export const paragraph = (...parts: (PmNode | string)[]): PmNode => {
  const content = parts.map((p) => (typeof p === "string" ? text(p) : p)).filter((p) => p.text !== "");
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
};

export const emptyParagraph = (): PmNode => ({ type: "paragraph" });

export const bulletList = (items: PmNode[][]): PmNode => ({
  type: "bulletList",
  content: items.map((content) => ({ type: "listItem", content })),
});

export const resource = (id: string, textName: string): PmNode => ({
  type: "resource",
  attrs: { id, textName },
});

export const doc = (...content: PmNode[]): PmDoc => ({
  type: "doc",
  content: content.length ? content : [emptyParagraph()],
});

/** Разбивает строку на абзацы по переводам строки. */
export const paragraphs = (value: string): PmNode[] =>
  value.split(/\r?\n/).map((line) => paragraph(line));

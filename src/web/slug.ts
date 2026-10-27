/** Имя файла латиницей, как в макете экспорта: «Проклятие Страда» → «proklyatie-strada». */
export function slug(text: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n",
    о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y",
    ь: "", э: "e", ю: "yu", я: "ya",
  };
  const out = [...text.toLowerCase()].map((ch) => map[ch] ?? ch).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return out || "kodeks";
}

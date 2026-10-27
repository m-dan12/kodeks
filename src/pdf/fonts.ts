import { Font } from "@react-pdf/renderer";

let registered = false;

/** Шрифты встроены в приложение, интернет не нужен. Обе гарнитуры под лицензией OFL и содержат кириллицу. */
/** `f` превращает имя файла шрифта в путь (Node) или URL (браузер). */
export function registerFonts(f: (name: string) => string): void {
  if (registered) return;
  registered = true;
  Font.register({
    family: "Open Sans",
    fonts: [
      { src: f("OpenSans_400Regular.ttf"), fontWeight: 400 },
      { src: f("OpenSans_400Regular_Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: f("OpenSans_600SemiBold.ttf"), fontWeight: 600 },
      { src: f("OpenSans_700Bold.ttf"), fontWeight: 700 },
      { src: f("OpenSans_700Bold_Italic.ttf"), fontWeight: 700, fontStyle: "italic" },
    ],
  });
  Font.register({
    family: "PT Serif",
    fonts: [
      { src: f("PTSerif_400Regular.ttf"), fontWeight: 400 },
      { src: f("PTSerif_400Regular_Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: f("PTSerif_700Bold.ttf"), fontWeight: 700 },
      { src: f("PTSerif_700Bold_Italic.ttf"), fontWeight: 700, fontStyle: "italic" },
    ],
  });
  // Переносов по слогам для русского у react-pdf нет: отключаем, чтобы слова не рвались.
  Font.registerHyphenationCallback((word) => [word]);
}

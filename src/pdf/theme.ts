/** Размеры на макете заданы в CSS-пикселях (96 на дюйм); в PDF единица — пункт, 1 px = 0,75 pt. */
export const px = (n: number): number => n * 0.75;

export const color = {
  ink: "#1f1f1f",
  muted: "#4d4d4d",
  soft: "#3a3a3a",
  line: "#8d8d8d",
  rule: "#2b2b2b",
  hairline: "#bdbdbd",
  fill: "#f3f3f3",
  accent: "#7a2230",
  dot: "#9a9a9a",
  white: "#ffffff",
};

export const font = {
  sans: "Open Sans",
  serif: "PT Serif",
};

/** A4 в пунктах. */
export const A4 = { width: 595.28, height: 841.89 };

/** Размер листа: A4 для печати или длинный лист для чтения с экрана. */
export type PageFormat = "A4" | { width: number; height?: number };
/** Без высоты: страница вытягивается ровно по содержимому и не делится. */
export const SCREEN_PAGE: PageFormat = { width: A4.width };

/** Чёрно-белая печать: акцентный цвет заголовков становится чёрным. Вызывается перед сборкой документа. */
export function setPrintMode(mono: boolean): void {
  color.accent = mono ? "#000000" : "#7a2230";
}

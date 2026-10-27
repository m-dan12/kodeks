/** Иконки «Кодекса». Контуры взяты из макета (viewBox 24, линия 1.6); окружности записаны дугами. */
const c = (cx: number, cy: number, r: number): string => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const rect = (x: number, y: number, w: number, h: number, r: number): string =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;

const PATHS = {
  d20: "M12 2l9 5v10l-9 5-9-5V7z M12 8l4 7H8z",
  user: `${c(12, 8, 3.5)} M5 20c0-4 3.2-6 7-6s7 2 7 6`,
  users: `${c(9, 8, 3)} M3 19c0-3 2.7-5 6-5s6 2 6 5 ${c(17, 9, 2.5)} M16.5 14.2c2.7.2 4.5 1.9 4.5 4.8`,
  skull: `M12 3a7 7 0 0 0-7 7c0 2.4 1.2 4.2 3 5.4V19h8v-3.6c1.8-1.2 3-3 3-5.4a7 7 0 0 0-7-7z ${c(9.5, 11, 1.2)} ${c(14.5, 11, 1.2)}`,
  character: `${c(12, 8, 3.5)} M5 20c0-4 3.2-6 7-6s7 2 7 6`,
  npc: `${c(9, 8, 3)} M3 19c0-3 2.7-5 6-5s6 2 6 5 ${c(17, 9, 2.5)} M16.5 14.2c2.7.2 4.5 1.9 4.5 4.8`,
  monster: `M12 3a7 7 0 0 0-7 7c0 2.4 1.2 4.2 3 5.4V19h8v-3.6c1.8-1.2 3-3 3-5.4a7 7 0 0 0-7-7z ${c(9.5, 11, 1.2)} ${c(14.5, 11, 1.2)}`,
  home: "M4 11l8-7 8 7v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z",
  lib: `${rect(3, 4, 4, 16, 1)} ${rect(9.5, 4, 4, 16, 1)} M15.5 6l3.3-.9 2.9 13.6-3.3.9z`,
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.9L12 3.5z",
  folder: "M3.5 7.5a2 2 0 0 1 2-2H9l2 2.5h7.5a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-10z",
  search: `${c(11, 11, 7)} M20 20l-3.5-3.5`,
  gear: `M4 7h10M18 7h2M4 17h2M10 17h10 ${c(16, 7, 2)} ${c(8, 17, 2)}`,
  arrow: "M5 12h14M13 6l6 6-6 6",
  chevron: "M6 9l6 6 6-6",
  right: "M9 6l6 6-6 6",
  back: "M19 12H5M11 6l-6 6 6 6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  checkcircle: `${c(12, 12, 9)} M8 12.5l3 3 5-6`,
  alert: `${c(12, 12, 9)} M12 7v6M12 16.5v.5`,
  copy: `${rect(8.5, 8.5, 11, 11, 2)} M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2`,
  paste: "M5 5h14v16H5z M9 3h6v4H9z",
  file: "M7 3h7l5 5v13H7z M14 3v5h5",
  share: "M12 15V4M8 8l4-4 4 4 M5 13v6h14v-6",
  download: "M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14",
  plus: "M12 5v14M5 12h14",
  book: "M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z M5 17a3 3 0 0 1 3-3h10",
  trash: "M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12",
  sort: "M7 5v14M4 16l3 3 3-3M17 19V5M14 8l3-3 3 3",
  list: "M5 7h14M5 12h14M5 17h14",
  grid: `${rect(4, 4, 7, 7, 1.5)} ${rect(13, 4, 7, 7, 1.5)} ${rect(4, 13, 7, 7, 1.5)} ${rect(13, 13, 7, 7, 1.5)}`,
  image: `${rect(4, 5, 16, 14, 2)} ${c(9, 10, 1.6)} M5 17l4.5-4.5 3 3 2.5-2.5L19 16`,
  print: "M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z",
  edit: "M4 20h4L19 9l-4-4L4 16z M13 7l4 4",
  min: "M5 12h14",
  max: "M6.5 6.5h11v11h-11z",
  x: "M6 6l12 12M18 6L6 18",
  dots: "M12 5.5h.01M12 12h.01M12 18.5h.01",
  shield: "M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, fill = false }: { name: IconName; size?: number; fill?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={name === "check" ? 2.2 : name === "dots" ? 3.6 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Знак «Кодекса» (вариант «Грани d20» из макета): шестигранник-кость с оранжевой гранью. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={{ color: "var(--ink)" }}>
      <path d="M32 5L54.5 18V44L32 57L9.5 44V18Z" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
      <path
        d="M32 15.4V5M32 15.4L54.5 18M32 15.4L9.5 18M45.5 38.8L54.5 18M45.5 38.8L54.5 44M45.5 38.8L32 57M18.5 38.8L32 57M18.5 38.8L9.5 44M18.5 38.8L9.5 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M32 15.4L45.5 38.8H18.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="var(--accent)" />
    </svg>
  );
}

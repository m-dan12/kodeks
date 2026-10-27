import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { APP_VERSION, REPO, cmpVersion, pickAsset, type ReleaseAsset } from "./version.js";

export interface Update {
  version: string;
  /** Установленная версия, с которой сравнивали. */
  current: string;
  notes: string;
  /** Страница релиза: запасной вариант, если файла для этой платформы нет. */
  page: string;
  /** Прямая ссылка на файл для этой платформы. */
  file?: string;
}

interface Bridge {
  openExternal?(url: string): void;
}
const desktop = (window as unknown as { codex?: Bridge }).codex;

/** Где можно обновиться сразу: Android-приложение или Windows-версия. Для браузера и PWA проверки нет: они обновляются сами. */
export const platform = (): "android" | "windows" | null =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android" ? "android" : desktop?.openExternal ? "windows" : null;

const SKIP_KEY = "dnd-cards.update.skip";
export const skipped = (): string => {
  try {
    return localStorage.getItem(SKIP_KEY) ?? "";
  } catch {
    return "";
  }
};
export const skipVersion = (v: string): void => {
  try {
    localStorage.setItem(SKIP_KEY, v);
  } catch {
    /* хранилище недоступно */
  }
};

/** Последний релиз на GitHub; null, если новее установленной версии ничего нет. Ошибка сети: исключение. */
export async function checkUpdate(current: string = APP_VERSION): Promise<Update | null> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub: ${res.status}`);
  const r = (await res.json()) as { tag_name: string; body?: string; html_url: string; assets?: ReleaseAsset[] };
  if (cmpVersion(r.tag_name, current) <= 0) return null;
  const p = platform();
  return {
    version: r.tag_name.replace(/^v/i, ""),
    current,
    notes: (r.body ?? "").trim(),
    page: r.html_url,
    file: p ? pickAsset(r.assets ?? [], p)?.browser_download_url : undefined,
  };
}

/** Скачать новую версию: на Android файл открывается в браузере и скачивается, дальше телефон предложит установить. */
export async function openUpdate(u: Update): Promise<void> {
  const url = u.file ?? u.page;
  if (desktop?.openExternal) desktop.openExternal(url);
  else if (Capacitor.isNativePlatform()) await Browser.open({ url });
  else window.open(url, "_blank", "noopener");
}

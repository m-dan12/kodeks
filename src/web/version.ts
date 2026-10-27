/** Версия приложения подставляется при сборке из package.json. */
declare const __APP_VERSION__: string;
export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";

/** Репозиторий, в релизах которого лежат новые сборки. */
export const REPO = "m-dan12/kodeks";

const parts = (v: string): number[] => v.replace(/^v/i, "").split("-")[0].split(".").map((x) => Number.parseInt(x, 10) || 0);

/** Больше нуля: a новее b; меньше нуля: старее; ноль: одинаковые. Сравнивает числа через точку: 0.10.0 новее 0.9.9. */
export function cmpVersion(a: string, b: string): number {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length, 3); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

/** Нужный файл релиза: apk для Android, zip для Windows. */
export function pickAsset(assets: ReleaseAsset[], platform: "android" | "windows"): ReleaseAsset | undefined {
  return assets.find((a) => (platform === "android" ? /\.apk$/i : /windows.*\.zip$|\.zip$/i).test(a.name));
}

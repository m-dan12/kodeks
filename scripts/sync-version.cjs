/**
 * Переносит версию из package.json в Android: versionName как есть, versionCode = мажор*10000 + минор*100 + патч.
 * Так каждая новая версия считается обновлением, и телефон ставит её поверх старой.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const { version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const [major = 0, minor = 0, patch = 0] = version.split(".").map((n) => Number.parseInt(n, 10) || 0);
const file = path.join(root, "android", "app", "build.gradle");
const next = fs
  .readFileSync(file, "utf8")
  .replace(/versionCode \d+/, `versionCode ${major * 10000 + minor * 100 + patch}`)
  .replace(/versionName "[^"]*"/, `versionName "${version}"`);
fs.writeFileSync(file, next);
console.log(`Android: версия ${version}`);

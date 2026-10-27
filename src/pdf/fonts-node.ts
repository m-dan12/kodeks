import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { registerFonts as register } from "./fonts.js";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "fonts");

export const registerFonts = (): void => register((name) => join(dir, name));

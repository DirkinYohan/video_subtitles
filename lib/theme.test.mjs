import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Pruebas de `lib/theme.ts` (el módulo real, transpilado). */
const here = dirname(fileURLToPath(import.meta.url));
const ts = await import("typescript").then((mod) => mod.default ?? mod);
const { outputText } = ts.transpileModule(readFileSync(join(here, "theme.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  fileName: "theme.ts",
});
const { isTheme, nextTheme, themeCookie, THEME_COOKIE } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

assert.equal(isTheme("light"), true);
assert.equal(isTheme("dark"), true);
assert.equal(isTheme("system"), false, "un valor desconocido no se aplica");
assert.equal(isTheme(undefined), false);
assert.equal(nextTheme("light"), "dark");
assert.equal(nextTheme("dark"), "light");
const cookie = themeCookie("dark");
assert.ok(cookie.startsWith(`${THEME_COOKIE}=dark;`));
assert.ok(cookie.includes("path=/") && cookie.includes("max-age=31536000") && cookie.includes("SameSite=Lax"));
console.log("theme ok — lib/theme.ts real verificado");

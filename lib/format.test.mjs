import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Pruebas de `lib/format.ts` (el módulo real, transpilado). */
const here = dirname(fileURLToPath(import.meta.url));
const ts = await import("typescript").then((mod) => mod.default ?? mod);
const { outputText } = ts.transpileModule(readFileSync(join(here, "format.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  fileName: "format.ts",
});
const { displayTitle, formatBytes } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

assert.equal(displayTitle("Rutinas_de_fin_de_semana.mp4"), "Rutinas de fin de semana");
assert.equal(displayTitle("Podcast semanal.MOV"), "Podcast semanal");
assert.equal(displayTitle("entrevista.final.mkv"), "entrevista.final", "sólo quita la extensión de medio");
assert.equal(displayTitle("informe.pdf"), "informe.pdf", "otras extensiones se respetan");
assert.equal(displayTitle("__.mp4"), "__.mp4", "si no queda nada, el original");
assert.equal(displayTitle("  varios   espacios  "), "varios espacios");

assert.equal(formatBytes(512), "512 B");
assert.equal(formatBytes(1536, "en"), "2 KB");
assert.equal(formatBytes(12.4 * 1024 * 1024, "en"), "12.4 MB");
assert.equal(formatBytes(12.4 * 1024 * 1024, "es"), "12,4 MB");
assert.equal(formatBytes(1.5 * 1024 ** 3, "en"), "1.5 GB");
console.log("format ok — lib/format.ts real verificado");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Pruebas de `lib/cues.ts`.
 *
 * El módulo es TypeScript, así que se transpila con el compilador de TypeScript
 * del proyecto y se importa el resultado: la prueba ejerce el CÓDIGO REAL, no
 * una copia de la implementación.
 */
const here = dirname(fileURLToPath(import.meta.url));

const ts = await import("typescript").then((mod) => mod.default ?? mod);
const source = readFileSync(join(here, "cues.ts"), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  fileName: "cues.ts",
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
const cues = await import(moduleUrl);

const { activeCue, normalizeCues, repairCues, cuesDuration, formatClock, formatMs, parseTimecode, rulerTicks } = cues;

// --- activeCue -------------------------------------------------------------
const track = [
  { index: 1, start_ms: 0, end_ms: 1200, text: "Hola", speaker: "", language: "es", state: "final" },
  { index: 2, start_ms: 1280, end_ms: 2400, text: "Adiós", speaker: "", language: "es", state: "final" },
];
assert.equal(activeCue(track, 100)?.text, "Hola");
assert.equal(activeCue(track, 1200), null, "el final es exclusivo");
assert.equal(activeCue(track, 1300)?.text, "Adiós");
assert.equal(activeCue(track, 99999), null);

// --- normalizeCues: ordena y renumera de forma contigua --------------------
const shuffled = [
  { index: 9, start_ms: 5000, end_ms: 6000, text: "c", speaker: "", language: "es", state: "final" },
  { index: 3, start_ms: 0, end_ms: 1000, text: "a", speaker: "", language: "es", state: "final" },
  { index: 7, start_ms: 2000, end_ms: 3000, text: "b", speaker: "", language: "es", state: "final" },
];
const ordered = normalizeCues(shuffled);
assert.deepEqual(ordered.map((cue) => cue.text), ["a", "b", "c"]);
assert.deepEqual(ordered.map((cue) => cue.index), [1, 2, 3]);
assert.equal(shuffled[0].index, 9, "no muta la entrada");

// --- repairCues: elimina solapamientos -------------------------------------
const overlapping = [
  { index: 1, start_ms: 0, end_ms: 2000, text: "a", speaker: "", language: "es", state: "final" },
  { index: 2, start_ms: 1500, end_ms: 3000, text: "b", speaker: "", language: "es", state: "final" },
];
const repaired = repairCues(overlapping);
assert.ok(repaired[0].end_ms <= repaired[1].start_ms, "sin solape tras reparar");
assert.ok(repaired[0].end_ms > repaired[0].start_ms, "duración positiva");
for (const cue of repaired) assert.ok(cue.end_ms > cue.start_ms);

// --- cuesDuration ----------------------------------------------------------
assert.equal(cuesDuration(track), 2400);
assert.equal(cuesDuration([]), 0);

// --- formatClock / formatMs ------------------------------------------------
assert.equal(formatClock(0), "00:00");
assert.equal(formatClock(65_000), "01:05");
assert.equal(formatClock(3_725_000), "1:02:05");
assert.equal(formatMs(65_432), "01:05.432");
assert.equal(formatMs(-5), "00:00.000");

// --- parseTimecode ---------------------------------------------------------
assert.equal(parseTimecode("01:05.432"), 65_432);
assert.equal(parseTimecode("1:02:05"), 3_725_000);
assert.equal(parseTimecode("12.5"), 12_500);
assert.equal(parseTimecode("01:05,432"), 65_432, "acepta coma decimal");
assert.equal(parseTimecode(""), null);
assert.equal(parseTimecode("nope"), null);
assert.equal(parseTimecode("1:2:3:4"), null);

// --- rulerTicks ------------------------------------------------------------
const ticks = rulerTicks(60_000);
assert.ok(ticks.length >= 2, "hay marcas");
assert.equal(ticks[0], 0);
assert.ok(ticks.every((tick, index) => index === 0 || tick > ticks[index - 1]), "marcas crecientes");
assert.deepEqual(rulerTicks(0), [0]);

console.log("cues ok — lib/cues.ts real verificado");

// --- appendCues / mergeServerTrack: sin duplicar ni perder cues ------------
{
  const { appendCues, mergeServerTrack } = cues;
  const mk = (start, end, text) => ({ index: 0, start_ms: start, end_ms: end, text, speaker: "", language: "es", state: "final" });
  const base = [mk(0, 1000, "a"), mk(1100, 2000, "b")];
  // El mismo lote dos veces (evento WS + recarga) no duplica.
  const once = appendCues(base, [mk(1100, 2000, "b"), mk(2100, 3000, "c")], "es");
  const twice = appendCues(once, [mk(2100, 3000, "c")], "es");
  assert.equal(twice.length, 3);
  assert.deepEqual(twice.map((c) => c.index), [1, 2, 3]);
  assert.equal(appendCues(base, [], "es"), base, "sin novedades conserva la referencia");
  // Una respuesta del servidor más antigua no borra cues llegados por WS.
  const local = [...base, mk(2100, 3000, "c"), mk(3100, 4000, "d")];
  const merged = mergeServerTrack([mk(0, 1000, "A"), mk(1100, 2000, "B")], local, "es");
  assert.deepEqual(merged.map((c) => c.text), ["A", "B", "c", "d"]);
  // Si el servidor ya los trae, no se repiten.
  const full = mergeServerTrack([mk(0, 1000, "A"), mk(1100, 2000, "B"), mk(2100, 3000, "C")], local, "es");
  assert.deepEqual(full.map((c) => c.text), ["A", "B", "C", "d"]);

  // El original y cada traducción llegan en EVENTOS SEPARADOS: cada pista
  // recibe solo lo suyo, sin mezclarse y conservando el orden temporal.
  const porIdioma = { en: [], es: [] };
  const lote = (lang, items) => {
    const nuevos = items.map(([s, e, t]) => ({
      index: 0, start_ms: s, end_ms: e, text: t, speaker: "", language: lang, state: "final",
    }));
    porIdioma[lang] = appendCues(porIdioma[lang], nuevos, lang);
  };
  lote("en", [[0, 1000, "hello"], [1100, 2000, "world"]]);
  lote("es", [[0, 1000, "hola"], [1100, 2000, "mundo"]]);
  lote("en", [[2100, 3000, "again"]]);
  lote("es", [[2100, 3000, "otra vez"]]);
  assert.deepEqual(porIdioma.en.map((c) => c.text), ["hello", "world", "again"]);
  assert.deepEqual(porIdioma.es.map((c) => c.text), ["hola", "mundo", "otra vez"]);
  assert.deepEqual(porIdioma.en.map((c) => c.index), [1, 2, 3], "indices contiguos por pista");
  assert.deepEqual(porIdioma.es.map((c) => c.index), [1, 2, 3], "indices contiguos por pista");
  // Un evento repetido (reconexion) no duplica la pista.
  lote("en", [[2100, 3000, "again"]]);
  assert.equal(porIdioma.en.length, 3, "la reconexion no duplica");
}

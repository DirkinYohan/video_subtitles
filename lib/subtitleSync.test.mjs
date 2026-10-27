import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Pruebas de `lib/subtitleSync.ts` (y de la fusión de pistas de `lib/cues.ts`).
 *
 * Se transpila el módulo REAL con TypeScript. El <video> es un doble que se
 * comporta como el del navegador: `currentTime`, `paused` y los eventos
 * `play`/`pause`/`seeking`/`seeked`/`timeupdate`. Los fotogramas los avanza la
 * prueba, así que los tiempos son exactos y deterministas.
 */
const here = dirname(fileURLToPath(import.meta.url));
const ts = await import("typescript").then((mod) => mod.default ?? mod);

async function load(file) {
  const source = readFileSync(join(here, file), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { SubtitleSync, findCueIndex, trackState, mergeCoverage, addRange, inRanges, needsSubtitleWait, isNewEvent } = await load("subtitleSync.ts");
const { appendCues, mergeServerTrack, normalizeCues } = await load("cues.ts");

// --- Dobles ----------------------------------------------------------------

class FakeVideo {
  currentTime = 0;
  paused = true;
  listeners = new Map();
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }
  emit(type) {
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn();
  }
  play() {
    this.paused = false;
    this.emit("play");
  }
  pause() {
    this.paused = true;
    this.emit("pause");
  }
  /** Salto en dos fases, como el navegador: `seeking` ya trae la posición. */
  seekStart(ms) {
    this.currentTime = ms / 1000;
    this.emit("seeking");
  }
  seekEnd() {
    this.emit("seeked");
  }
  seek(ms) {
    this.seekStart(ms);
    this.seekEnd();
  }
}

class ManualFrames {
  queue = new Map();
  next = 1;
  request(callback) {
    const id = this.next++;
    this.queue.set(id, callback);
    return id;
  }
  cancel(id) {
    this.queue.delete(id);
  }
  /** Ejecuta UN fotograma (los callbacks pendientes en ese momento). */
  frame() {
    const pending = [...this.queue.values()];
    this.queue.clear();
    for (const callback of pending) callback();
  }
}

/** Avanza la reproducción `ms` milisegundos en fotogramas de ~16 ms. */
function advance(video, frames, ms, step = 16) {
  let left = ms;
  while (left > 0) {
    const delta = Math.min(step, left);
    if (!video.paused) video.currentTime += delta / 1000;
    frames.frame();
    left -= delta;
  }
}

function setup(cues = [], { attach = true } = {}) {
  const video = new FakeVideo();
  const frames = new ManualFrames();
  const sync = new SubtitleSync(frames);
  const changes = [];
  sync.subscribe(() => changes.push(sync.getSnapshot()));
  sync.setCues(cues);
  if (attach) sync.attach(video);
  return { video, frames, sync, changes, text: () => sync.getSnapshot().cue?.text ?? null };
}

const mk = (language, start, end, text) => ({
  index: 0, start_ms: start, end_ms: end, text, speaker: "", language, state: "final",
});

// Pista de tiempos conocidos (ms del vídeo original) en tres idiomas.
const TIMES = [
  [1_000, 2_500, "one", "uno", "un"],
  [3_000, 4_000, "two", "dos", "deux"],
  [30_000, 32_000, "thirty", "treinta", "trente"],
  [300_000, 302_500, "five minutes", "cinco minutos", "cinq minutes"],
  [302_500, 304_000, "right after", "justo después", "juste après"],
];
const track = (language, column) =>
  normalizeCues(TIMES.map((row) => mk(language, row[0], row[1], row[column])), language);
const EN = track("en", 2);
const ES = track("es", 3);
const FR = track("fr", 4);

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

// --- findCueIndex: búsqueda binaria con intervalo [inicio, fin) -------------
test("findCueIndex respeta inicio inclusivo y fin exclusivo", () => {
  assert.equal(findCueIndex(ES, 0), -1);
  assert.equal(findCueIndex(ES, 1_000), 0);
  assert.equal(findCueIndex(ES, 2_499), 0);
  assert.equal(findCueIndex(ES, 2_500), -1, "fin exclusivo");
  assert.equal(findCueIndex(ES, 302_500), 4, "cues contiguos: manda el que empieza");
  assert.equal(findCueIndex([], 10), -1);
  const big = Array.from({ length: 50_000 }, (_, i) => mk("es", i * 1000, i * 1000 + 800, `c${i}`));
  assert.equal(findCueIndex(big, 36_000_500), 36_000, "10 h de vídeo");
  assert.equal(findCueIndex(big, 36_000_900), -1);
});

// 1. Reproducir desde el principio --------------------------------------------
test("1. reproduce desde el inicio y muestra cada cue en su instante", () => {
  const { video, frames, text } = setup(ES);
  assert.equal(text(), null);
  video.play();
  advance(video, frames, 992); // 0,992 s: todavía no
  assert.equal(text(), null);
  advance(video, frames, 16); // 1,008 s: aparece en el mismo fotograma
  assert.equal(text(), "uno");
  advance(video, frames, 1_488); // 2,496 s
  assert.equal(text(), "uno");
  advance(video, frames, 16); // 2,512 s: su intervalo terminó
  assert.equal(text(), null, "desaparece al terminar su intervalo");
  advance(video, frames, 500); // 3,012 s
  assert.equal(text(), "dos");
  advance(video, frames, 1_000);
  assert.equal(text(), null);
});

// 2. Adelantar de 0:30 a 5:00 -------------------------------------------------
test("2. adelantar del segundo 30 al minuto 5 muestra el cue del minuto 5", () => {
  const { video, frames, text } = setup(ES);
  video.seek(30_500);
  video.play();
  advance(video, frames, 100);
  assert.equal(text(), "treinta");
  video.seekStart(300_200);
  assert.equal(text(), "cinco minutos", "se actualiza al EMPEZAR el salto");
  video.seekEnd();
  advance(video, frames, 100);
  assert.equal(text(), "cinco minutos");
  advance(video, frames, 2_300); // 5:02.6 → siguiente cue
  assert.equal(text(), "justo después");
});

// 3. Retroceder de 5:00 a 0:30 ------------------------------------------------
test("3. retroceder del minuto 5 al segundo 30", () => {
  const { video, frames, text } = setup(ES);
  video.seek(300_100);
  video.play();
  advance(video, frames, 50);
  assert.equal(text(), "cinco minutos");
  video.seek(30_000);
  assert.equal(text(), "treinta");
  advance(video, frames, 1_000);
  assert.equal(text(), "treinta");
  advance(video, frames, 1_100);
  assert.equal(text(), null);
});

// 4. Saltos rápidos -----------------------------------------------------------
test("4. varios saltos rápidos no dejan subtítulos obsoletos", () => {
  const { video, frames, text } = setup(ES);
  video.play();
  advance(video, frames, 1_100);
  assert.equal(text(), "uno");
  // Fotograma pedido ANTES de los saltos y aún pendiente.
  for (const target of [30_100, 3_100, 301_000, 10_000, 31_500]) {
    video.seekStart(target);
  }
  // El navegador sólo confirma el último salto.
  video.seekEnd();
  frames.frame();
  assert.equal(text(), "treinta", "sólo cuenta la posición final");
  video.seek(10_000);
  frames.frame();
  assert.equal(text(), null, "zona sin diálogo: nada en pantalla");
});

// 5. Pausar y reanudar --------------------------------------------------------
test("5. pausar fija el subtítulo y reanudar continúa desde ese instante", () => {
  const { video, frames, text } = setup(ES);
  video.seek(29_900);
  video.play();
  advance(video, frames, 200); // 30,1 s
  assert.equal(text(), "treinta");
  video.pause();
  assert.equal(frames.queue.size, 0, "en pausa no se gastan fotogramas");
  frames.frame();
  frames.frame();
  assert.equal(text(), "treinta", "sigue con el fotograma detenido");
  video.play();
  advance(video, frames, 1_850); // 31,95 s
  assert.equal(text(), "treinta");
  advance(video, frames, 100); // 32,05 s
  assert.equal(text(), null);
});

// 6. Cambiar de idioma reproduciendo -----------------------------------------
test("6. cambiar entre idiomas durante la reproducción", () => {
  const { video, frames, sync, text } = setup(ES);
  video.seek(1_200);
  video.play();
  advance(video, frames, 50);
  assert.equal(text(), "uno");
  sync.setCues(EN);
  assert.equal(text(), "one", "inmediato, sin esperar al siguiente fotograma");
  assert.equal(sync.getSnapshot().cue.language, "en");
  sync.setCues(FR);
  assert.equal(text(), "un");
  advance(video, frames, 1_900); // 3,15 s
  assert.equal(text(), "deux", "conserva los tiempos del audio original");
});

// 7. Cambiar de idioma después de adelantar ----------------------------------
test("7. cambiar de idioma tras adelantar usa la posición NUEVA", () => {
  const { video, sync, text } = setup(ES);
  video.seek(30_500);
  assert.equal(text(), "treinta");
  video.seek(301_000);
  sync.setCues(FR);
  assert.equal(text(), "cinq minutes");
  sync.setCues(EN);
  assert.equal(text(), "five minutes");
});

// 8. Proyecto con subtítulos ya generados ------------------------------------
test("8. abrir un proyecto ya generado: el reproductor se engancha después", () => {
  const { video, sync, text } = setup(ES, { attach: false });
  video.currentTime = 3.5; // p. ej. posición restaurada al cargar
  sync.attach(video);
  assert.equal(text(), "dos", "se calcula al engancharse, sin esperar a play");
  sync.attach(null);
  assert.equal(video.listeners.get("seeking").size, 0, "desengancha todos los eventos");
});

// 9. Reproducir mientras se generan (en vivo o «Producir») --------------------
test("9. reproducir mientras llegan lotes nuevos (en vivo, por delante del cabezal)", () => {
  const first = normalizeCues(ES.slice(0, 2), "es");
  const { video, frames, sync, text } = setup(first);
  let ranges = addRange([], [0, 20_000]);
  video.seek(29_000);
  video.play();
  advance(video, frames, 1_200); // 30,2 s: aún sin lote
  assert.equal(text(), null);
  assert.equal(
    trackState({ cueCount: first.length, covered: inRanges(ranges, 30_200), generating: true, failed: false }),
    "processing",
    "el tramo se marca como pendiente, sin pausar el vídeo",
  );
  assert.equal(video.paused, false, "generar no bloquea la reproducción");
  // Llega el lote del tramo actual (con sus tiempos del vídeo original).
  sync.setCues(appendCues(first, ES.slice(2, 3).map((cue) => ({ ...cue })), "es"));
  ranges = addRange(ranges, [28_500, 40_500]);
  assert.equal(text(), "treinta", "aparece en cuanto llega su lote");
  assert.equal(
    trackState({ cueCount: 3, covered: inRanges(ranges, 30_200), generating: true, failed: false }),
    "ready",
  );
});

// 10. Pista vacía, incompleta o no disponible ---------------------------------
test("10. pista vacía, incompleta, fallida o inexistente", () => {
  const { video, sync, text } = setup([]);
  video.seek(1_500);
  assert.equal(text(), null, "pista vacía: nada, sin errores");
  sync.setCues(ES.slice(0, 1));
  assert.equal(text(), "uno");
  const base = { cueCount: 0, covered: false, generating: false, failed: false };
  assert.equal(trackState(base), "missing", "no se presenta como terminada");
  assert.equal(trackState({ ...base, generating: true }), "processing");
  assert.equal(trackState({ ...base, failed: true }), "failed");
  assert.equal(
    trackState({ ...base, cueCount: 2, covered: true, generating: true, failed: true }),
    "ready",
    "lo traducido antes del fallo sigue disponible",
  );
  assert.equal(trackState({ ...base, cueCount: 2 }), "ready");
});

// 12. Reconexión y respuestas tardías ----------------------------------------
test("12. reconexión y respuestas tardías: sin duplicados ni retrocesos", () => {
  // El mismo lote llega por WebSocket, por la reconexión y por la recarga HTTP.
  let es = appendCues([], ES.slice(0, 3), "es");
  es = appendCues(es, ES.slice(0, 3), "es");
  assert.equal(es.length, 3, "la reconexión no duplica");
  es = appendCues(es, ES.slice(3), "es");
  // Respuesta HTTP pedida antes de los últimos lotes que llega tarde.
  const merged = mergeServerTrack(ES.slice(0, 2), es, "es");
  assert.deepEqual(merged.map((cue) => cue.text), ES.map((cue) => cue.text), "no borra lo llegado por WS");
  assert.deepEqual(merged.map((cue) => cue.index), [1, 2, 3, 4, 5]);

  // La cobertura nunca retrocede con un evento repetido o tardío.
  let coverage = mergeCoverage({}, { en: 30_000 });
  coverage = mergeCoverage(coverage, { es: 15_000 });
  const same = mergeCoverage(coverage, { en: 20_000, es: 15_000 });
  assert.equal(same, coverage, "sin cambios conserva la referencia");
  assert.deepEqual(coverage, { en: 30_000, es: 15_000 });
});

test("tramos procesados en vivo: se fusionan y responden por instante", () => {
  let ranges = addRange([], [298_500, 304_500]);
  ranges = addRange(ranges, [0, 6_000]);
  ranges = addRange(ranges, [6_000, 18_000]);
  ranges = addRange(ranges, [304_500, 316_500]);
  assert.deepEqual(ranges, [[0, 18_000], [298_500, 316_500]]);
  assert.ok(inRanges(ranges, 300_000) && inRanges(ranges, 0));
  assert.ok(!inRanges(ranges, 18_000), "fin exclusivo");
  assert.ok(!inRanges(ranges, 100_000) && !inRanges(undefined, 5));
});

// --- Vídeo recién subido: generación progresiva --------------------------------
test("recién subido: el vídeo espera al primer subtítulo y no se adelanta a lo preparado", () => {
  // Simula el servidor: los lotes llegan mientras el vídeo intenta avanzar.
  const { video, frames, sync, text } = setup([]);
  let ranges = [];
  let cues = [];
  const wait = () =>
    needsSubtitleWait({
      enabled: true,
      captionsOn: true,
      forced: false,
      covered: inRanges(ranges, Math.round(video.currentTime * 1000)),
    });
  // El usuario pulsa Reproducir nada más subir: no hay nada preparado.
  assert.equal(wait(), true, "espera en vez de arrancar sin subtítulos");
  // Llega el primer lote (0–12 s) con sus tiempos del audio original.
  cues = appendCues(cues, ES.slice(0, 2), "es");
  ranges = addRange(ranges, [0, 12_000]);
  sync.setCues(cues);
  assert.equal(wait(), false, "arranca en cuanto existe lo mínimo");
  video.play();
  advance(video, frames, 1_100);
  assert.equal(text(), "uno", "el primer subtítulo aparece en su instante");
  // El vídeo alcanza el final de lo preparado: debe esperar otra vez.
  video.currentTime = 12.0;
  assert.equal(wait(), true, "no avanza por delante de los segmentos");
  ranges = addRange(ranges, [12_000, 36_000]);
  cues = appendCues(cues, ES.slice(2, 3), "es");
  sync.setCues(cues);
  assert.equal(wait(), false, "se retoma al llegar el siguiente lote");
  video.seek(30_500);
  assert.equal(text(), "treinta");
  // Sin subtítulos visibles, o agotada la espera máxima, no se espera.
  video.currentTime = 200;
  assert.equal(needsSubtitleWait({ enabled: true, captionsOn: false, forced: false, covered: false }), false);
  assert.equal(needsSubtitleWait({ enabled: true, captionsOn: true, forced: true, covered: false }), false);
  assert.equal(needsSubtitleWait({ enabled: false, captionsOn: true, forced: false, covered: false }), false);
});

test("reconexión: la instantánea y los eventos repetidos no duplican ni desordenan", () => {
  // Antes de cortarse llegaron los eventos 1..3; al reconectar llega una
  // instantánea con seq=5 (incluye todo) y después eventos 4..6.
  let last = -1;
  const applied = [];
  let track = [];
  const apply = (seq, cues) => {
    if (!isNewEvent(last, seq)) return;
    last = seq;
    applied.push(seq);
    track = appendCues(track, cues, "es");
  };
  apply(1, ES.slice(0, 1));
  apply(2, ES.slice(1, 2));
  apply(3, ES.slice(2, 3));
  // Instantánea tras reconectar: todo lo generado (también lo ya aplicado).
  last = 5;
  track = appendCues(track, ES, "es");
  apply(4, ES.slice(3, 4)); // ya incluido en la instantánea
  apply(5, ES.slice(3, 4));
  apply(6, ES.slice(4, 5));
  assert.deepEqual(applied, [1, 2, 3, 6], "lo anterior a la instantánea se ignora; lo posterior se aplica");
  assert.equal(track.length, ES.length, "sin duplicados");
  assert.deepEqual(track.map((c) => c.start_ms), ES.map((c) => c.start_ms), "en orden");
  assert.equal(isNewEvent(5, undefined), true, "eventos sin número se aceptan");
});

test("sólo notifica cuando cambia el subtítulo visible", () => {
  const { video, frames, changes } = setup(ES);
  video.play();
  advance(video, frames, 5_000);
  // null→uno→null→dos→null: 4 cambios en 300 fotogramas.
  assert.equal(changes.length, 4);
});

console.log(`subtitleSync ok — ${passed} casos sobre lib/subtitleSync.ts real`);

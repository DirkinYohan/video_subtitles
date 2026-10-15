import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Pruebas de `lib/status.ts` y del contrato de tipos con el backend.
 * Se transpila el módulo real con TypeScript, no se copia la implementación.
 */
const here = dirname(fileURLToPath(import.meta.url));
const ts = await import("typescript").then((mod) => mod.default ?? mod);

async function loadTypeScriptModule(file) {
  const source = readFileSync(join(here, file), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  });
  const url = `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
  return import(url);
}

const status = await loadTypeScriptModule("status.ts");
const { statusKey, statusTone, isActive, isDone, isFailed } = status;

// --- statusKey cubre TODOS los estados que emite el backend ---------------
const BACKEND_STATUSES = [
  "PENDING",
  "QUEUED",
  "PROCESSING",
  "TRANSCRIBING",
  "TRANSLATING",
  "GENERATING_SUBTITLES",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "SUCCESS",
  "PARTIAL",
];
for (const value of BACKEND_STATUSES) {
  const key = statusKey(value);
  assert.equal(key, `status.${value}`, `mapeo inesperado para ${value}`);
  assert.ok(statusTone(value), `sin tono para ${value}`);
}
assert.equal(statusKey("DESCONOCIDO"), "status.PENDING", "estado desconocido cae al valor por defecto");

// --- clasificación de estados ---------------------------------------------
for (const value of ["COMPLETED", "SUCCESS", "PARTIAL"]) {
  assert.ok(isDone(value), `${value} debe ser terminal correcto`);
  assert.ok(!isActive(value), `${value} no debe estar activo`);
}
for (const value of ["FAILED", "CANCELLED"]) {
  assert.ok(isFailed(value), `${value} debe ser fallo`);
  assert.ok(!isActive(value), `${value} no debe estar activo`);
}
for (const value of ["PENDING", "QUEUED", "PROCESSING", "TRANSCRIBING", "TRANSLATING", "GENERATING_SUBTITLES"]) {
  assert.ok(isActive(value), `${value} debe estar activo`);
  assert.ok(!isDone(value) && !isFailed(value), `${value} no debe ser terminal`);
}

// --- tonos ----------------------------------------------------------------
assert.equal(statusTone("COMPLETED"), "ok");
assert.equal(statusTone("FAILED"), "danger");
assert.equal(statusTone("PARTIAL"), "warn");
assert.equal(statusTone("PROCESSING"), "neutral");

// --- las etapas que reporta el backend tienen traducción ------------------
const es = JSON.parse(readFileSync(join(here, "..", "i18n", "es", "common.json"), "utf8"));
const en = JSON.parse(readFileSync(join(here, "..", "i18n", "en", "common.json"), "utf8"));
const BACKEND_STAGES = [
  "PENDING", "QUEUED", "PREPARING", "MEDIA_PREP", "VAD", "LID", "ASR", "TIMESTAMPS",
  "DIARIZATION", "ALIGNMENT", "QUALITY", "VALIDATION", "METRICS", "OUTPUT",
  "TRANSLATING", "GENERATING_SUBTITLES", "COMPLETED", "PARTIAL", "FAILED", "CANCELLED",
];
const STAGE_STEP_KEYS = [
  "job.preparing", "job.audio", "job.language", "job.vad", "job.transcribing",
  "job.diarizing", "job.aligning", "job.quality", "job.validating", "job.translating",
  "job.subtitles", "job.done",
];
for (const key of STAGE_STEP_KEYS) {
  assert.ok(key in es, `falta ${key} en es`);
  assert.ok(key in en, `falta ${key} en en`);
}
assert.ok(BACKEND_STAGES.length >= 20, "catálogo de etapas presente");

// --- mensajes de error del cliente HTTP ----------------------------------
const errorKeys = [
  "error.generic", "error.offline", "error.unauthorized", "error.forbidden",
  "error.notFound", "error.conflict", "error.tooLarge", "error.invalid",
  "error.tooMany", "error.server",
];
for (const key of errorKeys) {
  assert.ok(key in es && key in en, `falta ${key}`);
}

console.log("status ok — estados, etapas y errores verificados");

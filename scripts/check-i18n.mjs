#!/usr/bin/env node
/**
 * Verifica la coherencia de i18n:
 *  - mismas claves en es y en
 *  - sin claves duplicadas en el JSON (JSON.parse las perdería en silencio)
 *  - sin claves declaradas y nunca usadas (muertas)
 *  - sin claves usadas y no declaradas (faltantes)
 *
 * Salida: exit 0 si todo está correcto; exit 1 con el detalle si no.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "public"]);

/** Detecta claves duplicadas conservando el orden de aparición. */
function duplicateKeys(source) {
  const seen = new Map();
  const duplicates = [];
  const pattern = /^\s*"([^"]+)"\s*:/gm;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const key = match[1];
    if (seen.has(key)) duplicates.push(key);
    else seen.set(key, true);
  }
  return duplicates;
}

function loadLocale(locale) {
  const path = join(ROOT, "i18n", locale, "common.json");
  const source = readFileSync(path, "utf8");
  const duplicates = duplicateKeys(source);
  const data = JSON.parse(source);
  return { path, keys: Object.keys(data), data, duplicates };
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs|js|jsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function collectUsedKeys() {
  // `status.ts` resuelve las claves dinámicamente mediante `statusKey()`:
  // escanearlo daría por usada la cadena "status." sin sufijo.
  const files = walk(ROOT).filter(
    (file) => !file.endsWith("i18n-keys.test.mjs") && !file.endsWith("status.ts"),
  );
  const used = new Map();
  const patterns = [
    // `t("clave")` — sin exigir el cierre para tolerar `t("clave", vars)`.
    /\bt\(\s*"([^"]+)"/g,
    /\btranslate\(\s*[^,]+,\s*"([^"]+)"/g,
    // `status.` + al menos otro segmento: evita capturar extensiones de archivo.
    /"((?:status|job|player|editor|studio|projects|account|auth|error|timeline|home|nav|app|project|lang|user|a11y|upload|settings)\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+)"/g,
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(source)) !== null) {
        if (match[1]) used.set(match[1], file);
      }
    }
  }
  return used;
}

const problems = [];
const es = loadLocale("es");
const en = loadLocale("en");

for (const locale of [es, en]) {
  if (locale.duplicates.length > 0) {
    problems.push(`CLAVES DUPLICADAS en ${locale.path}: ${[...new Set(locale.duplicates)].join(", ")}`);
  }
}

const esSet = new Set(es.keys);
const enSet = new Set(en.keys);
const onlyEs = es.keys.filter((key) => !enSet.has(key));
const onlyEn = en.keys.filter((key) => !esSet.has(key));
if (onlyEs.length) problems.push(`SÓLO en es: ${onlyEs.join(", ")}`);
if (onlyEn.length) problems.push(`SÓLO en en: ${onlyEn.join(", ")}`);

const used = collectUsedKeys();
// Claves resueltas dinámicamente en tiempo de ejecución, no como literal:
//   status.* -> statusKey()       lang.*   -> languageLabel()
//   error.*  -> errorMessageKey() job.*    -> lista de pasos de JobStatus
//   studio.size* -> AccountPanel elige por índice (SIZE_KEYS)
const RUNTIME_PREFIXES = ["status.", "lang.", "error.", "job.", "studio.size"];
const dead = es.keys.filter(
  (key) => !used.has(key) && !RUNTIME_PREFIXES.some((prefix) => key.startsWith(prefix)),
);
if (dead.length) problems.push(`CLAVES MUERTAS (${dead.length}): ${dead.join(", ")}`);

// El patrón de claves literales ignora las que llegan por parámetro,
// así que "clave" (nombre de variable) no debe contar como clave real.
used.delete("clave");

const missing = [...used.keys()].filter((key) => !esSet.has(key));
if (missing.length) problems.push(`CLAVES USADAS NO DECLARADAS (${missing.length}): ${missing.join(", ")}`);

const total = es.keys.length;
if (problems.length === 0) {
  console.log(`i18n ok — ${total} claves en es/en, ${used.size} usadas, 0 muertas, 0 duplicadas`);
  process.exit(0);
}
console.error("i18n FALLO:");
for (const problem of problems) console.error(`  - ${problem}`);
process.exit(1);

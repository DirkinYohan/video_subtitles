import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "i18n");
const es = JSON.parse(readFileSync(join(root, "es", "common.json"), "utf8"));
const en = JSON.parse(readFileSync(join(root, "en", "common.json"), "utf8"));
const esKeys = Object.keys(es).sort();
const enKeys = Object.keys(en).sort();
if (esKeys.join("\n") !== enKeys.join("\n")) {
  throw new Error("claves i18n distintas");
}
for (const key of esKeys) {
  if (!String(es[key]).trim() || !String(en[key]).trim()) throw new Error(`clave vacía: ${key}`);
}
console.log("i18n ok");

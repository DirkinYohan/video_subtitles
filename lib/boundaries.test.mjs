import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");
const SKIP = new Set(["node_modules", ".next", ".git", "public", "scripts"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const sources = new Map(files.map((file) => [file, readFileSync(file, "utf8")]));

function resolveImport(fromFile, specifier) {
  let base;
  if (specifier.startsWith("@/")) base = join(ROOT, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(fromFile), specifier);
  else return null;
  for (const candidate of [`${base}.tsx`, `${base}.ts`, join(base, "index.tsx"), join(base, "index.ts")]) {
    if (sources.has(candidate)) return candidate;
  }
  return null;
}

function isClientModule(file) {
  return /^\s*["']use client["']/.test(sources.get(file) ?? "");
}

function serverComponent(file) {
  return file.endsWith(".tsx") && !isClientModule(file);
}

const problems = [];

for (const file of files) {
  if (!serverComponent(file)) continue;
  const source = sources.get(file);

  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)) {
    const names = match[1]
      .split(",")
      .map((part) => part.trim().split(/\s+as\s+/)[0]?.trim())
      .filter(Boolean);
    const target = resolveImport(file, match[2]);
    if (!target || !isClientModule(target)) continue;

    for (const name of names) {
      const called = new RegExp(`\\b${name}\\s*\\(`).test(
        source.replace(new RegExp(`import\\s*\\{[^}]*\\}\\s*from\\s*["']${match[2].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "g"), ""),
      );
      if (called) {
        problems.push(
          `${file.replace(ROOT + "\\", "")}: llama a ${name}() importado del módulo cliente ` +
            `${target.replace(ROOT + "\\", "")} — la página quedará en blanco`,
        );
      }
    }
  }
}

const classesPath = join(ROOT, "components", "classes.ts");
assert.ok(sources.has(classesPath), "falta components/classes.ts");
assert.ok(
  !isClientModule(classesPath),
  'components/classes.ts no puede llevar "use client": los Server Components lo importan',
);
assert.match(sources.get(classesPath), /export function buttonClass/, "debe exportar buttonClass");

const homePath = join(ROOT, "app", "page.tsx");
const home = sources.get(homePath);
assert.ok(home, "falta app/page.tsx");
assert.ok(!isClientModule(homePath), "app/page.tsx debe seguir siendo Server Component");
assert.match(
  home,
  /from ["']@\/components\/classes["']/,
  "app/page.tsx debe importar buttonClass de components/classes (no de components/ui)",
);

if (problems.length > 0) {
  console.error("frontera servidor/cliente FALLO:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`boundaries ok — ${files.length} archivos revisados, frontera servidor/cliente respetada`);

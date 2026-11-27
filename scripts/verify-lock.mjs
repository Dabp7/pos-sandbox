import { readFile } from "node:fs/promises";

const lockPath = process.argv[2] ?? "package-lock.json";
const lock = JSON.parse(await readFile(lockPath, "utf8"));
if (lock.lockfileVersion !== 3 || !lock.packages) {
  throw new Error("Se requiere un lockfile npm v3 con el árbol completo.");
}
const entries = Object.entries(lock.packages);
const missing = new Set();
let checked = 0;
for (const [, parent] of entries) {
  for (const [name, wanted] of Object.entries(parent.optionalDependencies ?? {})) {
    checked++;
    const candidates = entries.filter(([path]) =>
      path.endsWith(`/node_modules/${name}`) || path === `node_modules/${name}`,
    );
    const exact = /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(wanted);
    if (!candidates.some(([, dependency]) => !exact || dependency.version === wanted)) {
      missing.add(`${name}@${wanted}`);
    }
  }
}
for (const [name, version] of [["expo", "58.0.26"], ["expo-modules-core", "58.1.0"], ["react", "19.3.0"], ["react-dom", "19.3.0"]]) {
  const copies = entries.filter(([path]) => path.endsWith(`/node_modules/${name}`) || path === `node_modules/${name}`);
  if (!copies.length || copies.some(([, dependency]) => dependency.version !== version)) {
    throw new Error(`El lock debe conservar únicamente ${name}@${version}.`);
  }
}
if (missing.size) {
  console.error(`El lock omite ${missing.size} dependencias opcionales de plataformas:`);
  console.error([...missing].sort().join("\n"));
  console.error("Regenerar desde manifests en un directorio vacío, sin node_modules ni lock previo, incluyendo optional dependencies.");
  process.exit(1);
}
console.log(`Lock portable: ${checked} referencias opcionales completas y pins nativos conservados.`);

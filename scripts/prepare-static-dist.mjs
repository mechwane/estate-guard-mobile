import { cp, mkdir, rm, stat, copyFile, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicOutput = path.join(root, ".output", "public");
const distOutput = path.join(root, "dist");

async function existsDirectory(dir) {
  try {
    return (await stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

if (!(await existsDirectory(publicOutput))) {
  throw new Error(`Missing build output: ${publicOutput}`);
}

await rm(distOutput, { recursive: true, force: true });
await mkdir(distOutput, { recursive: true });
await cp(publicOutput, distOutput, { recursive: true, force: true });

const indexFile = path.join(distOutput, "index.html");
if (!existsSync(indexFile)) {
  const shellFile = path.join(distOutput, "_shell.html");
  if (!existsSync(shellFile)) {
    throw new Error("Missing SPA shell: expected dist/index.html or dist/_shell.html");
  }
  await copyFile(shellFile, indexFile);
}

const html = await readFile(indexFile, "utf8");
if (!html.includes("<script") || !html.includes("/assets/")) {
  throw new Error("Built SPA shell is missing its asset scripts");
}

await Promise.all([
  writeFile(path.join(distOutput, "404.html"), html),
  writeFile(path.join(distOutput, "200.html"), html),
]);

console.log("Prepared dist with current SPA shell and deep-link fallbacks.");
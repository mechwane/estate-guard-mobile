import { cp, mkdir, rm, stat, copyFile, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicOutput = path.join(root, ".output", "public");
const distOutput = path.join(root, "dist");
const routesDir = path.join(root, "src", "routes");

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

await copyFile(indexFile, path.join(publicOutput, "index.html"));

async function routeFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return routeFiles(fullPath);
      return entry.isFile() && /\.[jt]sx?$/.test(entry.name) ? [fullPath] : [];
    }),
  );
  return files.flat();
}

async function concreteRoutePaths() {
  const files = await routeFiles(routesDir);
  const paths = new Set(["/"]);

  await Promise.all(
    files.map(async (file) => {
      const source = await readFile(file, "utf8");
      const matches = source.matchAll(/createFileRoute\(\s*["'`]([^"'`]+)["'`]\s*\)/g);
      for (const match of matches) {
        const routePath = match[1].replace(/\/$/, "") || "/";
        if (routePath.includes("$")) continue;
        paths.add(routePath);
      }
    }),
  );

  return [...paths].sort();
}

async function writeRouteFallback(outputRoot, routePath) {
  if (routePath === "/") return;
  const outputDir = path.join(outputRoot, routePath.replace(/^\//, ""));
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "index.html"), html);
}

async function writeFallbackFiles(outputRoot) {
  await Promise.all([
    writeFile(path.join(outputRoot, "404.html"), html),
    writeFile(path.join(outputRoot, "200.html"), html),
    ...routes.map((routePath) => writeRouteFallback(outputRoot, routePath)),
  ]);
}

const routes = await concreteRoutePaths();

await Promise.all([writeFallbackFiles(distOutput), writeFallbackFiles(publicOutput)]);

console.log(
  `Prepared dist and .output/public with current SPA shell and ${routes.length} route fallbacks.`,
);

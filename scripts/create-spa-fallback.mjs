import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const distDir = "dist";
const assetsDir = join(distDir, "assets");

if (!existsSync(assetsDir)) {
  throw new Error("dist/assets is missing; run the Vite build before creating the SPA fallback.");
}

const assets = readdirSync(assetsDir);
const entryScript = assets.find((file) => /^index-[\w-]+\.js$/.test(file));
const stylesheet = assets.find((file) => /^styles-[\w-]+\.css$/.test(file));

if (!entryScript) {
  throw new Error("Could not find the generated client entry script in dist/assets.");
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#2C6E63" />
    <title>Estate Guard — Estate operations, simplified</title>
    <meta name="description" content="Estate Guard is a premium estate management app for residents, guards, and administrators." />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
    <link rel="manifest" href="/site.webmanifest" />
    ${stylesheet ? `<link rel="stylesheet" href="/assets/${stylesheet}" />` : ""}
    <script type="module" async src="/assets/${entryScript}"></script>
  </head>
  <body></body>
</html>
`;

mkdirSync(distDir, { recursive: true });
writeFileSync(join(distDir, "index.html"), html);
writeFileSync(join(distDir, "404.html"), html);

if (!existsSync(join(distDir, "200.html"))) {
  copyFileSync(join(distDir, "index.html"), join(distDir, "200.html"));
}
// @lovable.dev/vite-tanstack-config already includes tanstackStart, viteReact, tailwindcss,
// tsConfigPaths, nitro (cloudflare target), env injection and @ alias — do NOT add them manually.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
});

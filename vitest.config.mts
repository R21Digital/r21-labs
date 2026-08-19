import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
  // import.meta.dirname, not __dirname — this config is ESM.
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
});

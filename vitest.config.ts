import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // Module-level rate-limit counters, cleared before every test. See the
    // file for why a route test would otherwise start 429-ing itself.
    setupFiles: ["tests/setup/rate-limit-reset.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      // Types have nothing to execute; the design-exploration preview is
      // explicitly non-production (see its own commit) and isn't held to the
      // same coverage bar as shipped code.
      exclude: ["src/**/*.d.ts", "src/lib/types/**", "src/app/design/**"],
      reporter: ["text", "json-summary"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});

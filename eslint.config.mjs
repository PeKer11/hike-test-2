import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next. A `globalIgnores` object
  // like this one doesn't merge with ESLint's own built-in defaults, it
  // replaces them -- so `node_modules/**`, normally ignored automatically,
  // has to be listed here explicitly too, or a bare `eslint` (no path args,
  // what `npm run lint` runs) walks the entire dependency tree. Found
  // 2026-08-28: the TODO note this fixes described the symptom as ".next/**
  // wasn't excluded", but that part was already listed below and already
  // working -- the real gap was node_modules, which produced the actual
  // thousands-of-issues noise (Next's own compiled bundles under
  // node_modules/next/dist/compiled/**, not .next/ build output).
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // The e2e suite's build output. Same content as .next/**, same reason to
    // skip it -- and the same thousands-of-issues noise if it isn't listed,
    // since a `globalIgnores` pattern matches the literal directory name.
    ".next-e2e/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // ESLint's own default, restored:
    "node_modules/**",
    // Generated locally, never worth linting:
    "coverage/**",
    // A leftover renamed .next backup, already gitignored -- the actual
    // source of the thousands-of-issues noise this fix targets, since its
    // name doesn't match the .next/** pattern above. Safe to delete by hand
    // (479 MB, build cache only); ignored here regardless so lint stays
    // clean whether or not it's removed.
    ".next-stale-bak/**",
  ]),
]);

export default eslintConfig;

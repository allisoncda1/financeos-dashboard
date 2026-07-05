---
name: TS project references need db declarations rebuilt
description: After editing lib/db schema, api-server's tsc typecheck fails until lib/db declaration output is rebuilt, even though runtime works.
---

# TS project references need lib/db declarations rebuilt

`@workspace/db`'s package `exports` map points at `src/*.ts`, so the **runtime**
build (esbuild bundling in api-server) resolves new schema exports directly from
source and works immediately.

But `artifacts/api-server/tsconfig.json` uses TypeScript **project references**
(`references: [{ path: "../../lib/db" }]`). Under project references, `tsc`
resolves `@workspace/db` from lib/db's emitted **declaration output** (`dist/`),
not from `src`. lib/db is `composite: true` + `emitDeclarationOnly`.

**Symptom:** after adding/exporting a new table in `lib/db/src/schema/`,
api-server typecheck fails with `Module '"@workspace/db"' has no exported member
'...'` even though the code runs fine.

**Fix:** rebuild the referenced project's declarations before typechecking:
`pnpm exec tsc -b lib/db/tsconfig.json`. lib/db has no `build`/`typecheck`
script, so `tsc -b` is the way.

**Why:** stale `lib/db/dist/*.d.ts` (e.g. an empty `schema/index.d.ts`) is what
tsc reads; runtime and typecheck resolve `@workspace/db` through different paths.

---
name: verify
description: Run the full local quality gate (biome, tsc, vitest, build, and pgTAP if the local Supabase stack is up) and report results. Use before saying a change is done.
---

Run these in order from the repo root and report each result plainly (pass/fail + the failing
lines, nothing else):

1. `pnpm biome check src` — must print 0 errors, 0 warnings. If only formatting/import-order
   issues: `pnpm biome check --write src` and re-run.
2. `./node_modules/.bin/tsc --noEmit`
3. `pnpm vitest run`
4. `pnpm build`
5. If `supabase/` changed in this session: `pnpm exec supabase status` — if the stack is up,
   `pnpm exec supabase db reset` then `pnpm exec supabase test db`; if it is not up, say so and
   do not start it unless asked (Docker).

If anything fails, fix it only if the fix is clearly inside the change being verified; otherwise
report it as pre-existing. Do not commit.

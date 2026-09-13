# 2026-09-13 — Audits and workstream plan

**Commit audited:** `d7b98f2` (`main`). The audit documents and `todo/` briefs described below
live in git history at commit `8c6faa5`; they were removed from the working tree once the
remediation landed. What survives in-tree: `docs/database.md`, `docs/open-questions.md`,
`docs/backlog.md`, and this changelog.

## Done
- `AUDIT.md` — full engineering audit (security, correctness, frontend, performance, tests).
- `DB_AUDIT.md` — database schema audit: per-table matrix, bidding/concurrency scenarios,
  historical integrity, RLS matrix, ERD, current-vs-recommended, open questions OQ-1..9.
  Headline: **High Risk** — bid log deletable (DB-1/DB-2), derived `items` columns writable by
  any admin JWT (DB-3), non-deterministic bid ordering (DB-4), no bid ceiling (DB-5).
- `todo/` — workstreams S, A, B, C, D, E, F, G, H, Z with ownership, migration prefixes, wave
  order and acceptance criteria. DB-audit deltas appended to B, C, D, F, G, Z; H is new.

## Decisions (owner)
- Remote Supabase project is disposable → migrations are **squashed** into a clean baseline
  (workstream S) instead of patched forward.
- "Solo" = one human deploying; agents still run the workstreams in parallel, so the ownership /
  prefix model in `todo/README.md` stays.
- Nothing implemented during the audit phase; implementation runs via Orca orchestration
  (see `2026-09-13-orchestration.md`).

## How the work is executed
- Orca run `run_c964becbf7d7`: Claude coordinates; Gemini workers (`antigravity` launcher) do
  one `todo/` workstream each in the shared working tree; DAG S → {A,C,D,E,H} → B → {F,H5} → G.
- Workers' first shell command needs a manual approval in their Orca terminal.
- Do **not** reuse a Gemini worker terminal for a second task after its `worker_done`: the
  agent process ends and the new dispatch fails with `process_exited` (happened to H; retried
  on a fresh terminal).
- Remote Supabase project `raxaicqhlbmyzngcubye` is **paused**; all DB verification is local
  (`supabase db reset`). Owner must unpause and `supabase db reset --linked` before deploying.

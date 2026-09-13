# Keep notes/ current

`notes/` is the project changelog for humans. When you make a significant change, append to the
relevant `notes/YYYY-MM-DD-*.md` (create a new dated file for a new day/topic and add it to
`notes/README.md`) **in the same turn**, not at the end of the session.

Record only:
- new features or behaviour changes
- architecture/design decisions and *why*
- database/schema/API changes (and the migration file name)
- important bugs and their fixes
- breaking changes or things a future developer must know
- setup/config/deployment changes

Skip obvious code changes. Keep entries concise and practical — what changed, why, what to watch
out for. `docs/database.md` must also be updated when the schema changes; `docs/open-questions.md`
when a default assumption changes; `docs/backlog.md` when work is deferred or completed.

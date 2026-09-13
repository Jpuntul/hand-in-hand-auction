# Open questions for the organisers

Decisions the code cannot make. Each has a default the current implementation assumes; change
the default and the listed part of the system changes with it. (Originated in the 2026-09-13
database audit — see git history, commit `8c6faa5`, for the full audit.)

| # | Question | Why it matters | Current default |
|---|---|---|---|
| OQ-1 | Will this database be reused for a second event? | Decides whether an `events` table and per-event `item_no` uniqueness are needed. | **No** — one database per event. |
| OQ-2 | What currency, and what are realistic bid sizes? (DB default increment 500, form default 10, UI says USD) | Sets DB defaults, the bid-jump ceiling in `place_bid` (`greatest(min×10, min+10 000)`), and whether cents appear. | USD, whole dollars. |
| OQ-3 | May a bidder raise their own leading bid? | Currently allowed ("Raise your bid"); raises the price with no competitor. | Allowed. |
| OQ-4 | Are `sport / hotel / food` really the only categories? | The column is an enum; changing it is a migration + type regen. | Keep; convert to `text` + CHECK when the real list is known. |
| OQ-5 | Must a bidder have a verified email and/or phone before bidding? | Winner contactability. `phone` is nullable. | Verified email required (enable confirmations in prod); phone optional. |
| OQ-6 | Is "paid / collected" tracking needed after the event? | Two nullable columns on `items` vs nothing. | Nothing — offline fulfilment. |
| OQ-7 | If a winner declines, does the runner-up win? | `items_closed_has_consistent_winner` forbids it; would need a `reassign_winner()` RPC. | Hard constraint; no reassignment. |
| OQ-8 | Should a paused item that passes its `end_time` auto-close? | Cron ignores paused items today. | No — admin must resume + extend, or force-close. |
| OQ-9 | Is a "delete my account" / erasure path needed for donors? | Users with bids cannot be deleted (FK RESTRICT); the alternative is anonymisation. | No erasure path; add an `anonymise_profile()` function if ever required. |

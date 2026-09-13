# F — Admin pages: users query, item form

**AUDIT refs:** §2.9 form half (P1 #9), §2.16 (P1 #16), §2.18 (form validation), §5 #3
**Wave:** 2 (after B — needs the `paused` enum and B's new SQL functions) · **Complexity:** S ·
**Migration prefix:** `2026091314MMSS`

## Goal

The item edit form cannot clobber live auction state or silently shift deadlines. The users page
computes counts in the database.

## Files you own

- `src/app/admin/(protected)/items/item-form.tsx`
- `src/app/admin/(protected)/items/schema.ts`
- `src/app/admin/(protected)/items/actions.ts` — **only** `updateItem` (partial update). Keep A's
  guard/audit and B's delete guard.
- `src/app/admin/(protected)/items/[id]/edit/page.tsx`
- `src/app/admin/(protected)/items/items-table.tsx`
- `src/app/admin/(protected)/users/page.tsx`
- `src/app/admin/(protected)/page.tsx` — only the `projectedRevenue` query.
- `supabase/migrations/2026091314MMSS_admin_views.sql` (new)

Read-only: `src/lib/auction.ts` (from E — use `formatUsd` / `STATUS_VARIANT` if it exists when
you start; otherwise leave the local copies and note it).

## Tasks

### F1 — Views (migration)
```sql
create or replace view public.user_bid_counts with (security_invoker = true) as
  select user_id, count(*)::int as bid_count from public.bid_history group by user_id;
create or replace view public.open_items_revenue with (security_invoker = true) as
  select coalesce(sum(current_bid), 0)::numeric as revenue from public.items where status = 'open';
grant select on public.user_bid_counts, public.open_items_revenue to authenticated;
```
`security_invoker = true` so RLS on the underlying tables still applies (bid_history is public-read;
fine).

### F2 — Users page
Replace the `.in("user_id", userIds)` fetch with `from("user_bid_counts").select("*")`. Paginate
profiles: `?page=` search param, 50 per page, `.range()`, prev/next links. Select only
`id, display_name, email, created_at, is_admin`.

### F3 — Dashboard revenue
`from("open_items_revenue").select("revenue").single()` instead of fetching every open item.

### F4 — Item form: lifecycle columns out of the generic save
- `schema.ts`: split into `itemDetailsSchema` (name, description, sponsor, categories,
  retail_value, starting_bid, bid_increment, image_urls, item_no) and `itemScheduleSchema`
  (`start_time`, `end_time`, `status`). `itemSchema` = the merge, used only by `createItem`.
- `itemScheduleSchema` refines: `end_time > start_time` when both set; `end_time` required when
  `status === "open"`; `status` must not be `closed` or `cancelled` on **create**. `status` enum
  must come from `ITEM_STATUSES` (now includes `paused`).
- `updateItem(id, values)` accepts `Partial<ItemFormValues>` validated with
  `itemDetailsSchema.partial()`; **strips** `status`, `start_time`, `end_time` if present. Sends
  only keys whose value differs from the loaded item (compute the diff in the form with
  `formState.dirtyFields`).
- Edit page: schedule fields move to a separate "Schedule" card with its own **Save schedule**
  button that calls a new `updateItemSchedule(id, values)` action (add it to `actions.ts`, guarded
  with `requireAdmin()`, validated with `itemScheduleSchema`). It may set `status` only among
  `scheduled | open | paused`; for `closed`/`cancelled` the UI points at the override buttons. When
  the item is `open`, `start_time` is read-only.
- Datetime round-trip must preserve seconds: `toDatetimeLocal` emits `YYYY-MM-DDTHH:mm:ss`, inputs
  get `step="1"`.

### F5 — Client-side validation
`useForm` gets `resolver: zodResolver(<form-shaped schema>)` — build a coercing schema from the
raw string form (`z.coerce.number()` etc.) so the same rules run client-side, and field errors
render under each input (there is already an `errors.name` pattern to copy). Server rejections
still toast.

### F6 — Items table
- Name cell becomes a `<Link>`; remove the row `onClick` and the no-op pencil button (or wire it
  to the same href). With no handlers left, drop `"use client"`.
- Add a `paused` badge variant.

## Acceptance criteria

- [x] Editing a description on an `open` item whose `end_time` was extended by anti-snipe does
      **not** change `end_time`.
- [x] Saving the edit form on an item that cron closed meanwhile does not reopen it.
- [x] Round-tripping an item with `end_time = …:30` seconds keeps the seconds.
- [x] Setting `status = open` with no `end_time` is rejected client-side and server-side.
- [x] `/admin/users` bid counts are correct with > 1,000 bids (seed them locally if Docker is
      available; otherwise reason from the view).
- [x] `/admin/users?page=2` works.
- [x] `items-table.tsx` has no `"use client"`.

## Out of scope

Override buttons (B). Image cleanup (P2).

## Additions from `DB_AUDIT.md`

### F1 — views must count live bids only (DB-2)
`user_bid_counts`: `… from public.bid_history where cancelled_at is null group by user_id`.
(Column added by H2, whose prefix `…09…` sorts before yours, so `db reset` is safe. If H has
not merged when you start, still write the `where` and note it in your report.)

### F2 — optional `can_bid` toggle (DB-17, only if H4 added the column)
Next to the admin switch on `/admin/users`, a "Can bid" switch calling a `setCanBid(userId,
bool)` action (guarded by `requireAdmin()`, audit action `admin.user.bid_disable` /
`admin.user.bid_enable`). Skip entirely if H did not add the column.

### F4 — schedule card: state the venue time zone (DB_AUDIT §5)
`datetime-local` is interpreted in the admin's browser zone. Print "Times are entered in your
browser's time zone (<Intl zone name>)" under the schedule fields so an admin editing from abroad
does not shift a deadline by hours.

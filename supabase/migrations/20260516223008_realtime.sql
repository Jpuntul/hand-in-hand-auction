-- Enable Realtime for items and bid_history so client subscriptions get
-- live updates when bids change. The supabase_realtime publication is
-- created by Supabase at project init; we just add our tables to it.
--
-- Realtime broadcasts respect RLS — clients only receive changes for
-- rows they can SELECT. Both items and bid_history have public SELECT
-- policies, so every connected client sees every update.

alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.bid_history;

-- place_bid: ACID bid placement.
--
-- Serializes concurrent bids on the same item via SELECT FOR UPDATE.
-- Validates auction status, window, and minimum amount inside the same
-- transaction. Writes the new current bid to items and appends a row to
-- bid_history atomically. Implements anti-sniping: if the bid lands
-- within the final 60 seconds, end_time is extended by 60 seconds.
--
-- Returns jsonb with the previous bidder so the caller (or a downstream
-- notification function) can alert the user who was outbid.

create or replace function public.place_bid(
  p_item_id uuid,
  p_amount  numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id           uuid := auth.uid();
  v_item              public.items;
  v_now               timestamptz := now();
  v_min_bid           numeric;
  v_extended          timestamptz;
  v_prev_bid          numeric;
  v_prev_bidder       uuid;
  v_anti_snipe_window constant interval := interval '60 seconds';
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  -- Row lock — concurrent place_bid calls on the same item serialize here.
  select * into v_item
  from public.items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item not found'
      using errcode = 'P0002';
  end if;

  if v_item.status <> 'open' then
    raise exception 'Auction is not open (status: %)', v_item.status
      using errcode = '22023';
  end if;

  if v_item.start_time is not null and v_now < v_item.start_time then
    raise exception 'Auction has not started yet'
      using errcode = '22023';
  end if;

  if v_item.end_time is not null and v_now >= v_item.end_time then
    raise exception 'Auction has ended'
      using errcode = '22023';
  end if;

  v_min_bid := coalesce(
    v_item.current_bid + v_item.bid_increment,
    v_item.starting_bid
  );

  if p_amount < v_min_bid then
    raise exception 'Bid must be at least %', v_min_bid
      using errcode = '22023';
  end if;

  v_prev_bid    := v_item.current_bid;
  v_prev_bidder := v_item.current_bidder_id;

  -- Anti-snipe: if bid arrives within the final window, extend end_time.
  if v_item.end_time is not null
     and v_item.end_time - v_now < v_anti_snipe_window
  then
    v_extended := v_now + v_anti_snipe_window;
  end if;

  update public.items
  set current_bid       = p_amount,
      current_bidder_id = v_user_id,
      bid_count         = bid_count + 1,
      end_time          = coalesce(v_extended, end_time)
  where id = p_item_id;

  insert into public.bid_history (
    item_id, user_id, amount,
    previous_bidder_id, previous_bid, extended_end_time
  ) values (
    p_item_id, v_user_id, p_amount,
    v_prev_bidder, v_prev_bid, v_extended
  );

  return jsonb_build_object(
    'ok', true,
    'item_id', p_item_id,
    'amount', p_amount,
    'extended_end_time', v_extended,
    'previous_bidder_id', v_prev_bidder,
    'new_end_time', coalesce(v_extended, v_item.end_time)
  );
end;
$$;

grant execute on function public.place_bid(uuid, numeric) to authenticated;

comment on function public.place_bid is
  'Atomic bid placement with row-level locking, validation, and anti-sniping. Authenticated users only.';

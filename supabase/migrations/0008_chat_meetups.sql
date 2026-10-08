-- =========================================================================
-- 0008_chat_meetups.sql — listing chat and meetup booking
--
-- Apply after 0007. Re-runnable.
--
-- NOTE: this DROPS the `inquiries` table from 0001. It never had a UI. After
-- this file has run, do not re-run 0002 as it stands: its inquiries lines
-- would fail on the missing table.
-- =========================================================================

-- WHY `inquiries` IS REPLACED RATHER THAN ADAPTED
-- It stored one buyer-to-seller note: there is no sender column, so a seller's
-- reply has nowhere to go, and nothing ties two rows into one thread. Its
-- insert policy checked only buyer_id, so a seller could "inquire" about their
-- own listing. Fixing all of that leaves nothing of the original table.

drop table if exists public.inquiries;


-- --- Enumerated type -----------------------------------------------------

do $$ begin
  create type public.meetup_status as enum
    ('proposed', 'accepted', 'superseded', 'cancelled');
exception when duplicate_object then null; end $$;


-- --- conversations -------------------------------------------------------
-- One thread per (listing, buyer). A seller with three interested buyers has
-- three conversations on that listing.
--
-- seller_id is copied from the listing by the trigger below, so that the two
-- participants are both on this row: every policy can then be a comparison
-- against auth.uid() with no join, and buyer <> seller can be a plain CHECK.

create table if not exists public.conversations (
  id                  uuid primary key default gen_random_uuid(),
  listing_id          uuid not null references public.listings (id) on delete cascade,
  buyer_id            uuid not null references public.profiles (id) on delete cascade,
  seller_id           uuid not null references public.profiles (id) on delete cascade,

  -- NULL means "has never opened it". A message is unread for a participant
  -- when it was sent by the other one after this moment.
  buyer_last_read_at  timestamptz,
  seller_last_read_at timestamptz,

  last_message_at     timestamptz not null default now(),
  created_at          timestamptz not null default now(),

  constraint conversations_one_per_buyer unique (listing_id, buyer_id),
  constraint conversations_not_self      check  (buyer_id <> seller_id)
);

create index if not exists conversations_buyer_idx  on public.conversations (buyer_id,  last_message_at desc);
create index if not exists conversations_seller_idx on public.conversations (seller_id, last_message_at desc);

create or replace function public.conversations_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Whatever seller_id the caller supplied is discarded: the seller of a
  -- conversation is whoever owns the listing, and nobody else.
  select l.seller_id into new.seller_id
  from public.listings l
  where l.id = new.listing_id;

  if new.seller_id is null then
    raise exception 'listing_not_found' using errcode = 'no_data_found';
  end if;

  return new;
end;
$$;

drop trigger if exists conversations_before_insert on public.conversations;
create trigger conversations_before_insert
  before insert on public.conversations
  for each row execute function public.conversations_before_insert();


-- --- meetups -------------------------------------------------------------
-- Rows are never edited by a client. Every change of status goes through one
-- of the functions further down, which is where "you cannot accept your own
-- proposal" and "only one active meetup" are decided.

create table if not exists public.meetups (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  proposed_by     uuid not null references public.profiles (id) on delete cascade,
  pickup_spot_id  uuid not null references public.pickup_spots (id) on delete restrict,
  meet_at         timestamptz not null,
  status          public.meetup_status not null default 'proposed',
  responded_at    timestamptz,
  created_at      timestamptz not null default now(),

  -- "Sensible hours" are campus hours, so the comparison is made in campus
  -- time and not in whatever zone the server or the browser happens to be in.
  -- "In the future" cannot be a CHECK (it would stop being true by itself), so
  -- that half lives in propose_meetup().
  constraint meetups_campus_hours check (
    (meet_at at time zone 'Asia/Kolkata')::time between time '08:00' and time '20:00'
  )
);

-- The rule "one active meetup per conversation", as a property of the table:
-- two simultaneous proposals cannot both be inserted, whatever the code does.
create unique index if not exists meetups_one_active
  on public.meetups (conversation_id)
  where status in ('proposed', 'accepted');

create index if not exists meetups_conversation_idx on public.meetups (conversation_id, created_at desc);


-- --- messages ------------------------------------------------------------
-- A thread is one ordered list. Meetup events are rows in it too (written
-- only by the functions below), so a proposal counts as unread and arrives
-- over Realtime exactly like a typed message does.

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null default auth.uid()
                    references public.profiles (id) on delete cascade,
  kind            text not null default 'text'
                    constraint messages_kind_known
                    check (kind in ('text', 'meetup_proposed', 'meetup_accepted', 'meetup_cancelled')),
  meetup_id       uuid references public.meetups (id) on delete cascade,
  body            text not null,
  -- clock_timestamp(), not now(): now() is the transaction's start time, so
  -- two rows written in one transaction would tie and could not be ordered.
  created_at      timestamptz not null default clock_timestamp(),

  constraint messages_meetup_matches_kind check ((kind = 'text') = (meetup_id is null))
);

-- At most 1000 characters, and at least one that is not whitespace.
--
-- `body ~ '\S'` and not `char_length(btrim(body)) >= 1`: btrim strips spaces
-- only, so a message of spaces around a newline survived it with length 1 and
-- was stored as a blank bubble. `npm run verify:rls` caught that. Added with
-- drop-and-add, rather than inline above, so that re-running this file
-- replaces the earlier version of the rule. `not valid` applies it to every
-- new row without failing on a blank one stored before the fix.
alter table public.messages
  drop constraint if exists messages_body_len;
alter table public.messages
  add constraint messages_body_len
  check (char_length(body) <= 1000 and body ~ '\S') not valid;

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at, id);

-- Keeps the conversation's summary columns in step. security definer because
-- clients have no UPDATE privilege on conversations at all.
create or replace function public.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations c
  set last_message_at     = new.created_at,
      -- Sending a message means you have seen everything up to it.
      buyer_last_read_at  = case when c.buyer_id  = new.sender_id then new.created_at else c.buyer_last_read_at  end,
      seller_last_read_at = case when c.seller_id = new.sender_id then new.created_at else c.seller_last_read_at end
  where c.id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.messages_after_insert();


-- --- Privileges ----------------------------------------------------------
-- Supabase grants ALL on new public tables to anon and authenticated by
-- default, so everything is revoked first and only what is needed given back.
--
-- What a signed-in user can do directly:
--   conversations  read
--   meetups        read
--   messages       read, and insert of (conversation_id, body) ONLY
--
-- The column list on that insert is the point. sender_id, kind, meetup_id and
-- created_at cannot be supplied by a client at all - they come from column
-- defaults - so there is no forged sender or back-dated message to refuse.
-- Nobody can update or delete anything: messages are permanent, and
-- conversations and meetups change only through the functions below.

revoke all on public.conversations from anon, authenticated;
revoke all on public.meetups       from anon, authenticated;
revoke all on public.messages      from anon, authenticated;

grant select on public.conversations to authenticated;
grant select on public.meetups       to authenticated;
grant select on public.messages      to authenticated;
grant insert (conversation_id, body) on public.messages to authenticated;


-- --- Row Level Security --------------------------------------------------

alter table public.conversations enable row level security;
alter table public.meetups       enable row level security;
alter table public.messages      enable row level security;

drop policy if exists conversations_select_participants on public.conversations;
create policy conversations_select_participants
  on public.conversations for select
  to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));

drop policy if exists meetups_select_participants on public.meetups;
create policy meetups_select_participants
  on public.meetups for select
  to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = meetups.conversation_id
        and (select auth.uid()) in (c.buyer_id, c.seller_id)
    )
  );

drop policy if exists messages_select_participants on public.messages;
create policy messages_select_participants
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) in (c.buyer_id, c.seller_id)
    )
  );

-- A typed message: yours, plain text, in a conversation you are part of.
drop policy if exists messages_insert_participant on public.messages;
create policy messages_insert_participant
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and kind = 'text'
    and meetup_id is null
    and exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) in (c.buyer_id, c.seller_id)
    )
  );


-- =========================================================================
-- Functions
--
-- These are `security definer`, so they run as the table owner and RLS does
-- not apply inside them. That is deliberate - each one performs a change that
-- a policy cannot express (two rows that must change together, or a rule about
-- WHO may make a transition) - and it means each one must establish for itself
-- who is calling and whether they belong to the conversation. Every function
-- does that first, from auth.uid(), never from an argument.
--
-- Errors carry a short machine-readable message (`not_participant`, ...) that
-- the app maps to a sentence for the user.
-- =========================================================================

-- --- start_conversation --------------------------------------------------
-- Opens the caller's conversation about a listing (or finds the one they
-- already have) and posts the first message, in one transaction - so a seller
-- never sees an empty thread.

create or replace function public.start_conversation(p_listing_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_seller  uuid;
  v_status  public.listing_status;
  v_conv_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;

  select l.seller_id, l.status into v_seller, v_status
  from public.listings l
  where l.id = p_listing_id;

  if v_seller is null then
    raise exception 'listing_not_found' using errcode = 'no_data_found';
  end if;

  if v_seller = v_uid then
    raise exception 'own_listing' using errcode = 'check_violation';
  end if;

  select c.id into v_conv_id
  from public.conversations c
  where c.listing_id = p_listing_id and c.buyer_id = v_uid;

  if v_conv_id is null then
    -- A sold listing accepts no NEW conversations. Existing ones stay open:
    -- the two people may still be arranging the handover.
    if v_status <> 'available' then
      raise exception 'listing_sold' using errcode = 'check_violation';
    end if;

    insert into public.conversations (listing_id, buyer_id, seller_id)
    values (p_listing_id, v_uid, v_seller)
    on conflict (listing_id, buyer_id) do nothing
    returning id into v_conv_id;

    -- Lost a race with the same user's other tab: use the row that won.
    if v_conv_id is null then
      select c.id into v_conv_id
      from public.conversations c
      where c.listing_id = p_listing_id and c.buyer_id = v_uid;
    end if;
  end if;

  insert into public.messages (conversation_id, sender_id, body)
  values (v_conv_id, v_uid, p_body);

  return v_conv_id;
end;
$$;


-- --- mark_conversation_read ----------------------------------------------
-- Moves the caller's own "read up to" marker to now. It takes no timestamp
-- and touches only the caller's side, so it cannot be used to mark the other
-- person's messages as read for them, or to move a marker into the future.

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.conversations c
  set buyer_last_read_at  = case when c.buyer_id  = v_uid then clock_timestamp() else c.buyer_last_read_at  end,
      seller_last_read_at = case when c.seller_id = v_uid then clock_timestamp() else c.seller_last_read_at end
  where c.id = p_conversation_id
    and v_uid in (c.buyer_id, c.seller_id);
end;
$$;


-- --- propose_meetup ------------------------------------------------------
-- Proposes a time and place. If the conversation already has an active meetup
-- - a pending proposal from either side, or an accepted one - it is retired
-- as `superseded` in the same transaction. So this one function is "Propose
-- meetup", "Suggest another time" and "Reschedule".

create or replace function public.propose_meetup(
  p_conversation_id uuid,
  p_pickup_spot_id  uuid,
  p_meet_at         timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_conv_id   uuid;
  v_meetup_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;

  -- Locks the conversation row. Two proposals made at the same instant queue
  -- up here, so the second one sees (and supersedes) the first instead of
  -- colliding with it on the unique index.
  select c.id into v_conv_id
  from public.conversations c
  where c.id = p_conversation_id
    and v_uid in (c.buyer_id, c.seller_id)
  for update;

  if v_conv_id is null then
    raise exception 'not_participant' using errcode = 'insufficient_privilege';
  end if;

  if p_meet_at is null or p_meet_at <= now() then
    raise exception 'meetup_in_past' using errcode = 'check_violation';
  end if;

  if p_meet_at > now() + interval '60 days' then
    raise exception 'meetup_too_far' using errcode = 'check_violation';
  end if;

  -- Also a CHECK on the table; repeated here for a clean error message.
  if (p_meet_at at time zone 'Asia/Kolkata')::time not between time '08:00' and time '20:00' then
    raise exception 'meetup_outside_hours' using errcode = 'check_violation';
  end if;

  if not exists (select 1 from public.pickup_spots s where s.id = p_pickup_spot_id) then
    raise exception 'spot_not_found' using errcode = 'no_data_found';
  end if;

  update public.meetups m
  set status = 'superseded', responded_at = now()
  where m.conversation_id = p_conversation_id
    and m.status in ('proposed', 'accepted');

  insert into public.meetups (conversation_id, proposed_by, pickup_spot_id, meet_at)
  values (p_conversation_id, v_uid, p_pickup_spot_id, p_meet_at)
  returning id into v_meetup_id;

  insert into public.messages (conversation_id, sender_id, kind, meetup_id, body)
  values (p_conversation_id, v_uid, 'meetup_proposed', v_meetup_id, 'Proposed a meetup');

  return v_meetup_id;
end;
$$;


-- --- accept_meetup -------------------------------------------------------
-- Only the person the proposal was made TO can accept it. All the conditions
-- are in the WHERE clause of one UPDATE, so there is no gap between checking
-- and changing: if the proposal was superseded a moment ago, nothing matches.

create or replace function public.accept_meetup(p_meetup_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_conv_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;

  update public.meetups m
  set status = 'accepted', responded_at = now()
  from public.conversations c
  where m.id = p_meetup_id
    and c.id = m.conversation_id
    and v_uid in (c.buyer_id, c.seller_id)
    and m.proposed_by <> v_uid
    and m.status = 'proposed'
    and m.meet_at > now()
  returning m.conversation_id into v_conv_id;

  if v_conv_id is null then
    raise exception 'meetup_not_acceptable' using errcode = 'check_violation';
  end if;

  insert into public.messages (conversation_id, sender_id, kind, meetup_id, body)
  values (v_conv_id, v_uid, 'meetup_accepted', p_meetup_id, 'Accepted the meetup');
end;
$$;


-- --- cancel_meetup -------------------------------------------------------
-- Either participant can call off a pending or accepted meetup. Without this
-- an accepted meetup could never be undone, only replaced.

create or replace function public.cancel_meetup(p_meetup_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_conv_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;

  update public.meetups m
  set status = 'cancelled', responded_at = now()
  from public.conversations c
  where m.id = p_meetup_id
    and c.id = m.conversation_id
    and v_uid in (c.buyer_id, c.seller_id)
    and m.status in ('proposed', 'accepted')
  returning m.conversation_id into v_conv_id;

  if v_conv_id is null then
    raise exception 'meetup_not_cancellable' using errcode = 'check_violation';
  end if;

  insert into public.messages (conversation_id, sender_id, kind, meetup_id, body)
  values (v_conv_id, v_uid, 'meetup_cancelled', p_meetup_id, 'Cancelled the meetup');
end;
$$;


-- --- my_inbox / my_unread_count ------------------------------------------
-- Read helpers for the Inbox page and the header badge. Unlike the functions
-- above these are `security invoker`: they run as the caller, under RLS, and
-- can return nothing a plain query would refuse. They exist only because "the
-- latest message and an unread count per conversation" is one query in SQL
-- and many through the REST API.

create or replace function public.my_inbox()
returns table (
  conversation_id      uuid,
  listing_id           uuid,
  listing_title        text,
  listing_price        numeric,
  listing_status       public.listing_status,
  listing_image_path   text,
  other_id             uuid,
  other_name           text,
  i_am_seller          boolean,
  last_message_body    text,
  last_message_kind    text,
  last_message_sender  uuid,
  last_message_at      timestamptz,
  unread_count         integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    l.id,
    l.title,
    l.price,
    l.status,
    l.image_path,
    p.id,
    p.full_name,
    c.seller_id = (select auth.uid()),
    lm.body,
    lm.kind,
    lm.sender_id,
    c.last_message_at,
    (
      select count(*)::integer
      from public.messages m
      where m.conversation_id = c.id
        and m.sender_id <> (select auth.uid())
        and m.created_at > coalesce(
          case when c.seller_id = (select auth.uid()) then c.seller_last_read_at else c.buyer_last_read_at end,
          '-infinity'::timestamptz
        )
    )
  from public.conversations c
  join public.listings l on l.id = c.listing_id
  join public.profiles p
    on p.id = case when c.seller_id = (select auth.uid()) then c.buyer_id else c.seller_id end
  left join lateral (
    select m.body, m.kind, m.sender_id
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc, m.id desc
    limit 1
  ) lm on true
  where (select auth.uid()) in (c.buyer_id, c.seller_id)
  order by c.last_message_at desc, c.id;
$$;

create or replace function public.my_unread_count()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where (select auth.uid()) in (c.buyer_id, c.seller_id)
    and m.sender_id <> (select auth.uid())
    and m.created_at > coalesce(
      case when c.seller_id = (select auth.uid()) then c.seller_last_read_at else c.buyer_last_read_at end,
      '-infinity'::timestamptz
    );
$$;


-- --- Who may call what ---------------------------------------------------
-- Supabase also grants EXECUTE on new functions to anon by default, so it is
-- revoked by name and not only from `public`.

revoke all on function public.start_conversation(uuid, text)              from public, anon;
revoke all on function public.mark_conversation_read(uuid)                from public, anon;
revoke all on function public.propose_meetup(uuid, uuid, timestamptz)     from public, anon;
revoke all on function public.accept_meetup(uuid)                         from public, anon;
revoke all on function public.cancel_meetup(uuid)                         from public, anon;
revoke all on function public.my_inbox()                                  from public, anon;
revoke all on function public.my_unread_count()                           from public, anon;

grant execute on function public.start_conversation(uuid, text)           to authenticated;
grant execute on function public.mark_conversation_read(uuid)             to authenticated;
grant execute on function public.propose_meetup(uuid, uuid, timestamptz)  to authenticated;
grant execute on function public.accept_meetup(uuid)                      to authenticated;
grant execute on function public.cancel_meetup(uuid)                      to authenticated;
grant execute on function public.my_inbox()                               to authenticated;
grant execute on function public.my_unread_count()                        to authenticated;

-- Trigger functions are only ever run by their triggers.
revoke all on function public.conversations_before_insert() from public, anon, authenticated;
revoke all on function public.messages_after_insert()       from public, anon, authenticated;


-- --- Realtime ------------------------------------------------------------
-- Only `messages` is published. Every change a chat page cares about - a new
-- message, a proposal, an acceptance, a cancellation - inserts a message row,
-- so one table is enough of a signal and the other two stay off the wire.
-- Realtime applies messages_select_participants per subscriber: someone who
-- is not in the conversation receives nothing.

do $$ begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'publication supabase_realtime not found - enable Realtime in the dashboard, then re-run';
end $$;

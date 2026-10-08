-- =========================================================================
-- 0011_hardening.sql — fixes from the final security review
--
-- Apply after 0010. Re-runnable. Additive: nothing the deployed site does is
-- taken away, because the app never sends the columns this locks down.
-- =========================================================================

-- --- 1. A post's timestamps belong to the database -----------------------
--
-- THE HOLE
-- `authenticated` may insert and update any column of its own listings, and
-- the update policy only checks `seller_id`. So an owner could send
--
--     PATCH /rest/v1/listings?id=eq.<own id>   {"created_at": "2099-01-01"}
--
-- and their post would sit first in Explore, and in the public home page
-- sections, for good - those are ordered by created_at. The same trick on
-- `sold_at` took the one "recently sold" slot on the home page. The comment
-- in 0001 said sold_at "cannot be back-dated by a crafted request"; that was
-- only true for the moment a post is marked sold, not afterwards.
--
-- THE FIX
-- Both columns are now set by triggers on every insert and update, whatever
-- the request says. Nothing in the app sends either column, so nothing in the
-- app changes.

create or replace function public.listings_before_insert()
returns trigger
language plpgsql
as $$
begin
  new.created_at := now();
  new.updated_at := now();
  new.sold_at    := case when new.status = 'sold' then now() else null end;
  return new;
end;
$$;

drop trigger if exists listings_set_timestamps on public.listings;
create trigger listings_set_timestamps
  before insert on public.listings
  for each row execute function public.listings_before_insert();

-- The update trigger from 0010, with two changes: created_at can never
-- change, and sold_at is derived from the status in EVERY case (before, a
-- row that stayed sold kept whatever sold_at the request supplied).
create or replace function public.listings_before_update()
returns trigger
language plpgsql
as $$
begin
  if new.type is distinct from old.type then
    raise exception 'type_is_fixed' using errcode = 'check_violation';
  end if;

  new.created_at := old.created_at;
  new.updated_at := now();

  if new.status = 'sold' and old.status <> 'sold' then
    new.sold_at := now();
  elsif new.status = 'sold' then
    new.sold_at := old.sold_at;
  else
    new.sold_at := null;
  end if;

  return new;
end;
$$;


-- --- 2. Privileges nobody was meant to have -------------------------------
-- Supabase grants ALL on a new public table to `authenticated` by default.
-- Migration 0002 revoked from `anon` and then granted `authenticated` what it
-- needed, but never took the rest away. Row Level Security has been blocking
-- these all along (there is no policy that allows them), so this closes
-- nothing that was open: it removes the reliance on a policy staying absent.

revoke insert, delete, truncate, references, trigger         on public.profiles       from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.pickup_spots   from authenticated;
revoke update, truncate, references, trigger                 on public.wishlist_items from authenticated;
revoke truncate, references, trigger                         on public.listings       from authenticated;
revoke all on public.signup_allowed_domains from anon, authenticated;


-- --- 3. A photo path is a folder and a file name, nothing cleverer --------
-- The existing rule was "starts with your own id and a slash". That is also
-- true of `<my id>/../<someone else>/photo.webp`. It could only ever point at
-- another PUBLIC photo, but there is no reason to allow it at all.

alter table public.listings
  drop constraint if exists listings_image_path_plain;
alter table public.listings
  add constraint listings_image_path_plain
  check (image_path is null or image_path !~ '(\.\.|//|\\)') not valid;

alter table public.profiles
  drop constraint if exists profiles_avatar_path_plain;
alter table public.profiles
  add constraint profiles_avatar_path_plain
  check (avatar_path is null or avatar_path !~ '(\.\.|//|\\)') not valid;

-- =========================================================================
-- 0002_rls.sql — table privileges, Row Level Security and policies
--
-- Apply after 0001. Re-runnable.
--
-- Two independent mechanisms are in play and both matter:
--   * GRANT   decides whether a role may touch a table at all.
--   * POLICY  decides which rows it may touch.
-- A table with RLS enabled and no matching policy returns zero rows and
-- rejects every write. That is the default we want: deny unless stated.
-- =========================================================================

-- --- Privileges ----------------------------------------------------------
-- Browsing requires a session, so `anon` (the role used for unauthenticated
-- requests) is given nothing. Revoking explicitly rather than relying on
-- Supabase's default grants makes the intent visible and survives a restore
-- into a project with different defaults.

grant usage on schema public to anon, authenticated;

revoke all on public.profiles       from anon;
revoke all on public.listings       from anon;
revoke all on public.pickup_spots   from anon;
revoke all on public.wishlist_items from anon;
revoke all on public.inquiries      from anon;

grant select, update                 on public.profiles       to authenticated;
grant select, insert, update, delete on public.listings       to authenticated;
grant select                         on public.pickup_spots   to authenticated;
grant select, insert, delete         on public.wishlist_items to authenticated;
grant select, insert                 on public.inquiries      to authenticated;

-- No grant of insert/delete on profiles: rows are created by the
-- handle_new_user trigger and removed by the auth.users cascade.
-- No write grant at all on pickup_spots: it is seeded by migration.


-- --- Enable RLS ----------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.listings       enable row level security;
alter table public.pickup_spots   enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.inquiries      enable row level security;


-- --- profiles ------------------------------------------------------------

drop policy if exists profiles_select on public.profiles;
create policy profiles_select
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using      (id = (select auth.uid()))
  with check (id = (select auth.uid()));


-- --- listings ------------------------------------------------------------
--
-- Note on `(select auth.uid())` rather than a bare `auth.uid()`: wrapping it
-- in a subquery lets Postgres evaluate it once per statement as an InitPlan
-- instead of once per row. On a browse query over every listing that is the
-- difference between one call and thousands.

drop policy if exists listings_select on public.listings;
create policy listings_select
  on public.listings for select
  to authenticated
  using (true);

drop policy if exists listings_insert_own on public.listings;
create policy listings_insert_own
  on public.listings for insert
  to authenticated
  with check (seller_id = (select auth.uid()));

-- `using` controls which rows may be targeted; `with check` controls what the
-- row may look like afterwards. Both are required: without the check, an owner
-- could reassign seller_id and hand their listing to someone else.
-- Mark-as-sold is an UPDATE, so it is covered by this same policy - there is
-- no separate privilege that could be got wrong.
drop policy if exists listings_update_own on public.listings;
create policy listings_update_own
  on public.listings for update
  to authenticated
  using      (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));

drop policy if exists listings_delete_own on public.listings;
create policy listings_delete_own
  on public.listings for delete
  to authenticated
  using (seller_id = (select auth.uid()));


-- --- pickup_spots --------------------------------------------------------
-- Read-only reference data. No write policy exists, so no write is possible
-- through the API regardless of what the application code asks for.

drop policy if exists pickup_spots_select on public.pickup_spots;
create policy pickup_spots_select
  on public.pickup_spots for select
  to authenticated
  using (true);


-- --- wishlist_items ------------------------------------------------------
-- A wishlist is private: you cannot see what anyone else has saved.

drop policy if exists wishlist_select_own on public.wishlist_items;
create policy wishlist_select_own
  on public.wishlist_items for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists wishlist_insert_own on public.wishlist_items;
create policy wishlist_insert_own
  on public.wishlist_items for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists wishlist_delete_own on public.wishlist_items;
create policy wishlist_delete_own
  on public.wishlist_items for delete
  to authenticated
  using (user_id = (select auth.uid()));


-- --- inquiries -----------------------------------------------------------
-- Visible to the two parties involved and nobody else: the buyer who sent it,
-- and the seller who owns the listing it is about.

drop policy if exists inquiries_select_participants on public.inquiries;
create policy inquiries_select_participants
  on public.inquiries for select
  to authenticated
  using (
    buyer_id = (select auth.uid())
    or exists (
      select 1
      from public.listings l
      where l.id = inquiries.listing_id
        and l.seller_id = (select auth.uid())
    )
  );

drop policy if exists inquiries_insert_own on public.inquiries;
create policy inquiries_insert_own
  on public.inquiries for insert
  to authenticated
  with check (buyer_id = (select auth.uid()));


-- --- Realtime ------------------------------------------------------------
-- Publishing `listings` lets the browser subscribe to changes, which is what
-- makes a listing grey out for everyone the moment it is marked sold.
-- Realtime enforces the SELECT policy above per subscriber, so a subscription
-- cannot be used to read rows a plain query would refuse.

do $$ begin
  alter publication supabase_realtime add table public.listings;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'publication supabase_realtime not found - enable Realtime in the dashboard, then re-run';
end $$;

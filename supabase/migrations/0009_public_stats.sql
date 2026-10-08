-- =========================================================================
-- 0009_public_stats.sql — counts and a sold teaser for the public home page
--
-- Apply after 0008. Re-runnable.
-- =========================================================================

-- WHAT THE HOME PAGE NEEDS, AND WHY IT CANNOT JUST ASK
-- The home page is public. It shows a row of live numbers and a few recent
-- listings, one of them sold. But a signed-out visitor has no privilege on any
-- table (migration 0002), and that stays true - so there is nothing for the
-- page to count, and nothing to list.
--
-- These three functions are the whole exception. All are `security definer`
-- with no arguments, so a caller cannot steer them: there is no id to guess,
-- no filter to vary, nothing to enumerate. What each returns is exactly its
-- SELECT list. No table policy is changed, and `npm run verify:rls` still
-- asserts that a signed-out client cannot read `listings` directly.


-- --- public_stats --------------------------------------------------------
-- Five integers. A count identifies nobody: it says how many students have
-- signed up, not who.

create or replace function public.public_stats()
returns table (
  listings_live   integer,
  items_sold      integer,
  pickup_spots    integer,
  meetups_agreed  integer,
  students        integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer from public.listings     where status = 'available'),
    (select count(*)::integer from public.listings     where status = 'sold'),
    (select count(*)::integer from public.pickup_spots),
    (select count(*)::integer from public.meetups      where status = 'accepted'),
    (select count(*)::integer from public.profiles);
$$;

revoke all on function public.public_stats() from public;
grant execute on function public.public_stats() to anon, authenticated;


-- --- public_pickup_spots -------------------------------------------------
-- The names of the campus handover points, for the "Meet on campus" section.
-- These are places on a campus map, not data about anyone.

create or replace function public.public_pickup_spots()
returns table (name text, description text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.name, s.description
  from public.pickup_spots s
  order by s.sort_order, s.name;
$$;

revoke all on function public.public_pickup_spots() from public;
grant execute on function public.public_pickup_spots() to anon, authenticated;


-- --- home_listing_teasers ------------------------------------------------
-- Like recent_listing_teasers() from 0007, with one difference: the result
-- includes the most recently sold listing, so the home page can show what
-- "sold" looks like. It carries a `status` column for that.
--
-- It is a NEW function, and 0007's is left exactly as it was. Replacing that
-- one would have changed what the already-deployed home page receives the
-- moment this file ran - before the code that understands `status` had been
-- pushed - and it would have drawn a sold item as if it were for sale.
--
--   returned:      id, title, price, category, condition, status, image_path,
--                  course_code, pickup spot name
--   NOT returned:  seller_id, description, isbn, author, original price,
--                  condition checklist, timestamps, who bought it
--
-- At most eight rows: up to seven available listings, newest first, then the
-- one sold listing if there is one.

create or replace function public.home_listing_teasers()
returns table (
  id               uuid,
  title            text,
  price            numeric,
  category         public.listing_category,
  condition        public.item_condition,
  status           public.listing_status,
  image_path       text,
  course_code      text,
  pickup_spot_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  (
    select l.id, l.title, l.price, l.category, l.condition, l.status,
           l.image_path, l.course_code, s.name
    from public.listings l
    left join public.pickup_spots s on s.id = l.pickup_spot_id
    where l.status = 'available'
    order by l.created_at desc, l.id
    limit 7
  )
  union all
  (
    select l.id, l.title, l.price, l.category, l.condition, l.status,
           l.image_path, l.course_code, s.name
    from public.listings l
    left join public.pickup_spots s on s.id = l.pickup_spot_id
    where l.status = 'sold'
    order by l.sold_at desc nulls last, l.id
    limit 1
  );
$$;

revoke all on function public.home_listing_teasers() from public;
grant execute on function public.home_listing_teasers() to anon, authenticated;

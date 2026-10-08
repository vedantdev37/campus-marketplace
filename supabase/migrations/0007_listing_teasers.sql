-- =========================================================================
-- 0007_listing_teasers.sql — a few recent listings for the public home page
--
-- OPTIONAL. Apply after 0006. Re-runnable.
--
-- Without it the app works exactly as before: the home page simply shows
-- recent listings to signed-in users only.
-- =========================================================================

-- THE PROBLEM
-- Browsing requires a session: `anon` has no privileges on `listings`
-- (migration 0002), and that stays true. But it means a first-time visitor to
-- the home page sees a marketplace with nothing in it.
--
-- THE NARROW EXCEPTION
-- This function lets a signed-out visitor see up to eight recent, available
-- listings - and only the fields a card shows. It is `security definer`, so it
-- reads the table as its owner, and what it returns is exactly its SELECT list:
--
--   returned:      id, title, price, category, condition, image_path,
--                  course_code, pickup spot name
--   NOT returned:  seller_id, description, isbn, author, original price,
--                  condition checklist, timestamps, sold listings
--
-- So nobody can be identified and nothing can be enumerated: there are no
-- arguments to vary, the row count is fixed, and the photos it points at are
-- already in a public bucket. Opening the listing itself still requires
-- signing in. The table's own policies are untouched - `anon` still cannot
-- select from `listings`, and `npm run verify:rls` still asserts that.

create or replace function public.recent_listing_teasers()
returns table (
  id               uuid,
  title            text,
  price            numeric,
  category         public.listing_category,
  condition        public.item_condition,
  image_path       text,
  course_code      text,
  pickup_spot_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.id,
    l.title,
    l.price,
    l.category,
    l.condition,
    l.image_path,
    l.course_code,
    s.name
  from public.listings l
  left join public.pickup_spots s on s.id = l.pickup_spot_id
  where l.status = 'available'
  order by l.created_at desc, l.id
  limit 8;
$$;

revoke all on function public.recent_listing_teasers() from public;
grant execute on function public.recent_listing_teasers() to anon, authenticated;

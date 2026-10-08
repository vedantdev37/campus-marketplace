-- =========================================================================
-- 0010_listing_types.sql — six kinds of post, and profiles with skills
--
-- Apply after 0009. Re-runnable.
--
-- Everything here is ADDITIVE. The site that is deployed when this file runs
-- knows nothing about `type`: it inserts listings without one (they default
-- to 'sale') and reads every row. So no existing column changes meaning, no
-- existing function changes its signature, and the search index is left
-- exactly as it is.
-- =========================================================================

-- ONE TABLE, SIX KINDS OF POST
-- A rental, a giveaway, a found item, a skill on offer and a call for
-- teammates all need what a sale already has: an owner, a title, a
-- description, an optional photo, search, a status, a chat. Six tables would
-- mean six sets of policies to get right and to keep right. Instead `listings`
-- gains a `type`, and the handful of fields that only one kind uses.
--
-- STATUS IS NOT EXTENDED
-- `sold` already means "this is finished, stop offering it". A rental that is
-- out, a found item that was claimed and a team that is full are the same
-- state under different names, so the app shows a different LABEL per type
-- (Sold / Rented out / Claimed / Team full) over the one stored value. Every
-- existing rule that reads `status` - browse filters, the sold_at trigger, the
-- chat function that refuses new conversations on a closed post - is then
-- already correct for all six.

-- `text` with a CHECK, not an enum: adding an enum value cannot share a
-- transaction with statements that use it (see the note on 0006).
alter table public.listings
  add column if not exists type text not null default 'sale';

alter table public.listings
  drop constraint if exists listings_type_known;
alter table public.listings
  add constraint listings_type_known
  check (type in ('sale', 'rent', 'free', 'lost_found', 'skill_offer', 'team_request'));

-- Fields used by one kind of post only.
alter table public.listings add column if not exists rent_max_days smallint;
alter table public.listings add column if not exists found_on      date;
alter table public.listings add column if not exists event_name    text;
alter table public.listings add column if not exists event_date    date;
alter table public.listings add column if not exists tags          text[] not null default '{}';

-- A skill or a team request is not an item, so it has no real category or
-- condition. The columns stay NOT NULL - the deployed code and the checklist
-- trigger both read them - and non-item posts simply take these defaults.
alter table public.listings alter column category  set default 'other';
alter table public.listings alter column condition set default 'good';


-- --- Rules per type ------------------------------------------------------
-- Each is a CHECK, so it holds for a row written straight through the API as
-- well as one that came through the form.

-- Money only changes hands for a sale or a rental. For a rental, `price` is
-- the price PER DAY. Everything else must be 0 - a "free" post with a price
-- on it would be a sale wearing a FREE badge.
alter table public.listings
  drop constraint if exists listings_price_by_type;
alter table public.listings
  add constraint listings_price_by_type
  check (type in ('sale', 'rent') or price = 0);

-- A rental says how long it can be borrowed for, up to 30 days. Nothing else
-- may carry that field.
alter table public.listings
  drop constraint if exists listings_rent_fields;
alter table public.listings
  add constraint listings_rent_fields
  check (
    case when type = 'rent'
      then rent_max_days is not null and rent_max_days between 1 and 30
      else rent_max_days is null
    end
  );

alter table public.listings
  drop constraint if exists listings_found_fields;
alter table public.listings
  add constraint listings_found_fields
  check (found_on is null or type = 'lost_found');

alter table public.listings
  drop constraint if exists listings_event_fields;
alter table public.listings
  add constraint listings_event_fields
  check (
    (event_name is null or char_length(event_name) between 1 and 80)
    and ((event_name is null and event_date is null) or type in ('skill_offer', 'team_request'))
  );

-- Tags: at most 8, each 1-24 characters of lower-case letters, digits and
-- + # . - (so "next.js", "c++" and "video-editing" all fit). Lower-case only,
-- so "React" and "react" cannot be two different tags. The array is joined
-- with spaces and matched as a whole; array_to_string() silently skips NULL
-- elements, which is why NULLs are ruled out separately first.
alter table public.listings
  drop constraint if exists listings_tags_shape;
alter table public.listings
  add constraint listings_tags_shape
  check (
    cardinality(tags) <= 8
    and array_position(tags, null) is null
    and (
      cardinality(tags) = 0
      or (
        type in ('skill_offer', 'team_request')
        and array_to_string(tags, ' ') ~ '^[a-z0-9+#.-]{1,24}( [a-z0-9+#.-]{1,24})*$'
      )
    )
  );

create index if not exists listings_type_idx on public.listings (type, status, created_at desc);
create index if not exists listings_tags_idx on public.listings using gin (tags);


-- --- A post cannot change its type ---------------------------------------
-- The owner may edit their own row (the listings_update_own policy), and
-- without this they could turn a FREE post that people have replied to into
-- a sale. The function is the one from 0001 with that check added.

create or replace function public.listings_before_update()
returns trigger
language plpgsql
as $$
begin
  if new.type is distinct from old.type then
    raise exception 'type_is_fixed' using errcode = 'check_violation';
  end if;

  new.updated_at := now();

  if new.status = 'sold' and old.status <> 'sold' then
    new.sold_at := now();
  elsif new.status = 'available' then
    new.sold_at := null;
  end if;

  return new;
end;
$$;

-- WHO CAN CLOSE A POST
-- Marking a rental returned, a found item claimed or a team full is an UPDATE
-- of `status`, exactly as marking a sale sold is. The policy from 0002 already
-- restricts that to the owner, so nothing new is needed: a stranger cannot
-- "claim" someone's found item in the database, they can only say so in chat,
-- and the person who posted it decides.


-- --- profiles ------------------------------------------------------------
-- A profile becomes something to look at: a short bio, skills, a photo and a
-- GitHub username.

alter table public.profiles add column if not exists bio             text;
alter table public.profiles add column if not exists skills          text[] not null default '{}';
alter table public.profiles add column if not exists avatar_path     text;
alter table public.profiles add column if not exists github_username text;

alter table public.profiles
  drop constraint if exists profiles_full_name_len;
alter table public.profiles
  add constraint profiles_full_name_len
  check (char_length(full_name) <= 80) not valid;

alter table public.profiles
  drop constraint if exists profiles_bio_len;
alter table public.profiles
  add constraint profiles_bio_len
  check (bio is null or char_length(bio) <= 280);

alter table public.profiles
  drop constraint if exists profiles_skills_shape;
alter table public.profiles
  add constraint profiles_skills_shape
  check (
    cardinality(skills) <= 12
    and array_position(skills, null) is null
    and (
      cardinality(skills) = 0
      or array_to_string(skills, ' ') ~ '^[a-z0-9+#.-]{1,24}( [a-z0-9+#.-]{1,24})*$'
    )
  );

-- The photo must be in the user's own Storage folder, as a listing's must.
alter table public.profiles
  drop constraint if exists profiles_avatar_own_folder;
alter table public.profiles
  add constraint profiles_avatar_own_folder
  check (avatar_path is null or avatar_path like id::text || '/%');

-- A USERNAME, never a URL. The page builds https://github.com/<username>
-- itself, so there is no stored link that could be a javascript: URL or point
-- somewhere else. These are the characters GitHub allows.
alter table public.profiles
  drop constraint if exists profiles_github_username_fmt;
alter table public.profiles
  add constraint profiles_github_username_fmt
  check (github_username is null or github_username ~ '^[A-Za-z0-9-]{1,39}$');

create index if not exists profiles_skills_idx on public.profiles using gin (skills);

-- Until now `authenticated` could update ANY column of their own profile row,
-- including created_at. The grant is narrowed to the columns a person edits.
revoke update on public.profiles from authenticated;
grant update (full_name, bio, skills, avatar_path, github_username)
  on public.profiles to authenticated;


-- --- Public home page functions ------------------------------------------
-- The three existing functions are re-created with the same signatures, now
-- limited to sales where that is what they mean: "Fresh drops" and "items
-- sold" are about things for sale, and without the filter a team request
-- would turn up among them as a 0-rupee item.

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
  select l.id, l.title, l.price, l.category, l.condition, l.image_path, l.course_code, s.name
  from public.listings l
  left join public.pickup_spots s on s.id = l.pickup_spot_id
  where l.status = 'available' and l.type = 'sale'
  order by l.created_at desc, l.id
  limit 8;
$$;

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
    where l.status = 'available' and l.type = 'sale'
    order by l.created_at desc, l.id
    limit 7
  )
  union all
  (
    select l.id, l.title, l.price, l.category, l.condition, l.status,
           l.image_path, l.course_code, s.name
    from public.listings l
    left join public.pickup_spots s on s.id = l.pickup_spot_id
    where l.status = 'sold' and l.type = 'sale'
    order by l.sold_at desc nulls last, l.id
    limit 1
  );
$$;

-- "Listings live" counts every kind of post; "items sold" counts sales.
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
    (select count(*)::integer from public.listings     where status = 'sold' and type = 'sale'),
    (select count(*)::integer from public.pickup_spots),
    (select count(*)::integer from public.meetups      where status = 'accepted'),
    (select count(*)::integer from public.profiles);
$$;

-- --- home_sections -------------------------------------------------------
-- The newest four open posts of each kind other than sale, for the home
-- page's Rent, Free, Squad up and Lost & Found sections.
--
--   returned:      id, type, title, price, image_path, pickup spot name,
--                  tags, rent_max_days, found_on, event_name, event_date
--   NOT returned:  seller_id or any name, description, timestamps
--
-- So a signed-out visitor learns that someone is looking for a backend
-- developer, not who. Opening the post requires signing in.

create or replace function public.home_sections()
returns table (
  id               uuid,
  type             text,
  title            text,
  price            numeric,
  image_path       text,
  pickup_spot_name text,
  tags             text[],
  rent_max_days    smallint,
  found_on         date,
  event_name       text,
  event_date       date
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.type, r.title, r.price, r.image_path, s.name,
         r.tags, r.rent_max_days, r.found_on, r.event_name, r.event_date
  from (
    select l.*,
           row_number() over (partition by l.type order by l.created_at desc, l.id) as position
    from public.listings l
    where l.status = 'available' and l.type <> 'sale'
  ) r
  left join public.pickup_spots s on s.id = r.pickup_spot_id
  where r.position <= 4
  order by r.type, r.position;
$$;

revoke all on function public.home_sections() from public;
grant execute on function public.home_sections() to anon, authenticated;

-- =========================================================================
-- 0001_schema.sql — tables, enums, indexes and triggers
--
-- Apply first. Written to be re-runnable: a second run is a no-op.
-- =========================================================================

-- --- Enumerated types ----------------------------------------------------
-- Enums rather than free text: the database rejects a typo instead of
-- silently storing it, and the TypeScript unions are generated from them.

do $$ begin
  create type listing_category as enum
    ('books', 'electronics', 'furniture', 'hostel', 'notes', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type item_condition as enum
    ('new', 'like_new', 'good', 'fair', 'poor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type listing_status as enum ('available', 'sold');
exception when duplicate_object then null; end $$;


-- --- profiles ------------------------------------------------------------
-- auth.users is not readable by the app, so a seller's display name needs a
-- row in a schema the app can select from.

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  created_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Public-facing user fields. One row per auth.users row, created by trigger.';


-- --- pickup_spots --------------------------------------------------------
-- A lookup table, not an enum: these are campus facts that may change, and
-- the filter UI needs to list them with descriptions.

create table if not exists public.pickup_spots (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  sort_order  smallint not null default 0
);


-- --- listings ------------------------------------------------------------

create table if not exists public.listings (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references public.profiles (id) on delete cascade,

  title           text not null
                    constraint listings_title_len
                    check (char_length(btrim(title)) between 3 and 120),
  description     text not null
                    constraint listings_description_len
                    check (char_length(btrim(description)) between 10 and 2000),
  price           numeric(10, 2) not null
                    constraint listings_price_range
                    check (price >= 0 and price <= 1000000),

  category        listing_category not null,
  condition       item_condition   not null,
  status          listing_status   not null default 'available',

  -- Bucket-relative path, not a full URL: the public URL is derived at render
  -- time, so changing bucket or project never requires rewriting rows.
  image_path      text,

  pickup_spot_id  uuid references public.pickup_spots (id) on delete set null,

  -- Campus-specific, both searchable.
  course_code     text
                    constraint listings_course_code_fmt
                    check (course_code is null or course_code ~ '^[A-Za-z0-9]{2,12}$'),
  semester        smallint
                    constraint listings_semester_range
                    check (semester is null or semester between 1 and 8),

  -- Populated by the ISBN scan / Google Books lookup.
  isbn            text
                    constraint listings_isbn_fmt
                    check (isbn is null or isbn ~ '^[0-9Xx-]{10,17}$'),
  book_author     text,
  -- Baseline for the fair-price hint. Stored so the hint is stable and needs
  -- no Google Books call per page view; condition is applied at display time,
  -- so the heuristic can be tuned without a migration.
  original_price  numeric(10, 2)
                    constraint listings_original_price_nonneg
                    check (original_price is null or original_price >= 0),

  sold_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);


-- --- Full-text search ----------------------------------------------------
-- Weighted so a title or course-code match outranks a description match.
-- A generated column stays correct by construction: there is no way to update
-- a row and forget to refresh the search index.

alter table public.listings drop column if exists search_vector;

alter table public.listings
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')),       'A') ||
    setweight(to_tsvector('english', coalesce(course_code, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(book_author, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored;


-- --- Indexes -------------------------------------------------------------

create index if not exists listings_search_idx
  on public.listings using gin (search_vector);

-- The default browse query: available listings, newest first.
create index if not exists listings_status_created_idx
  on public.listings (status, created_at desc);

create index if not exists listings_seller_idx      on public.listings (seller_id);
create index if not exists listings_category_idx    on public.listings (category);
create index if not exists listings_pickup_spot_idx on public.listings (pickup_spot_id);
create index if not exists listings_course_code_idx on public.listings (course_code);
create index if not exists listings_semester_idx    on public.listings (semester);


-- --- wishlist_items ------------------------------------------------------
-- The composite primary key is what prevents duplicate saves; no
-- application-level "already saved?" check is needed.

create table if not exists public.wishlist_items (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings  (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index if not exists wishlist_listing_idx on public.wishlist_items (listing_id);


-- --- inquiries (bonus 4) -------------------------------------------------
-- Created now so the schema does not need reshaping if this gets built.

create table if not exists public.inquiries (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id   uuid not null references public.profiles (id) on delete cascade,
  body       text not null
               constraint inquiries_body_len
               check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists inquiries_listing_idx on public.inquiries (listing_id, created_at desc);
create index if not exists inquiries_buyer_idx   on public.inquiries (buyer_id);


-- --- Trigger: create a profile for every new auth user -------------------
-- security definer so it can write to public.profiles regardless of caller.
-- search_path is pinned empty to prevent search-path hijacking, which is why
-- every name below is schema-qualified.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, 'student'), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- --- Trigger: maintain updated_at and sold_at ----------------------------
-- sold_at is derived from the status transition rather than trusted from the
-- client, so it cannot be back-dated by a crafted request.

create or replace function public.listings_before_update()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();

  if new.status = 'sold' and old.status <> 'sold' then
    new.sold_at := now();
  elsif new.status = 'available' then
    new.sold_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.listings_before_update();

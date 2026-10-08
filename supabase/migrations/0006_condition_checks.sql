-- =========================================================================
-- 0006_condition_checks.sql — category-specific condition checklists
--
-- Apply after 0005. Re-runnable.
--
-- NOTE: run this file on its own. `alter type ... add value` must be committed
-- before the new value can be used, so do not paste it together with anything
-- that inserts a 'lab' listing.
-- =========================================================================

-- --- New category: lab coats and gear ------------------------------------

alter type public.listing_category add value if not exists 'lab';


-- --- The checklist column ------------------------------------------------
-- A JSON object of things the seller confirms about their item, for example
--   {"charger_included": true, "battery_ok": true}
-- Which keys are allowed depends on the category, and is enforced below.
--
-- jsonb rather than one boolean column per item: the items differ by category,
-- so separate columns would be mostly NULL and every new item would need a
-- schema change. The cost of jsonb is that the database no longer knows the
-- shape by itself - which is what the trigger further down puts back.

alter table public.listings
  add column if not exists condition_checks jsonb not null default '{}'::jsonb;

alter table public.listings
  drop constraint if exists listings_condition_checks_is_object;
alter table public.listings
  add constraint listings_condition_checks_is_object
  check (jsonb_typeof(condition_checks) = 'object');

-- A hard ceiling on size, independent of the key check below: a crafted
-- request cannot use this column to store a large blob.
alter table public.listings
  drop constraint if exists listings_condition_checks_small;
alter table public.listings
  add constraint listings_condition_checks_small
  check (pg_column_size(condition_checks) < 1024);


-- --- Validate keys and values per category -------------------------------
--
-- WHY THIS IS IN THE DATABASE AND NOT ONLY IN THE APP
-- The app validates the checklist with zod in the form and again in the Server
-- Action. But the publishable key lets any signed-in user insert into
-- `listings` through the REST API directly, skipping both. RLS would allow it:
-- it is their own row. So without this trigger a crafted request could store
-- arbitrary keys, or strings where a tick belongs, and the detail page would
-- be rendering attacker-chosen structure. The trigger makes the allowed shape
-- a property of the table.
--
-- The key lists here mirror CONDITION_CHECKS in src/lib/types/listing.ts.

create or replace function public.listings_validate_condition_checks()
returns trigger
language plpgsql
as $$
declare
  v_allowed text[];
  v_key     text;
  v_value   jsonb;
begin
  -- Compared as text so this function does not depend on the 'lab' enum value
  -- having been committed before the function is created.
  v_allowed := case new.category::text
    when 'electronics' then array['charger_included', 'battery_ok', 'screen_unscratched']
    when 'books'       then array['no_highlighting', 'all_pages_intact']
    when 'lab'         then array['no_stains', 'size']
    else array[]::text[]
  end;

  for v_key, v_value in select key, value from jsonb_each(new.condition_checks) loop
    if not (v_key = any (v_allowed)) then
      raise exception 'condition_checks: "%" is not allowed for category %', v_key, new.category
        using errcode = 'check_violation';
    end if;

    if v_key = 'size' then
      if jsonb_typeof(v_value) <> 'string'
         or not ((v_value #>> '{}') = any (array['XS', 'S', 'M', 'L', 'XL', 'XXL'])) then
        raise exception 'condition_checks: size must be one of XS, S, M, L, XL, XXL'
          using errcode = 'check_violation';
      end if;
    elsif v_value <> 'true'::jsonb then
      -- Every other item is a tick: present and true, or absent. There is no
      -- "false", so "not stated" cannot be confused with "confirmed bad".
      raise exception 'condition_checks: "%" must be true or absent', v_key
        using errcode = 'check_violation';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists listings_validate_condition_checks on public.listings;
create trigger listings_validate_condition_checks
  before insert or update of condition_checks, category on public.listings
  for each row execute function public.listings_validate_condition_checks();


-- --- Two constraints the audit found missing ------------------------------

-- The form and the Server Action cap the author at 160 characters; the table
-- did not, so a direct API insert could exceed it.
alter table public.listings
  drop constraint if exists listings_book_author_len;
alter table public.listings
  add constraint listings_book_author_len
  check (book_author is null or char_length(book_author) <= 160);

-- A listing's photo must live in its own seller's Storage folder. The Server
-- Action already checks this; as a constraint it also holds for direct API
-- writes, so a user cannot point their listing at another user's object.
alter table public.listings
  drop constraint if exists listings_image_path_own_folder;
alter table public.listings
  add constraint listings_image_path_own_folder
  check (image_path is null or image_path like seller_id::text || '/%');

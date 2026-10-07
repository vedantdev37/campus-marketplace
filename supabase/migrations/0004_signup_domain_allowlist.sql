-- =========================================================================
-- 0004_signup_domain_allowlist.sql — restrict sign-up by email domain
--
-- Apply after 0003. Re-runnable.
--
-- AFTER running this you must enable the hook in the dashboard:
--   Authentication -> Hooks -> "Before User Created"
--   -> Postgres function -> public.hook_restrict_signup_by_email_domain
-- Until that is done the function exists but is never called.
--
-- WHY THIS IS NOT IN APPLICATION CODE
-- The publishable key lets anyone call /auth/v1/signup directly. A domain
-- check inside a Server Action is therefore bypassable with a single
-- hand-crafted request. This hook runs inside the database, on the auth
-- service's own insert path, so there is no way around it.
-- =========================================================================

-- --- Allowlist table ----------------------------------------------------
-- A table rather than a hardcoded list, so domains can be added or removed
-- without editing and redeploying a function.

create table if not exists public.signup_allowed_domains (
  domain     text primary key,
  note       text,
  created_at timestamptz not null default now()
);

comment on table public.signup_allowed_domains is
  'Email domains permitted to sign up. Deny by default: absence blocks signup.';

-- Configuration, not user data. No role is granted access and RLS is on with
-- no policies, so it is unreachable through the API from either anon or
-- authenticated. The hook reads it as a security definer function instead.
alter table public.signup_allowed_domains enable row level security;
revoke all on public.signup_allowed_domains from anon, authenticated;


-- --- The hook -----------------------------------------------------------
--
-- Deliberate deviation from Supabase's published example, which keeps both an
-- 'allow' and a 'deny' list and *permits* an address when neither matches.
-- That is allow-by-default: forget to deny a domain and it gets in. This
-- version is a pure allowlist, so the failure mode is a legitimate user being
-- refused rather than an illegitimate one admitted.
--
-- The published example also compares `lower(domain)` against `lower($1)`,
-- where `domain` collides with the table's own column name and `$1` is the
-- jsonb event argument rather than the extracted domain. The local variable
-- here is prefixed to avoid that shadowing.

create or replace function public.hook_restrict_signup_by_email_domain(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email   text;
  v_domain  text;
  v_allowed boolean;
begin
  v_email := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));

  -- This app is email-only. Anything without a usable address is refused
  -- rather than allowed through on a technicality.
  if v_email = '' or position('@' in v_email) = 0 then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message',   'An email address is required to sign up.',
        'http_code', 400
      )
    );
  end if;

  v_domain := split_part(v_email, '@', 2);

  select exists (
    select 1
    from public.signup_allowed_domains d
    where lower(d.domain) = v_domain
  ) into v_allowed;

  if v_allowed then
    return '{}'::jsonb;   -- empty object = permit
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'message',   'Sign-up is limited to approved campus email domains.',
      'http_code', 403
    )
  );
end;
$$;


-- --- Permissions ---------------------------------------------------------
-- Only the auth service may invoke the hook. Revoking from anon/authenticated
-- matters because a callable hook function is an oracle: without this, a
-- client could probe which domains are permitted.

grant execute on function public.hook_restrict_signup_by_email_domain(jsonb)
  to supabase_auth_admin;

revoke execute on function public.hook_restrict_signup_by_email_domain(jsonb)
  from anon, authenticated, public;

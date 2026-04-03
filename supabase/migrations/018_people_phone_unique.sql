-- Non-empty phones are unique (case-insensitive, trimmed). Multiple NULL/blank phones allowed.

create unique index if not exists people_phone_lower_trim_unique
  on public.people (lower(trim(phone)))
  where phone is not null and trim(phone) <> '';

create or replace function public.person_phone_is_duplicate(
  p_phone text,
  p_exclude_person_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.people p
    where p_phone is not null
      and trim(p_phone) <> ''
      and p.phone is not null
      and trim(p.phone) <> ''
      and lower(trim(p.phone)) = lower(trim(p_phone))
      and (p_exclude_person_id is null or p.id <> p_exclude_person_id)
  );
$$;

grant execute on function public.person_phone_is_duplicate(text, uuid) to authenticated, anon, service_role;

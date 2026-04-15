-- Returns the first matching person (same phone rule as unique index: lower(trim)).

create or replace function public.person_phone_conflict(
  p_phone text,
  p_exclude_person_id uuid default null
)
returns table(conflict_id uuid, conflict_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name
  from public.people p
  where p_phone is not null
    and trim(p_phone) <> ''
    and p.phone is not null
    and trim(p.phone) <> ''
    and lower(trim(p.phone)) = lower(trim(p_phone))
    and (p_exclude_person_id is null or p.id <> p_exclude_person_id)
  limit 1;
$$;

grant execute on function public.person_phone_conflict(text, uuid) to authenticated, anon, service_role;

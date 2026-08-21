-- Old-system ID for incremental people import / re-import matching.
-- Blank values are allowed; non-empty codes are unique (trim + lower).

alter table public.people
  add column if not exists external_code text;

create unique index if not exists people_external_code_lower_trim_unique
  on public.people (lower(trim(external_code)))
  where external_code is not null and trim(external_code) <> '';

notify pgrst, 'reload schema';

-- For databases that already applied 032 before it included NOTIFY: refresh PostgREST.
-- Safe to run multiple times.
NOTIFY pgrst, 'reload schema';

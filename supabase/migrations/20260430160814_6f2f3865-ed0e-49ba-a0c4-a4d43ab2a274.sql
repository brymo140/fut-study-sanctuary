-- Force PostgREST to reload its schema cache.
-- This resolves the transient "could not query the database for the schema cache. retrying."
-- error that appears in the admin panel after recent schema changes.
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
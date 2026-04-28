-- Restrict storage.objects SELECT on public buckets so listing is not allowed.
-- We achieve this by limiting SELECT to a per-object lookup pattern is not feasible at policy level,
-- so instead we revoke broad SELECT and only allow it via signed/public URLs (which bypass RLS for public buckets).
-- For public buckets (avatars, covers), public file URLs work without RLS SELECT. So we drop the broad SELECT policies.

DROP POLICY IF EXISTS "Avatars publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Covers publicly viewable" ON storage.objects;

-- Public buckets serve files directly via the public URL (no RLS check needed for object download).
-- Removing the SELECT policy prevents anonymous LIST operations while keeping public URL downloads working.

-- Revoke EXECUTE on SECURITY DEFINER functions from public roles
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies which run as the policy owner, so no GRANT needed for that path.
-- handle_new_user is only called by the auth.users trigger, no GRANT needed.
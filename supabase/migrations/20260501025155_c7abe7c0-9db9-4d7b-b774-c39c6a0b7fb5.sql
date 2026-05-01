DROP FUNCTION IF EXISTS public.ensure_permanent_admin_role(uuid, text);

DROP POLICY IF EXISTS "Permanent admins can self-assign admin role" ON public.user_roles;
CREATE POLICY "Permanent admins can self-assign admin role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'admin'::app_role
  AND lower(COALESCE(auth.jwt() ->> 'email', '')) IN (
    'lawalibrahimakorede@gmail.com',
    'lawalibrahim1240brymo@gmail.com'
  )
);

NOTIFY pgrst, 'reload schema';
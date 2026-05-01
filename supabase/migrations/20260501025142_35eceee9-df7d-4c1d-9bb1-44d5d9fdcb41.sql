CREATE OR REPLACE FUNCTION public.ensure_permanent_admin_role(_user_id uuid, _email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_emails CONSTANT text[] := ARRAY[
    'lawalibrahimakorede@gmail.com',
    'lawalibrahim1240brymo@gmail.com'
  ];
BEGIN
  IF auth.uid() IS DISTINCT FROM _user_id THEN
    RETURN false;
  END IF;

  IF lower(COALESCE(_email, '')) <> ALL(admin_emails) THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin'::app_role)
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles
  SET is_banned = false, updated_at = now()
  WHERE id = _user_id;

  RETURN true;
END;
$$;

NOTIFY pgrst, 'reload schema';
-- One-time backfill: assign admin role to the two hardcoded admin emails
-- if they already have an account. Safe to run multiple times.
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::app_role
FROM public.profiles p
WHERE LOWER(p.email) IN ('lawalibrahimakorede@gmail.com', 'lawalibrahim1240brymo@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;
DROP INDEX IF EXISTS public.app_settings_key_unique;
ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_key_key;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_key_key UNIQUE (key);

NOTIFY pgrst, 'reload schema';
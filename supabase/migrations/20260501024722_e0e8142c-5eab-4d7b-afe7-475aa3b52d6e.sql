-- Extend existing settings table to support key-value settings without dropping data.
ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_singleton;

CREATE SEQUENCE IF NOT EXISTS public.app_settings_id_seq;
SELECT setval('public.app_settings_id_seq', COALESCE((SELECT MAX(id) FROM public.app_settings), 1));
ALTER TABLE public.app_settings
  ALTER COLUMN id SET DEFAULT nextval('public.app_settings_id_seq');
ALTER SEQUENCE public.app_settings_id_seq OWNED BY public.app_settings.id;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS key text,
  ADD COLUMN IF NOT EXISTS value text;

CREATE UNIQUE INDEX IF NOT EXISTS app_settings_key_unique
  ON public.app_settings (key)
  WHERE key IS NOT NULL;

INSERT INTO public.app_settings (key, value)
SELECT 'app_tagline', COALESCE((SELECT app_tagline FROM public.app_settings WHERE id = 1), 'FUTMinna · Your academic sanctuary')
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'app_tagline');

INSERT INTO public.app_settings (key, value)
SELECT 'adsense_publisher_id', COALESCE((SELECT adsense_publisher_id FROM public.app_settings WHERE id = 1), 'ca-pub-4988426041877845')
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'adsense_publisher_id');

INSERT INTO public.app_settings (key, value)
SELECT 'maintenance_mode', COALESCE((SELECT maintenance_mode::text FROM public.app_settings WHERE id = 1), 'false')
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'maintenance_mode');

INSERT INTO public.app_settings (key, value)
SELECT 'admin_display_name', ''
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'admin_display_name');

NOTIFY pgrst, 'reload schema';
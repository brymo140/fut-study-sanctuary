
-- App settings (single row, key-value style)
CREATE TABLE public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  adsense_publisher_id TEXT DEFAULT 'ca-pub-4988426041877845',
  app_tagline TEXT DEFAULT 'FUTMinna · Your academic sanctuary',
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);

INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settings viewable by everyone"
  ON public.app_settings FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins update settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Add is_active flag to announcements
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Add is_banned to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;

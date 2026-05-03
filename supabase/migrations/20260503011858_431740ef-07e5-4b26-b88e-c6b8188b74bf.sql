-- 1. notification_reads: per-user marker for read in-app notifications
CREATE TABLE IF NOT EXISTS public.notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  notification_key TEXT NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, notification_key)
);
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own reads" ON public.notification_reads;
DROP POLICY IF EXISTS "Users insert own reads" ON public.notification_reads;
DROP POLICY IF EXISTS "Users delete own reads" ON public.notification_reads;

CREATE POLICY "Users view own reads" ON public.notification_reads
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own reads" ON public.notification_reads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own reads" ON public.notification_reads
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON public.notification_reads(user_id);

-- 2. push_tokens: scaffold for native push notifications
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  platform TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own tokens" ON public.push_tokens;
CREATE POLICY "Users manage own tokens" ON public.push_tokens
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Migrate adsense_publisher_id -> admob_app_id in key/value rows
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('admob_app_id', 'ca-pub-4988426041877845', now())
ON CONFLICT (key) DO NOTHING;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
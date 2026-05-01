-- Keep the admin email list centralized in database logic for future signups.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  assigned_role app_role := 'student';
  admin_emails CONSTANT text[] := ARRAY[
    'lawalibrahimakorede@gmail.com',
    'lawalibrahim1240brymo@gmail.com'
  ];
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  IF lower(COALESCE(NEW.email, '')) = ANY(admin_emails) THEN
    assigned_role := 'admin';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop old duplicate/permissive admin write policy names so the app has one consistent rule per action.
DROP POLICY IF EXISTS "Admin insert pdfs" ON public.pdfs;
DROP POLICY IF EXISTS "Admin update pdfs" ON public.pdfs;
DROP POLICY IF EXISTS "Admin delete pdfs" ON public.pdfs;
DROP POLICY IF EXISTS "Auth write pdfs" ON public.pdfs;
DROP POLICY IF EXISTS "Auth update pdfs" ON public.pdfs;
DROP POLICY IF EXISTS "Auth delete pdfs" ON public.pdfs;

DROP POLICY IF EXISTS "Admin insert chapters" ON public.chapters;
DROP POLICY IF EXISTS "Admin update chapters" ON public.chapters;
DROP POLICY IF EXISTS "Admin delete chapters" ON public.chapters;
DROP POLICY IF EXISTS "Auth write chapters" ON public.chapters;
DROP POLICY IF EXISTS "Auth update chapters" ON public.chapters;
DROP POLICY IF EXISTS "Auth delete chapters" ON public.chapters;

DROP POLICY IF EXISTS "Admin insert announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admin update announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admin delete announcements" ON public.announcements;
DROP POLICY IF EXISTS "Auth write announcements" ON public.announcements;
DROP POLICY IF EXISTS "Auth update announcements" ON public.announcements;
DROP POLICY IF EXISTS "Auth delete announcements" ON public.announcements;

DROP POLICY IF EXISTS "Admin all youtube_channels" ON public.youtube_channels;
DROP POLICY IF EXISTS "Public read youtube_channels" ON public.youtube_channels;
DROP POLICY IF EXISTS "Auth write youtube_channels" ON public.youtube_channels;
DROP POLICY IF EXISTS "Auth update youtube_channels" ON public.youtube_channels;
DROP POLICY IF EXISTS "Auth delete youtube_channels" ON public.youtube_channels;

DROP POLICY IF EXISTS "Admin all youtube_videos" ON public.youtube_videos;
DROP POLICY IF EXISTS "Public read youtube_videos" ON public.youtube_videos;
DROP POLICY IF EXISTS "Auth write youtube_videos" ON public.youtube_videos;
DROP POLICY IF EXISTS "Auth update youtube_videos" ON public.youtube_videos;
DROP POLICY IF EXISTS "Auth delete youtube_videos" ON public.youtube_videos;

DROP POLICY IF EXISTS "Admin all app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Public read app_settings" ON public.app_settings;

-- PDFs: everyone can read, admins/reps can create, admins can edit/delete.
DROP POLICY IF EXISTS "Public read pdfs" ON public.pdfs;
CREATE POLICY "Public read pdfs" ON public.pdfs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Reps and admins insert PDFs" ON public.pdfs;
CREATE POLICY "Reps and admins insert PDFs" ON public.pdfs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'rep'::app_role));
DROP POLICY IF EXISTS "Admins update PDFs" ON public.pdfs;
CREATE POLICY "Admins update PDFs" ON public.pdfs
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins delete PDFs" ON public.pdfs;
CREATE POLICY "Admins delete PDFs" ON public.pdfs
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Chapters: public read, admins manage.
DROP POLICY IF EXISTS "Public read chapters" ON public.chapters;
CREATE POLICY "Public read chapters" ON public.chapters FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage chapters" ON public.chapters;
CREATE POLICY "Admins manage chapters" ON public.chapters
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Announcements: public read, admins manage.
DROP POLICY IF EXISTS "Public read announcements" ON public.announcements;
CREATE POLICY "Public read announcements" ON public.announcements FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage announcements" ON public.announcements;
CREATE POLICY "Admins manage announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- YouTube content: public read, admins manage.
DROP POLICY IF EXISTS "Channels viewable by authenticated" ON public.youtube_channels;
CREATE POLICY "Public read youtube_channels" ON public.youtube_channels FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage channels" ON public.youtube_channels;
CREATE POLICY "Admins manage channels" ON public.youtube_channels
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Videos viewable by authenticated" ON public.youtube_videos;
CREATE POLICY "Public read youtube_videos" ON public.youtube_videos FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage videos" ON public.youtube_videos;
CREATE POLICY "Admins manage videos" ON public.youtube_videos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Settings: public read, admins manage the singleton row.
DROP POLICY IF EXISTS "Settings viewable by everyone" ON public.app_settings;
CREATE POLICY "Public read app_settings" ON public.app_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins update settings" ON public.app_settings;
CREATE POLICY "Admins manage app_settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin user management helpers needed by Users and Reports admin screens.
DROP POLICY IF EXISTS "Admins update profiles" ON public.profiles;
CREATE POLICY "Admins update profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete profiles" ON public.profiles;
CREATE POLICY "Admins delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete reports" ON public.reports;
CREATE POLICY "Admins delete reports" ON public.reports
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Ask the API layer to reload table/policy metadata immediately.
NOTIFY pgrst, 'reload schema';
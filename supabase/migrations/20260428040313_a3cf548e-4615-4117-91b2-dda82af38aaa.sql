-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('student', 'rep', 'admin');
CREATE TYPE public.student_level AS ENUM ('100L', '200L', '300L', '400L', '500L');

-- ============ UPDATED_AT HELPER ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  level student_level,
  department TEXT,
  faculty TEXT,
  matric_no TEXT,
  avatar_url TEXT,
  xp INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_active DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins view all roles"
  ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ NEW USER TRIGGER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role app_role := 'student';
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  IF lower(NEW.email) = 'lawalibrahimakorede@gmail.com' THEN
    assigned_role := 'admin';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ PDFS ============
CREATE TABLE public.pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  course_code TEXT NOT NULL,
  level student_level NOT NULL,
  department TEXT,
  faculty TEXT,
  description TEXT,
  total_chapters INTEGER NOT NULL DEFAULT 0,
  file_size_mb NUMERIC(10,2) DEFAULT 0,
  cover_url TEXT,
  uploader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_past_question BOOLEAN NOT NULL DEFAULT false,
  is_general BOOLEAN NOT NULL DEFAULT false,
  year INTEGER,
  tags TEXT[] DEFAULT '{}',
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdfs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_pdfs_level ON public.pdfs(level);
CREATE INDEX idx_pdfs_course_code ON public.pdfs(course_code);
CREATE INDEX idx_pdfs_past_q ON public.pdfs(is_past_question);

CREATE POLICY "PDFs viewable by authenticated"
  ON public.pdfs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Reps and admins insert PDFs"
  ON public.pdfs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'rep'));

CREATE POLICY "Admins update PDFs"
  ON public.pdfs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete PDFs"
  ON public.pdfs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER pdfs_updated_at
  BEFORE UPDATE ON public.pdfs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CHAPTERS ============
CREATE TABLE public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_id UUID NOT NULL REFERENCES public.pdfs(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size_mb NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pdf_id, chapter_number)
);

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_chapters_pdf ON public.chapters(pdf_id);

CREATE POLICY "Chapters viewable by authenticated"
  ON public.chapters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage chapters"
  ON public.chapters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ DOWNLOADS ============
CREATE TABLE public.downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  pdf_id UUID NOT NULL REFERENCES public.pdfs(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, chapter_id)
);

ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_downloads_user ON public.downloads(user_id);

CREATE POLICY "Users view own downloads"
  ON public.downloads FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own downloads"
  ON public.downloads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own downloads"
  ON public.downloads FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins view all downloads"
  ON public.downloads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ BOOKMARKS ============
CREATE TABLE public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pdf_id UUID NOT NULL REFERENCES public.pdfs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pdf_id)
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own bookmarks"
  ON public.bookmarks FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own bookmarks"
  ON public.bookmarks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own bookmarks"
  ON public.bookmarks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ RATINGS ============
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pdf_id UUID NOT NULL REFERENCES public.pdfs(id) ON DELETE CASCADE,
  stars INTEGER NOT NULL,
  review_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pdf_id)
);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.validate_rating_stars()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.stars < 1 OR NEW.stars > 5 THEN
    RAISE EXCEPTION 'Stars must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ratings_validate
  BEFORE INSERT OR UPDATE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.validate_rating_stars();

CREATE POLICY "Ratings viewable by authenticated"
  ON public.ratings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert own ratings"
  ON public.ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own ratings"
  ON public.ratings FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users delete own ratings"
  ON public.ratings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ ANNOUNCEMENTS ============
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_level student_level,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Announcements viewable by authenticated"
  ON public.announcements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage announcements"
  ON public.announcements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ REPORTS ============
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pdf_id UUID NOT NULL REFERENCES public.pdfs(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own reports"
  ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all reports"
  ON public.reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own reports"
  ON public.reports FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ YOUTUBE CHANNELS ============
CREATE TABLE public.youtube_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name TEXT NOT NULL,
  channel_url TEXT NOT NULL,
  description TEXT,
  level student_level,
  course_tags TEXT[] DEFAULT '{}',
  thumbnail_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.youtube_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Channels viewable by authenticated"
  ON public.youtube_channels FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage channels"
  ON public.youtube_channels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ YOUTUBE VIDEOS ============
CREATE TABLE public.youtube_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_title TEXT NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  course_tag TEXT,
  level student_level,
  is_featured BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.youtube_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Videos viewable by authenticated"
  ON public.youtube_videos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage videos"
  ON public.youtube_videos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES ('chapters', 'chapters', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true);

-- Avatars: public read, users manage their own folder
CREATE POLICY "Avatars publicly viewable"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Covers: public read, admin write
CREATE POLICY "Covers publicly viewable"
  ON storage.objects FOR SELECT USING (bucket_id = 'covers');

CREATE POLICY "Admins manage covers"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'covers' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'covers' AND public.has_role(auth.uid(), 'admin'));

-- Chapters: private, only admins upload, signed URLs for download
CREATE POLICY "Authenticated read chapters via signed URL"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chapters');

CREATE POLICY "Admins upload chapters"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chapters' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update chapters"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'chapters' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete chapters"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chapters' AND public.has_role(auth.uid(), 'admin'));
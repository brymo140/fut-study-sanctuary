import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Flame, Megaphone, Play } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PdfCard, PdfSummary } from "@/components/PdfCard";
import { AnnouncementsSheet } from "@/components/AnnouncementsSheet";
import { NotificationsSheet } from "@/components/NotificationsSheet";
import { useRewardedYouTubeOpener } from "@/hooks/useRewardedYouTube";
import { maybeShowStudyReminder } from "@/lib/pushNotifications";
import { cacheData, getCachedData } from "@/lib/cache";
import { InlineAdSlot } from "@/components/ads/InlineAdSlot";
import { AD_UNITS } from "@/lib/admob";


const LEVELS = ["All", "100L", "200L", "300L", "400L", "500L"];

interface YTChannel {
  id: string;
  channel_name: string;
  channel_url: string;
  thumbnail_url: string | null;
  level: string | null;
}

const Home = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const openYouTube = useRewardedYouTubeOpener();
  const [activeLevel, setActiveLevel] = useState<string>("All");
  const [trending, setTrending] = useState<PdfSummary[]>([]);
  const [recent, setRecent] = useState<PdfSummary[]>([]);
  const [channels, setChannels] = useState<YTChannel[]>([]);
  const [annOpen, setAnnOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      maybeShowStudyReminder();
    }
  }, [user?.id]);

  useEffect(() => {
    const cacheKey = `home_${activeLevel}`;
    const cached = getCachedData<{ t: PdfSummary[]; r: PdfSummary[]; c: YTChannel[] }>(cacheKey);
    if (cached) {
      setTrending(cached.t || []);
      setRecent(cached.r || []);
      setChannels(cached.c || []);
    }
    const load = async () => {
      try {
        const trendingQ = supabase.from("pdfs").select("*").order("download_count", { ascending: false }).limit(6);
        const recentQ = supabase.from("pdfs").select("*").order("created_at", { ascending: false }).limit(10);
        const chQ = supabase.from("youtube_channels").select("id,channel_name,channel_url,thumbnail_url,level").eq("is_active", true).order("created_at", { ascending: false }).limit(8);

        if (activeLevel !== "All") {
          trendingQ.eq("level", activeLevel as "100L");
          recentQ.eq("level", activeLevel as "100L");
        }

        const [{ data: t }, { data: r }, { data: c }] = await Promise.all([trendingQ, recentQ, chQ]);
        const tt = (t as PdfSummary[]) || [];
        const rr = (r as PdfSummary[]) || [];
        const cc = (c as YTChannel[]) || [];
        setTrending(tt); setRecent(rr); setChannels(cc);
        cacheData(cacheKey, { t: tt, r: rr, c: cc });
      } catch (e) {
        console.warn("home load failed", e);
      } finally {
        setLoading(false);
      }
    };
    if (navigator.onLine) load();
    else setLoading(false);
  }, [activeLevel]);

  // Compute unread count using notification_reads (per-user dismissals).
  const computeUnread = async () => {
    if (!user) return;
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const lvl = profile?.level ?? null;
    const dept = profile?.department ?? null;

    const [{ data: ann }, { data: pdfs }, { data: reads }] = await Promise.all([
      supabase.from("announcements").select("id,target_level,created_at,is_active").gte("created_at", since).eq("is_active", true).limit(100),
      supabase.from("pdfs").select("id,level,department,is_general,created_at").gte("created_at", since).limit(100),
      supabase.from("notification_reads").select("announcement_id").eq("user_id", user.id),
    ]);
    const readKeys = new Set((reads || []).map((r: any) => r.announcement_id));

    let count = 0;
    for (const a of (ann || []) as any[]) {
      if (a.target_level && lvl && a.target_level !== lvl) continue;
      if (!readKeys.has(`ann-${a.id}`)) count++;
    }
    for (const p of (pdfs || []) as any[]) {
      const isGeneral = p.is_general === true;
      if (!isGeneral) {
        if (lvl && p.level !== lvl) continue;
        if (p.department && dept && p.department !== dept) continue;
      }
      if (!readKeys.has(`pdf-${p.id}`)) count++;
    }
    setUnreadCount(count);
  };

  useEffect(() => { computeUnread(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id, profile?.level, profile?.department, notifOpen]);

  // Realtime: bump unread when new content arrives.
  useEffect(() => {
    const channel = supabase
      .channel("home-notifs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "announcements" }, () => computeUnread())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pdfs" }, () => computeUnread())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.level, profile?.department]);

  const initials = (profile?.full_name || profile?.email || "U")
    .split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const firstName = (profile?.full_name || profile?.email || "there").split(" ")[0];

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="surface-card p-4 animate-pulse" />
        <div className="surface-card p-4 animate-pulse" />
        <div className="surface-card p-4 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header — greeting + bell + avatar */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold">👋 Hello, {firstName}!</p>
          <p className="text-[11px] text-muted-foreground">Welcome back to HighVault</p>
        </div>
        <div className="flex items-center gap-2">
          {(profile?.streak ?? 0) > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full surface-card text-xs font-semibold">
              <Flame className="h-3.5 w-3.5 text-warning" />
              <span>{profile?.streak}</span>
            </div>
          )}
          <button onClick={() => setAnnOpen(true)} aria-label="Announcements" className="relative h-9 w-9 rounded-full surface-card flex items-center justify-center hover:border-primary">
            <Megaphone className="h-4 w-4 text-foreground/80" />
          </button>
          <button onClick={() => setNotifOpen(true)} aria-label="Notifications" className="relative h-9 w-9 rounded-full surface-card flex items-center justify-center hover:border-primary">
            <Bell className="h-4 w-4 text-foreground/80" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate("/profile")}
            className="h-9 w-9 rounded-full bg-gradient-brand flex items-center justify-center text-xs font-bold text-white"
            aria-label="Profile"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
            ) : initials}
          </button>
        </div>
      </header>

      <InlineAdSlot adUnitId={AD_UNITS.homeBanner1} size="banner" />

      {/* Level pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {LEVELS.map((lvl) => (
          <button
            key={lvl}
            onClick={() => setActiveLevel(lvl)}
            className={`level-pill ${activeLevel === lvl ? "level-pill-active" : ""}`}
          >
            {lvl}
          </button>
        ))}
      </div>

      <Section title="Trending this week" subtitle="Most downloaded by your peers">
        {trending.length === 0 ? (
          <EmptyHint text="No trending materials yet. Check back soon." />
        ) : (
          <div className="flex gap-3 overflow-x-auto scrollbar-hide">
            {trending.map((p, i) => (
              <div key={p.id} className="relative">
                {i === 0 && (
                  <span className="absolute -top-1 -right-1 z-10 badge-purple">Trending</span>
                )}
                <PdfCard pdf={p} variant="trending" rating={4.6} />
              </div>
            ))}
          </div>
        )}
      </Section>

      <InlineAdSlot adUnitId={AD_UNITS.homeBanner2} size="banner" />

      <Section
        title="Learning channels"
        subtitle="Curated YouTube tutors for your level"
        right={<Link to="/watch" className="text-xs text-primary font-medium">See all →</Link>}
      >
        {channels.length === 0 ? (
          <EmptyHint text="No channels yet. Admins can add them in /admin." />
        ) : (
          <div className="flex gap-3 overflow-x-auto scrollbar-hide">
            {channels.map((c) => (
              <button
                key={c.id} onClick={() => openYouTube(c.channel_url)} type="button"
                className="text-left shrink-0 w-44 surface-card p-3 hover:border-primary transition-colors"
              >
                <div className="aspect-video rounded-lg bg-gradient-cover mb-2 flex items-center justify-center overflow-hidden">
                  {c.thumbnail_url
                    ? <img src={c.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    : <Play className="h-8 w-8 text-white/80" />}
                </div>
                <p className="text-xs font-semibold line-clamp-1 mb-1">{c.channel_name}</p>
                <div className="flex items-center justify-between">
                  {c.level && <span className="badge-blue">{c.level}</span>}
                  <span className="h-7 w-7 rounded-full bg-youtube flex items-center justify-center">
                    <Play className="h-3 w-3 text-white fill-white" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section title="Recently added" subtitle="Fresh uploads from class reps">
        {recent.length === 0 ? (
          <EmptyHint text="Nothing here yet — uploads will show up as they arrive." />
        ) : (
          <div className="space-y-2.5">
            {recent.map((p) => <PdfCard key={p.id} pdf={p} />)}
          </div>
        )}
      </Section>

      <AnnouncementsSheet open={annOpen} onOpenChange={setAnnOpen} userLevel={profile?.level} />
      <NotificationsSheet
        open={notifOpen}
        onOpenChange={setNotifOpen}
        userLevel={profile?.level}
        userDepartment={profile?.department}
        onChange={computeUnread}
      />
    </div>
  );
};

const Section = ({ title, subtitle, right, children }: any) => (
  <section>
    <div className="flex items-end justify-between mb-3">
      <div>
        <h2 className="text-base font-bold">{title}</h2>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
    {children}
  </section>
);

const EmptyHint = ({ text }: { text: string }) => (
  <div className="surface-card p-6 text-center text-sm text-muted-foreground">{text}</div>
);

export default Home;

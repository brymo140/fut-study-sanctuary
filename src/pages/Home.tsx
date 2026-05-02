import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Bell, Flame, Megaphone, Play } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PdfCard, PdfSummary } from "@/components/PdfCard";
import { AnnouncementsSheet } from "@/components/AnnouncementsSheet";
import { NotificationsSheet } from "@/components/NotificationsSheet";


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
  const { profile } = useAuth();
  const [activeLevel, setActiveLevel] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [trending, setTrending] = useState<PdfSummary[]>([]);
  const [recent, setRecent] = useState<PdfSummary[]>([]);
  const [channels, setChannels] = useState<YTChannel[]>([]);
  const [annOpen, setAnnOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    const load = async () => {
      const filter = activeLevel === "All" ? {} : { level: activeLevel };

      const trendingQ = supabase.from("pdfs").select("*").order("download_count", { ascending: false }).limit(6);
      const recentQ = supabase.from("pdfs").select("*").order("created_at", { ascending: false }).limit(10);
      const chQ = supabase.from("youtube_channels").select("id,channel_name,channel_url,thumbnail_url,level").eq("is_active", true).order("created_at", { ascending: false }).limit(8);

      if (activeLevel !== "All") {
        trendingQ.eq("level", activeLevel as "100L");
        recentQ.eq("level", activeLevel as "100L");
      }

      const [{ data: t }, { data: r }, { data: c }] = await Promise.all([trendingQ, recentQ, chQ]);
      setTrending((t as PdfSummary[]) || []);
      setRecent((r as PdfSummary[]) || []);
      setChannels((c as YTChannel[]) || []);
    };
    load();
  }, [activeLevel]);

  // Unread badge: any announcement or pdf newer than last seen timestamp
  useEffect(() => {
    const check = async () => {
      const lastSeen = localStorage.getItem("notifs:lastSeen") || new Date(Date.now() - 7 * 86400000).toISOString();
      const [{ data: ann }, { data: pdfs }] = await Promise.all([
        supabase.from("announcements").select("id,target_level,created_at").gt("created_at", lastSeen).limit(20),
        supabase.from("pdfs").select("id,level,created_at").gt("created_at", lastSeen).limit(20),
      ]);
      const lvl = profile?.level ?? null;
      const annHit = (ann || []).some((a: any) => !a.target_level || !lvl || a.target_level === lvl);
      const pdfHit = (pdfs || []).some((p: any) => !lvl || p.level === lvl);
      setHasUnread(annHit || pdfHit);
    };
    check();
  }, [profile?.level, notifOpen]);

  // Realtime: flash the bell when new announcements / pdfs arrive while the app is open
  useEffect(() => {
    const channel = supabase
      .channel("home-notifs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "announcements" }, (payload: any) => {
        const lvl = profile?.level ?? null;
        const t = payload.new?.target_level;
        if (!t || !lvl || t === lvl) setHasUnread(true);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pdfs" }, (payload: any) => {
        const lvl = profile?.level ?? null;
        if (!lvl || payload.new?.level === lvl) setHasUnread(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.level]);

  const initials = (profile?.full_name || profile?.email || "U")
    .split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  const filteredRecent = search
    ? recent.filter((p) =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.course_code.toLowerCase().includes(search.toLowerCase())
      )
    : recent;

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex items-center justify-between">
        <Logo size="md" />
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
            {hasUnread && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />}
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search course, code, level…"
          className="w-full bg-surface border border-border rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary"
        />
      </div>

      {/* Level pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
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

      {/* Trending */}
      <Section title="Trending this week" subtitle="Most downloaded by your peers">
        {trending.length === 0 ? (
          <EmptyHint text="No trending materials yet. Check back soon." />
        ) : (
          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4">
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

      {/* Learning Channels */}
      <Section
        title="Learning channels"
        subtitle="Curated YouTube tutors for your level"
        right={<Link to="/watch" className="text-xs text-primary font-medium">See all →</Link>}
      >
        {channels.length === 0 ? (
          <EmptyHint text="No channels yet. Admins can add them in /admin." />
        ) : (
          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4">
            {channels.map((c) => (
              <a
                key={c.id} href={c.channel_url} target="_blank" rel="noreferrer"
                className="shrink-0 w-44 surface-card p-3 hover:border-primary transition-colors"
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
              </a>
            ))}
          </div>
        )}
      </Section>

      

      {/* Recently added */}
      <Section title="Recently added" subtitle="Fresh uploads from class reps">
        {filteredRecent.length === 0 ? (
          <EmptyHint text="Nothing here yet — uploads will show up as they arrive." />
        ) : (
          <div className="space-y-2.5">
            {filteredRecent.map((p) => <PdfCard key={p.id} pdf={p} />)}
          </div>
        )}
      </Section>

      <AnnouncementsSheet open={annOpen} onOpenChange={setAnnOpen} userLevel={profile?.level} />
      <NotificationsSheet
        open={notifOpen}
        onOpenChange={setNotifOpen}
        userLevel={profile?.level}
        onSeen={() => setHasUnread(false)}
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

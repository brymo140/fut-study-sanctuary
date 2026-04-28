import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const LEVELS = ["All", "100L", "200L", "300L", "400L", "500L"];

interface Channel {
  id: string; channel_name: string; channel_url: string; description: string | null;
  level: string | null; course_tags: string[] | null; thumbnail_url: string | null;
}
interface Video {
  id: string; video_title: string; video_url: string; thumbnail_url: string | null;
  course_tag: string | null; level: string | null;
}

const Watch = () => {
  const [level, setLevel] = useState("All");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [featured, setFeatured] = useState<Video[]>([]);

  useEffect(() => {
    const load = async () => {
      let chQ = supabase.from("youtube_channels").select("*").eq("is_active", true).order("created_at", { ascending: false });
      if (level !== "All") chQ = chQ.eq("level", level as "100L");
      const { data: ch } = await chQ;
      setChannels((ch as Channel[]) || []);

      const { data: v } = await supabase.from("youtube_videos").select("*").eq("is_featured", true).order("created_at", { ascending: false }).limit(10);
      setFeatured((v as Video[]) || []);
    };
    load();
  }, [level]);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Learning channels</h1>
          <span className="h-6 w-6 rounded-md bg-youtube flex items-center justify-center">
            <Play className="h-3 w-3 text-white fill-white" />
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Curated video tutors for your level</p>
      </div>

      {/* Featured videos */}
      {featured.length > 0 && (
        <section>
          <h2 className="text-sm font-bold mb-3">Featured videos</h2>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4">
            {featured.map((v) => (
              <a
                key={v.id} href={v.video_url} target="_blank" rel="noreferrer"
                className="shrink-0 w-56 surface-card p-2 hover:border-primary transition-colors"
              >
                <div className="aspect-video rounded-lg bg-gradient-cover mb-2 flex items-center justify-center overflow-hidden relative">
                  {v.thumbnail_url
                    ? <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    : <Play className="h-10 w-10 text-white/80" />}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-10 w-10 rounded-full bg-youtube flex items-center justify-center">
                      <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                    </div>
                  </div>
                </div>
                <p className="text-sm font-semibold line-clamp-2 mb-1.5 px-1">{v.video_title}</p>
                <div className="flex items-center justify-between px-1 pb-1">
                  {v.course_tag && <span className="text-[10px] text-muted-foreground">{v.course_tag}</span>}
                  {v.level && <span className="badge-blue">{v.level}</span>}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Level pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
        {LEVELS.map((l) => (
          <button key={l} onClick={() => setLevel(l)} className={`level-pill ${level === l ? "level-pill-active" : ""}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Channels grid */}
      {channels.length === 0 ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          No channels yet for this level.
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map((c) => (
            <div key={c.id} className="surface-card p-3 flex gap-3">
              <div className="h-20 w-20 shrink-0 rounded-lg bg-gradient-cover overflow-hidden flex items-center justify-center">
                {c.thumbnail_url
                  ? <img src={c.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  : <Play className="h-8 w-8 text-white/80" />}
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold line-clamp-1">{c.channel_name}</p>
                  {c.level && <span className="badge-blue shrink-0">{c.level}</span>}
                </div>
                {c.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{c.description}</p>
                )}
                {c.course_tags && c.course_tags.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">{c.course_tags.join(" · ")}</p>
                )}
                <a
                  href={c.channel_url} target="_blank" rel="noreferrer"
                  className="mt-auto inline-flex items-center justify-center gap-1.5 bg-youtube hover:bg-youtube/90 text-white text-xs font-bold px-3 py-1.5 rounded-md self-start"
                >
                  <Play className="h-3 w-3 fill-white" /> Watch on YouTube
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Watch;

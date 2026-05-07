import { useEffect, useState } from "react";
import { Play, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SplashLoader } from "@/components/SplashLoader";

import { useRewardedYouTubeOpener } from "@/hooks/useRewardedYouTube";

// Add VITE_YOUTUBE_API_KEY to your .env file — get free key from Google Cloud Console > YouTube Data API v3
const YT_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;

interface YTResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

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
  const [pageError, setPageError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const openYouTube = useRewardedYouTubeOpener();
  const [level, setLevel] = useState("All");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [featured, setFeatured] = useState<Video[]>([]);

  // YouTube search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [results, setResults] = useState<YTResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
  const load = async () => {
    setLoadingData(true);
    try {
      let chQ = supabase
        .from("youtube_channels")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (level !== "All") chQ = chQ.eq("level", level as any);
      const { data: ch, error: chError } = await chQ;
      if (chError) {
        console.error("Channels error:", chError);
        setChannels([]);
      } else {
        setChannels((ch as Channel[]) || []);
      }
    } catch (e) {
      console.error("Watch page load error:", e);
      setChannels([]);
    }

    try {
      const { data: v, error: vError } = await supabase
        .from("youtube_videos")
        .select("*")
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(10);
      if (vError) {
        console.error("Videos error:", vError);
        setFeatured([]);
      } else {
        setFeatured((v as Video[]) || []);
      }
    } catch (e) {
      console.error("Featured videos error:", e);
      setFeatured([]);
    }
    setLoadingData(false);
  };
  load().catch((err) => {
    console.error("Watch load fatal error:", err);
    setChannels([]);
    setFeatured([]);
    setPageError("We could not load this page right now.");
    setLoadingData(false);
  });
}, [level]);

  const runSearch = async (q: string) => {
    const query = q.trim();
    if (!query) { setResults(null); setSearchQuery(""); setSearchError(null); return; }
    if (!YT_API_KEY) {
      setSearchError("YouTube search not configured. Add VITE_YOUTUBE_API_KEY to .env");
      setResults([]);
      setSearchQuery(query);
      return;
    }
    setSearching(true);
    setSearchError(null);
    setSearchQuery(query);
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&relevanceLanguage=en&q=${encodeURIComponent(query)}&key=${YT_API_KEY}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(String(resp.status));
      const json = await resp.json();
      const items: YTResult[] = (json.items || []).map((it: any) => ({
        videoId: it.id?.videoId,
        title: it.snippet?.title || "",
        channelTitle: it.snippet?.channelTitle || "",
        thumbnail: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || "",
      })).filter((r: YTResult) => r.videoId);
      setResults(items);
    } catch (e) {
      console.error("YT search failed", e);
      setSearchError("Search failed — check your connection");
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => { setSearchInput(""); setSearchQuery(""); setResults(null); setSearchError(null); };

  const showSearchResults = !!searchQuery;

  if (pageError) return (
    <div className="p-8 text-center text-muted-foreground">
      <p>📺 {pageError}</p>
    </div>
  );
  try {
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

      {/* YouTube search bar */}
      <form
        onSubmit={(e) => { e.preventDefault(); runSearch(searchInput); }}
        className="surface-card flex items-center gap-2 px-3 py-2"
      >
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search YouTube videos…"
          className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
        />
        {showSearchResults && (
          <button type="button" onClick={clearSearch} className="text-[11px] text-muted-foreground hover:text-foreground">Clear</button>
        )}
        <button type="submit" className="bg-youtube hover:bg-youtube/90 text-white text-xs font-bold px-3 py-1.5 rounded-md">
          Search
        </button>
      </form>

      {/* Search results */}
      {showSearchResults && (
        <section className="space-y-3">
          <p className="text-sm font-bold">Results for "{searchQuery}"</p>
          {searching ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="surface-card p-3 flex gap-3 animate-pulse">
                  <div className="h-20 w-32 rounded-lg bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 bg-muted rounded" />
                    <div className="h-2.5 w-1/2 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : searchError ? (
            <div className="surface-card p-6 text-center text-sm text-destructive">{searchError}</div>
          ) : results && results.length === 0 ? (
            <div className="surface-card p-6 text-center text-sm text-muted-foreground">
              No results found for "{searchQuery}"
            </div>
          ) : (
            <div className="space-y-3">
              {results?.map((r) => (
                <div key={r.videoId} className="surface-card p-3 flex gap-3">
                  <div className="h-20 w-32 shrink-0 rounded-lg overflow-hidden bg-gradient-cover">
                    {r.thumbnail && <img src={r.thumbnail} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <p className="text-sm font-semibold line-clamp-2">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{r.channelTitle}</p>
                    <button
                      onClick={() => openYouTube(`https://www.youtube.com/watch?v=${r.videoId}`)}
                      className="mt-auto inline-flex items-center justify-center gap-1.5 bg-youtube hover:bg-youtube/90 text-white text-xs font-bold px-3 py-1.5 rounded-md self-start"
                    >
                      <Play className="h-3 w-3 fill-white" /> Watch on YouTube
                    </button>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground text-center pt-1">Powered by YouTube</p>
            </div>
          )}
        </section>
      )}

      {showSearchResults ? null : (<>
      {loadingData && <SplashLoader label="Loading channels..." />}
      {loadingData && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="surface-card p-3 flex gap-3 animate-pulse">
              <div className="h-20 w-20 shrink-0 rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 bg-muted rounded" />
                <div className="h-2.5 w-1/2 bg-muted rounded" />
                <div className="h-7 w-24 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Featured videos */}
      {!loadingData && featured.length > 0 && (
        <section>
          <h2 className="text-sm font-bold mb-3">Featured videos</h2>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4">
            {featured.map((v) => (
              <button
                key={v.id}
                onClick={() => openYouTube(v.video_url)}
                className="text-left shrink-0 w-56 surface-card p-2 hover:border-primary transition-colors"
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
              </button>
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
      {!loadingData && channels.length === 0 ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          No learning channels yet 📺
        </div>
      ) : !loadingData ? (
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
                <button
                  onClick={() => openYouTube(c.channel_url)}
                  className="mt-auto inline-flex items-center justify-center gap-1.5 bg-youtube hover:bg-youtube/90 text-white text-xs font-bold px-3 py-1.5 rounded-md self-start"
                >
                  <Play className="h-3 w-3 fill-white" /> Watch on YouTube
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      </>)}
    </div>
    );
  } catch (err) {
    console.error("Watch render failed:", err);
    if (!pageError) setPageError("We could not load this page right now.");
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>📺 We could not load this page right now.</p>
      </div>
    );
  }
};

export default Watch;

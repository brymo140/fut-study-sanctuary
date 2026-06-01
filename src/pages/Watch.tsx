import { useEffect, useState } from "react";
import { Play, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRewardedYouTubeOpener } from "@/hooks/useRewardedYouTube";

const YT_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
const LEVELS = ["All", "100L", "200L", "300L", "400L", "500L"];


interface Channel {
  id: string;
  channel_name: string;
  channel_url: string;
  description: string | null;
  level: string | null;
  course_tags: string[] | null;
  thumbnail_url: string | null;
  is_active: boolean | null;
}

interface Video {
  id: string;
  video_title: string;
  video_url: string;
  thumbnail_url: string | null;
  course_tag: string | null;
  level: string | null;
  is_featured: boolean | null;
}

interface YTResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

const Watch = () => {
  const openYouTube = useRewardedYouTubeOpener();
  const [level, setLevel] = useState("All");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<YTResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    fetchData();
  }, [level]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch channels
      let query = supabase
        .from("youtube_channels")
        .select("id, channel_name, channel_url, description, level, course_tags, thumbnail_url, is_active")
        .order("created_at", { ascending: false });

      if (level !== "All") {
        query = query.eq("level", level);
      }

      const { data: channelData, error: channelError } = await query;

      if (channelError) {
        console.error("Channel fetch error:", channelError.message);
        setChannels([]);
      } else {
        console.log("Channels fetched:", channelData);
        setChannels(channelData || []);
      }

      // Fetch featured videos
      const { data: videoData, error: videoError } = await supabase
        .from("youtube_videos")
        .select("id, video_title, video_url, thumbnail_url, course_tag, level, is_featured")
        .order("created_at", { ascending: false });

      if (videoError) {
        console.error("Video fetch error:", videoError.message);
        setVideos([]);
      } else {
        console.log("Videos fetched:", videoData);
        setVideos(videoData || []);
      }
    } catch (err) {
      console.error("Watch fetchData error:", err);
      setChannels([]);
      setVideos([]);
    }
    setLoading(false);
  };

  const runSearch = async () => {
    const q = searchInput.trim();
    if (!q) return;
    if (!YT_API_KEY) {
      setSearchError("YouTube search not configured.");
      return;
    }
    setSearching(true);
    setSearchError("");
    setSearchQuery(q);
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(q)}&key=${YT_API_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      const items = (json.items || [])
        .map((it: any) => ({
          videoId: it.id?.videoId,
          title: it.snippet?.title || "",
          channelTitle: it.snippet?.channelTitle || "",
          thumbnail: it.snippet?.thumbnails?.medium?.url || "",
        }))
        .filter((r: YTResult) => r.videoId);
      setResults(items);
    } catch (e) {
      setSearchError("Search failed. Check your connection.");
    }
    setSearching(false);
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    setResults([]);
    setSearchError("");
  };

  const featuredVideos = videos.filter(v => v.is_featured);

  return (
    <div className="space-y-5 pb-32">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Learning Channels</h1>
          <span className="h-6 w-6 rounded-md bg-red-600 flex items-center justify-center">
            <Play className="h-3 w-3 text-white fill-white" />
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Curated video channels for your level
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="flex-1 surface-card flex items-center gap-2 px-3 py-2 rounded-xl">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Search YouTube videos..."
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          {searchQuery && (
            <button onClick={clearSearch} className="text-xs text-muted-foreground">
              Clear
            </button>
          )}
        </div>
        <button
          onClick={runSearch}
          className="bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-xl"
        >
          Search
        </button>
      </div>

      {/* YouTube search results */}
      {searchQuery ? (
        <div className="space-y-3">
          <p className="text-sm font-bold">Results for "{searchQuery}"</p>
          {searching ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="surface-card p-3 flex gap-3 animate-pulse h-24 rounded-xl" />
              ))}
            </div>
          ) : searchError ? (
            <div className="surface-card p-6 text-center text-sm text-red-400 rounded-xl">
              {searchError}
            </div>
          ) : results.length === 0 ? (
            <div className="surface-card p-6 text-center text-sm text-muted-foreground rounded-xl">
              No results found for "{searchQuery}"
            </div>
          ) : (
            <div className="space-y-3">
              {results.map(r => (
                <div key={r.videoId} className="surface-card p-3 flex gap-3 rounded-xl">
                  <div className="h-20 w-32 shrink-0 rounded-lg overflow-hidden bg-black">
                    {r.thumbnail && (
                      <img src={r.thumbnail} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <p className="text-sm font-semibold line-clamp-2">{r.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.channelTitle}</p>
                    <button
                      onClick={() => openYouTube(`https://www.youtube.com/watch?v=${r.videoId}`)}
                      className="mt-auto self-start bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
                    >
                      <Play className="h-3 w-3 fill-white" /> Watch
                    </button>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground text-center">Powered by YouTube</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Level filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {LEVELS.map(l => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
                  level === l
                    ? "bg-primary/15 border-primary text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Featured videos */}
          {featuredVideos.length > 0 && (
            <div>
              <h2 className="text-sm font-bold mb-3">Featured Videos</h2>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {featuredVideos.map(v => (
                  <button
                    key={v.id}
                    onClick={() => openYouTube(v.video_url)}
                    className="shrink-0 w-52 surface-card p-2 rounded-xl text-left"
                  >
                    <div className="aspect-video rounded-lg bg-black mb-2 overflow-hidden relative">
                      {v.thumbnail_url ? (
                        <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="h-8 w-8 text-white/60" />
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-10 w-10 rounded-full bg-red-600 flex items-center justify-center">
                          <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <p className="text-sm font-semibold line-clamp-2 px-1">{v.video_title}</p>
                    <div className="flex items-center gap-2 px-1 mt-1">
                      {v.course_tag && (
                        <span className="text-xs text-muted-foreground">{v.course_tag}</span>
                      )}
                      {v.level && (
                        <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                          {v.level}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Channels list */}
          <div>
            <h2 className="text-sm font-bold mb-3">
              {level === "All" ? "All Channels" : `${level} Channels`}
            </h2>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="surface-card p-3 flex gap-3 animate-pulse h-24 rounded-xl" />
                ))}
              </div>
            ) : channels.length === 0 ? (
              <div className="surface-card p-8 text-center rounded-xl">
                <p className="text-2xl mb-2">📺</p>
                <p className="text-sm text-muted-foreground">
                  No channels available for {level === "All" ? "any level" : level} yet.
                </p>
                <p className="text-xs text-muted-foreground mt-1">Check back soon!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {channels.map(c => (
                  <div key={c.id} className="surface-card p-3 flex gap-3 rounded-xl">
                    <div className="h-20 w-20 shrink-0 rounded-lg bg-black overflow-hidden flex items-center justify-center">
                      {c.thumbnail_url ? (
                        <img
                          src={c.thumbnail_url}
                          alt={c.channel_name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Play className="h-8 w-8 text-white/60" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold line-clamp-1">{c.channel_name}</p>
                        {c.level && (
                          <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full shrink-0">
                            {c.level}
                          </span>
                        )}
                      </div>
                      {c.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                      )}
                      {c.course_tags && (
                        <p className="text-xs text-muted-foreground">
                          {Array.isArray(c.course_tags) 
                            ? c.course_tags.join(" · ") 
                            : String(c.course_tags)}
                        </p>
                      )}
                      <button
                        onClick={() => openYouTube(c.channel_url)}
                        className="self-start bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 mt-auto"
                      >
                        <Play className="h-3 w-3 fill-white" /> Watch on YouTube
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Watch;

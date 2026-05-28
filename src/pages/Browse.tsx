import { useEffect, useState } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PdfCard, PdfSummary } from "@/components/PdfCard";
import { InlineAdSlot } from "@/components/ads/InlineAdSlot";

const LEVELS = ["All", "100L", "200L", "300L", "400L", "500L"];
type Tab = "materials" | "past";

// Stable per-mount shuffle so users see the same random ordering until they
// switch tabs / refilter.
const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const Browse = () => {
  const HISTORY_KEY = "hv_search_history";
  const [tab, setTab] = useState<Tab>("materials");
  const [level, setLevel] = useState("All");
  const [pdfs, setPdfs] = useState<PdfSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Search is hidden by default — opens via the magnifying-glass button.
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]").slice(0, 5));
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let q = supabase.from("pdfs").select("*").limit(80);
      q = q.eq("is_past_question", tab === "past");
      if (level !== "All") q = q.eq("level", level as "100L");
      const { data } = await q;
      setPdfs(shuffle((data as PdfSummary[]) || []));
      setLoading(false);
    };
    load();
  }, [tab, level]);

  const filtered = search
    ? pdfs.filter((p) =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.course_code.toLowerCase().includes(search.toLowerCase())
      )
    : pdfs;

  const persistHistory = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    const next = [clean, ...history.filter((h) => h.toLowerCase() !== clean.toLowerCase())].slice(0, 5);
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="surface-card p-4 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="surface-card p-3 animate-pulse h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Browse</h1>
        <button
          onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setSearch(""); }}
          aria-label="Search"
          className="min-h-[44px] min-w-[44px] h-11 w-11 rounded-full surface-card flex items-center justify-center hover:border-primary"
        >
          {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4 text-primary" />}
        </button>
      </div>

      {searchOpen && (
        <div className="relative animate-fade-in">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => setSearchFocused(false)}
            onFocus={() => setSearchFocused(true)}
            onKeyDown={(e) => e.key === "Enter" && persistHistory(search)}
            placeholder="Search title or course code…"
            className="w-full bg-surface border border-border rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary"
          />
          {searchFocused && !search.trim() && history.length > 0 && (
            <div className="surface-card mt-2 p-3">
              <div className="flex flex-wrap gap-2">
                {history.map((term) => (
                  <button
                    key={term}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSearch(term);
                      persistHistory(term);
                    }}
                    className="text-xs px-2 py-1 rounded-full border border-border bg-surface-elevated"
                  >
                    {term}
                    <span
                      className="ml-2 text-muted-foreground"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const next = history.filter((h) => h !== term);
                        setHistory(next);
                        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
                      }}
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>
              <button
                className="text-xs text-primary mt-2"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setHistory([]);
                  localStorage.removeItem(HISTORY_KEY);
                }}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 surface-card p-1 rounded-xl">
        {[
          { v: "materials", label: "Course materials" },
          { v: "past", label: "Past questions" },
        ].map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v as Tab)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
              tab === t.v ? "bg-gradient-button text-primary border border-primary/40" : "text-muted-foreground"
            } min-h-[44px]`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {LEVELS.map((l) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            className={`level-pill ${level === l ? "level-pill-active" : ""}`}
          >
            {l}
          </button>
        ))}
      </div>

      <InlineAdSlot size="banner" />

      {filtered.length === 0 ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          <SlidersHorizontal className="h-6 w-6 mx-auto mb-2 opacity-60" />
          Nothing matches your filters.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((p, index) => (
            <div key={p.id}>
              {index > 0 && index % 5 === 0 && <InlineAdSlot size="banner" />}
              <PdfCard pdf={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Browse;

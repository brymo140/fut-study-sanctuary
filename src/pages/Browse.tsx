import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, LayoutGrid, List as ListIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PdfCard, PdfSummary } from "@/components/PdfCard";


const LEVELS = ["All", "100L", "200L", "300L", "400L", "500L"];
type Tab = "materials" | "past";

const Browse = () => {
  const [tab, setTab] = useState<Tab>("materials");
  const [level, setLevel] = useState("All");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const [pdfs, setPdfs] = useState<PdfSummary[]>([]);

  useEffect(() => {
    const load = async () => {
      let q = supabase.from("pdfs").select("*").order("created_at", { ascending: false });
      q = q.eq("is_past_question", tab === "past");
      if (level !== "All") q = q.eq("level", level as "100L");
      const { data } = await q;
      setPdfs((data as PdfSummary[]) || []);
    };
    load();
  }, [tab, level]);

  const filtered = search
    ? pdfs.filter((p) =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.course_code.toLowerCase().includes(search.toLowerCase())
      )
    : pdfs;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Browse</h1>

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
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or course code…"
          className="w-full bg-surface border border-border rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1">
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
        <button
          onClick={() => setView(view === "list" ? "grid" : "list")}
          className="h-9 w-9 rounded-lg surface-card flex items-center justify-center shrink-0"
          aria-label="Toggle view"
        >
          {view === "list" ? <LayoutGrid className="h-4 w-4" /> : <ListIcon className="h-4 w-4" />}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          <SlidersHorizontal className="h-6 w-6 mx-auto mb-2 opacity-60" />
          Nothing matches your filters.
        </div>
      ) : view === "list" ? (
        <div className="space-y-2.5">
          {filtered.map((p) => (
            <PdfCard key={p.id} pdf={p} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((p) => <PdfCard key={p.id} pdf={p} variant="trending" />)}
        </div>
      )}
    </div>
  );
};

export default Browse;

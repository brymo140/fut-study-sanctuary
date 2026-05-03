import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, BookOpen, Bookmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PdfViewer } from "@/components/PdfViewer";
import { isModuleUnlocked, markModuleUnlocked } from "@/lib/sessionUnlocks";
import { WatchToUnlockModal } from "@/components/WatchToUnlockModal";

interface DownloadItem {
  id: string;
  downloaded_at: string;
  chapter: { id: string; title: string; chapter_number: number; storage_path: string };
  pdf: { id: string; title: string; course_code: string; level: string };
}

interface Bookmarked { id: string; title: string; course_code: string; level: string; }

// Personal library: groups every module the user has read by subject.
// Replaces the old "Saved" tab — bookmarks now live in this same screen.
const Downloads = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmarked[]>([]);
  const [view, setView] = useState<DownloadItem | null>(null);
  const [unlock, setUnlock] = useState<DownloadItem | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from("downloads")
      .select("id, downloaded_at, chapter:chapters(id,title,chapter_number,storage_path), pdf:pdfs(id,title,course_code,level)")
      .eq("user_id", user.id)
      .order("downloaded_at", { ascending: false })
      .then(({ data }) => setItems((data as any) || []));

    supabase.from("bookmarks")
      .select("pdf:pdfs(id,title,course_code,level)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setBookmarks(((data as any[]) || []).map((b) => b.pdf).filter(Boolean));
      });
  }, [user]);

  // Group by subject (pdf.id)
  const grouped = useMemo(() => {
    const map = new Map<string, { subject: DownloadItem["pdf"]; modules: DownloadItem[] }>();
    for (const it of items) {
      const k = it.pdf.id;
      if (!map.has(k)) map.set(k, { subject: it.pdf, modules: [] });
      map.get(k)!.modules.push(it);
    }
    return Array.from(map.values());
  }, [items]);

  const open = (it: DownloadItem) => {
    if (!navigator.onLine) return;
    if (isModuleUnlocked(it.chapter.id)) setView(it);
    else setUnlock(it);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Library 📚</h1>
        <p className="text-sm text-muted-foreground">
          {items.length} module{items.length !== 1 && "s"} read across {grouped.length} subject{grouped.length !== 1 && "s"}
        </p>
      </div>

      {items.length === 0 && bookmarks.length === 0 ? (
        <div className="surface-card p-10 text-center text-sm text-muted-foreground">
          Your library is empty. Browse subjects to start reading! 📚
        </div>
      ) : (
        <>
          {grouped.map((g) => (
            <section key={g.subject.id} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Link to={`/pdf/${g.subject.id}`} className="text-sm font-bold hover:text-primary">
                  {g.subject.title}
                </Link>
                <span className="text-[11px] text-muted-foreground">
                  {g.subject.course_code} · {g.subject.level}
                </span>
              </div>
              <div className="space-y-2">
                {g.modules.map((it) => {
                  const unlocked = isModuleUnlocked(it.chapter.id);
                  return (
                    <div key={it.id} className="surface-card p-3 flex items-center gap-3">
                      <div className="h-11 w-11 shrink-0 rounded-lg bg-gradient-cover flex items-center justify-center">
                        <FileText className="h-5 w-5 text-white/90" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold line-clamp-1">
                          M{it.chapter.chapter_number}: {it.chapter.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Unlocked {new Date(it.downloaded_at).toLocaleDateString()} · {unlocked ? "Ready to read" : "Watch ad to read"}
                        </p>
                      </div>
                      <button
                        onClick={() => open(it)}
                        disabled={!navigator.onLine}
                        className="inline-flex items-center gap-1.5 bg-gradient-button border border-primary/40 text-primary text-xs font-semibold rounded-lg px-3 py-2 disabled:opacity-50"
                      >
                        <BookOpen className="h-3.5 w-3.5" /> Read
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {bookmarks.length > 0 && (
            <section className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">Bookmarked subjects</h2>
              </div>
              <div className="space-y-2">
                {bookmarks.map((b) => (
                  <Link
                    key={b.id}
                    to={`/pdf/${b.id}`}
                    className="surface-card p-3 flex items-center gap-3 hover:border-primary"
                  >
                    <div className="h-11 w-11 shrink-0 rounded-lg bg-gradient-cover flex items-center justify-center">
                      <Bookmark className="h-5 w-5 text-white/90 fill-white/40" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold line-clamp-1">{b.title}</p>
                      <p className="text-[11px] text-muted-foreground">{b.course_code} · {b.level}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <WatchToUnlockModal
        open={!!unlock}
        chapterTitle={unlock?.chapter.title || ""}
        onClose={() => setUnlock(null)}
        onUnlocked={() => {
          if (unlock) {
            markModuleUnlocked(unlock.chapter.id);
            setView(unlock);
            setUnlock(null);
            setTick((t) => t + 1);
          }
        }}
      />

      <PdfViewer
        open={!!view}
        onOpenChange={(v) => !v && setView(null)}
        storagePath={view?.chapter.storage_path ?? null}
        title={view ? `M${view.chapter.chapter_number} · ${view.chapter.title}` : undefined}
      />
    </div>
  );
};

export default Downloads;

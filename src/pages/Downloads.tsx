import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, BookOpen, Bookmark, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PdfViewer } from "@/components/PdfViewer";
import { isModuleUnlocked, markModuleUnlocked } from "@/lib/sessionUnlocks";
import { WatchToUnlockModal } from "@/components/WatchToUnlockModal";
import { savePdfToDevice, readPdfFromDevice } from "@/lib/deviceFiles";
import { Confetti } from "@/components/ads/Confetti";
import { toast } from "sonner";

interface Chapter {
  id: string; title: string; chapter_number: number; storage_path: string;
  file_size_mb?: number | null;
}
interface Subject {
  id: string; title: string; course_code: string; level: string; cover_url?: string | null;
  total_chapters?: number; is_past_question?: boolean;
}
interface SubjectGroup {
  subject: Subject;
  chapters: Chapter[];
  downloadedChapterIds: Set<string>;
  localPaths: Record<string, string>; // chapter_id -> local uri
}
interface Bookmarked { id: string; title: string; course_code: string; level: string; }

const LOCAL_PATHS_KEY = "hv_local_pdf_paths";
const DL_PREFIX = "hv_dl_";
const loadLocalPaths = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(LOCAL_PATHS_KEY) || "{}"); } catch { return {}; }
};
const saveLocalPath = (chapterId: string, uri: string) => {
  const all = loadLocalPaths();
  all[chapterId] = uri;
  localStorage.setItem(LOCAL_PATHS_KEY, JSON.stringify(all));
};

const Downloads = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<SubjectGroup[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmarked[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<{ ch: Chapter; subject: Subject; storagePath: string } | null>(null);
  const [unlock, setUnlock] = useState<{ ch: Chapter; subject: Subject } | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [loading, setLoading] = useState(true);

  const CACHE_KEY_DOWNLOADS = 'hv_cache_downloads';
const CACHE_KEY_BOOKMARKS = 'hv_cache_bookmarks';

const load = async () => {
  if (!user) return;
  setLoading(true);

  // Load from cache first for instant offline display
  const cachedDownloads = localStorage.getItem(CACHE_KEY_DOWNLOADS);
  const cachedBookmarks = localStorage.getItem(CACHE_KEY_BOOKMARKS);
  
  if (cachedDownloads) {
    try {
      const parsed = JSON.parse(cachedDownloads);
      // Reconstruct Sets from arrays
      const restored = parsed.map((g: any) => ({
        ...g,
        downloadedChapterIds: new Set<string>(g.downloadedChapterIds),
        localPaths: g.localPaths || {}
      }));
      setGroups(restored);
      setLoading(false);
    } catch {}
  }
  
  if (cachedBookmarks) {
    try { setBookmarks(JSON.parse(cachedBookmarks)); } catch {}
  }

  // If offline, stop here — show cached data
  if (!navigator.onLine) {
    setLoading(false);
    return;
  }

  try {
    const { data } = await supabase
      .from('downloads')
      .select(`
        chapter_id,
        downloaded_at,
        chapters (
          id,
          title,
          chapter_number,
          storage_path,
          file_size_mb,
          pdf_id,
          pdfs (
            id,
            title,
            course_code,
            level,
            cover_url,
            total_chapters,
            is_past_question
          )
        )
      `)
      .eq('user_id', user.id)
      .order('downloaded_at', { ascending: false });

    const downloads = (data as any[]) || [];
    const pdfMap = new Map<string, any>();
    const localPaths = loadLocalPaths();

    downloads.forEach((download: any) => {
      const chapter = download.chapters;
      const pdf = chapter?.pdfs;
      if (!pdf) return;
      if (!pdfMap.has(pdf.id)) {
        pdfMap.set(pdf.id, {
          subject: pdf,
          chapters: [],
          downloadedChapterIds: new Set<string>(),
          localPaths
        });
      }
      const group = pdfMap.get(pdf.id);
      group.chapters.push(chapter);
      group.downloadedChapterIds.add(chapter.id);
    });

    const result = Array.from(pdfMap.values());
    setGroups(result);

    // Cache for offline use — convert Sets to arrays for JSON
    const cacheable = result.map(g => ({
      ...g,
      downloadedChapterIds: Array.from(g.downloadedChapterIds),
    }));
    localStorage.setItem(CACHE_KEY_DOWNLOADS, JSON.stringify(cacheable));

    const { data: bm } = await supabase
      .from("bookmarks")
      .select("pdf:pdfs(id,title,course_code,level)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const bmData = ((bm as any[]) || []).map((b) => b.pdf).filter(Boolean);
    setBookmarks(bmData);
    localStorage.setItem(CACHE_KEY_BOOKMARKS, JSON.stringify(bmData));

  } catch (e) {
    console.error('[Downloads] fetch failed:', e);
  }

  setLoading(false);
};

  const completeDownload = async () => {
    if (!unlock || !user) return;
    const { ch, subject } = unlock;
    setUnlock(null);
    setDownloading(ch.id);
    try {
      const { data } = supabase.storage.from("chapters").getPublicUrl(ch.storage_path);
      const fileName = `${subject.course_code}-M${ch.chapter_number}-${ch.title}.pdf`;
      const uri = await savePdfToDevice(data.publicUrl, fileName);
      localStorage.setItem(`${DL_PREFIX}${ch.id}`, fileName);
      saveLocalPath(ch.id, uri);
      const { error: dlErr } = await supabase.from("downloads").insert({
        user_id: user.id,
        chapter_id: ch.id,
        pdf_id: subject.id,
        downloaded_at: new Date().toISOString(),
      });
      if (dlErr) {
        console.error("[Downloads] downloads insert failed; retrying without downloaded_at", dlErr);
        await supabase.from("downloads").insert({
          user_id: user.id,
          chapter_id: ch.id,
          pdf_id: subject.id,
        });
      }
      markModuleUnlocked(ch.id);
      toast.success("✅ Saved to your library!");
      setConfetti(true);
      setTimeout(() => setConfetti(false), 1500);
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Couldn't save the file. Try again.");
    } finally {
      setDownloading(null);
    }
  };

  const openModule = async (g: SubjectGroup, ch: Chapter) => {
    // Try local first (no ad)
    const storedName = localStorage.getItem(`${DL_PREFIX}${ch.id}`);
    const local = await readPdfFromDevice(storedName || `${g.subject.course_code}-M${ch.chapter_number}-${ch.title}.pdf`);
    if (local) {
      setView({ ch, subject: g.subject, storagePath: local });
      return;
    }
    // Web fallback — open via storage if already unlocked, otherwise gate.
    if (isModuleUnlocked(ch.id)) {
      setView({ ch, subject: g.subject, storagePath: ch.storage_path });
    } else {
      setUnlock({ ch, subject: g.subject });
    }
  };

  return (
    <div className="space-y-5 relative">
      {confetti && <Confetti durationMs={1500} />}
      <div>
        <h1 className="text-2xl font-bold">Library 📚</h1>
        <p className="text-sm text-muted-foreground">
          {totalModules} module{totalModules !== 1 && "s"} downloaded across {groups.length} subject{groups.length !== 1 && "s"}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="surface-card h-24 animate-pulse" />)}
        </div>
      ) : groups.length === 0 && bookmarks.length === 0 ? (
        <div className="surface-card p-10 text-center text-sm text-muted-foreground">
          Your library is empty 📚<br/>Browse subjects to start reading!
        </div>
      ) : (
        <>
          {groups.map((g) => {
            const isOpen = !!expanded[g.subject.id];
            const downloaded = g.downloadedChapterIds.size;
            const total = g.chapters.length;
            return (
              <section key={g.subject.id} className="surface-card overflow-hidden">
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [g.subject.id]: !e[g.subject.id] }))}
                  className="w-full p-3 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="h-14 w-14 shrink-0 rounded-lg bg-gradient-cover overflow-hidden flex items-center justify-center">
                    {g.subject.cover_url
                      ? <img src={g.subject.cover_url} alt="" className="h-full w-full object-cover" />
                      : <FileText className="h-6 w-6 text-white/90" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold line-clamp-1">{g.subject.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {g.subject.course_code} · <span className="badge-blue ml-0.5">{g.subject.level}</span>
                      {g.subject.is_past_question && <span className="badge-amber ml-1">Past Q</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                        <div className="h-full bg-gradient-brand transition-all" style={{ width: `${total ? (downloaded/total)*100 : 0}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">{downloaded} modules downloaded</span>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border px-3 py-2 space-y-2">
                    {g.chapters.map((ch) => {
                      const isDownloaded = g.downloadedChapterIds.has(ch.id);
                      const isBusy = downloading === ch.id;
                      return (
                        <div key={ch.id} className="flex items-center gap-3 py-1.5">
                          <div className="h-9 w-9 shrink-0 rounded-md bg-muted flex items-center justify-center text-[11px] font-bold text-muted-foreground">
                            M{ch.chapter_number}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold line-clamp-1">{ch.title}</p>
                            <p className="text-[10px] text-muted-foreground">{isDownloaded ? "On device" : "Not downloaded"}</p>
                          </div>
                          {isDownloaded ? (
                            <button
                              onClick={() => openModule(g, ch)}
                              className="inline-flex items-center gap-1 bg-success/15 border border-success/40 text-success text-[11px] font-bold rounded-md px-2.5 py-1.5"
                            >
                              <BookOpen className="h-3 w-3" /> Read 📖
                            </button>
                          ) : (
                            <button
                              onClick={() => beginDownload(g, ch)}
                              disabled={isBusy || !navigator.onLine}
                              className="inline-flex items-center gap-1 bg-gradient-button border border-primary/40 text-primary text-[11px] font-bold rounded-md px-2.5 py-1.5 disabled:opacity-50"
                            >
                              {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                              {isBusy ? "Saving" : "Download ⬇"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}

          {bookmarks.length > 0 && (
            <section className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">Bookmarked subjects</h2>
              </div>
              <div className="space-y-2">
                {bookmarks.map((b) => (
                  <Link key={b.id} to={`/pdf/${b.id}`} className="surface-card p-3 flex items-center gap-3 hover:border-primary">
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
        chapterTitle={unlock?.ch.title || ""}
        onClose={() => setUnlock(null)}
        onUnlocked={completeDownload}
      />

      <PdfViewer
      open={!!view}
      onOpenChange={(v) => !v && setView(null)}
      storagePath={view?.storagePath ?? null}
      chapterId={view?.ch.id}
      title={view ? `M${view.ch.chapter_number} · ${view.ch.title}` : undefined}
    />
    </div>
  );
};

export default Downloads;

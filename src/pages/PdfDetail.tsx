import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Star, Lock, Play, Check, ShieldCheck, Bookmark, Flag, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { WatchToUnlockModal } from "@/components/WatchToUnlockModal";
import { PdfViewer } from "@/components/PdfViewer";
import { toast } from "sonner";
import { isModuleUnlocked, markModuleUnlocked } from "@/lib/sessionUnlocks";
import { savePdfToDevice, readPdfFromDevice } from "@/lib/deviceFiles";

const DL_PREFIX = "hv_dl_";

interface Pdf {
  id: string; title: string; course_code: string; level: string;
  faculty: string | null; department: string | null; description: string | null;
  total_chapters: number; file_size_mb: number | null; download_count: number;
  is_verified: boolean; is_past_question: boolean; is_general: boolean;
}
interface Chapter { id: string; chapter_number: number; title: string; storage_path: string; file_size_mb: number | null; }
interface Rating { id: string; stars: number; review_text: string | null; user_id: string; created_at: string; }
interface ReviewUser { id: string; full_name: string | null; }

const PdfDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();

  const [pdf, setPdf] = useState<Pdf | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [bookmarked, setBookmarked] = useState(false);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [reviewUsers, setReviewUsers] = useState<Record<string, string>>({});
  const [myStars, setMyStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [unlockChapter, setUnlockChapter] = useState<Chapter | null>(null);
  const [viewChapter, setViewChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadedChapterIds, setDownloadedChapterIds] = useState<Set<string>>(new Set());
  const [downloadingChapter, setDownloadingChapter] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  // Tick to re-render when the in-memory unlock set changes.
  const [, setTick] = useState(0);

  const fileNameForChapter = (ch: Chapter) =>
    `${pdf?.course_code || "HV"}-M${ch.chapter_number}-${ch.title}.pdf`;

  const load = async () => {
    if (!id || !user) return;
    setLoading(true);

    const [{ data: p }, { data: ch }, { data: bm }, { data: rt }] = await Promise.all([
      supabase.from("pdfs").select("*").eq("id", id).maybeSingle(),
      supabase.from("chapters").select("*").eq("pdf_id", id).order("chapter_number"),
      supabase.from("bookmarks").select("id").eq("user_id", user.id).eq("pdf_id", id).maybeSingle(),
      supabase.from("ratings").select("*").eq("pdf_id", id).order("created_at", { ascending: false }).limit(3),
    ]);

    const chapters = ((ch as Chapter[]) || []) as Chapter[];
    setPdf(p as Pdf | null);
    setChapters(chapters);
    setBookmarked(!!bm);
    setRatings((rt as Rating[]) || []);

    // 1) LocalStorage first (fast): if hv_dl_<chapterId> exists, treat as downloaded.
    const localDownloaded = new Set<string>();
    for (const c of chapters) {
      if (localStorage.getItem(`${DL_PREFIX}${c.id}`)) localDownloaded.add(c.id);
    }
    setDownloadedChapterIds(localDownloaded);

    // 2) Then reconcile with Supabase: fetch *all* downloads for this user,
    // and match by chapter_id against the chapters in this PDF.
    try {
      const { data: dlsAll } = await supabase
        .from("downloads")
        .select("chapter_id")
        .eq("user_id", user.id);

      const dlIds = new Set(
        (((dlsAll as any[]) || []).map((d) => d.chapter_id) || []).filter(Boolean)
      );
      const currentChapterIds = new Set(chapters.map((c) => c.id));
      const merged = new Set<string>();
      for (const cid of dlIds) {
        if (currentChapterIds.has(cid)) merged.add(cid);
      }
      for (const cid of localDownloaded) merged.add(cid);
      setDownloadedChapterIds(merged);
    } catch (e) {
      console.error("[PdfDetail] download reconcile failed", e);
    }

    const mine = ((rt as Rating[]) || []).find((r) => r.user_id === user.id);
    setMyStars(mine?.stars || 0);
    setReviewText(mine?.review_text || "");
    const userIds = Array.from(new Set((((rt as Rating[]) || []).map((r) => r.user_id))));
    if (userIds.length) {
      const { data: users } = await supabase.from("profiles").select("id,full_name").in("id", userIds);
      const mapped = ((users || []) as ReviewUser[]).reduce<Record<string, string>>((acc, u) => {
        acc[u.id] = (u.full_name || "Student").split(" ")[0];
        return acc;
      }, {});
      setReviewUsers(mapped);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id, user]);

  const toggleBookmark = async () => {
    if (!user || !id) return;
    if (bookmarked) {
      await supabase.from("bookmarks").delete().eq("user_id", user.id).eq("pdf_id", id);
      setBookmarked(false);
      toast("Removed from saved");
    } else {
      await supabase.from("bookmarks").insert({ user_id: user.id, pdf_id: id });
      setBookmarked(true);
      toast.success("Saved");
    }
  };

  // Reward callback: download the file to local cache, persist download row,
  // then open the local reader with no additional ad.
  const handleUnlocked = async () => {
    const ch = unlockChapter;
    if (!ch || !user || !id) return;
    setUnlockChapter(null);
    markModuleUnlocked(ch.id);
    setTick((t) => t + 1);

    const fileName = fileNameForChapter(ch);
    
    // Show progress overlay
    setDownloadProgress(0);
    setDownloadingChapter(ch.id);
    
    try {
      // 0% → 30% (fetching)
      setDownloadProgress(30);
      
      const { data } = supabase.storage.from("chapters").getPublicUrl(ch.storage_path);
      
      // 30% → 70% (saving)
      setDownloadProgress(70);
      const localUri = await savePdfToDevice(data.publicUrl, fileName, (percent) => {
        if (percent === 100) setDownloadProgress(100);
      });

      // Backup: store local file identifier so we can render quickly later.
      localStorage.setItem(`${DL_PREFIX}${ch.id}`, fileName);

      // Persist download state (for cross-device / refresh correctness).
      const { error: dlErr } = await supabase.from("downloads").insert({
        user_id: user.id,
        chapter_id: ch.id,
        pdf_id: id,
        downloaded_at: new Date().toISOString(),
      });
      if (dlErr) {
        console.error("[PdfDetail] downloads insert failed; retrying without downloaded_at", dlErr);
        await supabase.from("downloads").insert({
          user_id: user.id,
          chapter_id: ch.id,
          pdf_id: id,
        });
      }

      const { data: prof } = await supabase.from("profiles").select("xp").eq("id", user.id).maybeSingle();
      await supabase.from("profiles").update({ xp: (prof?.xp || 0) + 10 }).eq("id", user.id);
      refreshProfile();

      // 70% → 100% (done)
      setDownloadProgress(100);
      setDownloadedChapterIds((prev) => new Set([...prev, ch.id]));
      
      setTimeout(() => {
        setDownloadingChapter(null);
        toast.success("✅ Saved to your library!");
      }, 500);
      
      // Open the locally cached PDF (no Google viewer).
      const localDataUrl = await readPdfFromDevice(fileName);
      if (localDataUrl) {
        setViewChapter({ ...ch, storage_path: localDataUrl });
      } else {
        setViewChapter(ch);
      }
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadingChapter(null);
      toast.error('Download failed. Please try again.');
    }
  };
  const openRead = async (ch: Chapter) => {
    const cachedFileName = localStorage.getItem(`${DL_PREFIX}${ch.id}`) || fileNameForChapter(ch);
    const local = await readPdfFromDevice(cachedFileName);
    if (local) {
      setViewChapter({ ...ch, storage_path: local });
      return;
    }
    
    // If not found locally, check if online and create signed URL
    const { isOnline } = await import('@/lib/admob');
    if (isOnline()) {
      const { data } = supabase.storage.from("chapters").getPublicUrl(ch.storage_path);
      // Open in Google Docs viewer
      const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(data.publicUrl)}&embedded=true`;
      setViewChapter({ ...ch, storage_path: googleViewerUrl });
    } else {
      toast.error("Download this PDF first to read offline");
    }
  };


  const reportFile = async () => {
    if (!user || !id) return;
    await supabase.from("reports").insert({ user_id: user.id, pdf_id: id, reason: "Bad file reported by user" });
    toast.success("Thanks — admins will review");
  };

  const submitRating = async () => {
    if (!user || !id || myStars < 1) return;
    const payload = {
      user_id: user.id,
      pdf_id: id,
      stars: myStars,
      review_text: reviewText.trim() || null,
    };
    const { error } = await supabase.from("ratings").upsert(payload, { onConflict: "user_id,pdf_id" });
    if (error) {
      toast.error(error.message || "Could not save rating");
      return;
    }
    toast.success("Rating saved");
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!pdf) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Material not found.</p>
        <Button onClick={() => navigate(-1)} variant="ghost" className="mt-4">Go back</Button>
      </div>
    );
  }

  const unlockedCount = chapters.filter((c) => isModuleUnlocked(c.id)).length;

  return (
    <div className="space-y-5 -mx-4 -mt-4">
      {/* Cover */}
      <div className="relative bg-gradient-cover px-4 pt-4 pb-8 rounded-b-3xl">
        <button
          onClick={() => navigate(-1)} aria-label="Back"
          className="h-9 w-9 rounded-full bg-background/40 backdrop-blur flex items-center justify-center"
        ><ArrowLeft className="h-4 w-4 text-white" /></button>

        <div className="flex flex-col items-center mt-2">
          <div className="h-24 w-20 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center mb-3">
            <FileText className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white text-center px-4">{pdf.title}</h1>
          <p className="text-sm text-white/80 mt-1">{pdf.course_code} · {pdf.faculty || pdf.department || "General"}</p>

          <div className="flex gap-4 mt-4 text-center text-white/90">
            <Stat label="Modules" value={pdf.total_chapters} />
            <Stat label="Size" value={`${pdf.file_size_mb?.toFixed(1) || "—"} MB`} />
            <Stat label="Reads" value={pdf.download_count} />
          </div>

          <div className="flex gap-1.5 flex-wrap justify-center mt-4">
            <span className="badge-blue">{pdf.level}</span>
            {pdf.is_general && <span className="badge-purple">General course</span>}
            {pdf.is_past_question && <span className="badge-amber">Past Q included</span>}
          </div>
        </div>
      </div>

      <div className="px-4 space-y-5">
        <div className="surface-card p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((s) => <Star key={s} className="h-4 w-4 fill-warning text-warning" />)}
            </div>
            <span className="text-sm font-semibold">4.6</span>
            <span className="text-xs text-muted-foreground">({ratings.length} reviews)</span>
          </div>
          {pdf.is_verified && (
            <span className="badge-green inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Rep verified
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <Button onClick={toggleBookmark} variant="outline" className="flex-1 bg-surface border-border">
            <Bookmark className={`h-4 w-4 mr-2 ${bookmarked ? "fill-primary text-primary" : ""}`} />
            {bookmarked ? "Saved" : "Save"}
          </Button>
          <Button onClick={reportFile} variant="outline" size="icon" className="bg-surface border-border" aria-label="Report">
            <Flag className="h-4 w-4" />
          </Button>
        </div>

        {chapters.length > 0 && (
          <div className="surface-card p-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Session unlocks</span>
              <span className="font-semibold text-primary">{unlockedCount} of {chapters.length} unlocked</span>
            </div>
            <div className="h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full bg-gradient-brand rounded-full transition-all"
                style={{ width: `${chapters.length ? (unlockedCount / chapters.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {pdf.description && (
          <div className="surface-card p-3">
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{pdf.description}</p>
          </div>
        )}

        {/* Modules */}
        <section>
          <h2 className="text-sm font-bold mb-1">Modules / Topics — watch an ad to download each one</h2>
          <p className="text-[11px] text-muted-foreground mb-3">📖 Download once, then read from your library with no extra ad.</p>
          {chapters.length === 0 ? (
            <div className="surface-card p-6 text-center text-sm text-muted-foreground">
              No modules uploaded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {chapters.map((ch) => {
                const unlocked = isModuleUnlocked(ch.id);
                const isDownloaded = downloadedChapterIds.has(ch.id);
                return (
                  <div
                    key={ch.id}
                    className={`surface-card p-3 ${unlocked ? "border-primary/40" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        unlocked ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                      }`}>
                        {unlocked ? <Check className="h-4 w-4" /> : ch.chapter_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-1">
                          <span className="text-muted-foreground mr-1">M{ch.chapter_number}.</span>{ch.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {ch.file_size_mb?.toFixed(1) || "—"} MB · {isDownloaded ? "Downloaded" : unlocked ? "Unlocked this session" : "Locked"}
                        </p>
                      </div>
                      {isDownloaded ? (
                        <Button
                          size="sm"
                          onClick={() => openRead(ch)}
                          variant="outline"
                          className="bg-surface border-success/40 text-success text-xs h-8"
                        >
                          <BookOpen className="h-3 w-3 mr-1" /> Read 📖
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setUnlockChapter(ch)}
                          className="bg-gradient-button border border-primary/40 text-primary text-xs h-8"
                        >
                          <Play className="h-3 w-3 mr-1 fill-primary" /> Download ⬇
                        </Button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 inline-flex items-center gap-1">
                      <Lock className="h-2.5 w-2.5" /> Rewarded ad required before first download.
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Reviews */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold">Reviews</h2>
            <button className="text-xs text-primary font-medium">See all →</button>
          </div>
          <div className="surface-card p-3 mb-3 space-y-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHoverStars(star)}
                  onMouseLeave={() => setHoverStars(0)}
                  onClick={() => setMyStars(star)}
                  className="p-0.5"
                >
                  <Star
                    className={`h-5 w-5 transition-colors ${
                      star <= (hoverStars || myStars) ? "fill-warning text-warning" : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value.slice(0, 200))}
              placeholder="Optional review (max 200 chars)"
              className="w-full min-h-[70px] text-xs rounded-lg border border-border bg-surface p-2"
            />
            <Button onClick={submitRating} className="h-8 text-xs">
              {ratings.some((r) => r.user_id === user?.id) ? "Update" : "Submit"}
            </Button>
          </div>
          {ratings.length === 0 ? (
            <div className="surface-card p-4 text-center text-xs text-muted-foreground">
              Be the first to rate this material.
            </div>
          ) : (
            <div className="space-y-2">
              {ratings.map((r) => (
                <div key={r.id} className="surface-card p-3">
                  <div className="flex items-center gap-1 mb-1.5">
                    {Array.from({ length: r.stars }).map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-warning text-warning" />
                    ))}
                    <span className="text-[10px] text-muted-foreground ml-2">{reviewUsers[r.user_id] || "Student"}</span>
                  </div>
                  {r.review_text && <p className="text-xs text-foreground/90">{r.review_text}</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="h-4" />
      </div>

      <WatchToUnlockModal
        open={!!unlockChapter}
        chapterTitle={unlockChapter?.title || ""}
        onClose={() => setUnlockChapter(null)}
        onUnlocked={handleUnlocked}
      />

      <PdfViewer
        open={!!viewChapter}
        onOpenChange={(v) => !v && setViewChapter(null)}
        storagePath={viewChapter?.storage_path ?? null}
        title={viewChapter ? `M${viewChapter.chapter_number} · ${viewChapter.title}` : undefined}
      />

      {/* Download Progress Overlay */}
      {downloadingChapter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
          <div className="relative w-full max-w-sm surface-elevated p-6 rounded-2xl animate-fade-in">
            <div className="flex flex-col items-center py-4">
              <div className="h-12 w-12 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
              <p className="text-sm font-semibold mb-2">Downloading module...</p>
              <div className="w-full bg-muted rounded-full h-2 mb-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                {downloadProgress < 30 && "Preparing download..."}
                {downloadProgress >= 30 && downloadProgress < 70 && "Fetching PDF..."}
                {downloadProgress >= 70 && downloadProgress < 100 && "Saving to device..."}
                {downloadProgress === 100 && "Almost done!"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div>
    <p className="text-lg font-bold leading-none">{value}</p>
    <p className="text-[10px] uppercase tracking-wider opacity-70 mt-1">{label}</p>
  </div>
);

export default PdfDetail;

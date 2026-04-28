import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Star, Lock, Play, Check, Download, ShieldCheck, Bookmark, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { WatchToUnlockModal } from "@/components/WatchToUnlockModal";
import { toast } from "sonner";

interface Pdf {
  id: string; title: string; course_code: string; level: string;
  faculty: string | null; department: string | null; description: string | null;
  total_chapters: number; file_size_mb: number | null; download_count: number;
  is_verified: boolean; is_past_question: boolean; is_general: boolean;
}
interface Chapter { id: string; chapter_number: number; title: string; storage_path: string; file_size_mb: number | null; }
interface Rating { id: string; stars: number; review_text: string | null; user_id: string; created_at: string; }

const PdfDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();

  const [pdf, setPdf] = useState<Pdf | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [bookmarked, setBookmarked] = useState(false);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [unlockChapter, setUnlockChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id || !user) return;
    const [{ data: p }, { data: ch }, { data: dl }, { data: bm }, { data: rt }] = await Promise.all([
      supabase.from("pdfs").select("*").eq("id", id).maybeSingle(),
      supabase.from("chapters").select("*").eq("pdf_id", id).order("chapter_number"),
      supabase.from("downloads").select("chapter_id").eq("user_id", user.id).eq("pdf_id", id),
      supabase.from("bookmarks").select("id").eq("user_id", user.id).eq("pdf_id", id).maybeSingle(),
      supabase.from("ratings").select("*").eq("pdf_id", id).order("created_at", { ascending: false }).limit(3),
    ]);
    setPdf(p as Pdf | null);
    setChapters((ch as Chapter[]) || []);
    setDownloadedIds(new Set((dl || []).map((d) => d.chapter_id)));
    setBookmarked(!!bm);
    setRatings((rt as Rating[]) || []);
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

  const handleUnlocked = async () => {
    const ch = unlockChapter;
    if (!ch || !user || !id) return;
    setUnlockChapter(null);

    // Generate signed URL and trigger download
    const { data: signed } = await supabase.storage.from("chapters").createSignedUrl(ch.storage_path, 60);
    if (signed?.signedUrl) {
      const a = document.createElement("a");
      a.href = signed.signedUrl;
      a.download = `${pdf?.course_code || "chapter"}-${ch.chapter_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      toast("File preview — sample download triggered");
    }

    // Record download + XP
    await supabase.from("downloads").insert({ user_id: user.id, chapter_id: ch.id, pdf_id: id });
    const { data: prof } = await supabase.from("profiles").select("xp").eq("id", user.id).maybeSingle();
    await supabase.from("profiles").update({ xp: (prof?.xp || 0) + 10 }).eq("id", user.id);
    refreshProfile();
    setDownloadedIds(new Set([...downloadedIds, ch.id]));
  };

  const reportFile = async () => {
    if (!user || !id) return;
    await supabase.from("reports").insert({ user_id: user.id, pdf_id: id, reason: "Bad file reported by user" });
    toast.success("Thanks — admins will review");
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

  const downloadedCount = downloadedIds.size;
  const remainingLocked = chapters.length - downloadedCount;

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
            <Stat label="Chapters" value={pdf.total_chapters} />
            <Stat label="Size" value={`${pdf.file_size_mb?.toFixed(1) || "—"} MB`} />
            <Stat label="Downloads" value={pdf.download_count} />
          </div>

          <div className="flex gap-1.5 flex-wrap justify-center mt-4">
            <span className="badge-blue">{pdf.level}</span>
            {pdf.is_general && <span className="badge-purple">General course</span>}
            {pdf.is_past_question && <span className="badge-amber">Past Q included</span>}
          </div>
        </div>
      </div>

      <div className="px-4 space-y-5">
        {/* Rating + verified */}
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

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button onClick={toggleBookmark} variant="outline" className="flex-1 bg-surface border-border">
            <Bookmark className={`h-4 w-4 mr-2 ${bookmarked ? "fill-primary text-primary" : ""}`} />
            {bookmarked ? "Saved" : "Save"}
          </Button>
          <Button onClick={reportFile} variant="outline" size="icon" className="bg-surface border-border" aria-label="Report">
            <Flag className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress */}
        {chapters.length > 0 && (
          <div className="surface-card p-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Reading progress</span>
              <span className="font-semibold text-primary">{downloadedCount} of {chapters.length} chapters</span>
            </div>
            <div className="h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full bg-gradient-brand rounded-full transition-all"
                style={{ width: `${chapters.length ? (downloadedCount / chapters.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Chapters */}
        <section>
          <h2 className="text-sm font-bold mb-3">Chapters — tap to unlock & download</h2>
          {chapters.length === 0 ? (
            <div className="surface-card p-6 text-center text-sm text-muted-foreground">
              No chapters uploaded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {chapters.map((ch, idx) => {
                const isDownloaded = downloadedIds.has(ch.id);
                const isNext = !isDownloaded && chapters.slice(0, idx).every((c) => downloadedIds.has(c.id));
                return (
                  <div
                    key={ch.id}
                    className={`surface-card p-3 flex items-center gap-3 ${isNext ? "border-primary" : ""}`}
                  >
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isDownloaded ? "bg-success/20 text-success" :
                      isNext ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {isDownloaded ? <Check className="h-4 w-4" /> : ch.chapter_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{ch.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {ch.file_size_mb?.toFixed(1) || "—"} MB
                      </p>
                    </div>
                    {isDownloaded ? (
                      <span className="badge-green">Downloaded</span>
                    ) : isNext ? (
                      <Button
                        size="sm"
                        onClick={() => setUnlockChapter(ch)}
                        className="bg-gradient-button border border-primary/40 text-primary text-xs h-8"
                      >
                        <Play className="h-3 w-3 mr-1 fill-primary" /> Watch
                      </Button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2.5 py-1.5 rounded-md">
                        <Lock className="h-3 w-3" /> Lock
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {remainingLocked > 0 && chapters.length > 0 && (
          <Button
            onClick={() => {
              const next = chapters.find((c) => !downloadedIds.has(c.id));
              if (next) setUnlockChapter(next);
            }}
            size="lg"
            className="w-full bg-gradient-button border border-primary/40 text-primary h-12 rounded-xl font-semibold"
          >
            <Download className="h-4 w-4 mr-2" />
            Download all chapters (Watch {remainingLocked} ad{remainingLocked > 1 ? "s" : ""})
          </Button>
        )}

        {/* Reviews */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold">Reviews</h2>
            <button className="text-xs text-primary font-medium">See all →</button>
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

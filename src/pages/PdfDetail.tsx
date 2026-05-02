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
  const [bookmarked, setBookmarked] = useState(false);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [unlockChapter, setUnlockChapter] = useState<Chapter | null>(null);
  const [viewChapter, setViewChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  // Tick to re-render when the in-memory unlock set changes.
  const [, setTick] = useState(0);

  const load = async () => {
    if (!id || !user) return;
    const [{ data: p }, { data: ch }, { data: bm }, { data: rt }] = await Promise.all([
      supabase.from("pdfs").select("*").eq("id", id).maybeSingle(),
      supabase.from("chapters").select("*").eq("pdf_id", id).order("chapter_number"),
      supabase.from("bookmarks").select("id").eq("user_id", user.id).eq("pdf_id", id).maybeSingle(),
      supabase.from("ratings").select("*").eq("pdf_id", id).order("created_at", { ascending: false }).limit(3),
    ]);
    setPdf(p as Pdf | null);
    setChapters((ch as Chapter[]) || []);
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

  // Reward callback: mark this module unlocked for the session, log the
  // open as a "download" record (for analytics + XP), then open the
  // in-app reader. NEVER trigger a file download to the device.
  const handleUnlocked = async () => {
    const ch = unlockChapter;
    if (!ch || !user || !id) return;
    setUnlockChapter(null);
    markModuleUnlocked(ch.id);
    setTick((t) => t + 1);

    await supabase.from("downloads").insert({ user_id: user.id, chapter_id: ch.id, pdf_id: id });
    const { data: prof } = await supabase.from("profiles").select("xp").eq("id", user.id).maybeSingle();
    await supabase.from("profiles").update({ xp: (prof?.xp || 0) + 10 }).eq("id", user.id);
    refreshProfile();

    setViewChapter(ch);
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
          <h2 className="text-sm font-bold mb-1">Modules / Topics — watch an ad to read each one</h2>
          <p className="text-[11px] text-muted-foreground mb-3">📖 Read inside HighVault — modules cannot be saved to your device.</p>
          {chapters.length === 0 ? (
            <div className="surface-card p-6 text-center text-sm text-muted-foreground">
              No modules uploaded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {chapters.map((ch) => {
                const unlocked = isModuleUnlocked(ch.id);
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
                          {ch.file_size_mb?.toFixed(1) || "—"} MB · {unlocked ? "Unlocked this session" : "Locked"}
                        </p>
                      </div>
                      {unlocked ? (
                        <Button
                          size="sm"
                          onClick={() => setViewChapter(ch)}
                          variant="outline"
                          className="bg-surface border-success/40 text-success text-xs h-8"
                        >
                          <BookOpen className="h-3 w-3 mr-1" /> Read
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setUnlockChapter(ch)}
                          className="bg-gradient-button border border-primary/40 text-primary text-xs h-8"
                        >
                          <Play className="h-3 w-3 mr-1 fill-primary" /> Watch
                        </Button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 inline-flex items-center gap-1">
                      <Lock className="h-2.5 w-2.5" /> 📖 Read inside HighVault — no device download.
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

      <PdfViewer
        open={!!viewChapter}
        onOpenChange={(v) => !v && setViewChapter(null)}
        storagePath={viewChapter?.storage_path ?? null}
        title={viewChapter ? `M${viewChapter.chapter_number} · ${viewChapter.title}` : undefined}
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

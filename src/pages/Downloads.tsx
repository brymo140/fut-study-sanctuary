import { useEffect, useState } from "react";
import { FileText, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PdfViewer } from "@/components/PdfViewer";
import { isModuleUnlocked } from "@/lib/sessionUnlocks";
import { WatchToUnlockModal } from "@/components/WatchToUnlockModal";

interface Item {
  id: string;
  downloaded_at: string;
  chapter: { id: string; title: string; chapter_number: number; storage_path: string };
  pdf: { id: string; title: string; course_code: string; level: string };
}

const Downloads = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [view, setView] = useState<Item | null>(null);
  const [unlock, setUnlock] = useState<Item | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from("downloads")
      .select("id, downloaded_at, chapter:chapters(id,title,chapter_number,storage_path), pdf:pdfs(id,title,course_code,level)")
      .eq("user_id", user.id)
      .order("downloaded_at", { ascending: false })
      .then(({ data }) => setItems((data as any) || []));
  }, [user]);

  const open = (it: Item) => {
    if (isModuleUnlocked(it.chapter.id)) setView(it);
    else setUnlock(it);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Library</h1>
      <p className="text-sm text-muted-foreground">
        {items.length} module{items.length !== 1 && "s"} read · 📖 Read inside HighVault
      </p>

      {items.length === 0 ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          You haven't unlocked any modules yet. Browse and watch an ad to unlock your first one.
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((it) => {
            const unlocked = isModuleUnlocked(it.chapter.id);
            return (
              <div key={it.id} className="surface-card p-3 flex items-center gap-3">
                <button
                  onClick={() => open(it)}
                  className="h-12 w-12 shrink-0 rounded-lg bg-gradient-cover flex items-center justify-center hover:opacity-90"
                  aria-label="Open"
                >
                  <FileText className="h-5 w-5 text-white/90" />
                </button>
                <button onClick={() => open(it)} className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold line-clamp-1">M{it.chapter.chapter_number}: {it.chapter.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {it.pdf.course_code} · {unlocked ? "Unlocked this session" : "Watch ad to read"}
                  </p>
                </button>
                <button
                  onClick={() => open(it)}
                  aria-label="Read"
                  className="h-8 w-8 rounded-lg surface-elevated flex items-center justify-center hover:border-primary"
                >
                  <BookOpen className="h-4 w-4 text-primary" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <WatchToUnlockModal
        open={!!unlock}
        chapterTitle={unlock?.chapter.title || ""}
        onClose={() => setUnlock(null)}
        onUnlocked={() => {
          if (unlock) {
            // markModuleUnlocked is already called inside WatchToUnlockModal flow via PdfDetail;
            // here we mark via the same util to keep the behavior consistent on this page too.
            import("@/lib/sessionUnlocks").then((m) => m.markModuleUnlocked(unlock.chapter.id));
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

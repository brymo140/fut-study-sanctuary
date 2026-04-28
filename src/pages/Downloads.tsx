import { useEffect, useState } from "react";
import { FileText, Download, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PdfViewer } from "@/components/PdfViewer";

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

  useEffect(() => {
    if (!user) return;
    supabase.from("downloads")
      .select("id, downloaded_at, chapter:chapters(id,title,chapter_number,storage_path), pdf:pdfs(id,title,course_code,level)")
      .eq("user_id", user.id)
      .order("downloaded_at", { ascending: false })
      .then(({ data }) => setItems((data as any) || []));
  }, [user]);

  const redownload = async (path: string, name: string) => {
    const { data } = await supabase.storage.from("chapters").createSignedUrl(path, 60);
    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = name;
      a.click();
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Downloads</h1>
      <p className="text-sm text-muted-foreground">{items.length} chapter{items.length !== 1 && "s"} unlocked</p>

      {items.length === 0 ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          You haven't downloaded any chapters yet. Browse and unlock your first one.
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((it) => (
            <div key={it.id} className="surface-card p-3 flex items-center gap-3">
              <button
                onClick={() => setView(it)}
                className="h-12 w-12 shrink-0 rounded-lg bg-gradient-cover flex items-center justify-center hover:opacity-90"
                aria-label="Open"
              >
                <FileText className="h-5 w-5 text-white/90" />
              </button>
              <button onClick={() => setView(it)} className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold line-clamp-1">Ch {it.chapter.chapter_number}: {it.chapter.title}</p>
                <p className="text-[11px] text-muted-foreground">{it.pdf.course_code} · {it.pdf.title}</p>
              </button>
              <button
                onClick={() => setView(it)}
                aria-label="Read"
                className="h-8 w-8 rounded-lg surface-elevated flex items-center justify-center hover:border-primary"
              >
                <Eye className="h-4 w-4 text-primary" />
              </button>
              <button
                onClick={() => redownload(it.chapter.storage_path, `${it.pdf.course_code}-ch${it.chapter.chapter_number}.pdf`)}
                aria-label="Redownload"
                className="h-8 w-8 rounded-lg surface-elevated flex items-center justify-center hover:border-primary"
              >
                <Download className="h-4 w-4 text-primary" />
              </button>
            </div>
          ))}
        </div>
      )}

      <PdfViewer
        open={!!view}
        onOpenChange={(v) => !v && setView(null)}
        storagePath={view?.chapter.storage_path ?? null}
        title={view ? `Ch ${view.chapter.chapter_number} · ${view.chapter.title}` : undefined}
        fileName={view ? `${view.pdf.course_code}-ch${view.chapter.chapter_number}.pdf` : undefined}
      />
    </div>
  );
};

export default Downloads;

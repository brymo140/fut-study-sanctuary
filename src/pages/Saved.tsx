import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PdfCard, PdfSummary } from "@/components/PdfCard";
import { toast } from "sonner";

const Saved = () => {
  const { user } = useAuth();
  const [pdfs, setPdfs] = useState<PdfSummary[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("bookmarks")
      .select("pdf:pdfs(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setPdfs(((data as any[]) || []).map((b) => b.pdf).filter(Boolean));
  };
  useEffect(() => { load(); }, [user]);

  const remove = async (pdfId: string) => {
    if (!user) return;
    await supabase.from("bookmarks").delete().eq("user_id", user.id).eq("pdf_id", pdfId);
    toast("Removed");
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Saved</h1>
      <p className="text-sm text-muted-foreground">{pdfs.length} bookmarked material{pdfs.length !== 1 && "s"}</p>

      {pdfs.length === 0 ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          No bookmarks yet. Tap the bookmark icon on any material to save it for later.
        </div>
      ) : (
        <div className="space-y-2.5">
          {pdfs.map((p) => (
            <PdfCard key={p.id} pdf={p} bookmarked onBookmark={() => remove(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Saved;

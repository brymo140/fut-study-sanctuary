import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { X, Loader2, BookOpen } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storagePath: string | null;
  fileName?: string;
  title?: string;
}

/**
 * Read-only in-app PDF viewer. Renders the PDF via signed URL inside an
 * <iframe> with the toolbar suppressed so students can read but cannot
 * save, download, share, or print the file from the device.
 */
export const PdfViewer = ({ open, onOpenChange, storagePath, title }: Props) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !storagePath) { setUrl(null); return; }
    if (storagePath.startsWith("data:") || storagePath.startsWith("http") || storagePath.startsWith("file:") || storagePath.startsWith("content:")) {
      setUrl(storagePath);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase.storage
      .from("chapters")
      .createSignedUrl(storagePath, 60 * 60)
      .then(({ data }) => {
        setUrl(data?.signedUrl ?? null);
        setLoading(false);
      });
  }, [open, storagePath]);

  // Block right-click / long-press save while the viewer is open.
  useEffect(() => {
    if (!open) return;
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-none w-screen sm:rounded-none p-0 bg-background border-0 [&>button]:hidden flex flex-col"
        style={{ height: '100dvh', paddingBottom: 'calc(env(safe-area-inset-bottom) + 60px)' }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <BookOpen className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm font-semibold line-clamp-1">{title || "Reading"}</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-surface-elevated"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="flex-1 min-h-0 bg-black select-none"
          onContextMenu={(e) => e.preventDefault()}
          style={{ WebkitTouchCallout: "none" } as any}
        >
          {loading || !url ? (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="relative w-full h-full overflow-hidden">
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`}
                title={title || "PDF"}
                className="w-full h-full pointer-events-none"
                style={{ border: 0, display: "block" }}
                sandbox="allow-scripts allow-same-origin"
                onContextMenu={(e) => e.preventDefault()}
              />
              <div
                className="absolute"
                style={{ top: 0, right: 0, width: "56px", height: "56px", background: "black", zIndex: 999 }}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { X, Download, ExternalLink, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storagePath: string | null;
  fileName?: string;
  title?: string;
}

/**
 * Full-screen native PDF viewer using a signed URL + <iframe>.
 * Uses the device's built-in PDF renderer so the file looks identical
 * to opening it in any phone PDF reader (pinch-to-zoom, scroll, page jumps).
 */
export const PdfViewer = ({ open, onOpenChange, storagePath, fileName, title }: Props) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !storagePath) {
      setUrl(null);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none w-screen h-screen sm:rounded-none p-0 bg-background border-0 [&>button]:hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface">
          <p className="text-sm font-semibold line-clamp-1 flex-1">{title || fileName || "PDF"}</p>
          <div className="flex items-center gap-1">
            {url && (
              <>
                <a
                  href={url}
                  download={fileName}
                  className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-surface-elevated"
                  aria-label="Download"
                >
                  <Download className="h-4 w-4" />
                </a>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-surface-elevated"
                  aria-label="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </>
            )}
            <button
              onClick={() => onOpenChange(false)}
              className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-surface-elevated"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-black">
          {loading || !url ? (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <iframe
              src={`${url}#toolbar=1&navpanes=0&view=FitH`}
              title={title || "PDF"}
              className="w-full h-full"
              style={{ border: 0 }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

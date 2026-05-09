import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { X, Loader2, BookOpen, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storagePath: string | null;
  chapterId?: string;
  fileName?: string;
  title?: string;
}

export const PdfViewer = ({ open, onOpenChange, storagePath, chapterId, fileName, title }: Props) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!open) { setUrl(null); setError(null); return; }
    loadPdf();
  }, [open, storagePath, chapterId]);

  const loadPdf = async () => {
  setLoading(true);
  setError(null);

  if (!storagePath) {
    setError('No PDF available');
    setLoading(false);
    return;
  }

  // If storagePath is already a base64 data URL — use it directly
  if (storagePath.startsWith('data:')) {
    try {
      const byteChars = atob(storagePath.split(',')[1]);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArr[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArr], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(blobUrl)}&embedded=true`;
      setUrl(viewerUrl);
      setLoading(false);
      return;
    } catch (e) {
      console.error('[PdfViewer] base64 error:', e);
      setError('Could not open PDF. Please try again.');
      setLoading(false);
      return;
    }
  }

  // Otherwise use Supabase Storage signed URL
  if (isOffline) {
    setError('You are offline. Connect to internet to read this PDF.');
    setLoading(false);
    return;
  }

  try {
    console.log('[PdfViewer] fetching signed URL for:', storagePath);

    const { data, error: signedUrlError } = await supabase.storage
      .from("chapters")
      .createSignedUrl(storagePath, 60 * 60);

    if (signedUrlError) {
      console.error('[PdfViewer] signed URL error:', signedUrlError);
      setError(`Could not load PDF: ${signedUrlError.message}`);
      setLoading(false);
      return;
    }

    if (!data?.signedUrl) {
      setError('Could not generate PDF link. Please try again.');
      setLoading(false);
      return;
    }

    const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(data.signedUrl)}&embedded=true`;
    setUrl(viewerUrl);

  } catch (e: any) {
    console.error('[PdfViewer] error:', e);
    setError('Failed to load PDF. Check your connection.');
  }

  setLoading(false);
};

  // Block right click
  useEffect(() => {
    if (!open) return;
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-none w-screen h-screen sm:rounded-none p-0 bg-background border-0 [&>button]:hidden flex flex-col"
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <BookOpen className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm font-semibold line-clamp-1">{title || "Reading"}</p>
          </div>
          <div className="flex items-center gap-1">
            {!loading && !error && (
              <button
                onClick={() => { setReloadKey(k => k + 1); loadPdf(); }}
                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-elevated"
              >
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <button
              onClick={() => onOpenChange(false)}
              className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-surface-elevated"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className="flex-1 min-h-0 bg-black select-none relative"
          onContextMenu={(e) => e.preventDefault()}
          style={{ WebkitTouchCallout: "none" } as any}
        >
          {loading ? (
            <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Loading PDF...</p>
            </div>
          ) : error ? (
            <div className="h-full w-full flex flex-col items-center justify-center gap-3 px-6 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <button
                onClick={loadPdf}
                className="px-4 py-2 bg-primary/10 border border-primary/40 text-primary text-sm rounded-lg"
              >
                Try Again
              </button>
            </div>
          ) : url ? (
            <div className="relative w-full h-full">
              {/* Cover external link button */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '60px',
                  height: '60px',
                  background: '#000',
                  zIndex: 999,
                  pointerEvents: 'none'
                }}
              />
              <iframe
                key={reloadKey}
                src={url}
                title={title || "PDF"}
                className="w-full h-full"
                style={{ border: 0, display: 'block' }}
                onContextMenu={(e) => e.preventDefault()}
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

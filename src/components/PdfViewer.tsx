import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { X, Loader2, BookOpen, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import * as pdfjsLib from 'pdfjs-dist';

// Use local worker file — works offline
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storagePath: string | null;
  chapterId?: string;
  title?: string;
}

export const PdfViewer = ({ open, onOpenChange, storagePath, chapterId, title }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const renderTaskRef = useRef<any>(null);

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
    if (!open) {
      setPdfDoc(null);
      setPageNum(1);
      setTotalPages(0);
      setError(null);
      return;
    }
    loadPdf();
  }, [open, storagePath, chapterId]);

  useEffect(() => {
    if (pdfDoc && canvasRef.current) {
      renderPage(pageNum);
    }
  }, [pdfDoc, pageNum]);

  const loadPdf = async () => {
    setLoading(true);
    setError(null);
    setPdfDoc(null);

    try {
      let pdfData: ArrayBuffer | null = null;

      // Try device cache first (works offline)
      if (chapterId) {
        const cachedFileName = localStorage.getItem(`hv_dl_${chapterId}`);
        if (cachedFileName) {
          try {
            const { Filesystem, Directory } = await import('@capacitor/filesystem');
            const result = await Filesystem.readFile({
              path: `highvault/chapters/${cachedFileName}`,
              directory: Directory.Cache
            });
            const base64 = result.data as string;
            console.log('[PdfViewer] Cache hit, data length:', base64.length);
            // Safe base64 to ArrayBuffer conversion
            const base64Response = await fetch(`data:application/pdf;base64,${base64}`);
            pdfData = await base64Response.arrayBuffer();
            console.log('[PdfViewer] Loaded from device cache successfully');
          } catch (e) {
            console.log('[PdfViewer] Cache miss:', e);
          }
        }
      }

      // If offline and no cache
      if (!pdfData && isOffline) {
        setError('You are offline. Download this PDF first to read it offline.');
        setLoading(false);
        return;
      }

      // Fetch from Supabase if no cache
      if (!pdfData && storagePath) {
        console.log('[PdfViewer] Fetching from Supabase:', storagePath);
        const { data, error: signedUrlError } = await supabase.storage
          .from("chapters")
          .createSignedUrl(storagePath, 60 * 60);

        if (signedUrlError || !data?.signedUrl) {
          setError('Could not load PDF. Please try again.');
          setLoading(false);
          return;
        }

        const response = await fetch(data.signedUrl);
        if (!response.ok) {
          setError('Failed to fetch PDF. Check your connection.');
          setLoading(false);
          return;
        }
        pdfData = await response.arrayBuffer();
        console.log('[PdfViewer] Loaded from remote successfully');
      }

      if (!pdfData) {
        setError('No PDF data available.');
        setLoading(false);
        return;
      }

      // Load with PDF.js
      const loadingTask = pdfjsLib.getDocument({ data: pdfData });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setPageNum(1);

    } catch (e: any) {
      console.error('[PdfViewer] error:', e);
      setError('Failed to load PDF. Please try again.');
    }

    setLoading(false);
  };

  const renderPage = async (num: number) => {
    if (!pdfDoc || !canvasRef.current) return;

    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
    }

    try {
      const page = await pdfDoc.getPage(num);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      const containerWidth = canvas.parentElement?.clientWidth || window.innerWidth;
      const viewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      canvas.height = scaledViewport.height;
      canvas.width = scaledViewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
      };

      renderTaskRef.current = page.render(renderContext);
      await renderTaskRef.current.promise;
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') {
        console.error('[PdfViewer] render error:', e);
      }
    }
  };

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
                onClick={loadPdf}
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
          className="flex-1 min-h-0 overflow-y-auto bg-gray-900 select-none"
          onContextMenu={(e) => e.preventDefault()}
          style={{ WebkitTouchCallout: "none" } as any}
        >
          {loading && (
            <div className="min-h-64 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading PDF...</p>
            </div>
          )}

          {!loading && error && (
            <div className="min-h-64 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <button
                onClick={loadPdf}
                className="px-4 py-2 bg-primary/10 border border-primary/40 text-primary text-sm rounded-lg"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && (
            <div className="flex justify-center p-2">
              <canvas
                ref={canvasRef}
                className="max-w-full shadow-lg"
                style={{ display: totalPages > 0 ? 'block' : 'none' }}
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
          )}
        </div>

        {/* Page Navigation */}
        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-surface shrink-0">
            <button
              onClick={() => setPageNum(p => Math.max(1, p - 1))}
              disabled={pageNum <= 1}
              className="h-8 w-8 rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-surface-elevated"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-xs text-muted-foreground">
              Page {pageNum} of {totalPages}
            </span>
            <button
              onClick={() => setPageNum(p => Math.min(totalPages, p + 1))}
              disabled={pageNum >= totalPages}
              className="h-8 w-8 rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-surface-elevated"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

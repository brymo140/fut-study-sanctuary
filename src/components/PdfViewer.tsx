import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { X, Loader2, BookOpen, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import * as pdfjsLib from 'pdfjs-dist';
import { AITutor } from "@/components/AITutor";

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storagePath: string | null;
  chapterId?: string;
  title?: string;
}

// Single page component
const PdfPage = ({ pdfDoc, pageNum, scale }: { pdfDoc: any; pageNum: number; scale: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    renderPage();
  }, [pdfDoc, pageNum, scale]);

  const renderPage = async () => {
    if (!pdfDoc || !canvasRef.current) return;
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
    }
    try {
      const page = await pdfDoc.getPage(pageNum);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      const viewport = page.getViewport({ scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      renderTaskRef.current = page.render({ canvasContext: context, viewport });
      await renderTaskRef.current.promise;
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') {
        console.error('[PdfPage] render error:', e);
      }
    }
  };

  return (
    <div className="shadow-lg mb-4 bg-white">
      <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%' }} />
    </div>
  );
};

export const PdfViewer = ({ open, onOpenChange, storagePath, chapterId, title }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [scale, setScale] = useState(1.0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

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
      setTotalPages(0);
      setError(null);
      setScale(1.0);
      return;
    }
    loadPdf();
  }, [open, storagePath, chapterId]);

  const loadPdf = async () => {
    setLoading(true);
    setError(null);
    setPdfDoc(null);

    try {
      let pdfData: ArrayBuffer | null = null;

      // Try device cache first
      if (chapterId) {
        const cachedFileName = localStorage.getItem(`hv_dl_${chapterId}`);
        if (cachedFileName && !cachedFileName.startsWith('data:')) {
          try {
            const { Filesystem, Directory } = await import('@capacitor/filesystem');
            
            // Verify file exists
            const stat = await Filesystem.stat({
              path: `highvault/chapters/${cachedFileName}`,
              directory: Directory.Cache
            });
            console.log('[PdfViewer] Cache hit, size:', stat.size);

            const result = await Filesystem.readFile({
              path: `highvault/chapters/${cachedFileName}`,
              directory: Directory.Cache
            });
            const base64 = result.data as string;
            const base64Response = await fetch(`data:application/pdf;base64,${base64}`);
            pdfData = await base64Response.arrayBuffer();
            console.log('[PdfViewer] Loaded from cache successfully');
          } catch (e) {
            console.log('[PdfViewer] Cache miss or corrupt:', e);
            // Clear bad cache entry
            localStorage.removeItem(`hv_dl_${chapterId}`);
          }
        }
      }

      if (!pdfData && isOffline) {
        setError('You are offline. Download this PDF first to read offline.');
        setLoading(false);
        return;
      }

      if (!pdfData && storagePath) {
        console.log('[PdfViewer] Fetching from Supabase storage');
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

      const loadingTask = pdfjsLib.getDocument({ data: pdfData });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);

    } catch (e: any) {
      console.error('[PdfViewer] error:', e);
      setError('Failed to load PDF. Please try again.');
    }

    setLoading(false);
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
              <button onClick={loadPdf} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-elevated">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <button onClick={() => onOpenChange(false)} className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-surface-elevated">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        {!loading && !error && totalPages > 0 && (
          <div className="flex items-center justify-center gap-3 py-2 bg-surface border-b border-border shrink-0">
            <button
              onClick={() => setScale(s => Math.max(0.5, parseFloat((s - 0.25).toFixed(2))))}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-elevated border border-border"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-xs font-mono text-muted-foreground min-w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(s => Math.min(3, parseFloat((s + 0.25).toFixed(2))))}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-elevated border border-border"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <div className="w-px h-4 bg-border mx-1" />
            <span className="text-xs text-muted-foreground">
              {totalPages} page{totalPages !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Content */}
        <div
          className="flex-1 min-h-0 overflow-y-auto bg-slate-900 select-none p-4"
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

          {!loading && !error && pdfDoc && (
            <div className="flex flex-col items-center">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                <PdfPage key={`${num}-${scale}`} pdfDoc={pdfDoc} pageNum={num} scale={scale} />
              ))}
            </div>
          )}
        </div>
        {/* AI Tutor accessible inside PDF */}
          <AITutor />
      </DialogContent>
    </Dialog>
  );
};

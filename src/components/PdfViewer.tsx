import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { X, Loader2, BookOpen, RefreshCw, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storagePath: string | null;
  chapterId?: string;
  title?: string;
}

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const PdfViewer = ({ open, onOpenChange, storagePath, chapterId, title }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pageRendering, setPageRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const lastTouchDistance = useRef<number | null>(null);
  const ios = isIOS();

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setPdfDoc(null);
      setTotalPages(0);
      setError(null);
      setScale(1.0);
      setCurrentPage(1);
      return;
    }
    loadPdf();
  }, [open, storagePath, chapterId]);

  useEffect(() => {
    if (!open) return;
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', block);
    return () => document.removeEventListener('contextmenu', block);
  }, [open]);

  // Render page whenever pdfDoc, currentPage, or scale changes
  useEffect(() => {
    if (pdfDoc) renderPage(pdfDoc, currentPage, scale);
  }, [pdfDoc, currentPage, scale]);

  const renderPage = async (doc: any, pageNum: number, sc: number) => {
    if (!canvasRef.current || !doc) return;
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
    }
    setPageRendering(true);
    try {
      const page = await doc.getPage(pageNum);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const containerWidth = (canvas.parentElement?.clientWidth || window.innerWidth) - 32;
      const baseViewport = page.getViewport({ scale: 1 });
      // iOS: cap scale at 1.5 to avoid memory overflow
      const maxScale = ios ? Math.min(sc, 1.5) : sc;
      const finalScale = (containerWidth / baseViewport.width) * maxScale;
      const viewport = page.getViewport({ scale: finalScale });
      // iOS: no devicePixelRatio multiplication — that is what causes blank canvas
      const dpr = ios ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto';
      if (dpr !== 1) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderTaskRef.current = page.render({ canvasContext: ctx, viewport });
      await renderTaskRef.current.promise;
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') console.error('[PdfViewer]', e);
    }
    setPageRendering(false);
  };

  const loadPdf = async () => {
    setLoading(true);
    setError(null);
    setPdfDoc(null);
    setCurrentPage(1);

    try {
      let pdfData: ArrayBuffer | null = null;

      if (chapterId) {
        const cachedFile = localStorage.getItem(`hv_dl_${chapterId}`);
        if (cachedFile && !cachedFile.startsWith('data:')) {
          try {
            const { Filesystem, Directory } = await import('@capacitor/filesystem');
            await Filesystem.stat({ path: `highvault/chapters/${cachedFile}`, directory: Directory.Cache });
            const result = await Filesystem.readFile({ path: `highvault/chapters/${cachedFile}`, directory: Directory.Cache });
            const resp = await fetch(`data:application/pdf;base64,${result.data}`);
            pdfData = await resp.arrayBuffer();
          } catch {
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
        const { data, error: urlErr } = await supabase.storage
          .from('chapters').createSignedUrl(storagePath, 3600);
        if (urlErr || !data?.signedUrl) {
          setError('Could not load PDF. Please try again.');
          setLoading(false);
          return;
        }
        const resp = await fetch(data.signedUrl);
        if (!resp.ok) { setError('Failed to fetch PDF.'); setLoading(false); return; }
        pdfData = await resp.arrayBuffer();
      }

      if (!pdfData) { setError('No PDF data available.'); setLoading(false); return; }

      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      // iOS: disable range requests to reduce memory fragmentation
      const pdf = await pdfjsLib.getDocument({
        data: pdfData,
        disableRange: ios,
        disableStream: ios,
      }).promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
    } catch (e: any) {
      console.error('[PdfViewer]', e);
      setError('Failed to load PDF. Please try again.');
    }
    setLoading(false);
  };

  const goToPrev = () => setCurrentPage(p => Math.max(1, p - 1));
  const goToNext = () => setCurrentPage(p => Math.min(totalPages, p + 1));

  const getTouchDistance = (t: React.TouchList) => {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-none w-screen h-screen sm:rounded-none p-0 bg-background border-0 [&>button]:hidden flex flex-col"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 border-b border-border bg-surface shrink-0"
          style={{ paddingTop: 'max(10px, env(safe-area-inset-top))', paddingBottom: '10px' }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <BookOpen className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm font-semibold line-clamp-1">{title || 'Reading'}</p>
          </div>
          <div className="flex items-center gap-1">
            {!loading && !error && (
              <button onClick={loadPdf} className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-surface-elevated">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <button onClick={() => onOpenChange(false)} className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-surface-elevated">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        {!loading && !error && pdfDoc && totalPages > 0 && (
          <div className="flex items-center justify-between px-3 py-2 bg-surface border-b border-border shrink-0">
            {/* Page navigation */}
            <div className="flex items-center gap-2">
              <button onClick={goToPrev} disabled={currentPage <= 1}
                className="h-8 w-8 rounded-lg flex items-center justify-center border border-border disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground min-w-16 text-center">
                {currentPage} / {totalPages}
              </span>
              <button onClick={goToNext} disabled={currentPage >= totalPages}
                className="h-8 w-8 rounded-lg flex items-center justify-center border border-border disabled:opacity-40">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {/* Zoom */}
            <div className="flex items-center gap-2">
              <button onClick={() => setScale(s => Math.max(0.5, parseFloat((s - 0.25).toFixed(2))))}
                className="h-8 w-8 rounded-lg flex items-center justify-center border border-border">
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-xs font-mono text-muted-foreground w-10 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button onClick={() => setScale(s => Math.min(3, parseFloat((s + 0.25).toFixed(2))))}
                className="h-8 w-8 rounded-lg flex items-center justify-center border border-border">
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div
          className="flex-1 min-h-0 overflow-auto bg-slate-900 select-none p-4 relative"
          onContextMenu={e => e.preventDefault()}
          style={{ WebkitTouchCallout: 'none' } as any}
          onTouchStart={e => { if (e.touches.length === 2) lastTouchDistance.current = getTouchDistance(e.touches); }}
          onTouchMove={e => {
            if (e.touches.length === 2 && lastTouchDistance.current) {
              const d = getTouchDistance(e.touches);
              setScale(s => Math.min(3, Math.max(0.5, s * (d / lastTouchDistance.current!))));
              lastTouchDistance.current = d;
            }
          }}
          onTouchEnd={() => { lastTouchDistance.current = null; }}
        >
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading PDF...</p>
            </div>
          )}

          {!loading && error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <button onClick={loadPdf} className="px-4 py-2 bg-primary/10 border border-primary/40 text-primary text-sm rounded-lg">
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && pdfDoc && (
            <div className="flex flex-col items-center">
              {pageRendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 z-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
              <div className="shadow-lg bg-white">
                <canvas ref={canvasRef} />
              </div>
              {/* Swipe hint for iOS */}
              {ios && totalPages > 1 && (
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  Use ← → buttons to navigate pages
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

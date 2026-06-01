import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { X, Loader2, BookOpen, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import { AdSession } from "@/lib/adSession";
import { showInterstitial, isNativePlatform } from "@/lib/admob";

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

// Single page renderer — Android only
const PdfPage = ({ pdfDoc, pageNum, scale }: {
  pdfDoc: any; pageNum: number; scale: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    renderPage();
    return () => {
      if (renderTaskRef.current) try { renderTaskRef.current.cancel(); } catch {}
    };
  }, [pdfDoc, pageNum, scale]);

  const renderPage = async () => {
    if (!pdfDoc || !canvasRef.current) return;
    if (renderTaskRef.current) try { renderTaskRef.current.cancel(); } catch {}
    try {
      const page = await pdfDoc.getPage(pageNum);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const containerWidth = (canvas.parentElement?.clientWidth || window.innerWidth) - 32;
      const baseViewport = page.getViewport({ scale: 1 });
      const finalScale = (containerWidth / baseViewport.width) * scale;
      const viewport = page.getViewport({ scale: finalScale });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      canvas.style.display = 'block';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderTaskRef.current = page.render({ canvasContext: ctx, viewport });
      await renderTaskRef.current.promise;
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') console.error('[PdfPage]', e);
    }
  };

  return (
    <div className="shadow-lg mb-4 bg-white">
      <canvas ref={canvasRef} />
    </div>
  );
};

export const PdfViewer = ({ open, onOpenChange, storagePath, chapterId, title }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Hybrid zoom — visualScale for instant CSS, renderScale for PDF.js re-render
  const [visualScale, setVisualScale] = useState(1.0);
  const [renderScale, setRenderScale] = useState(1.0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTouchDistance = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateScale = (newScale: number) => {
    const clamped = Math.min(3, Math.max(0.5, newScale));
    setVisualScale(clamped);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setRenderScale(clamped), 350);
  };

  const getTouchDistance = (t: React.TouchList) => {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

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
      setVisualScale(1.0);
      setRenderScale(1.0);
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

  useEffect(() => {
  if (!open) return;
  const timer = setTimeout(async () => {
    if (AdSession.isInterstitialDue() && isNativePlatform() && navigator.onLine) {
      AdSession.markInterstitialShown();
      await showInterstitial();
    }
  }, 3 * 60 * 1000);
  return () => clearTimeout(timer);
}, [open]);
  
  const loadPdf = async () => {
    setLoading(true);
    setError(null);
    setPdfDoc(null);
    setVisualScale(1.0);
    setRenderScale(1.0);

    try {
      let pdfData: ArrayBuffer | null = null;

      // Check local cache first
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
      const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
    } catch (e: any) {
      console.error('[PdfViewer]', e);
      setError('Failed to load PDF. Please try again.');
    }
    setLoading(false);
  };

  // CSS scale multiplier for instant visual feedback
  const cssScale = visualScale / renderScale;

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

        {/* Zoom toolbar */}
        {!loading && !error && pdfDoc && totalPages > 0 && (
          <div className="flex items-center justify-center gap-3 py-2 bg-surface border-b border-border shrink-0">
            <button
              onClick={() => updateScale(visualScale - 0.25)}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-elevated border border-border"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-xs font-mono text-muted-foreground min-w-12 text-center">
              {Math.round(visualScale * 100)}%
            </span>
            <button
              onClick={() => updateScale(visualScale + 0.25)}
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
          ref={containerRef}
          className="flex-1 min-h-0 overflow-auto bg-slate-900 select-none p-4"
          onContextMenu={e => e.preventDefault()}
          style={{ WebkitTouchCallout: 'none' } as any}
          onTouchStart={e => {
            if (e.touches.length === 2) {
              lastTouchDistance.current = getTouchDistance(e.touches);
            }
          }}
          onTouchMove={e => {
            if (e.touches.length === 2 && lastTouchDistance.current !== null) {
              const newDist = getTouchDistance(e.touches);
              const ratio = newDist / lastTouchDistance.current;
              lastTouchDistance.current = newDist;
              setVisualScale(s => Math.min(3, Math.max(0.5, s * ratio)));
            }
          }}
          onTouchEnd={() => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
              setVisualScale(v => {
                setRenderScale(v);
                return v;
              });
            }, 350);
            lastTouchDistance.current = null;
          }}
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
              <button onClick={loadPdf} className="px-4 py-2 bg-primary/10 border border-primary/40 text-primary text-sm rounded-lg">
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && pdfDoc && (
            <div
              className="flex flex-col items-center"
              style={{
                transform: `scale(${cssScale})`,
                transformOrigin: 'top center',
                transition: 'transform 0.08s ease-out',
                willChange: 'transform',
              }}
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                <PdfPage
                  key={`${num}-${renderScale}`}
                  pdfDoc={pdfDoc}
                  pageNum={num}
                  scale={renderScale}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

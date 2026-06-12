import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { X, Loader2, BookOpen, RefreshCw, ZoomIn, ZoomOut, Bot } from "lucide-react";
import { AdSession } from "@/lib/adSession";
import { showInterstitial, isNativePlatform } from "@/lib/admob";
import { AITutor } from "@/components/AITutor";

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

  // renderScale drives PDF.js re-render (only updates when pinch gesture ends)
  // visualScale drives the instant CSS transform during the gesture
  const [renderScale, setRenderScale] = useState(1.0);
  const [visualScale, setVisualScale] = useState(1.0);
  const [aiOpen, setAiOpen] = useState(false);

  // ── Pinch gesture tracking — all in refs so no re-render during gesture ──────
  // liveScale: the scale accumulating during the pinch, stored in a ref so
  // onTouchMove never triggers React re-renders — smooth 60fps gesture
  const liveScaleRef = useRef(1.0);
  const lastTouchDistRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const renderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // DOM ref to the inner scale div — we mutate style directly for 60fps smoothness
  const scaleLayerRef = useRef<HTMLDivElement>(null);

  const clamp = (v: number) => Math.min(3.5, Math.max(0.5, v));

  const getTouchDist = (t: React.TouchList) => {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Apply CSS transform directly to DOM — bypasses React render cycle entirely
  // This is what makes pinch zoom feel native and smooth (same technique as Google Maps)
  const applyLiveScale = (scale: number) => {
    if (!scaleLayerRef.current) return;
    const cssScale = scale / renderScale;
    scaleLayerRef.current.style.transform = `scale(${cssScale})`;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastTouchDistRef.current = getTouchDist(e.touches);
      liveScaleRef.current = visualScale;
      // Cancel any pending re-render from a previous gesture
      if (renderDebounceRef.current) clearTimeout(renderDebounceRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 2 || lastTouchDistRef.current === null) return;
    const newDist = getTouchDist(e.touches);
    const ratio = newDist / lastTouchDistRef.current;
    lastTouchDistRef.current = newDist;
    liveScaleRef.current = clamp(liveScaleRef.current * ratio);

    // Use rAF to throttle DOM mutations to screen refresh rate (60fps)
    // Never call setState here — that's what caused the jumpy/sluggish behaviour
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      applyLiveScale(liveScaleRef.current);
    });
  };

  const handleTouchEnd = () => {
    if (lastTouchDistRef.current === null) return;
    lastTouchDistRef.current = null;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

    const finalScale = liveScaleRef.current;

    // Commit to React state — this snaps the CSS transform back to 1
    // and triggers PDF.js to re-render at the new resolution
    setVisualScale(finalScale);

    // Debounce PDF.js re-render by 400ms so it only fires once the user
    // has fully lifted their fingers, not mid-gesture
    if (renderDebounceRef.current) clearTimeout(renderDebounceRef.current);
    renderDebounceRef.current = setTimeout(() => {
      setRenderScale(finalScale);
    }, 400);
  };

  // When visualScale changes (from gesture end or zoom buttons),
  // update the CSS transform on the layer div
  useEffect(() => {
    if (scaleLayerRef.current) {
      const cssScale = visualScale / renderScale;
      scaleLayerRef.current.style.transform = `scale(${cssScale})`;
      scaleLayerRef.current.style.transition = 'transform 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      // Remove transition after it completes so pinch gestures feel instant
      const t = setTimeout(() => {
        if (scaleLayerRef.current) scaleLayerRef.current.style.transition = '';
      }, 200);
      return () => clearTimeout(t);
    }
  }, [visualScale, renderScale]);

  const updateScale = (newScale: number) => {
    const clamped = clamp(newScale);
    liveScaleRef.current = clamped;
    setVisualScale(clamped);
    if (renderDebounceRef.current) clearTimeout(renderDebounceRef.current);
    renderDebounceRef.current = setTimeout(() => setRenderScale(clamped), 400);
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
      liveScaleRef.current = 1.0;
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
    liveScaleRef.current = 1.0;

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
      const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
    } catch (e: any) {
      console.error('[PdfViewer]', e);
      setError('Failed to load PDF. Please try again.');
    }
    setLoading(false);
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
            {/* AI Tutor button — available while reading */}
            <button
              onClick={() => setAiOpen(true)}
              className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-surface-elevated"
              aria-label="Ask AI Tutor"
              title="Ask AI Tutor"
            >
              <Bot className="h-5 w-5 text-primary" />
            </button>
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
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
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
            // scaleLayerRef is mutated directly in touch handlers — no React re-renders during gesture
            <div
              ref={scaleLayerRef}
              className="flex flex-col items-center"
              style={{
                transformOrigin: 'top center',
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
      {/* AI Tutor rendered inside the PDF viewer context so it overlays
          the PDF without needing to close it. The AITutor component manages
          its own open/close state — we pass externalOpen to control it from
          the header Bot button */}
      {open && <AITutor externalOpen={aiOpen} onExternalClose={() => setAiOpen(false)} />}
    </Dialog>
  );
};

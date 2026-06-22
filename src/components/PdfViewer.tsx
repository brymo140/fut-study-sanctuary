import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
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
  externalFileUri?: string | null;
}

// ─── Single page renderer ─────────────────────────────────────────────────────
const PdfPage = ({
  pdfDoc,
  pageNum,
  renderScale,
}: {
  pdfDoc: any;
  pageNum: number;
  renderScale: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    renderPage();
    return () => {
      if (renderTaskRef.current) try { renderTaskRef.current.cancel(); } catch {}
    };
  }, [pdfDoc, pageNum, renderScale]);

  const renderPage = async () => {
    if (!pdfDoc || !canvasRef.current) return;
    if (renderTaskRef.current) try { renderTaskRef.current.cancel(); } catch {}
    try {
      const page = await pdfDoc.getPage(pageNum);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Base width = full screen width, then multiply by renderScale
      const containerWidth = window.innerWidth;
      const baseViewport = page.getViewport({ scale: 1 });
      const finalScale = (containerWidth / baseViewport.width) * renderScale;
      const viewport = page.getViewport({ scale: finalScale });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      canvas.style.display = "block";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderTaskRef.current = page.render({ canvasContext: ctx, viewport });
      await renderTaskRef.current.promise;
    } catch (e: any) {
      if (e?.name !== "RenderingCancelledException") console.error("[PdfPage]", e);
    }
  };

  return (
    <div className="shadow-lg mb-3 bg-white rounded overflow-hidden">
      <canvas ref={canvasRef} />
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
export const PdfViewer = ({ open, onOpenChange, storagePath, chapterId, title, externalFileUri }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [aiOpen, setAiOpen] = useState(false);
  const [pdfText, setPdfText] = useState<string | null>(null);

  // renderScale triggers PDF.js re-render at new resolution (only on gesture end)
  const [renderScale, setRenderScale] = useState(1.0);

  // ── Pinch zoom — all gesture tracking in refs, zero React renders mid-gesture ─
  const liveScaleRef = useRef(1.0);          // scale accumulating during pinch
  const renderScaleRef = useRef(1.0);         // mirrors renderScale state for use in handlers
  const lastTouchDistRef = useRef<number | null>(null);
  const lastPinchCenterRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const renderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const innerContentRef = useRef<HTMLDivElement>(null);  // the div we resize to enable real scroll

  const clamp = (v: number) => Math.min(4.0, Math.max(0.75, v));

  const getTouchDist = (t: React.TouchList) => {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (t: React.TouchList) => ({
    x: (t[0].clientX + t[1].clientX) / 2,
    y: (t[0].clientY + t[1].clientY) / 2,
  });

  // Apply scale by resizing the inner content div — this is the KEY difference
  // from using CSS transform: the scroll container sees the real size, so
  // overflow scrolling in all directions works naturally after zoom.
  const applyScaleToLayout = useCallback((scale: number) => {
    if (!innerContentRef.current) return;
    // Scale the content by adjusting its width and letting height flow naturally.
    // At scale 1 it fits the viewport width; at scale 2 it's 2x wide, triggering
    // horizontal scroll. PDF pages inside re-render at renderScale for sharpness.
    const baseWidth = window.innerWidth;
    innerContentRef.current.style.width = `${baseWidth * scale}px`;
    innerContentRef.current.style.transformOrigin = "top left";
    // No CSS transform — layout reflow gives us real scrollable area
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastTouchDistRef.current = getTouchDist(e.touches);
      lastPinchCenterRef.current = getTouchCenter(e.touches);
      liveScaleRef.current = renderScaleRef.current;
      if (renderDebounceRef.current) clearTimeout(renderDebounceRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
  };

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2 || lastTouchDistRef.current === null) return;
    // Prevent page scroll during pinch
    e.preventDefault?.();
    const newDist = getTouchDist(e.touches);
    const ratio = newDist / lastTouchDistRef.current;
    lastTouchDistRef.current = newDist;
    liveScaleRef.current = clamp(liveScaleRef.current * ratio);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      applyScaleToLayout(liveScaleRef.current);
    });
  }, [applyScaleToLayout]);

  const handleTouchEnd = useCallback(() => {
    if (lastTouchDistRef.current === null) return;
    lastTouchDistRef.current = null;
    lastPinchCenterRef.current = null;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

    const finalScale = liveScaleRef.current;
    applyScaleToLayout(finalScale);

    // Debounce PDF.js re-render — fires 350ms after fingers lift
    // This re-renders all pages at the new resolution for crispness
    if (renderDebounceRef.current) clearTimeout(renderDebounceRef.current);
    renderDebounceRef.current = setTimeout(() => {
      renderScaleRef.current = finalScale;
      setRenderScale(finalScale);
    }, 350);
  }, [applyScaleToLayout]);

  // Zoom button handler — smooth animated resize
  const updateScale = (newScale: number) => {
    const s = clamp(newScale);
    liveScaleRef.current = s;

    // Animate the width change with a CSS transition on the inner div
    if (innerContentRef.current) {
      innerContentRef.current.style.transition = "width 0.2s cubic-bezier(0.25,0.46,0.45,0.94)";
      applyScaleToLayout(s);
      setTimeout(() => {
        if (innerContentRef.current) innerContentRef.current.style.transition = "";
      }, 220);
    }

    if (renderDebounceRef.current) clearTimeout(renderDebounceRef.current);
    renderDebounceRef.current = setTimeout(() => {
      renderScaleRef.current = s;
      setRenderScale(s);
    }, 350);
  };

  // Reset layout on scale reset
  const resetScale = () => {
    updateScale(1.0);
    // Scroll back to left/top after reset
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = 0;
      }
    }, 250);
  };

  // ── Network listeners ─────────────────────────────────────────────────────
  useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // ── Open / close ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setPdfDoc(null);
      setTotalPages(0);
      setError(null);
      setRenderScale(1.0);
      renderScaleRef.current = 1.0;
      liveScaleRef.current = 1.0;
      setAiOpen(false);
      setPdfText(null);
      // Restore body overflow-x: hidden when PDF closes
      document.body.classList.remove("pdf-viewer-open");
      return;
    }
    // Allow horizontal scroll while PDF is open
    document.body.classList.add("pdf-viewer-open");
    loadPdf();
  }, [open, storagePath, chapterId, externalFileUri]);

  // Block context menu (right-click / long press) while open
  useEffect(() => {
    if (!open) return;
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, [open]);

  // Interstitial ad timer while reading
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

  // ── PDF load ──────────────────────────────────────────────────────────────
  const loadPdf = async () => {
    setLoading(true);
    setError(null);
    setPdfDoc(null);
    setPdfText(null);
    setRenderScale(1.0);
    renderScaleRef.current = 1.0;
    liveScaleRef.current = 1.0;
    if (innerContentRef.current) innerContentRef.current.style.width = `${window.innerWidth}px`;

    try {
      let pdfData: ArrayBuffer | null = null;

      if (externalFileUri) {
        try {
          const { Filesystem } = await import("@capacitor/filesystem");
          const result = await Filesystem.readFile({ path: externalFileUri });
          const resp = await fetch(`data:application/pdf;base64,${result.data}`);
          pdfData = await resp.arrayBuffer();
        } catch {
          setError("Could not open this file.");
          setLoading(false);
          return;
        }
      }

      if (!pdfData && chapterId) {
        const cachedFile = localStorage.getItem(`hv_dl_${chapterId}`);
        if (cachedFile && !cachedFile.startsWith("data:")) {
          try {
            const { Filesystem, Directory } = await import("@capacitor/filesystem");
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
        setError("You're offline. Download this PDF first to read offline.");
        setLoading(false);
        return;
      }

      if (!pdfData && storagePath) {
        const { data, error: urlErr } = await supabase.storage
          .from("chapters").createSignedUrl(storagePath, 3600);
        if (urlErr || !data?.signedUrl) {
          setError("Could not load PDF. Please try again.");
          setLoading(false);
          return;
        }
        const resp = await fetch(data.signedUrl);
        if (!resp.ok) { setError("Failed to fetch PDF."); setLoading(false); return; }
        pdfData = await resp.arrayBuffer();
      }

      if (!pdfData) { setError("No PDF data available."); setLoading(false); return; }

      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);

      // Extract text from first 5 pages for AI context
      // Runs in background — doesn't block PDF rendering
      ;(async () => {
        try {
          const maxPages = Math.min(5, pdf.numPages);
          const textParts: string[] = [];
          for (let p = 1; p <= maxPages; p++) {
            const page = await pdf.getPage(p);
            const tc = await page.getTextContent();
            const pageText = tc.items.map((item: any) => item.str).join(" ");
            textParts.push(pageText);
          }
          const fullText = textParts.join("\n\n").replace(/\s{3,}/g, " ").trim();
          if (fullText.length > 50) setPdfText(fullText);
        } catch (e) {
          console.warn("[PdfViewer] Text extraction failed:", e);
        }
      })();
    } catch (e: any) {
      console.error("[PdfViewer]", e);
      setError("Failed to load PDF. Please try again.");
    }
    setLoading(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} modal={!aiOpen}>
        <DialogContent
          className="max-w-none w-screen h-screen sm:rounded-none p-0 bg-background border-0 [&>button]:hidden flex flex-col"
          style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
          onPointerDownOutside={(e) => { if (aiOpen) e.preventDefault(); }}
          onInteractOutside={(e) => { if (aiOpen) e.preventDefault(); }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 border-b border-border bg-surface shrink-0"
            style={{ paddingTop: "max(10px, env(safe-area-inset-top))", paddingBottom: "10px" }}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <BookOpen className="h-4 w-4 text-primary shrink-0" />
              <p className="text-sm font-semibold line-clamp-1">{title || "Reading"}</p>
            </div>
            <div className="flex items-center gap-1">
              {!loading && !error && (
                <button onClick={loadPdf} className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-surface-elevated">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              {/* AI Tutor — opens via portal above Dialog overlay (z-[200]) */}
              <button
                onClick={() => setAiOpen(true)}
                className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-surface-elevated"
                aria-label="Ask AI Tutor"
              >
                <Bot className="h-5 w-5 text-primary" />
              </button>
              <button onClick={() => onOpenChange(false)} className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-surface-elevated">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* ── Zoom toolbar ── */}
          {!loading && !error && pdfDoc && totalPages > 0 && (
            <div className="flex items-center justify-center gap-3 py-2 bg-surface border-b border-border shrink-0">
              <button
                onClick={() => updateScale(renderScaleRef.current - 0.25)}
                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-elevated border border-border"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                onClick={resetScale}
                className="text-xs font-mono text-muted-foreground min-w-14 text-center px-2 py-1 rounded hover:bg-surface-elevated border border-border"
              >
                {Math.round(renderScale * 100)}%
              </button>
              <button
                onClick={() => updateScale(renderScaleRef.current + 0.25)}
                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-elevated border border-border"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <div className="w-px h-4 bg-border mx-1" />
              <span className="text-xs text-muted-foreground">
                {totalPages}p · pinch or tap % to reset
              </span>
            </div>
          )}

          {/* ── Scroll container — overflow in ALL directions ── */}
          <div
            ref={scrollContainerRef}
            className="flex-1 min-h-0 overflow-auto bg-slate-900 select-none"
            onContextMenu={e => e.preventDefault()}
            style={{ WebkitTouchCallout: "none", touchAction: "pan-x pan-y" } as any}
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
              // innerContentRef is resized directly (not CSS transform) so the
              // scroll container sees the real wider/taller layout and enables
              // horizontal + vertical scrolling after zoom — same as native PDF apps
              <div
                ref={innerContentRef}
                style={{
                  width: `${window.innerWidth}px`,  // grows with zoom
                  minHeight: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "16px",
                  boxSizing: "border-box",
                }}
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                  <PdfPage
                    key={`${num}-${renderScale}`}
                    pdfDoc={pdfDoc}
                    pageNum={num}
                    renderScale={renderScale}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Tutor portal — rendered at document.body level so it sits ABOVE
          the Dialog overlay (z-50). We use z-[200] to guarantee it's on top.
          This is why the Bot button wasn't working before — the Dialog backdrop
          at z-50 was intercepting all touch/click events on the AITutor panel. */}
      {open && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 200, pointerEvents: aiOpen ? "auto" : "none" }}>
          <AITutor externalOpen={aiOpen} onExternalClose={() => setAiOpen(false)} pdfContext={pdfText} pdfTitle={title} />
        </div>,
        document.body
      )}
    </>
  );
};

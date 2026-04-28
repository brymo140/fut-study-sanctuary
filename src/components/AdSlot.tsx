import { useEffect, useRef } from "react";
import { useOnline } from "@/hooks/useOnline";

interface AdSlotProps {
  slot?: string;
  format?: string;
  className?: string;
  /** Render as a thin 320x50-style banner */
  banner?: boolean;
}

/**
 * Google AdSense slot. The publisher script is loaded in index.html (ca-pub-4988426041877845).
 * - When `slot` is provided we render a real AdSense unit.
 * - When offline, we render nothing (collapsed) so the layout doesn't show empty boxes.
 * - When online but no slot id is configured yet, we render a tasteful placeholder.
 */
export const AdSlot = ({ slot, format = "auto", className = "", banner = false }: AdSlotProps) => {
  const online = useOnline();
  const pushed = useRef(false);

  useEffect(() => {
    if (!slot || !online || pushed.current) return;
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch (e) {
      console.warn("AdSense push failed", e);
    }
  }, [slot, online]);

  if (!online) return null;

  if (!slot) {
    return (
      <div
        className={`w-full ${banner ? "h-[50px]" : "min-h-[200px]"} rounded-lg border border-dashed border-border bg-surface flex items-center justify-center text-muted-foreground ${className}`}
      >
        <p className="text-[10px] uppercase tracking-widest font-semibold opacity-60">Ad space</p>
      </div>
    );
  }

  if (banner) {
    return (
      <ins
        className={`adsbygoogle ${className}`}
        style={{ display: "inline-block", width: "320px", height: "50px" }}
        data-ad-client="ca-pub-4988426041877845"
        data-ad-slot={slot}
      />
    );
  }

  return (
    <ins
      className={`adsbygoogle ${className}`}
      style={{ display: "block" }}
      data-ad-client="ca-pub-4988426041877845"
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
};

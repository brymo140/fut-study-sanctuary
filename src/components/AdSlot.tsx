import { useEffect } from "react";

interface AdSlotProps {
  slot?: string; // your ad unit slot id
  format?: string;
  className?: string;
}

/**
 * Google AdSense slot. The publisher script is loaded in index.html.
 * Pass your `slot` (data-ad-slot) once you create an ad unit in AdSense.
 * Until then, this renders a styled placeholder.
 */
export const AdSlot = ({ slot, format = "auto", className = "" }: AdSlotProps) => {
  useEffect(() => {
    if (!slot) return;
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.warn("AdSense push failed", e);
    }
  }, [slot]);

  if (!slot) {
    return (
      <div
        className={`w-full min-h-[200px] rounded-xl border-2 border-dashed border-border bg-surface flex flex-col items-center justify-center text-muted-foreground ${className}`}
      >
        <p className="text-xs uppercase tracking-widest font-semibold">Advertisement</p>
        <p className="text-[10px] mt-1 opacity-60">AdSense slot will appear here</p>
      </div>
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

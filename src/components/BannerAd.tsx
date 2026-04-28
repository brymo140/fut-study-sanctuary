import { useOnline } from "@/hooks/useOnline";

/**
 * Thin horizontal in-app banner. Collapses entirely when offline.
 * Uses AdSense Auto Ads on the page; this just reserves a slot visually
 * so layout feels intentional. When you create a real 320x50 unit in
 * AdSense, swap the inner div for <AdSlot slot="YOUR_SLOT_ID" banner />.
 */
export const BannerAd = ({ className = "" }: { className?: string }) => {
  const online = useOnline();
  if (!online) return null;
  return (
    <div className={`flex justify-center ${className}`}>
      <div className="h-[50px] w-[320px] rounded-md border border-border bg-surface flex items-center justify-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">Sponsored</p>
      </div>
    </div>
  );
};

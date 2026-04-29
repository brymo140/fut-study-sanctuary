// ADMOB READY — swap placeholder with AdMob BannerAd widget on app conversion.
// Web: AdSense Auto Ads handles serving site-wide; this is a labelled
// reserved slot that collapses entirely when offline.
import { useOnline } from "@/hooks/useOnline";

export const BannerAd = ({ className = "" }: { className?: string }) => {
  const online = useOnline();
  if (!online) return null;
  return (
    <div className={`flex justify-center ${className}`}>
      <div
        className="relative h-[50px] w-[320px] rounded-md border border-border flex items-center justify-center"
        style={{ backgroundColor: "#13131f" }}
      >
        <span className="absolute top-0.5 left-1.5 text-[9px] uppercase tracking-widest text-muted-foreground/70">Ad</span>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">Sponsored</p>
      </div>
    </div>
  );
};

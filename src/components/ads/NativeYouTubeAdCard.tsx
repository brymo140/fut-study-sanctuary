// ADMOB READY — On app conversion replace with AdMob Native Advanced ad unit.
// Map: thumbnail → mediaView, name → headlineView, description → bodyView,
// CTA → callToActionView.
import { Play } from "lucide-react";

export const NativeYouTubeAdCard = () => {
  return (
    <div className="surface-card p-3 flex gap-3 relative border-warning/30">
      <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider text-warning bg-warning/10 px-1.5 py-0.5 rounded">
        Sponsored
      </span>
      <div className="h-20 w-20 shrink-0 rounded-lg bg-gradient-cover overflow-hidden flex items-center justify-center">
        <Play className="h-8 w-8 text-white/80" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <p className="text-sm font-semibold line-clamp-1 pr-16">Featured partner</p>
        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
          Discover learning resources from our sponsor.
        </p>
        <button
          className="mt-auto inline-flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-md self-start"
        >
          Learn More
        </button>
      </div>
    </div>
  );
};

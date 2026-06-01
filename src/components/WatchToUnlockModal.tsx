import { useEffect, useRef, useState } from "react";
import { Gift, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Confetti } from "./ads/Confetti";
import { AdSession } from "@/lib/adSession";
import { showRewardedAd, isOnline, isNativePlatform } from "@/lib/admob";
import { toast } from "sonner";

interface Props {
  open: boolean;
  chapterTitle: string;
  onClose: () => void;
  onUnlocked: () => void;
}

export const WatchToUnlockModal = ({ open, chapterTitle, onClose, onUnlocked }: Props) => {
  const [phase, setPhase] = useState<"loading" | "unlocked" | "no-ad">("loading");
  const started = useRef(false);

  useEffect(() => {
    if (!open) { started.current = false; setPhase("loading"); return; }
    if (started.current) return;
    started.current = true;

    if (!isOnline()) {
      toast.error("You need internet to unlock this module");
      onClose();
      return;
    }

    AdSession.markRewardedDownloadShown();
    (async () => {
      const granted = await showRewardedAd();
      if (granted) {
        setPhase("unlocked");
        await Promise.resolve(onUnlocked());
      } else {
        // Ad not available — show skip option instead of blocking user
        if (!isNativePlatform()) {
          // Web/PWA — always allow (no ads on web)
          setPhase("unlocked");
          await Promise.resolve(onUnlocked());
        } else {
          // Native Android but ad failed — show skip option
          setPhase("no-ad");
        }
      }
    })();
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
      <div className="relative w-full max-w-sm surface-elevated p-6 rounded-2xl animate-fade-in overflow-hidden">

        {phase === "loading" && (
          <div className="flex flex-col items-center py-6">
            <div className="h-12 w-12 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
            <p className="text-sm font-semibold">Loading rewarded ad…</p>
            <p className="text-[11px] text-muted-foreground mt-1 text-center">
              Watch the full ad to unlock<br />
              <span className="text-foreground/80">{chapterTitle}</span>
            </p>
          </div>
        )}

        {phase === "no-ad" && (
          <div className="flex flex-col items-center py-4 text-center gap-4">
            <div className="text-4xl">📭</div>
            <div>
              <p className="text-sm font-semibold">No ad available right now</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ads are still being set up. You can download this module for free for now.
              </p>
            </div>
            <Button
              onClick={async () => {
                setPhase("unlocked");
                await Promise.resolve(onUnlocked());
              }}
              className="w-full h-11 rounded-xl font-semibold"
            >
              📥 Download for Free
            </Button>
            <button onClick={onClose} className="text-xs text-muted-foreground">
              Cancel
            </button>
          </div>
        )}

        {phase === "unlocked" && (
          <>
            <Confetti />
            <div
              className="text-center -mx-6 -mt-6 px-6 pt-6 pb-4 rounded-t-2xl"
              style={{ background: "linear-gradient(135deg, hsl(var(--success) / 0.85), hsl(var(--success)))" }}
            >
              <div className="text-4xl mb-1">🎉</div>
              <h3 className="font-bold text-xl text-white">Reward Granted!</h3>
            </div>
            <div className="text-center mt-4">
              <p className="text-sm text-foreground/90 mb-1">Unlocked:</p>
              <p className="text-base font-semibold mb-3">{chapterTitle}</p>
              <div className="inline-flex items-center gap-1.5 text-sm text-warning font-semibold">
                <Gift className="h-4 w-4" /> +10 XP earned
              </div>
            </div>
            <Button
              onClick={onUnlocked}
              size="lg"
              className="w-full mt-6 bg-primary hover:bg-primary/90 text-primary-foreground h-12 rounded-xl font-semibold"
            >
              <Eye className="h-4 w-4 mr-2" /> Read inside HighVault
            </Button>
          </>
        )}

      </div>
    </div>
  );
};

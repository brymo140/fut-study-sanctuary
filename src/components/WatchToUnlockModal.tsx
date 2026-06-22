import { useEffect, useRef, useState } from "react";
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
  const [phase, setPhase] = useState<"loading" | "no-ad">("loading");
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
      if (granted || !isNativePlatform()) {
        onClose();
        onUnlocked();
        return;
      }
      setPhase("no-ad");
    })();
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
      <div className="relative w-full max-w-sm surface-elevated p-6 rounded-2xl animate-fade-in">

        {phase === "loading" && (
          <div className="flex flex-col items-center py-6">
            <div className="h-12 w-12 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
            <p className="text-sm font-semibold">Loading ad…</p>
            <p className="text-[11px] text-muted-foreground mt-1 text-center">
              {chapterTitle}
            </p>
          </div>
        )}

        {phase === "no-ad" && (
          <div className="flex flex-col items-center py-4 text-center gap-4">
            <div className="text-4xl">📭</div>
            <div>
              <p className="text-sm font-semibold">No ad available right now</p>
              <p className="text-xs text-muted-foreground mt-1">
                You can download this module for free for now.
              </p>
            </div>
            <button
              onClick={() => { onClose(); onUnlocked(); }}
              className="w-full h-11 rounded-xl font-semibold bg-primary text-primary-foreground"
            >
              📥 Download for Free
            </button>
            <button onClick={onClose} className="text-xs text-muted-foreground">
              Cancel
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

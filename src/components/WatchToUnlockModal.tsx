import { useEffect, useState } from "react";
import { X, Gift, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdSlot } from "./AdSlot";

interface Props {
  open: boolean;
  chapterTitle: string;
  durationSec?: number;
  onClose: () => void;
  onUnlocked: () => void;
}

export const WatchToUnlockModal = ({ open, chapterTitle, durationSec = 30, onClose, onUnlocked }: Props) => {
  const [remaining, setRemaining] = useState(durationSec);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRemaining(durationSec);
    setUnlocked(false);
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          setUnlocked(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [open, durationSec]);

  if (!open) return null;

  const pct = ((durationSec - remaining) / durationSec) * 100;
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
      <div className="relative w-full max-w-sm surface-elevated p-6 rounded-2xl animate-fade-in">
        {!unlocked ? (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-3xl mb-1">🎬</div>
                <h3 className="font-bold text-lg">Watch to unlock</h3>
                <p className="text-xs text-muted-foreground line-clamp-1">{chapterTitle}</p>
              </div>
              <button
                onClick={onClose} aria-label="Close"
                className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"
              ><X className="h-4 w-4" /></button>
            </div>

            <div className="flex justify-center my-6">
              <div className="relative h-32 w-32">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" stroke="hsl(var(--border))" strokeWidth="8" fill="none" />
                  <circle
                    cx="60" cy="60" r="54" stroke="hsl(var(--primary))" strokeWidth="8" fill="none"
                    strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary">{remaining}</span>
                </div>
              </div>
            </div>

            <AdSlot className="mb-3" />
            <p className="text-[11px] text-center text-muted-foreground">
              Do not close this screen · Ad 1 of 1
            </p>

            <Button disabled className="w-full mt-4 h-11 rounded-xl opacity-40 cursor-not-allowed bg-surface border border-border">
              Download will unlock in {remaining}s
            </Button>
          </>
        ) : (
          <>
            <div className="text-center -mx-6 -mt-6 px-6 pt-6 pb-4 rounded-t-2xl bg-gradient-reward">
              <div className="text-4xl mb-1">🎉</div>
              <h3 className="font-bold text-xl text-white">Reward granted!</h3>
            </div>
            <div className="text-center mt-4">
              <p className="text-sm text-foreground/90 mb-1">Unlocked:</p>
              <p className="text-base font-semibold mb-3">{chapterTitle}</p>
              <div className="inline-flex items-center gap-1.5 text-sm text-warning font-semibold">
                <Gift className="h-4 w-4" /> +10 XP earned
              </div>
            </div>
            <Button onClick={onUnlocked} size="lg" className="w-full mt-6 bg-gradient-button border border-primary/40 text-primary h-12 rounded-xl font-semibold">
              <Download className="h-4 w-4 mr-2" /> Download now
            </Button>
            <Button onClick={onClose} variant="ghost" className="w-full mt-2 text-muted-foreground">
              Maybe later
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

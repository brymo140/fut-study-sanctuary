// ADMOB READY — swap placeholder with AdMob SDK unit on app conversion.
// Web build: AdSense Auto Ads handle real serving site-wide; this is an
// in-app interstitial frame triggered every 30–40 minutes at navigation.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdPlaceholder } from "./AdPlaceholder";
import { AdSession } from "@/lib/adSession";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Kind = "interstitial" | "rewarded-interstitial";

export const InterstitialAdHost = () => {
  const { pathname } = useLocation();
  const { user, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("interstitial");
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [canClose, setCanClose] = useState(false);
  const [completed, setCompleted] = useState(false);
  const lastPath = useRef<string>(pathname);

  // Update ads-enabled flag whenever the route changes.
  useEffect(() => {
    AdSession.setAdsEnabledForPath(pathname);
  }, [pathname]);

  // Trigger on natural navigation only.
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    if (open) return;
    if (!AdSession.isInterstitialDue()) return;

    const k = AdSession.pickInterstitialKind();
    setKind(k);
    setSecondsLeft(k === "rewarded-interstitial" ? 30 : 5);
    setCanClose(false);
    setCompleted(false);
    setOpen(true);
  }, [pathname, open]);

  // Countdown
  useEffect(() => {
    if (!open) return;
    // Always allow close after 5s
    const closeT = setTimeout(() => setCanClose(true), 5000);

    let tick: any;
    if (kind === "rewarded-interstitial") {
      tick = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(tick);
            setCompleted(true);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      // For plain interstitial, just countdown the 5s "close" timer for display.
      tick = setInterval(() => {
        setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
      }, 1000);
    }
    return () => { clearTimeout(closeT); clearInterval(tick); };
  }, [open, kind]);

  const close = async (grantReward: boolean) => {
    if (!canClose && !completed) return;
    AdSession.markInterstitialShown();
    setOpen(false);

    if (kind === "rewarded-interstitial" && grantReward && completed && user) {
      const { data: prof } = await supabase.from("profiles").select("xp").eq("id", user.id).maybeSingle();
      await supabase.from("profiles").update({ xp: (prof?.xp || 0) + 25 }).eq("id", user.id);
      refreshProfile();
      toast.success("+25 XP Bonus!");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/85 backdrop-blur-md" />
      <div className="relative w-full max-w-sm surface-elevated rounded-2xl p-6 animate-fade-in">
        {kind === "rewarded-interstitial" ? (
          <>
            <div className="text-center mb-4">
              <div className="inline-flex h-12 w-12 rounded-full bg-warning/15 items-center justify-center mb-2">
                <Star className="h-6 w-6 text-warning fill-warning" />
              </div>
              <h3 className="font-bold text-lg">Watch for a Bonus Reward!</h3>
              <p className="text-xs text-muted-foreground mt-1">Watch this short ad and earn 25 bonus XP</p>
            </div>
            <AdPlaceholder
              label="AdMob Rewarded Interstitial Ad"
              note="unit ready for SDK"
            />
            <p className="text-center text-sm text-primary font-semibold mt-3">
              {completed ? "Reward unlocked" : `${secondsLeft}s left`}
            </p>
            {canClose && (
              <button
                onClick={() => close(true)}
                aria-label="Close"
                className="absolute top-3 right-3 h-8 w-8 rounded-full bg-background/60 hover:bg-background flex items-center justify-center"
              ><X className="h-4 w-4" /></button>
            )}
            {completed && (
              <Button onClick={() => close(true)} className="w-full mt-4 h-11 rounded-xl bg-primary text-primary-foreground font-semibold">
                Claim +25 XP
              </Button>
            )}
          </>
        ) : (
          <>
            <AdPlaceholder
              label="AdMob Interstitial Ad"
              note="unit ready for SDK"
            />
            {canClose ? (
              <button
                onClick={() => close(false)}
                aria-label="Close"
                className="absolute top-3 right-3 h-8 w-8 rounded-full bg-background/60 hover:bg-background flex items-center justify-center"
              ><X className="h-4 w-4" /></button>
            ) : (
              <p className="text-center text-[11px] text-muted-foreground mt-3">
                Closeable in {secondsLeft}s
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

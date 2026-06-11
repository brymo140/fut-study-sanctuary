import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { AdSession } from "@/lib/adSession";
import { showInterstitial, showRewardedInterstitial, isOnline } from "@/lib/admob";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const InterstitialAdHost = () => {
  const { pathname } = useLocation();
  const { user, refreshProfile } = useAuth();
  const lastPath = useRef<string>(pathname);
  const showing = useRef(false);

  useEffect(() => { AdSession.setAdsEnabledForPath(pathname); }, [pathname]);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    if (showing.current) return;
    if (!isOnline()) return;
    if (!AdSession.isInterstitialDue()) return;
    showing.current = true;

    const kind = AdSession.pickInterstitialKind();

    (async () => {
      try {
        if (kind === "rewarded-interstitial") {
          const granted = await showRewardedInterstitial();
          if (granted) {
            // Only mark shown + give XP if the ad actually completed
            AdSession.markInterstitialShown();
            if (user) {
              const { data: prof } = await supabase
                .from("profiles").select("xp").eq("id", user.id).maybeSingle();
              await supabase
                .from("profiles").update({ xp: (prof?.xp || 0) + 25 }).eq("id", user.id);
              refreshProfile();
              toast.success("+25 XP Bonus! 🎉");
            }
          }
          // If granted=false (ad failed), timer is NOT reset — it will try again next navigation
        } else {
          const shown = await showInterstitial();
          if (shown) {
            AdSession.markInterstitialShown();
          }
          // If ad failed, timer resets on next navigation attempt
        }
      } catch (e) {
        console.warn("[InterstitialAdHost] Ad error:", e);
      } finally {
        showing.current = false;
      }
    })();
  }, [pathname, user, refreshProfile]);

  return null;
};

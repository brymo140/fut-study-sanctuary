import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isOnline, showRewardedInterstitial } from "@/lib/admob";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

export const useRewardedYouTubeOpener = () => {
  const { user, refreshProfile } = useAuth();

  return async (url: string) => {
    if (!url) return;
    if (!isOnline()) {
      toast.error("You need internet to open YouTube");
      return;
    }

    // iOS PWA — open immediately, no ad (AdMob doesn't run on PWA)
    if (!Capacitor.isNativePlatform()) {
      window.open(url, '_blank', 'noopener,noreferrer');
      if (user) {
        try {
          const { data: prof } = await supabase
            .from("profiles").select("xp").eq("id", user.id).maybeSingle();
          await supabase
            .from("profiles").update({ xp: (prof?.xp || 0) + 5 }).eq("id", user.id);
          refreshProfile();
          toast.success("+5 XP for watching! 🎥");
        } catch {}
      }
      return;
    }

    // Android native — show rewarded interstitial BEFORE opening YouTube
    // so the user actually watches the ad (not in background while YouTube is open).
    // Hard 5-second cap: if no ad fills in time, we stop waiting and continue
    // to YouTube silently rather than leaving the loading spinner stuck.
    toast.loading("Loading ad...", { id: "yt-ad" });

    const adTimeout = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), 5000)
    );

    try {
      const granted = await Promise.race([showRewardedInterstitial(), adTimeout]);
      toast.dismiss("yt-ad");

      // Open YouTube after ad regardless of granted (ad may not fill every time)
      window.open(url, '_system');

      if (user) {
        try {
          const { data: prof } = await supabase
            .from("profiles").select("xp").eq("id", user.id).maybeSingle();
          // +10 XP if they watched the ad, +5 XP if no ad was available
          const xpGain = granted ? 10 : 5;
          await supabase
            .from("profiles").update({ xp: (prof?.xp || 0) + xpGain }).eq("id", user.id);
          refreshProfile();
          toast.success(granted ? "+10 XP for watching! 🎥" : "+5 XP for watching! 🎥");
        } catch {}
      }
    } catch {
      toast.dismiss("yt-ad");
      // If ad throws entirely, still open YouTube
      window.open(url, '_system');
    }
  };
};

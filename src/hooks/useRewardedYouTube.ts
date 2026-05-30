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

    // Show rewarded interstitial — never block YouTube if ad fails
    if (Capacitor.isNativePlatform()) {
      showRewardedInterstitial().catch(() => {});
    }

    // Grant XP
    if (user) {
      try {
        const { data: prof } = await supabase
          .from("profiles").select("xp").eq("id", user.id).maybeSingle();
        await supabase
          .from("profiles").update({ xp: (prof?.xp || 0) + 5 }).eq("id", user.id);
        refreshProfile();
        toast.success("+5 XP for watching!");
      } catch {}
    }

    // Open in YouTube app on Android, browser on web
    if (Capacitor.isNativePlatform()) {
      window.open(url, '_system');
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };
};

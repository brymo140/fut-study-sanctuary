import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isOnline, showRewardedAd } from "@/lib/admob";
import { toast } from "sonner";

export const useRewardedYouTubeOpener = () => {
  const { user, refreshProfile } = useAuth();

  return async (url: string) => {
    if (!url) return;
    if (!isOnline()) {
      toast.error("You need internet to open YouTube");
      return;
    }

    try {
      // Show rewarded ad before opening YouTube
      const granted = await showRewardedAd();
      if (!granted) {
        toast.error("Watch the full ad to continue");
        return;
      }

      // Grant XP for watching
      if (user) {
        try {
          const { data: prof } = await supabase
            .from("profiles")
            .select("xp")
            .eq("id", user.id)
            .maybeSingle();
          await supabase
            .from("profiles")
            .update({ xp: (prof?.xp || 0) + 5 })
            .eq("id", user.id);
          refreshProfile();
          toast.success("+5 XP for watching!");
        } catch (e) {
          console.warn("XP update failed", e);
        }
      }

      window.open(url, "_blank", "noopener,noreferrer");

    } catch (e) {
      console.error("YouTube opener failed", e);
      // Open anyway if ad fails
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };
};

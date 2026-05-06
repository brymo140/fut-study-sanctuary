import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { showRewardedAd, isOnline } from "@/lib/admob";
import { toast } from "sonner";

// Shared rewarded-ad gate for ANY external YouTube link in the app.
// Always route YouTube opens through this hook — never call window.open
// or render <a href="https://youtube..."> directly.
export const useRewardedYouTubeOpener = () => {
  const { user, refreshProfile } = useAuth();
  return async (url: string) => {
    if (!url) return;
    if (!isOnline()) { toast.error("You need internet to open YouTube"); return; }
    try {
      const granted = await showRewardedAd();
      if (!granted) { toast.error("Watch the full ad to continue"); return; }
      if (user) {
        try {
          const { data: prof } = await supabase.from("profiles").select("xp").eq("id", user.id).maybeSingle();
          await supabase.from("profiles").update({ xp: (prof?.xp || 0) + 5 }).eq("id", user.id);
          refreshProfile();
          toast.success("+5 XP · Opening YouTube");
        } catch (e) {
          console.warn("XP update failed", e);
        }
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error("Rewarded ad failed", e);
      toast.error("Couldn't load the ad. Try again.");
    }
  };
};

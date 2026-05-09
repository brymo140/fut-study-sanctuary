import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isOnline } from "@/lib/admob";
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
      // Open YouTube directly without requiring ad for now
      // Ad gate can be re-enabled after AdMob is fully configured
      window.open(url, "_blank", "noopener,noreferrer");

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
        } catch (e) {
          console.warn("XP update failed", e);
        }
      }
    } catch (e) {
      console.error("YouTube opener failed", e);
      toast.error("Could not open YouTube. Try again.");
    }
  };
};

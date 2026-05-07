import { useEffect } from "react";
import { showBanner, hideBanner } from "@/lib/admob";
import { useOnline } from "@/hooks/useOnline";

export const AdMobBannerSlot = () => {
  const online = useOnline();

  useEffect(() => {
    if (!online) {
      hideBanner();
      return;
    }
    showBanner();
  }, [online]);

  if (!online) return null;
  return <div className="surface-card h-[50px]" aria-label="AdMob banner slot" />;
};

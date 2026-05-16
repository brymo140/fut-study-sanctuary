import { useEffect } from "react";
import { showBanner } from "@/lib/admob";
import { useOnline } from "@/hooks/useOnline";

let bannerShowing = false;

export const AdMobBannerSlot = () => {
  const online = useOnline();

  useEffect(() => {
    if (!online || bannerShowing) return;
    bannerShowing = true;
    showBanner();
    return () => {
      bannerShowing = false;
    };
  }, [online]);

  if (!online) return null;
  
  // Spacer so content doesn't hide behind the native banner
  return <div style={{ height: '60px' }} aria-hidden="true" />;
};

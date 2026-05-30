import { ReactNode, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { AITutor } from "./AITutor";
import { InterstitialAdHost } from "./ads/InterstitialAdHost";
import { initAdMob, showBanner, hideBanner, preloadRewardedAd } from "@/lib/admob";
import { AdSession } from "@/lib/adSession";
import { OnboardingGuide } from "./OnboardingGuide";

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    const root = document.documentElement;
    if (Capacitor.isNativePlatform()) {
      root.classList.add("capacitor-native");
    } else {
      root.classList.remove("capacitor-native");
    }
    initAdMob();
    setTimeout(() => preloadRewardedAd(), 3000);
  }, []);

  useEffect(() => {
    const manageBanner = async () => {
      const onAuth = AdSession.isAuthPath(pathname);
      if (onAuth || !navigator.onLine) {
        hideBanner();
      } else {
        await showBanner();
      }
    };
    manageBanner();
  }, [pathname]);

  useEffect(() => {
    const on = () => { if (!AdSession.isAuthPath(window.location.pathname)) showBanner(); };
    const off = () => hideBanner();
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <div className="min-h-screen" style={{ paddingBottom: "calc(90px + var(--sab))" }}>
      <div className={`${isAdmin ? "max-w-5xl mx-auto" : "app-shell"} px-4 pt-4`}>{children}</div>
      {!isAdmin && <AITutor />}
      {!isAdmin && <OnboardingGuide />}
      <BottomNav />
      <InterstitialAdHost />
    </div>
  );
};

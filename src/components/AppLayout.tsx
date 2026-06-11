import { ReactNode, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { AITutor } from "./AITutor";
import { InterstitialAdHost } from "./ads/InterstitialAdHost";
import { initAdMob, showBanner, hideBanner, preloadRewardedAd, preloadRewardedInterstitial } from "@/lib/admob";
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
    setTimeout(() => {
      preloadRewardedAd();
      preloadRewardedInterstitial();
    }, 3000);
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
    const on = () => {
      if (!AdSession.isAuthPath(window.location.pathname)) showBanner();
    };
    const off = () => hideBanner();
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    // FIX: was min-h-screen with fixed paddingBottom — this caused content to be
    // "sandwiched" on tall Android phones (6.5"+ screens) because min-h-screen
    // forced the container taller than the viewport but the bottom padding was
    // still calculated for a smaller screen, clipping content under the nav.
    //
    // Solution: use padding-bottom via CSS var (already defined in index.css as
    // --bottom-chrome = nav-height + banner-height + sab). This correctly accounts
    // for the AdMob banner on Android (capacitor-native adds --banner-height: 50px)
    // and the safe area inset on all devices.
    <div
      className="min-h-screen"
      style={{ paddingBottom: "var(--bottom-chrome)" }}
    >
      <div
        className={`${isAdmin ? "max-w-5xl mx-auto" : "app-shell"} px-4 pt-4`}
      >
        {children}
      </div>
      {!isAdmin && <AITutor />}
      {!isAdmin && <OnboardingGuide />}
      <BottomNav />
      <InterstitialAdHost />
    </div>
  );
};

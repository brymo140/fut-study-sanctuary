import { ReactNode, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { AITutor } from "./AITutor";
import { InterstitialAdHost } from "./ads/InterstitialAdHost";
import { initAdMob, showBanner, hideBanner } from "@/lib/admob";
import { AdSession } from "@/lib/adSession";
import { OnboardingGuide } from "./OnboardingGuide";
import { initAdMob, showBanner, hideBanner, preloadRewardedAd } from "@/lib/admob";

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/admin");

  // Initialize AdMob once, manage banner lifecycle, and react to network changes.
  useEffect(() => { 
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

// Keep banner alive - refresh every 30 seconds
useEffect(() => {
  const interval = setInterval(() => {
    if (!AdSession.isAuthPath(window.location.pathname) && navigator.onLine) {
      showBanner();
    }
  }, 30000);
  return () => clearInterval(interval);
}, []);

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
    // Bottom padding reserves space for the bottom nav + AdMob banner + safe-area inset
    // so content is never hidden behind native chrome.
    <div className="min-h-screen" style={{ paddingBottom: "calc(58px + var(--sab))" }}>
      <div className={`${isAdmin ? "max-w-5xl mx-auto" : "app-shell"} px-4 pt-4`}>{children}</div>
      {!isAdmin && <AITutor />}
      {!isAdmin && <OnboardingGuide />}
      <BottomNav />
      <InterstitialAdHost />
    </div>
  );
};

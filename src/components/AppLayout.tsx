import { ReactNode, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { AITutor } from "./AITutor";
import { InterstitialAdHost } from "./ads/InterstitialAdHost";
import { initAdMob, showBanner, hideBanner } from "@/lib/admob";
import { AdSession } from "@/lib/adSession";

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/admin");

  // Initialize AdMob once, manage banner lifecycle, and react to network changes.
  useEffect(() => { initAdMob(); }, []);

  useEffect(() => {
    const onAuth = AdSession.isAuthPath(pathname);
    if (onAuth || !navigator.onLine) hideBanner();
    else showBanner();
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
    // Extra bottom padding (pb-32) reserves room for the AdMob banner so
    // it never overlaps the bottom nav.
    <div className="min-h-screen pb-32">
      <div className={`${isAdmin ? "max-w-5xl mx-auto" : "app-shell"} px-4 pt-4`}>{children}</div>
      {!isAdmin && <AITutor />}
      <BottomNav />
      <InterstitialAdHost />
    </div>
  );
};

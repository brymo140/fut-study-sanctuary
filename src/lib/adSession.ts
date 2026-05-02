// Ad session manager — decides WHEN to show interstitials and tracks
// rewarded-download cooldowns. Actual ad presentation is delegated to
// src/lib/admob.ts (AdMob SDK on native; no-op on web).

type Listener = () => void;

const REWARDED_DOWNLOAD_COOLDOWN_MS = 5 * 60 * 1000;
const MIN_INTERSTITIAL_INTERVAL_MS = 30 * 60 * 1000;
const MAX_INTERSTITIAL_INTERVAL_MS = 40 * 60 * 1000;

const AUTH_PATH_PREFIXES = ["/welcome", "/signup", "/login", "/forgot-password", "/reset-password"];

class AdSessionManagerImpl {
  lastInterstitialShown = 0;
  lastRewardedDownloadShown = 0;
  nextInterstitialDue: number;
  isOnline: boolean = typeof navigator !== "undefined" ? navigator.onLine : true;
  adsEnabled: boolean = true;

  private listeners = new Set<Listener>();

  constructor() {
    this.nextInterstitialDue = Date.now() + this.randomInterval();
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => { this.isOnline = true; this.emit(); });
      window.addEventListener("offline", () => { this.isOnline = false; this.emit(); });
    }
  }

  private randomInterval() {
    return Math.floor(
      MIN_INTERSTITIAL_INTERVAL_MS +
        Math.random() * (MAX_INTERSTITIAL_INTERVAL_MS - MIN_INTERSTITIAL_INTERVAL_MS)
    );
  }

  subscribe(fn: Listener) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { this.listeners.forEach((l) => l()); }

  setAdsEnabledForPath(pathname: string) {
    const isAuth = AUTH_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
    const next = !isAuth;
    if (next !== this.adsEnabled) { this.adsEnabled = next; this.emit(); }
  }

  isAuthPath(pathname: string) {
    return AUTH_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  }

  canShowAd(): boolean { return this.adsEnabled && this.isOnline; }

  markRewardedDownloadShown() { this.lastRewardedDownloadShown = Date.now(); this.emit(); }

  isInterstitialDue(): boolean {
    if (!this.canShowAd()) return false;
    if (Date.now() < this.nextInterstitialDue) return false;
    if (Date.now() - this.lastRewardedDownloadShown < REWARDED_DOWNLOAD_COOLDOWN_MS) return false;
    return true;
  }

  markInterstitialShown() {
    this.lastInterstitialShown = Date.now();
    this.nextInterstitialDue = Date.now() + this.randomInterval();
    this.emit();
  }

  pickInterstitialKind(): "interstitial" | "rewarded-interstitial" {
    return Math.random() < 0.5 ? "interstitial" : "rewarded-interstitial";
  }
}

export const AdSession = new AdSessionManagerImpl();

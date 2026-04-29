// ADMOB READY — central ad session manager. On native conversion, this same
// service decides when to call AdMob SDK methods. Web build uses placeholders
// + AdSense Auto Ads. All decisions about cooldowns, online state, and
// auth-screen suppression flow through here.

type Listener = () => void;

const REWARDED_DOWNLOAD_COOLDOWN_MS = 5 * 60 * 1000; // 5 min
const MIN_INTERSTITIAL_INTERVAL_MS = 30 * 60 * 1000; // 30 min
const MAX_INTERSTITIAL_INTERVAL_MS = 40 * 60 * 1000; // 40 min

const AUTH_PATH_PREFIXES = ["/welcome", "/signup", "/login", "/forgot-password", "/reset-password"];

class AdSessionManagerImpl {
  lastInterstitialShown = 0;
  lastRewardedDownloadShown = 0;
  nextInterstitialDue: number;
  isOnline: boolean = typeof navigator !== "undefined" ? navigator.onLine : true;
  adsEnabled: boolean = true;

  private listeners = new Set<Listener>();

  constructor() {
    // Reset on every app open (timer NOT persisted by design).
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

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() { this.listeners.forEach((l) => l()); }

  setAdsEnabledForPath(pathname: string) {
    const isAuth = AUTH_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
    const next = !isAuth;
    if (next !== this.adsEnabled) {
      this.adsEnabled = next;
      this.emit();
    }
  }

  /** Should we attempt ANY ad right now? */
  canShowAd(): boolean {
    return this.adsEnabled && this.isOnline;
  }

  /** Rewarded download (chapter unlock). */
  canShowRewardedDownload(): boolean {
    return this.canShowAd();
  }
  markRewardedDownloadShown() {
    this.lastRewardedDownloadShown = Date.now();
    this.emit();
  }

  /** Time-based interstitial gate. */
  isInterstitialDue(): boolean {
    if (!this.canShowAd()) return false;
    if (Date.now() < this.nextInterstitialDue) return false;
    // Don't show interstitial within 5 minutes of a rewarded download ad.
    if (Date.now() - this.lastRewardedDownloadShown < REWARDED_DOWNLOAD_COOLDOWN_MS) return false;
    return true;
  }

  markInterstitialShown() {
    this.lastInterstitialShown = Date.now();
    this.nextInterstitialDue = Date.now() + this.randomInterval();
    this.emit();
  }

  /** 50/50 between interstitial and rewarded interstitial. */
  pickInterstitialKind(): "interstitial" | "rewarded-interstitial" {
    return Math.random() < 0.5 ? "interstitial" : "rewarded-interstitial";
  }
}

export const AdSession = new AdSessionManagerImpl();

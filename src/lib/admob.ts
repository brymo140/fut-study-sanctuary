import {
  AdMob,
  BannerAdSize,
  BannerAdPosition,
  AdMobRewardItem,
} from "@capacitor-community/admob";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export const isOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

export const isNativePlatform = () =>
  typeof Capacitor !== "undefined" && Capacitor.isNativePlatform?.();

// Alias for backward compatibility
const isNative = isNativePlatform;

export const AD_UNITS = {
  banner: "ca-app-pub-4988426041877845/2198116054",
  interstitial: "ca-app-pub-4988426041877845/8852971003",
  rewarded: "ca-app-pub-4988426041877845/6468533553",
  rewardedInterstitial: "ca-app-pub-4988426041877845/8529692908",
  homeBanner1: "ca-app-pub-4988426041877845/1752192257",
  homeBanner2: "ca-app-pub-4988426041877845/5517697355",
  watchBanner: "ca-app-pub-4988426041877845/4259925775",
};

let initialized = false;

export const initAdMob = async () => {
  if (!isOnline() || initialized) return;
  if (!isNative()) { initialized = true; return; }
  try {
    await AdMob.initialize({ testingDevices: [], initializeForTesting: false });
    initialized = true;
  } catch (e) { console.warn("AdMob init failed", e); }
};

// REWARDED — preloaded for instant display
let rewardedAdReady = false;

export const preloadRewardedAd = async () => {
  if (!isNative() || !isOnline()) return;
  await initAdMob();
  try {
    await AdMob.prepareRewardVideoAd({ adId: AD_UNITS.rewarded, isTesting: false });
    rewardedAdReady = true;
  } catch { rewardedAdReady = false; }
};

export const showRewardedAd = async (): Promise<boolean> => {
  if (!isOnline()) return false;
  if (!isNative()) return true;
  await initAdMob();
  try {
    if (!rewardedAdReady) {
      await AdMob.prepareRewardVideoAd({ adId: AD_UNITS.rewarded, isTesting: false });
    }
    rewardedAdReady = false;
    const result = await AdMob.showRewardVideoAd();
    preloadRewardedAd();
    return !!result;
  } catch (e) { console.warn("Rewarded failed", e); return false; }
};

// REWARDED INTERSTITIAL — for YouTube / navigation triggers
// Uses prepareRewardedInterstitialAd (NOT prepareRewardVideoAd — that's for rewarded only)
let rewardedInterstitialReady = false;

export const preloadRewardedInterstitial = async () => {
  if (!isNative() || !isOnline()) return;
  await initAdMob();
  try {
    await AdMob.prepareRewardedInterstitialAd({ adId: AD_UNITS.rewardedInterstitial, isTesting: false });
    rewardedInterstitialReady = true;
  } catch { rewardedInterstitialReady = false; }
};

export const showRewardedInterstitial = async (): Promise<boolean> => {
  if (!isOnline()) return false;
  if (!isNative()) return true;
  await initAdMob();
  try {
    if (!rewardedInterstitialReady) {
      await AdMob.prepareRewardedInterstitialAd({ adId: AD_UNITS.rewardedInterstitial, isTesting: false });
    }
    rewardedInterstitialReady = false;
    const result: AdMobRewardItem = await AdMob.showRewardedInterstitialAd();
    // Preload next one in background
    preloadRewardedInterstitial();
    return !!result;
  } catch (e) { console.warn("Rewarded interstitial failed", e); return false; }
};

// INTERSTITIAL — timer based
export const showInterstitial = async (): Promise<boolean> => {
  if (!isOnline()) return false;
  if (!isNative()) return true;
  await initAdMob();
  try {
    await AdMob.prepareInterstitial({ adId: AD_UNITS.interstitial, isTesting: false });
    await AdMob.showInterstitial();
    return true;
  } catch (e) { console.warn("Interstitial failed", e); return false; }
};

// BANNER — persistent bottom, only Android/iOS native
// Note: AdMob handles banner refresh automatically (every ~60s).
// Do NOT call resumeBanner() on a manual interval — it causes flickering
// and can flag the account. Just show once and let the SDK manage it.
let bannerVisible = false;

export const showBanner = async () => {
  if (!isOnline() || !isNative()) return;
  await initAdMob();
  try {
    await AdMob.showBanner({
      adId: AD_UNITS.banner,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: false,
    });
    bannerVisible = true;
  } catch (e) { console.warn("Banner failed", e); }
};

export const hideBanner = async () => {
  if (!isNative()) return;
  if (!bannerVisible) return;
  try { await AdMob.hideBanner(); } catch {}
  bannerVisible = false;
};

export const showAppOpenAd = async (): Promise<boolean> => false;

// Backward compatibility for admin/settings lookups
export const getAdMobAppId = async (): Promise<string> => {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "admob_app_id")
      .maybeSingle();
    return (data as { value?: string })?.value || "ca-app-pub-4988426041877845";
  } catch {
    return "ca-app-pub-4988426041877845";
  }
};

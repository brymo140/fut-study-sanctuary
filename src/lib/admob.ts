import {
  AdMob,
  BannerAdSize,
  BannerAdPosition,
  type BannerAdOptions,
  type RewardAdOptions,
  type AdOptions,
} from "@capacitor-community/admob";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export const isOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

const isNative = () =>
  typeof Capacitor !== "undefined" && Capacitor.isNativePlatform?.();

// Real production ad unit IDs
export const AD_UNITS = {
  banner: "ca-app-pub-4988426041877845/2198116054",
  interstitial: "ca-app-pub-4988426041877845/8852971003",
  rewarded: "ca-app-pub-4988426041877845/6468533553",
  rewardedInterstitial: "ca-app-pub-4988426041877845/8529692908",
  appOpen: "ca-app-pub-4988426041877845/2640969184",
};

export const getAdMobAppId = async (): Promise<string> => {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "admob_app_id")
      .maybeSingle();
    return (data as any)?.value || "ca-app-pub-4988426041877845";
  } catch {
    return "ca-app-pub-4988426041877845";
  }
};

let initialized = false;

export const initAdMob = async () => {
  if (!isOnline() || initialized) return;
  if (!isNative()) {
    initialized = true;
    return;
  }
  try {
    await AdMob.initialize({
      testingDevices: [],
      initializeForTesting: false,
    });
    initialized = true;
    console.log('[AdMob] Initialized successfully');
  } catch (e) {
    console.warn("AdMob init failed", e);
  }
};

// Preload rewarded ad so it shows instantly when needed
let rewardedAdReady = false;

export const preloadRewardedAd = async () => {
  if (!isNative() || !isOnline()) return;
  await initAdMob();
  try {
    await AdMob.prepareRewardVideoAd({
      adId: AD_UNITS.rewarded,
      isTesting: false,
    });
    rewardedAdReady = true;
    console.log('[AdMob] Rewarded ad preloaded');
  } catch (e) {
    rewardedAdReady = false;
    console.warn('[AdMob] Preload failed:', e);
  }
};

export const showRewardedAd = async (): Promise<boolean> => {
  if (!isOnline()) return false;
  if (!isNative()) return true;
  await initAdMob();
  try {
    // If not preloaded, prepare now
    if (!rewardedAdReady) {
      await AdMob.prepareRewardVideoAd({
        adId: AD_UNITS.rewarded,
        isTesting: false,
      });
    }
    rewardedAdReady = false; // Reset flag
    const result = await AdMob.showRewardVideoAd();
    // Preload next ad immediately after showing
    preloadRewardedAd();
    return !!result;
  } catch (e) {
    console.warn('[AdMob] Rewarded failed:', e);
    return false;
  }
};

// ---------- BANNER ----------
let bannerVisible = false;

export const showBanner = async () => {
  if (!isOnline() || !isNative()) return;
  await initAdMob();
  try {
    const options: BannerAdOptions = {
      adId: AD_UNITS.banner,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: false,
    };
    await AdMob.showBanner(options);
    bannerVisible = true;
  } catch (e) {
    console.warn("AdMob banner failed", e);
  }
};

export const hideBanner = async () => {
  if (!isNative() || !bannerVisible) return;
  try {
    await AdMob.hideBanner();
  } catch {/* ignore */}
  bannerVisible = false;
};

// ---------- REWARDED ----------
export const showRewardedAd = async (): Promise<boolean> => {
  if (!isOnline()) return false;
  if (!isNative()) return true;
  await initAdMob();
  try {
    const options: RewardAdOptions = {
      adId: AD_UNITS.rewarded,
      isTesting: false,
    };
    await AdMob.prepareRewardVideoAd(options);
    const result = await AdMob.showRewardVideoAd();
    return !!result;
  } catch (e) {
    console.warn("AdMob rewarded failed", e);
    return false;
  }
};

// ---------- INTERSTITIAL ----------
export const showInterstitial = async (): Promise<boolean> => {
  if (!isOnline()) return false;
  if (!isNative()) return true;
  await initAdMob();
  try {
    const options: AdOptions = {
      adId: AD_UNITS.interstitial,
      isTesting: false,
    };
    await AdMob.prepareInterstitial(options);
    await AdMob.showInterstitial();
    return true;
  } catch (e) {
    console.warn("AdMob interstitial failed", e);
    return false;
  }
};

// ---------- REWARDED INTERSTITIAL ----------
export const showRewardedInterstitial = async (): Promise<boolean> => {
  if (!isOnline()) return false;
  if (!isNative()) return true;
  await initAdMob();
  try {
    await AdMob.prepareRewardVideoAd({
      adId: AD_UNITS.rewardedInterstitial,
      isTesting: false,
    });
    const result = await AdMob.showRewardVideoAd();
    return !!result;
  } catch (e) {
    console.warn("AdMob rewarded interstitial failed", e);
    return false;
  }
};

// ---------- APP OPEN ----------
export const showAppOpenAd = async (): Promise<boolean> => {
  if (!isOnline()) return false;
  if (!isNative()) return false;
  await initAdMob();
  try {
    await AdMob.prepareRewardVideoAd({
      adId: AD_UNITS.appOpen,
      isTesting: false,
    });
    await AdMob.showRewardVideoAd();
    return true;
  } catch (e) {
    console.warn("App open ad failed", e);
    return false;
  }
};

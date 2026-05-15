// Central AdMob service — works on native (Capacitor) AND gracefully no-ops
// on web (the plugin throws if called outside a Capacitor runtime, so we
// detect that and resolve silently). All ad decisions in the app go through
// here so we have a single source of truth.

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

// PRODUCTION: Replace test ad unit IDs below with real ad unit IDs
// from AdMob dashboard under ca-app-pub-4988426041877845
// before building the production APK.
export const AD_UNITS = {
  banner: "ca-app-pub-3940256099942544/6300978111",
  interstitial: "ca-app-pub-3940256099942544/1033173712",
  rewarded: "ca-app-pub-3940256099942544/5224354917",
  rewardedInterstitial: "ca-app-pub-4988426041877845/8529692908",
  appOpen: "ca-app-pub-4988426041877845/9820769449",
};

// Reads the live AdMob App ID from the app_settings table so admin changes
// propagate without a code release. Falls back to the default publisher ID.
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
    initialized = true; // mark so we don't retry every navigation on web
    return;
  }
  try {
    const appId = await getAdMobAppId();
    console.info("[AdMob] Initializing with app id", appId);
    await AdMob.initialize({
      testingDevices: ["EMULATOR"],
      initializeForTesting: true,
    });
    initialized = true;
  } catch (e) {
    console.warn("AdMob init failed", e);
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
      isTesting: true,
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
  // On the web build (no native AdMob), grant the reward immediately so
  // the in-browser flow keeps working. The real ad runs on native devices.
  if (!isNative()) return true;
  await initAdMob();
  try {
    const options: RewardAdOptions = {
      adId: AD_UNITS.rewarded,
      isTesting: true,
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
      isTesting: true,
    };
    await AdMob.prepareInterstitial(options);
    await AdMob.showInterstitial();
    return true;
  } catch (e) {
    console.warn("AdMob interstitial failed", e);
    return false;
  }
};

// ---------- APP OPEN ----------
export const showAppOpenAd = async (): Promise<boolean> => {
  if (!isOnline()) return false;
  if (!isNative()) return true;
  await initAdMob();
  try {
    await AdMob.prepareRewardVideoAd({
      adId: AD_UNITS.appOpen,
      isTesting: true,
    });
    await AdMob.showRewardVideoAd();
    return true;
  } catch (e) {
    console.warn("App open ad failed", e);
    return false;
  }
};

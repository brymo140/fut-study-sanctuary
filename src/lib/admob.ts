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

export const isOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

const isNative = () =>
  typeof Capacitor !== "undefined" && Capacitor.isNativePlatform?.();

// AdMob App ID — replace with real ID when publishing
// Android: ca-app-pub-4988426041877845~XXXXXXXXXX
// iOS:     ca-app-pub-4988426041877845~XXXXXXXXXX

// Test Ad Unit IDs (Google's official test IDs — safe during development)
export const AD_UNITS = {
  banner: "ca-app-pub-3940256099942544/6300978111",
  interstitial: "ca-app-pub-3940256099942544/1033173712",
  rewarded: "ca-app-pub-3940256099942544/5224354917",
  rewardedInterstitial: "ca-app-pub-3940256099942544/5354046379",
};
// NOTE: Replace the above with real ad unit IDs from ca-app-pub-4988426041877845
// when building the production APK.

let initialized = false;

export const initAdMob = async () => {
  if (!isOnline() || initialized) return;
  if (!isNative()) {
    initialized = true; // mark so we don't retry every navigation on web
    return;
  }
  try {
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

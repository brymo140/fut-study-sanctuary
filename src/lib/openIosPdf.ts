/** iOS / iPadOS detection (includes iPad on desktop UA). */
export const isIOSDevice = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Open a signed PDF URL — native in-app browser on Android APK, new tab on iOS PWA. */
export const openIosPdfUrl = async (signedUrl: string) => {
  const { Capacitor } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({
      url: signedUrl,
      presentationStyle: "popover",
      toolbarColor: "#07080f",
    });
  } else {
    window.open(signedUrl, "_blank", "noopener,noreferrer");
  }
};

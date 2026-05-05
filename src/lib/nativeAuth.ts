import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { lovable } from "@/integrations/lovable";

/**
 * Custom URL scheme used as the OAuth deep-link redirect on native.
 * Must match the intent-filter in android/app/src/main/AndroidManifest.xml.
 */
export const NATIVE_OAUTH_REDIRECT = "com.highvault.futminna://auth/callback";

export const isNative = () => Capacitor.isNativePlatform();

/**
 * Start a Google OAuth sign-in. On web, uses the standard Lovable Cloud
 * managed flow. On native (Capacitor), opens the auth URL in the system
 * browser and relies on the appUrlOpen deep-link handler in App.tsx to
 * complete the session.
 */
export const signInWithGoogleSmart = async (webRedirect: string) => {
  if (!isNative()) {
    return lovable.auth.signInWithOAuth("google", { redirect_uri: webRedirect });
  }

  // Native flow: get the provider URL but DO NOT redirect the webview.
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: NATIVE_OAUTH_REDIRECT,
    // @ts-expect-error – passthrough; managed Lovable shim accepts extras.
    skipBrowserRedirect: true,
  });

  // If the shim still returns a URL, open it in the system browser.
  // @ts-expect-error – url may be present on native shim
  const url: string | undefined = result?.url || result?.data?.url;
  if (url) {
    await Browser.open({ url, presentationStyle: "popover" });
  }
  return result;
};

import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { supabase } from "@/integrations/supabase/client";

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
    // Supabase expects provider in an object; passing positional args can lead
    // to `provider undefined` runtime errors.
    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: webRedirect },
    });
  }

  const result = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: NATIVE_OAUTH_REDIRECT,
      skipBrowserRedirect: true,
    },
  });

  const url: string | undefined = result?.data?.url;
  if (url) {
    await Browser.open({ url, presentationStyle: "popover" });
  }
  return result;
};

import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { supabase } from "@/integrations/supabase/client";

/**
 * Register a deep-link listener so OAuth callbacks (com.highvault.futminna://auth/callback)
 * complete the Supabase session and close the in-app browser. Web is a no-op.
 *
 * Returns a cleanup function.
 */
export const registerNativeAuthDeepLinks = (onSignedIn: () => void) => {
  if (!Capacitor.isNativePlatform()) return () => {};

  const handlePromise = CapApp.addListener("appUrlOpen", async ({ url }) => {
    try {
      if (!url || !url.includes("auth/callback")) return;

      // Extract tokens from either query string or hash fragment.
      const u = new URL(url.replace("#", "?"));
      const access_token = u.searchParams.get("access_token");
      const refresh_token = u.searchParams.get("refresh_token");

      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      }

      try { await Browser.close(); } catch { /* noop */ }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) onSignedIn();
    } catch (e) {
      console.error("[deepLink] auth callback failed", e);
    }
  });

  return () => {
    handlePromise.then((h) => h.remove()).catch(() => {});
  };
};

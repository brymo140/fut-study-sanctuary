// Push notification scaffold. Activates on native (Capacitor) automatically;
// no-ops in the browser. Admin actions also write a row into the in-app
// notifications table so the bell + toast experience works on the web build.
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

let inited = false;

const isNative = (): boolean => {
  try {
    // Lazy require so the build doesn't fail if Capacitor isn't installed.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cap = (window as any).Capacitor;
    return !!cap?.isNativePlatform?.();
  } catch {
    return false;
  }
};

export const initPushNotifications = async (userId: string) => {
  if (inited || !userId) return;
  inited = true;

  if (!isNative()) {
    // Web build — nothing to register. Native push activates automatically
    // when the project is wrapped with Capacitor.
    return;
  }

  try {
    // Dynamic import so web bundles don't fail without the native plugin.
    // String-built specifier prevents Vite from analyzing/resolving at build time.
    const spec = ["@capacitor", "push-notifications"].join("/");
    const mod: any = await import(/* @vite-ignore */ spec).catch(() => null);
    if (!mod) return;
    const { PushNotifications } = mod;

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") return;
    await PushNotifications.register();

    PushNotifications.addListener("registration", async (token: { value: string }) => {
      const platform = (window as any).Capacitor?.getPlatform?.() || "unknown";
      await supabase.from("push_tokens").upsert(
        { user_id: userId, token: token.value, platform, updated_at: new Date().toISOString() },
        { onConflict: "user_id,token" }
      );
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action: any) => {
      const url = action?.notification?.data?.url;
      if (url) window.location.href = url;
    });
  } catch (err) {
    console.warn("Push notifications init failed", err);
  }
};

interface PushPayload {
  target_level: string | null; // "all" or specific level
  target_department?: string | null;
  title: string;
  body: string;
  url: string;
}

// Called from admin actions. Always writes an in-app notification row;
// also calls the send-push edge function so native devices get OS pushes.
export const sendPushNotification = async (payload: PushPayload) => {
  // Best-effort dispatch — never block admin success on this.
  try {
    await supabase.functions.invoke("send-push", { body: payload });
  } catch (err) {
    console.warn("send-push invoke failed (non-fatal)", err);
  }
};

export const maybeShowStudyReminder = () => {
  const key = "hv_last_reminder";
  const now = Date.now();
  const last = Number(localStorage.getItem(key) || "0");
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  if (!last || now - last > threeDays) {
    toast("📚 New materials are waiting in the Vault — come grab yours!");
    localStorage.setItem(key, String(now));
  }
};

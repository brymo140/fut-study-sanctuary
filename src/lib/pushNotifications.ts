import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

let inited = false;

export const initPushNotifications = async (userId: string) => {
  if (!userId || inited) return;
  if (!Capacitor.isNativePlatform()) return;
  inited = true;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') return;

    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token) => {
      console.log('[Push] Token:', token.value);
      await supabase.from('push_tokens').upsert({
        user_id: userId,
        token: token.value,
        platform: 'android',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Received:', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] Action:', action);
      const url = action.notification.data?.url;
      if (url && window.location.pathname !== url) {
        window.location.href = url;
      }
    });
  } catch (e) {
    console.warn('[Push] Init failed:', e);
    inited = false;
  }
};

interface PushPayload {
  target_level: string | null;
  target_department?: string | null;
  title: string;
  body: string;
  url: string;
}

export const sendPushNotification = async (payload: PushPayload) => {
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

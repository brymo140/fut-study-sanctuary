import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const initPushNotifications = async (userId: string) => {
  if (!userId) return;
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Check current permission status first
    const currentPerm = await PushNotifications.checkPermissions();
    console.log('[Push] Current permission:', currentPerm.receive);

    if (currentPerm.receive === 'denied') {
      // Already denied — show in-app message to guide user
      console.log('[Push] Notification permission denied by user');
      return;
    }

    // Request permission (shows dialog if not yet decided)
    const permResult = await PushNotifications.requestPermissions();
    console.log('[Push] Permission result:', permResult.receive);

    if (permResult.receive !== 'granted') {
      console.log('[Push] Permission not granted');
      return;
    }

    // Register for push notifications
    await PushNotifications.register();
    console.log('[Push] Registered');

    // Remove old listeners to avoid duplicates
    await PushNotifications.removeAllListeners();

    PushNotifications.addListener('registration', async (token) => {
      console.log('[Push] Token received:', token.value);
      try {
        const { error } = await supabase.from('push_tokens').upsert({
          user_id: userId,
          token: token.value,
          platform: 'android',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        if (error) {
          console.error('[Push] Token save error:', error);
        } else {
          console.log('[Push] Token saved successfully');
        }
      } catch (e) {
        console.error('[Push] Token save failed:', e);
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] Registration error:', JSON.stringify(err));
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Notification received in foreground:', notification.title);
      // Show in-app toast when notification arrives while app is open
      toast(notification.title || 'New notification', {
        description: notification.body,
      });
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] Notification tapped');
      const url = action.notification.data?.url;
      if (url && window.location.pathname !== url) {
        window.location.href = url;
      }
    });

  } catch (e) {
    console.error('[Push] Init failed:', e);
  }
};

interface PushPayload {
  target_level?: string | null;
  target_department?: string | null;
  title: string;
  body: string;
  url?: string;
  user_ids?: string[];
  send_to_all?: boolean;
}

export const sendPushNotification = async (payload: PushPayload) => {
  try {
    const body: any = {
      title: payload.title,
      body: payload.body,
    };

    if (payload.user_ids?.length) {
      body.user_ids = payload.user_ids;
    } else if (payload.target_level && payload.target_level !== 'all') {
      body.level = payload.target_level;
    } else {
      body.send_to_all = true;
    }

    if (payload.url) body.data = { url: payload.url };

    const { data, error } = await supabase.functions.invoke('send-push', { body });
    if (error) {
      console.error('[Push] send-push error:', error);
    } else {
      console.log('[Push] Sent successfully:', data);
    }
  } catch (err) {
    console.warn('[Push] sendPushNotification failed:', err);
  }
};

export const maybeShowStudyReminder = () => {
  const key = 'hv_last_reminder';
  const now = Date.now();
  const last = Number(localStorage.getItem(key) || '0');
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  if (!last || now - last > threeDays) {
    toast('📚 New materials are waiting in the Vault — come grab yours!');
    localStorage.setItem(key, String(now));
  }
};

export const scheduleStreakReminder = async (userId: string, lastActive: string) => {
  const last = new Date(lastActive);
  const now = new Date();
  const days = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

  if (days >= 2 && days < 3) {
    await sendPushNotification({
      title: '🐝 Your reading streak is at risk!',
      body: "You haven't visited HighVault in 2 days. Come back to keep your streak alive!",
      user_ids: [userId],
    });
  }
};

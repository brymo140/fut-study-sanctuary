import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const initPushNotifications = async (userId: string) => {
  if (!userId) return;
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const currentPerm = await PushNotifications.checkPermissions();
    console.log('[Push] Current permission:', currentPerm.receive);

    if (currentPerm.receive === 'denied') {
      console.log('[Push] Permission denied by user — skipping');
      return;
    }

    const permResult = await PushNotifications.requestPermissions();
    console.log('[Push] Permission result:', permResult.receive);

    if (permResult.receive !== 'granted') {
      console.log('[Push] Permission not granted');
      return;
    }

    // Remove old listeners first to avoid duplicate registrations
    await PushNotifications.removeAllListeners();

    // Register — token arrives in the 'registration' listener below
    await PushNotifications.register();
    console.log('[Push] Registered with FCM');

    PushNotifications.addListener('registration', async (token) => {
      console.log('[Push] FCM token received:', token.value.slice(0, 30) + '...');
      try {
        // IMPORTANT: onConflict must be 'user_id' — the table now has UNIQUE(user_id)
        // (not the old composite UNIQUE(user_id, token) which broke this upsert)
        const { error } = await supabase.from('push_tokens').upsert(
          {
            user_id: userId,
            token: token.value,           // column is "token" not "fcm_token"
            platform: Capacitor.getPlatform(), // 'android' or 'ios'
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }        // one row per user, always latest token
        );

        if (error) {
          console.error('[Push] Token upsert error:', error.message, error.code);
        } else {
          console.log('[Push] Token saved to Supabase ✓');
        }
      } catch (e) {
        console.error('[Push] Token save exception:', e);
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] Registration error:', JSON.stringify(err));
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Foreground notification:', notification.title);
      toast(notification.title || 'HighVault 📚', {
        description: notification.body,
      });
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] Notification tapped');
      // Always navigate to the notifications sheet first so the user can
      // read the full announcement before taking any action.
      // The sheet already shows attachments, link buttons, and body text.
      if (window.location.pathname !== '/notifications') {
        window.location.href = '/notifications';
      }
    });

  } catch (e) {
    console.error('[Push] initPushNotifications failed:', e);
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
    const body: Record<string, unknown> = {
      title: payload.title,
      body: payload.body,
    };

    if (payload.user_ids?.length) {
      body.user_ids = payload.user_ids;
    } else if (payload.target_level && payload.target_level !== 'all') {
      body.target_level = payload.target_level;
      if (payload.target_department) {
        body.target_department = payload.target_department;
      }
    } else {
      body.send_to_all = true;
    }

    if (payload.url) body.url = payload.url;

    const { data, error } = await supabase.functions.invoke('send-push', { body });
    if (error) {
      console.error('[Push] send-push invoke error:', error);
    } else {
      console.log('[Push] send-push response:', data);
    }
  } catch (err) {
    console.warn('[Push] sendPushNotification exception:', err);
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

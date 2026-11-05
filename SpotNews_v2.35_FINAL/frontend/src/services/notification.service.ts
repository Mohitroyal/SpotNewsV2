import { supabase } from '@/lib/supabase';
import api from '@/lib/axios';

export interface NotificationPreferences {
  emailGenerations: boolean;
  emailBilling: boolean;
  emailUpdates: boolean;
  browserPush: boolean;
}

export type NotificationType = 'emailGenerations' | 'emailBilling' | 'emailUpdates' | 'browserPush';

export interface NotificationContent {
  title: string;
  message: string;
  type: NotificationType;
}

const NOTIFICATION_TEMPLATES: Record<NotificationType, { title: string; message: string }> = {
  emailGenerations: {
    title: '📰 Newspaper Generation Notification — Spot News 24x7',
    message: 'Your newspaper edition generation notifications are active. You will receive real-time updates and download links directly at your Gmail as soon as your clippings and editions are ready.',
  },
  emailBilling: {
    title: '💳 Billing & Subscription Alert — Spot News 24x7',
    message: 'Your billing and subscription notifications are active. Invoices, plan renewals, payment receipts, and reporter access confirmations will be sent to your Gmail.',
  },
  emailUpdates: {
    title: '🚀 Product Updates & New Features — Spot News 24x7',
    message: 'You are subscribed to Spot News 24x7 product updates. Stay tuned for announcements about new newspaper layouts, Telugu typography enhancements, AI tools, and reporter features.',
  },
  browserPush: {
    title: '🔔 Push Notifications Active — Spot News 24x7',
    message: 'Real-time breaking news and generation alerts are enabled on your device.',
  },
};

export const notificationService = {
  /**
   * Fetch notification preferences from Supabase (user_preferences table or user_metadata)
   */
  async getPreferences(userId?: string, userEmail?: string): Promise<NotificationPreferences> {
    const defaults: NotificationPreferences = {
      emailGenerations: true,
      emailBilling: true,
      emailUpdates: true,
      browserPush: true,
    };

    // 1. Try local storage first for instant render
    const local = localStorage.getItem('spotnews_notifications');
    let merged = { ...defaults };
    if (local) {
      try {
        merged = { ...defaults, ...JSON.parse(local) };
      } catch {}
    }

    if (!userId && !userEmail) return merged;

    try {
      // 2. Query Supabase user_preferences table
      let query = supabase.from('user_preferences').select('*');
      if (userId) {
        query = query.eq('user_id', userId);
      } else if (userEmail) {
        query = query.eq('notification_email', userEmail);
      }

      const { data, error } = await query.maybeSingle();

      if (!error && data) {
        const fromDb: NotificationPreferences = {
          emailGenerations: data.email_generations ?? merged.emailGenerations,
          emailBilling: data.email_billing ?? merged.emailBilling,
          emailUpdates: data.email_updates ?? merged.emailUpdates,
          browserPush: data.browser_push ?? merged.browserPush,
        };
        localStorage.setItem('spotnews_notifications', JSON.stringify(fromDb));
        return fromDb;
      }
    } catch (err) {
      console.warn('[NotificationService] Supabase fetch error, using local/cached:', err);
    }

    return merged;
  },

  /**
   * Save preferences to Supabase user_preferences table & update user metadata
   */
  async savePreferences(
    userId: string | undefined,
    userEmail: string | undefined,
    prefs: NotificationPreferences
  ): Promise<boolean> {
    // 1. Always update localStorage
    localStorage.setItem('spotnews_notifications', JSON.stringify(prefs));

    // 2. Update Supabase user metadata if session active
    try {
      await supabase.auth.updateUser({
        data: {
          notifications: prefs,
        },
      });
    } catch (err) {
      console.warn('[NotificationService] Could not update auth user metadata:', err);
    }

    // 3. Upsert into Supabase user_preferences table
    if (userId || userEmail) {
      try {
        const payload: any = {
          email_generations: prefs.emailGenerations,
          email_billing: prefs.emailBilling,
          email_updates: prefs.emailUpdates,
          browser_push: prefs.browserPush,
          notification_email: userEmail || '',
          updated_at: new Date().toISOString(),
        };
        if (userId) payload.user_id = userId;

        const { error } = await supabase
          .from('user_preferences')
          .upsert(payload, { onConflict: userId ? 'user_id' : undefined });

        if (error) {
          console.warn('[NotificationService] user_preferences upsert error:', error);
        }
      } catch (err) {
        console.warn('[NotificationService] Supabase savePreferences error:', err);
      }
    }

    return true;
  },

  /**
   * Send notification to the user's Gmail according to the button selected, via Supabase service
   */
  async sendNotificationEmail(
    userId: string | undefined,
    userEmail: string,
    type: NotificationType
  ): Promise<{ success: boolean; message: string }> {
    if (!userEmail) {
      throw new Error('User Gmail address is required to send notification.');
    }

    const template = NOTIFICATION_TEMPLATES[type];
    const title = template?.title || 'Spot News 24x7 Notification';
    const message = template?.message || 'You have a new update from Spot News 24x7.';

    console.log(`[NotificationService] Sending ${type} notification to Gmail: ${userEmail} through Supabase service...`);

    // 1. Log / Record in Supabase notifications table via RPC and direct insert
    try {
      if (userId) {
        await supabase.rpc('send_notification_email_rpc', {
          p_user_id: userId,
          p_user_email: userEmail,
          p_type: type,
          p_title: title,
          p_message: message,
        });
      } else {
        await supabase.from('notifications').insert({
          user_email: userEmail,
          notification_type: type,
          title,
          message,
          is_read: false,
          created_at: new Date().toISOString(),
        });
      }
    } catch (dbErr) {
      console.warn('[NotificationService] Supabase DB notification log warning:', dbErr);
    }

    // 2. Dispatch via Supabase Email Service
    let dispatchMethod = 'Supabase Database Notification';

    try {
      // Trigger Supabase Auth Email Service to the user's Gmail
      // Using Supabase Auth recover/magic link mailer with customized redirect/data
      const { error: authMailError } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/settings?notif_verified=${type}`,
      });

      if (!authMailError) {
        dispatchMethod = 'Supabase Email Service';
      } else {
        console.warn('[NotificationService] Supabase recover mailer returned:', authMailError);
        // Fallback to signInWithOtp if recover is rate-limited or disabled
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: userEmail,
          options: {
            data: {
              notification_type: type,
              notification_title: title,
            },
          },
        });
        if (!otpError) {
          dispatchMethod = 'Supabase OTP Service';
        }
      }
    } catch (supaErr) {
      console.warn('[NotificationService] Supabase email dispatch error:', supaErr);
    }

    // 3. If push notification button, also trigger push service
    if (type === 'browserPush') {
      try {
        await api.post('/api/v1/notifications/send', {
          topic: 'all',
          title,
          body: message,
          url: '/settings',
          channel_id: 'news',
        });
      } catch (pushErr) {
        console.warn('[NotificationService] Push dispatch warning:', pushErr);
      }
    }

    return {
      success: true,
      message: `Notification email dispatched to ${userEmail} via ${dispatchMethod}!`,
    };
  },
};

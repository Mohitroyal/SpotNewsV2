// Push notifications for Spot News V2 (Capacitor + Firebase Cloud Messaging)
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { FCM } from "@capacitor-community/fcm";
import { supabase } from "@/lib/supabase";

let currentDistrict: number | null = null;
let currentDistrictTopic: string | null = null;

/** FCM topic for a district name, e.g. 'Sri Potti Sriramulu Nellore' → 'dist_sri_potti_sriramulu_nellore'. Same rule as the server. */
export function districtTopic(name?: string | null): string | null {
  const slug = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return slug && slug !== 'all' ? `dist_${slug}` : null;
}
let isInitialized = false;

// The TEST app is built without Firebase, so push is switched off there
const PUSH_DISABLED = import.meta.env.VITE_DISABLE_PUSH === 'true';

export async function isPushSupported(): Promise<boolean> {
  return !PUSH_DISABLED && Capacitor.isNativePlatform();
}

export async function checkPushPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const perm = await PushNotifications.checkPermissions();
    return perm.receive === "granted";
  } catch (err) {
    console.warn("checkPushPermission error:", err);
    return false;
  }
}

export async function requestPushPermission(): Promise<boolean> {
  if (PUSH_DISABLED || !Capacitor.isNativePlatform()) return false;
  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    return perm.receive === "granted";
  } catch (err) {
    console.warn("requestPushPermission error:", err);
    return false;
  }
}

export async function initPush(opts: {
  userId?: string;
  districtId?: number;
  districtName?: string | null;
  navigate?: (path: string) => void;
}): Promise<boolean> {
  if (PUSH_DISABLED || !Capacitor.isNativePlatform()) {
    console.log("[Push] Non-native environment, skipping push initialization.");
    return false;
  }

  try {
    // 1. Check and request permission (Android 13+ POST_NOTIFICATIONS)
    const granted = await requestPushPermission();
    if (!granted) {
      console.log("[Push] Notification permission not granted.");
      return false;
    }

    // 2. Setup notification channels
    await PushNotifications.createChannel({
      id: "news",
      name: "బ్రేకింగ్ వార్తలు (Breaking News)",
      importance: 4,
      sound: "default",
      vibration: true,
      visibility: 1,
    }).catch(() => {});

    await PushNotifications.createChannel({
      id: "weather",
      name: "వాతావరణ హెచ్చరికలు (Weather Alerts)",
      importance: 5,
      sound: "default",
      vibration: true,
      visibility: 1,
    }).catch(() => {});

    await PushNotifications.createChannel({
      id: "reporter",
      name: "రిపోర్టర్ అప్‌డేట్స్ (Reporter Updates)",
      importance: 4,
      sound: "default",
      vibration: true,
      visibility: 1,
    }).catch(() => {});

    await PushNotifications.createChannel({
      id: "general",
      name: "సాధారణ సమాచారం (General Announcements)",
      importance: 3,
      sound: "default",
    }).catch(() => {});

    // 3. Register native push listener
    await PushNotifications.register().catch((err) => {
      console.warn("[Push] PushNotifications.register failed:", err);
    });

    // 4. Retrieve FCM token and save to Supabase
    let token: string | null = null;
    try {
      const fcmResult = await FCM.getToken();
      token = fcmResult.token;
      if (token) {
        console.log("[Push] FCM token obtained successfully:", token.substring(0, 15) + "...");
        await saveTokenToDatabase(token, opts.userId, opts.districtId);
      }
    } catch (e) {
      console.warn("[Push] FCM.getToken error:", e);
    }

    // 5. Topics: subscribe to both 'readers' and 'all' to ensure notifications always deliver
    await FCM.subscribeTo({ topic: "readers" }).catch((e) => console.warn("[Push] Subscribe 'readers' failed:", e));
    await FCM.subscribeTo({ topic: "all" }).catch((e) => console.warn("[Push] Subscribe 'all' failed:", e));
    await FCM.unsubscribeFrom({ topic: "district_1" }).catch(() => {});
    await setPushDistrictName(opts.districtName).catch(() => {});

    // 6. Register listeners once
    if (!isInitialized) {
      // Tap on notification
      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        console.log("[Push] Notification tapped:", action);
        const data = action.notification.data as Record<string, any> | undefined;
        const targetUrl = data?.url || data?.link || data?.path;
        if (targetUrl && opts.navigate) {
          opts.navigate(targetUrl);
        }
      });

      // Received notification while app in foreground
      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("[Push] Notification received in foreground:", notification);
        window.dispatchEvent(
          new CustomEvent("spotnews-push", { detail: notification })
        );
      });

      isInitialized = true;
    }

    return true;
  } catch (err) {
    console.warn("[Push] initPush encountered an error:", err);
    return false;
  }
}

export async function saveTokenToDatabase(
  token: string,
  userId?: string,
  districtId?: number
): Promise<void> {
  try {
    const payload: Record<string, any> = {
      token,
      platform: "android",
      updated_at: new Date().toISOString(),
    };
    if (userId) payload.user_id = userId;
    if (districtId) payload.district_id = districtId;

    const { error } = await supabase.from("device_tokens").upsert(payload, {
      onConflict: "token",
    });

    if (error) {
      console.warn("[Push] Failed to upsert device_tokens to Supabase:", error.message);
    } else {
      console.log("[Push] Device token registered with Supabase.");
    }
  } catch (err) {
    console.warn("[Push] saveTokenToDatabase exception:", err);
  }
}

export async function setPushDistrict(districtId: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (currentDistrict && currentDistrict !== districtId) {
      await FCM.unsubscribeFrom({ topic: `district_${currentDistrict}` }).catch(() => {});
    }
    await FCM.subscribeTo({ topic: `district_${districtId}` }).catch(() => {});
    currentDistrict = districtId;

    const { token } = await FCM.getToken();
    if (token) {
      await supabase
        .from("device_tokens")
        .update({ district_id: districtId, updated_at: new Date().toISOString() })
        .eq("token", token);
    }
  } catch (e) {
    console.warn("[Push] setPushDistrict error:", e);
  }
}

export async function disablePush(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { token } = await FCM.getToken();
    if (token) {
      try {
        await supabase.from("device_tokens").delete().eq("token", token);
      } catch (err) {
        console.warn("[Push] Error removing device token:", err);
      }
    }
    await FCM.unsubscribeFrom({ topic: "all" }).catch(() => {});
    await FCM.unsubscribeFrom({ topic: "readers" }).catch(() => {});
    if (currentDistrictTopic) await FCM.unsubscribeFrom({ topic: currentDistrictTopic }).catch(() => {});
    if (currentDistrict) {
      await FCM.unsubscribeFrom({ topic: `district_${currentDistrict}` }).catch(() => {});
    }
    const { cancelMomentAlerts } = await import("./localMoments");
    await cancelMomentAlerts();
    console.log("[Push] Push notifications disabled and unsubscribed.");
  } catch (e) {
    console.warn("[Push] disablePush error:", e);
  }
}

/** Follow the reader's district: news and ads of that district arrive as push notifications. */
export async function setPushDistrictName(name?: string | null): Promise<void> {
  if (PUSH_DISABLED || !Capacitor.isNativePlatform()) return;
  const topic = districtTopic(name);
  if (topic === currentDistrictTopic) return;
  try {
    if (currentDistrictTopic) await FCM.unsubscribeFrom({ topic: currentDistrictTopic }).catch(() => {});
    // No district chosen ("All districts"): only statewide news via 'readers'
    if (topic) await FCM.subscribeTo({ topic }).catch(() => {});
    currentDistrictTopic = topic;
  } catch (e) {
    console.warn("[Push] setPushDistrictName error:", e);
  }
}

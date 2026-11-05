// Phone notifications for the hourly posts (sunrise thought, healthy drink, youth focus, sleep…).
// They are made on the phone, so no server or internet is needed and every district gets them.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { DISTRICTS, findDistrict, istDate } from '@/features/daily/dailyContentEngine';
import { buildMoments, TOPIC_LABEL, type Topic } from '@/features/moments/momentsEngine';
import { getLiveMood } from '@/features/moments/sky';

const ID_BASE = 71000;          // our notification ids: 71000 – 71099
const MAX = 40;
let listening = false;

export function hourlyAlertsEnabled(): boolean {
  try {
    const raw = localStorage.getItem('spotnews_notifications');
    if (!raw) return true;
    const p = JSON.parse(raw);
    return p.browserPush !== false && p.hourlyPosts !== false;
  } catch { return true; }
}

export async function cancelMomentAlerts(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const ids = Array.from({ length: 100 }, (_, i) => ({ id: ID_BASE + i }));
    await LocalNotifications.cancel({ notifications: ids });
  } catch { /* nothing scheduled */ }
}

/** Schedule the next ~24 h of hourly posts for this district. Safe to call often (replaces the old schedule). */
export async function scheduleMomentAlerts(district?: string | null, state?: string | null, navigate?: (p: string) => void): Promise<void> {
  if (!Capacitor.isNativePlatform() || !hourlyAlertsEnabled()) return;
  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return;

    await LocalNotifications.createChannel({
      id: 'hourly', name: 'గంట గంటకూ మంచి మాట (Hourly posts)', importance: 3, sound: 'default', visibility: 1,
    }).catch(() => {});

    if (!listening && navigate) {
      listening = true;
      LocalNotifications.addListener('localNotificationActionPerformed', (a: any) => {
        const url = (a.notification.extra as any)?.url;
        if (url) navigate(url);
      });
    }

    const info = findDistrict(district)
      || DISTRICTS.find((d) => d.en === (String(state || '').toLowerCase().includes('andhra') ? 'NTR' : 'Hyderabad'))!;
    const now = Date.now();
    const today = istDate();
    const tomorrow = istDate(new Date(now + 86400000));
    const mood = getLiveMood();
    const upcoming = [...buildMoments({ district: info, date: today, mood }), ...buildMoments({ district: info, date: tomorrow, mood })]
      .filter((m) => new Date(m.publish_at).getTime() > now + 60000)
      .slice(0, MAX);

    await cancelMomentAlerts();
    if (!upcoming.length) return;
    await LocalNotifications.schedule({
      notifications: upcoming.map((m, i) => {
        const topic = (m.meta as any).topic as Topic;
        const [te] = TOPIC_LABEL[topic];
        const first = m.title_te.split('\n')[0];
        return {
          id: ID_BASE + i,
          channelId: 'hourly',
          title: `${m.emoji} ${te} · ${info.te}`,
          body: m.body_te ? `${first} — ${m.body_te.split('\n')[0]}` : first,
          largeBody: [m.title_te, m.body_te].filter(Boolean).join('\n'),
          schedule: { at: new Date(m.publish_at), allowWhileIdle: false },
          extra: { url: '/feed?cat=quote' },
        };
      }),
    });
  } catch (e) {
    console.warn('[Moments] schedule failed', e);
  }
}

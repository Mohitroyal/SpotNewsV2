// Ask the server to send a push for something that just went live.
// The server reads the item itself and pushes it only once, so calling twice is harmless.
const API = (import.meta.env.VITE_API_URL || 'https://spotnewsv2-ew09.onrender.com').replace(/\/+$/, '');

export function notifyLive(kind: 'clip' | 'ad', id?: string | number | null): void {
  if (!id || String(id).startsWith('local_')) return;
  fetch(`${API}/v1/notify/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: String(id) }),
  }).catch(() => { /* push is a bonus; never block the user */ });
}

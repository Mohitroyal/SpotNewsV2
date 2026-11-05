// Short share links: a clipping id (UUID, 36 chars) becomes 22 letters/numbers.
// e.g. 63ff0648-7853-42d8-9fb9-c312218caa82  →  3CwYqWlVd8ZQ0x5bJ3sHke
// The same code exists in share-landing/api/n.js and lib/deepLinks.ts.
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function shortenId(id: string): string {
  if (!UUID_RE.test(id)) return id;
  let n = BigInt('0x' + id.replace(/-/g, ''));
  let out = '';
  while (n > 0n) { out = ALPHABET[Number(n % 62n)] + out; n /= 62n; }
  return out.padStart(22, '0');
}

export function expandId(code: string): string {
  if (UUID_RE.test(code) || !/^[0-9A-Za-z]{22}$/.test(code)) return code;
  let n = 0n;
  for (const ch of code) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return code;
    n = n * 62n + BigInt(v);
  }
  const hex = n.toString(16).padStart(32, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

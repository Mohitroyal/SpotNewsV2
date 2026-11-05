// Reader language (Telugu first or English first). Both are always shown; this only decides which is bigger.
import { useEffect, useState } from 'react';

export type Lang = 'te' | 'en';
const KEY = 'spotnews_selected_lang';
const EVT = 'spotnews-lang';

export function getLang(): Lang {
  try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'te'; } catch { return 'te'; }
}

export function setLang(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT));
}

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, set] = useState<Lang>(getLang);
  useEffect(() => {
    const on = () => set(getLang());
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  return [lang, setLang];
}

/** Pick the main and the small line for a Telugu / English pair. */
export function pair(lang: Lang, te: string, en: string): [string, string] {
  return lang === 'en' ? [en, te] : [te, en];
}

/**
 * Word-limit helpers for news content.
 *
 * Rule: a news clipping's article text is limited to 100 words.
 * Works for Telugu and English (words are separated by whitespace).
 */

export const MAX_ARTICLE_WORDS = 100;
export const MAX_HEADLINE_WORDS = 10;

/** Count words (any run of non-space characters). */
export function countWords(text: string): number {
  const t = (text || '').trim();
  if (!t) return 0;
  return t.split(/\s+/u).length;
}

/**
 * Keep only the first `max` words while preserving the reporter's own
 * line breaks and spacing between those words.
 */
export function limitWords(text: string, max: number = MAX_ARTICLE_WORDS): string {
  if (!text) return '';
  if (countWords(text) <= max) return text;

  const re = /\S+/gu;
  let match: RegExpExecArray | null;
  let n = 0;
  let end = 0;
  while ((match = re.exec(text)) !== null) {
    n += 1;
    end = match.index + match[0].length;
    if (n === max) break;
  }
  return text.slice(0, end);
}

/** For display of older clippings that were saved before the limit existed. */
export function limitWordsForDisplay(text: string, max: number = MAX_ARTICLE_WORDS): string {
  if (!text) return '';
  if (countWords(text) <= max) return text;
  return `${limitWords(text, max).replace(/[\s,;:–-]+$/u, '')}…`;
}

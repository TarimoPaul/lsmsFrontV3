/**
 * (bv) 02/11 — same rule as the server's ReasonQuality: a reason made of one repeated character ("6666666666",
 * "rrrrrrrrrr") or of fewer than {@link REASON_MIN_DISTINCT} different letters/digits is refused. Spaces and
 * punctuation do not count; upper/lower case is the same letter. Empty is not "junk" — the length rule covers it.
 */
export const REASON_MIN_DISTINCT = 4;

export function distinctChars(s: string | null | undefined): number {
  if (!s) return 0;
  return new Set(Array.from(s.toLowerCase()).filter((c) => /[\p{L}\p{N}]/u.test(c))).size;
}

export function isJunkReason(s: string | null | undefined): boolean {
  return !!s && s.trim().length > 0 && distinctChars(s) < REASON_MIN_DISTINCT;
}

export const JUNK_HINT = {
  en: `Write a real reason — not one repeated letter (at least ${REASON_MIN_DISTINCT} different letters).`,
  sw: `Andika sababu halisi — si herufi moja inayojirudia (angalau herufi ${REASON_MIN_DISTINCT} tofauti).`,
};

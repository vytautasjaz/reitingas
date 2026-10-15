/**
 * Club matching rules for TRItonas rating inclusion.
 *
 * - Pure / containing "tritonas" (any case) qualifies for consideration.
 * - Mixed clubs like "Lietuvos kariuomenė / TRItonas" only count if the athlete
 *   is already on the members list (handled by caller).
 */

export function clubMentionsTritonas(club: string | null | undefined): boolean {
  if (!club) return false;
  return /tritonas/i.test(club);
}

/**
 * "Pure" Tritonas club: the club string is essentially just Tritonas
 * (optional whitespace / punctuation), not a dual affiliation.
 */
export function isPureTritonasClub(club: string | null | undefined): boolean {
  if (!club) return false;
  const cleaned = club
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/^[\s/|-]+|[\s/|-]+$/g, "");
  return /^tritonas$/i.test(cleaned);
}

/**
 * Dual / mixed affiliation that mentions Tritonas plus something else.
 */
export function isMixedTritonasClub(club: string | null | undefined): boolean {
  return clubMentionsTritonas(club) && !isPureTritonasClub(club);
}

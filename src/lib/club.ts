/**
 * Club matching helpers for TRItonas protocol rows.
 *
 * Import also matches athletes by official roster name even when the club
 * field does not mention Tritonas (see import-race fillRaceResults).
 *
 * - Pure / containing "tritonas" still pulls the row into history.
 * - Mixed clubs without a roster match are skipped for rating.
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

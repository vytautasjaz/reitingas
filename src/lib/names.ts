/**
 * Normalize athlete names for matching across result formats:
 * "JABLONSKIS Mantas" ↔ "Mantas Jablonskis" ↔ "Mantas JABLONSKIS"
 */

const DIACRITICS: Record<string, string> = {
  ą: "a",
  č: "c",
  ę: "e",
  ė: "e",
  į: "i",
  š: "s",
  ų: "u",
  ū: "u",
  ž: "z",
  À: "A",
  Á: "A",
  Â: "A",
  Ã: "A",
  Ä: "A",
  Å: "A",
  à: "a",
  á: "a",
  â: "a",
  ã: "a",
  ä: "a",
  å: "a",
};

export function stripDiacritics(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ąčęėįšųūž]/gi, (ch) => DIACRITICS[ch.toLowerCase()] ?? ch);
}

export function tokenizeName(raw: string): string[] {
  return stripDiacritics(raw)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Canonical key: sorted tokens joined, so order of first/last name does not matter. */
export function normalizeName(raw: string): string {
  return tokenizeName(raw).sort().join(" ");
}

/**
 * Prefer "Vardas Pavardė" display form when input looks like "PAVARDĖ Vardas".
 */
export function toDisplayName(raw: string): string {
  const cleaned = raw.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return cleaned;

  const parts = cleaned.split(" ");
  if (parts.length < 2) return cleaned;

  const [first, ...rest] = parts;
  const restJoined = rest.join(" ");

  // SURNAME Firstname → Firstname Surname
  if (first === first.toUpperCase() && restJoined !== restJoined.toUpperCase()) {
    const surname = titleCase(first);
    const given = rest.map(titleCase).join(" ");
    return `${given} ${surname}`;
  }

  return parts.map(titleCase).join(" ");
}

function titleCase(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function namesMatch(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
}

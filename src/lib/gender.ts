export type Sex = "M" | "F";

/** How age-group codes map to sex. */
export type CategoryConvention = "lt" | "intl";

/**
 * Detect whether Cat codes are Lithuanian (V30=vyrai, M30=moterys)
 * or international (M30=men, F30=women).
 */
export function detectCategoryConvention(
  categories: Array<string | null | undefined>
): CategoryConvention {
  let hasV = false;
  let hasF = false;
  let hasM = false;
  for (const raw of categories) {
    const cat = (raw ?? "").trim().toUpperCase();
    if (!cat) continue;
    if (/^V\d/.test(cat)) hasV = true;
    if (/^F\d/.test(cat) || /^W\d/.test(cat)) hasF = true;
    if (/^M\d/.test(cat)) hasM = true;
  }
  // Lithuanian LTT protocols use Vxx for men (and often Mxx for women).
  if (hasV) return "lt";
  // International / Ironman-style: Mxx = men, Fxx = women.
  if (hasF || hasM) return "intl";
  return "lt";
}

/**
 * Normalize protocol sex / category into M (vyrai) or F (moterys).
 * Prefers explicit Sx column; falls back to category codes.
 *
 * Important: bare M30 is ambiguous (LT moterys vs intl men) — pass convention
 * from the whole protocol, otherwise return null for Mxx.
 */
export function normalizeSex(
  sexRaw?: string | null,
  categoryRaw?: string | null,
  convention: CategoryConvention = "lt"
): Sex | null {
  const sex = (sexRaw ?? "").trim().toLowerCase();
  if (sex) {
    if (
      /^(m|male|man|v|vyras|vyrai|м)$/i.test(sex) ||
      sex === "male" ||
      sex.startsWith("vyr")
    ) {
      return "M";
    }
    if (
      /^(f|female|w|woman|moteris|moterys|k)$/i.test(sex) ||
      sex === "female" ||
      sex.startsWith("mot")
    ) {
      return "F";
    }
  }

  const cat = (categoryRaw ?? "").trim().toUpperCase();
  if (!cat) return null;

  if (/^F\d/.test(cat) || /^W\d/.test(cat) || cat.startsWith("MOT")) return "F";
  if (/^V\d/.test(cat) || cat.startsWith("VYR")) return "M";

  if (/^M\d/.test(cat)) {
    // LT: M30 = moterys; intl: M30 = men
    if (convention === "lt") return "F";
    if (convention === "intl") return "M";
  }

  return null;
}

/** Soft fallback from Lithuanian surname endings when protocol has no sex. */
export function inferSexFromName(displayName: string): Sex | null {
  const parts = displayName.trim().split(/\s+/);
  const surname = parts[parts.length - 1] ?? "";
  const first = parts[0] ?? "";

  if (/(ienė|aitė|ytė|utė|ūtė|iené|ute)$/i.test(surname)) return "F";
  if (/(auskas|avičius|evičius|aitis|ūnas|unas|skis|ckas)$/i.test(surname)) {
    return "M";
  }
  // Common male first names (when surname is ambiguous, e.g. foreign)
  if (
    /^(Mantas|Airidas|Arvydas|Arūnas|Darius|Lukas|Vaidas|Vytautas|Saulius|Raimondas|Tomas|Jonas|Povilas|Donatas|Martynas|Gediminas|Antanas|Evaldas|Juozas|Modestas|Rytis|Giedrius|Mikael|Radoslav)$/i.test(
      first
    )
  ) {
    return "M";
  }
  if (
    /^(Aistė|Austėja|Eglė|Gabrielė|Greta|Ieva|Indrė|Inga|Ingrida|Jurgita|Justė|Jūratė|Lina|Liudmila|Monika|Sigita|Jūratė)$/i.test(
      first
    )
  ) {
    return "F";
  }
  if (/(as|is|us|ys)$/i.test(surname) && !/(ienė|aitė|ytė)$/i.test(surname)) {
    return "M";
  }
  return null;
}

export function sexLabel(sex: Sex | null | undefined): string {
  if (sex === "M") return "V";
  if (sex === "F") return "M";
  return "?";
}

export function sexTitle(sex: Sex | null | undefined): string {
  if (sex === "M") return "Vyras";
  if (sex === "F") return "Moteris";
  return "Nenurodyta";
}

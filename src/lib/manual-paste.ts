function looksLikeTime(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/^(dnf|dns|dsq|dq)$/i.test(t)) return true;
  return /^\d{1,2}:\d{2}(:\d{2}([.,]\d+)?)?$/.test(t);
}

function looksLikePlace(text: string): boolean {
  return /^\d{1,4}$/.test(text.trim());
}

function splitPasteLines(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/g, ""))
    .filter((l, i, arr) => l.length > 0 || i < arr.length - 1)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function splitCells(line: string): string[] {
  const cells = line.includes("\t")
    ? line.split("\t").map((c) => c.trim())
    : line.includes(";")
      ? line.split(";").map((c) => c.trim())
      : // Only split on commas if it looks like CSV columns (not "Last, First")
        /^\d/.test(line) || looksLikeTime(line.split(",")[1] ?? "")
        ? line.split(",").map((c) => c.trim())
        : [line.trim()];

  while (cells.length && !cells[cells.length - 1]) cells.pop();
  return cells;
}

export type PastedParticipantRow = {
  place: string;
  name: string;
  time: string;
};

export type PasteAnalysis =
  | { kind: "column"; values: string[] }
  | { kind: "rows"; rows: PastedParticipantRow[] };

/**
 * Detect single-column paste (names OR times separately) vs multi-column sheet paste.
 */
export function analyzePaste(text: string): PasteAnalysis | null {
  const lines = splitPasteLines(text);
  if (lines.length === 0) return null;

  const cellRows = lines.map(splitCells);
  const maxCols = Math.max(...cellRows.map((c) => c.length));

  if (maxCols <= 1) {
    const values = cellRows.map((c) => c[0] ?? "").filter((v) => v.length > 0);
    // Skip a lone header
    if (
      values.length === 1 &&
      /^(vardas|pavardė|pavarde|name|laikas|time|vieta|place)$/i.test(values[0])
    ) {
      return null;
    }
    if (
      values.length > 1 &&
      /^(vardas|pavardė|pavarde|name|laikas|time|vieta|place)$/i.test(values[0])
    ) {
      return { kind: "column", values: values.slice(1) };
    }
    return values.length ? { kind: "column", values } : null;
  }

  const rows = parsePastedParticipantLines(text);
  return rows.length ? { kind: "rows", rows } : null;
}

/** Parse Excel / Sheets paste (TSV or CSV-ish lines). */
export function parsePastedParticipantLines(text: string): PastedParticipantRow[] {
  const lines = splitPasteLines(text);
  const rows: PastedParticipantRow[] = [];

  for (const line of lines) {
    const cells = splitCells(line);
    if (cells.length === 0) continue;

    if (
      rows.length === 0 &&
      /vardas|name|laikas|time|vieta|place/i.test(cells.join(" "))
    ) {
      continue;
    }

    if (cells.length === 1) {
      const only = cells[0];
      if (looksLikeTime(only)) {
        rows.push({ place: "", name: "", time: only });
      } else {
        rows.push({ place: "", name: only, time: "" });
      }
      continue;
    }

    if (cells.length === 2) {
      const [a, b] = cells;
      if (looksLikePlace(a) && !looksLikeTime(a)) {
        rows.push({ place: a, name: b, time: "" });
      } else {
        rows.push({ place: "", name: a, time: b });
      }
      continue;
    }

    const [c0, c1, c2] = cells;
    if (looksLikePlace(c0) && (looksLikeTime(c2) || !looksLikeTime(c1))) {
      rows.push({ place: c0, name: c1, time: c2 });
    } else if (looksLikeTime(c1)) {
      rows.push({ place: "", name: c0, time: c1 });
    } else {
      rows.push({
        place: looksLikePlace(c0) ? c0 : "",
        name: c1 || c0,
        time: c2,
      });
    }
  }

  return rows;
}

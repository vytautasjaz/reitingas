import * as XLSX from "xlsx";
import {
  classifyFinishStatus,
  parseTimeToSeconds,
  type FinishStatus,
} from "./scoring";

export type ParsedResultRow = {
  place: number | null;
  bib: string | null;
  country: string | null;
  name: string;
  club: string | null;
  sex: string | null;
  category: string | null;
  swim: string | null;
  t1: string | null;
  bike: string | null;
  t2: string | null;
  run: string | null;
  time: string | null;
  gap: string | null;
  gunTime: string | null;
  timeSeconds: number | null;
  gunTimeSeconds: number | null;
  /** ok = finished; dnf = started but no finish; dns = did not start. */
  finishStatus: FinishStatus;
};

export type ParsedRaceFile = {
  rows: ParsedResultRow[];
  leaderTimeSeconds: number | null;
};

function emptyRowExtras() {
  return {
    bib: null as string | null,
    country: null as string | null,
    sex: null as string | null,
    category: null as string | null,
    swim: null as string | null,
    t1: null as string | null,
    bike: null as string | null,
    t2: null as string | null,
    run: null as string | null,
    gap: null as string | null,
    gunTime: null as string | null,
    gunTimeSeconds: null as number | null,
  };
}

function formatHms(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function cellText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel time serial (fraction of a day)
    if (value > 0 && value < 1.5) {
      return formatHms(value * 24 * 3600);
    }
    return String(value);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Prefer local components — Excel time-only cells are wall-clock times.
    return formatHms(
      value.getHours() * 3600 + value.getMinutes() * 60 + value.getSeconds()
    );
  }
  const text = String(value).replace(/\u00a0/g, " ").trim();
  return text || null;
}

function isLeaderLabel(text: string | null): boolean {
  if (!text) return false;
  return /nugal[eė]?toj|leader\s*time|winner\s*time|lyderio\s*laik/i.test(
    text.replace(/\s+/g, " ").trim()
  );
}

/**
 * Compact Tritonas roster spreadsheet:
 *   row 0: ["Nugaletojas laikas", "3:57:55"]
 *   row 1+: ["Vardas Pavardė", "4:21:57"]
 */
export function parseCompactTritonasSheet(
  matrix: unknown[][]
): ParsedRaceFile | null {
  if (matrix.length < 2) return null;

  const first = matrix[0] ?? [];
  const label = cellText(first[0]);
  const leaderFromCol2 = cellText(first[1]);
  const leaderTimeSeconds = isLeaderLabel(label)
    ? parseTimeToSeconds(leaderFromCol2)
    : null;

  if (leaderTimeSeconds == null || !isLeaderLabel(label)) {
    return null;
  }

  const rows: ParsedResultRow[] = [];
  for (const raw of matrix.slice(1)) {
    const name = cellText(raw?.[0]);
    const time = cellText(raw?.[1]);
    if (!name || isLeaderLabel(name)) continue;

    const timeSeconds = parseTimeToSeconds(time);
    const status = classifyFinishStatus(time);
    let finishStatus: FinishStatus = "ok";
    if (timeSeconds != null) finishStatus = "ok";
    else if (status === "dns") finishStatus = "dns";
    else if (status === "dnf" || time != null) finishStatus = "dnf";
    else finishStatus = "dns";

    // Club roster only — no protocol place / field size.
    rows.push({
      place: null,
      name,
      club: "TRItonas",
      time,
      timeSeconds,
      finishStatus,
      ...emptyRowExtras(),
    });
  }

  if (rows.length === 0) return null;
  return { rows, leaderTimeSeconds };
}

export function parseResultsSpreadsheet(buffer: Buffer): ParsedRaceFile {
  // Keep raw serials (not Date) so time-of-day is not shifted by timezone.
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { rows: [], leaderTimeSeconds: null };
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  const compact = parseCompactTritonasSheet(matrix);
  if (compact) return compact;

  // Fallback: treat first row as headers if it looks like a protocol table
  const asStrings = matrix.map((row) =>
    (row ?? []).map((c) => cellText(c) ?? "")
  );
  const htmlish = asStrings
    .map(
      (row) =>
        `<tr>${row.map((c) => `<td>${c}</td>`).join("")}</tr>`
    )
    .join("");
  return parseResultsHtml(`<table>${htmlish}</table>`);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\u00a0/g, " ");
}

function extractTables(html: string): string[][][] {
  const rowMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const table: string[][] = [];
  for (const rowHtml of rowMatches) {
    const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
      decodeEntities(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
    );
    if (cells.length) table.push(cells);
  }
  return table.length ? [table] : [];
}

function headerIndex(headers: string[], ...candidates: string[]): number {
  const normalized = headers.map((h) => h.toLowerCase().replace(/\s+/g, " ").trim());
  for (const c of candidates) {
    const needle = c.toLowerCase();
    const exact = normalized.findIndex((h) => h === needle);
    if (exact >= 0) return exact;
    const partial = normalized.findIndex((h) => h.includes(needle));
    if (partial >= 0) return partial;
  }
  return -1;
}

function pick(row: string[], idx: number): string | null {
  if (idx < 0 || idx >= row.length) return null;
  const v = row[idx]?.trim();
  return v ? v : null;
}

export function parseResultsHtml(content: string): ParsedRaceFile {
  const tables = extractTables(content);
  const table = tables.sort((a, b) => b.length - a.length)[0] ?? [];

  if (table.length < 2) {
    return { rows: [], leaderTimeSeconds: null };
  }

  const headers = table[0];
  const idx = {
    place: headerIndex(headers, "pl.", "pl", "place", "vieta"),
    bib: headerIndex(headers, "bib", "nr"),
    name: headerIndex(headers, "name", "vardas", "dalyvis"),
    club: headerIndex(headers, "club", "klubas"),
    sex: headerIndex(headers, "sx", "sex", "lytis"),
    cat: headerIndex(headers, "cat", "kategorija"),
    swim: headerIndex(headers, "swimming", "swim", "plaukimas"),
    t1: headerIndex(headers, "t1"),
    bike: headerIndex(headers, "bike", "dviratis"),
    t2: headerIndex(headers, "t2"),
    run: headerIndex(headers, "running", "run", "bėgimas", "begimas"),
    time: headerIndex(headers, "time", "laikas"),
    gap: headerIndex(headers, "gap"),
    gun: headerIndex(headers, "gun time", "gun"),
  };

  // Prefer leftmost plain "Name" column
  const nameCols = headers
    .map((h, i) => ({ h: h.toLowerCase().trim(), i }))
    .filter((x) => x.h === "name");
  if (nameCols.length > 0) idx.name = nameCols[0].i;

  const rows: ParsedResultRow[] = [];
  for (const row of table.slice(1)) {
    const name = pick(row, idx.name);
    if (!name) continue;

    const time = pick(row, idx.time);
    const gunTime = pick(row, idx.gun);
    const placeRaw = pick(row, idx.place);
    const place = placeRaw && /^\d+$/.test(placeRaw) ? Number(placeRaw) : null;
    const timeSeconds = parseTimeToSeconds(time);
    const gunTimeSeconds = parseTimeToSeconds(gunTime);
    const statusFromTime =
      classifyFinishStatus(time) ?? classifyFinishStatus(gunTime);
    const statusFromPlace = classifyFinishStatus(placeRaw);
    let finishStatus: FinishStatus = "ok";
    if (timeSeconds != null || gunTimeSeconds != null) {
      finishStatus = "ok";
    } else if (statusFromTime === "dns" || statusFromPlace === "dns") {
      finishStatus = "dns";
    } else if (
      statusFromTime === "dnf" ||
      statusFromPlace === "dnf" ||
      // Non-numeric place with no finish time (e.g. "-" + Withdrawal)
      (place == null && (time != null || gunTime != null || placeRaw != null))
    ) {
      finishStatus = "dnf";
    } else {
      // No time and no status label — treat as DNF if they appear in results
      // with empty time (started list). Pure DNS rows usually say DNS.
      finishStatus = placeRaw != null || time != null || gunTime != null ? "dnf" : "dns";
    }

    rows.push({
      place,
      bib: pick(row, idx.bib),
      country: null,
      name,
      club: pick(row, idx.club),
      sex: pick(row, idx.sex),
      category: pick(row, idx.cat),
      swim: pick(row, idx.swim),
      t1: pick(row, idx.t1),
      bike: pick(row, idx.bike),
      t2: pick(row, idx.t2),
      run: pick(row, idx.run),
      time,
      gap: pick(row, idx.gap),
      gunTime,
      timeSeconds,
      gunTimeSeconds,
      finishStatus,
    });
  }

  const leader = rows.find((r) => (r.timeSeconds ?? r.gunTimeSeconds) != null);
  const leaderTimeSeconds = leader
    ? (leader.timeSeconds ?? leader.gunTimeSeconds)
    : null;

  return { rows, leaderTimeSeconds };
}

function looksLikeHtmlResults(buffer: Buffer): boolean {
  const head = buffer.subarray(0, Math.min(buffer.length, 8192)).toString("utf8");
  return /<tr[\s>]|<table[\s>]|<html[\s>]/i.test(head);
}

export function parseResultsFileBuffer(buffer: Buffer): ParsedRaceFile {
  // LTT exports are often HTML saved as .xls; Gdansk-style rosters are real xlsx.
  if (looksLikeHtmlResults(buffer)) {
    return parseResultsHtml(buffer.toString("utf8"));
  }
  // ZIP/xlsx signature "PK"
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return parseResultsSpreadsheet(buffer);
  }
  // Last resort: try HTML, then spreadsheet
  const asHtml = parseResultsHtml(buffer.toString("utf8"));
  if (asHtml.rows.length > 0 && asHtml.leaderTimeSeconds != null) return asHtml;
  try {
    return parseResultsSpreadsheet(buffer);
  } catch {
    return asHtml;
  }
}

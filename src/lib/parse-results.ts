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

export function parseResultsFileBuffer(buffer: Buffer): ParsedRaceFile {
  return parseResultsHtml(buffer.toString("utf8"));
}

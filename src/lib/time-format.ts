/** Client-safe time formatting / parsing (no Node / DB imports). */

export type FinishStatus = "ok" | "dnf" | "dns";

/** Normalize raw time/place labels used in Lithuanian/international protocols. */
export function classifyFinishStatus(
  raw: string | null | undefined
): FinishStatus | null {
  if (raw == null) return null;
  const text = String(raw).trim().toLowerCase().replace(/\s+/g, " ");
  if (!text || text === "-" || text === "–" || text === "—") return null;

  if (
    text === "dns" ||
    text === "did not start" ||
    text === "nepradėjo" ||
    text.startsWith("dns ")
  ) {
    return "dns";
  }

  if (
    text === "dnf" ||
    text === "did not finish" ||
    text === "withdrawal" ||
    text === "withdrawn" ||
    text === "wd" ||
    text === "w.d." ||
    text === "w/d" ||
    text === "dq" ||
    text === "dsq" ||
    text === "disqualified" ||
    text.startsWith("dnf ") ||
    text.includes("withdrawal")
  ) {
    return "dnf";
  }

  return null;
}

export function parseTimeToSeconds(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const text = String(raw).trim().replace(",", ".");
  if (!text || text === "-" || text === "–" || text === "—") return null;
  if (classifyFinishStatus(text) != null) return null;

  const parts = text.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || Number.isNaN(Number(p)))) return null;

  const nums = parts.map(Number);
  if (nums.length === 3) {
    return nums[0] * 3600 + nums[1] * 60 + nums[2];
  }
  if (nums.length === 2) {
    return nums[0] * 60 + nums[1];
  }
  if (nums.length === 1) {
    return nums[0];
  }
  return null;
}

export function formatSeconds(total: number | null | undefined): string {
  if (total == null || !Number.isFinite(total)) return "";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const sec = s.toFixed(1).padStart(4, "0");
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${sec}`;
  }
  return `${m}:${sec}`;
}

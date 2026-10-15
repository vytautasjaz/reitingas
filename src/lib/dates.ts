/** Display helpers — Lithuanian locale (week starts Monday). */

const LT_DATE: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
};

/** Format YYYY-MM-DD (or ISO) as lt-LT date, e.g. 05.09.2026 */
export function formatDateLt(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const day = isoDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return isoDate;
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("lt-LT", LT_DATE);
}

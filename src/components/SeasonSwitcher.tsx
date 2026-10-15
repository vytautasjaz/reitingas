"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SeasonSwitcher({
  year,
  years,
}: {
  year: number;
  years: number[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onChange(next: number) {
    if (next === year) return;
    setError(null);
    try {
      const res = await fetch("/api/season", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: next }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Nepavyko pakeisti sezono");
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko");
    }
  }

  return (
    <div className="season-switcher">
      <label className="season-switcher-label" htmlFor="season-year">
        Sezonas
      </label>
      <select
        id="season-year"
        className="season-select"
        value={year}
        disabled={pending}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Reitingo sezonas"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      {error && <span className="season-switcher-error">{error}</span>}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteRaceButton({
  raceId,
  raceName,
}: {
  raceId: number;
  raceName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete() {
    const ok = window.confirm(
      `Ištrinti varžybas „${raceName}“?\nReitingas bus perskaičiuotas.`
    );
    if (!ok) return;

    setPending(true);
    try {
      const res = await fetch(`/api/races/${raceId}`, { method: "DELETE" });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Nepavyko ištrinti");
      }
      router.push("/races");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Nepavyko ištrinti");
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className="btn btn-danger"
      disabled={pending}
      onClick={onDelete}
    >
      {pending ? "Trinama…" : "Ištrinti varžybas"}
    </button>
  );
}

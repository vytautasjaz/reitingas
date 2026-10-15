"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteMeetButton({
  meetId,
  meetName,
}: {
  meetId: number;
  meetName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete() {
    const ok = window.confirm(
      `Ištrinti varžybas „${meetName}“ ir visas distancijas?\nReitingas bus perskaičiuotas.`
    );
    if (!ok) return;

    setPending(true);
    try {
      const res = await fetch(`/api/meets/${meetId}`, { method: "DELETE" });
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

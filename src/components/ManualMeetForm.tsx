"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DistanceType } from "@/lib/distances";

type MemberOption = { id: number; display_name: string };

type ParticipantRow = {
  key: string;
  memberId: string;
  name: string;
  place: string;
  time: string;
};

type LegRow = {
  key: string;
  distanceType: DistanceType;
  leaderTime: string;
  participants: ParticipantRow[];
};

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function newParticipant(): ParticipantRow {
  return { key: newKey(), memberId: "", name: "", place: "", time: "" };
}

function newLeg(distanceType: DistanceType = "olympic"): LegRow {
  return {
    key: newKey(),
    distanceType,
    leaderTime: "",
    participants: [],
  };
}

export function ManualMeetForm({ members }: { members: MemberOption[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [meetDate, setMeetDate] = useState("");
  const [legs, setLegs] = useState<LegRow[]>([newLeg()]);

  function updateLeg(key: string, patch: Partial<LegRow>) {
    setLegs((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function updateParticipant(
    legKey: string,
    participantKey: string,
    patch: Partial<ParticipantRow>
  ) {
    setLegs((prev) =>
      prev.map((leg) => {
        if (leg.key !== legKey) return leg;
        return {
          ...leg,
          participants: leg.participants.map((p) =>
            p.key === participantKey ? { ...p, ...patch } : p
          ),
        };
      })
    );
  }

  function addParticipant(legKey: string) {
    setLegs((prev) =>
      prev.map((leg) =>
        leg.key === legKey
          ? { ...leg, participants: [...leg.participants, newParticipant()] }
          : leg
      )
    );
  }

  function removeParticipant(legKey: string, participantKey: string) {
    setLegs((prev) =>
      prev.map((leg) => {
        if (leg.key !== legKey) return leg;
        return {
          ...leg,
          participants: leg.participants.filter((p) => p.key !== participantKey),
        };
      })
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        meetDate,
        legs: legs.map((leg) => ({
          distanceType: leg.distanceType,
          leaderTimeText: leg.leaderTime.trim(),
          participants: leg.participants
            .filter(
              (p) =>
                p.memberId ||
                p.name.trim() ||
                p.time.trim() ||
                p.place.trim()
            )
            .map((p) => ({
              memberId: p.memberId ? Number(p.memberId) : null,
              name: p.name.trim() || undefined,
              place: p.place.trim() ? Number(p.place) : null,
              timeText: p.time.trim(),
              club: "TRItonas",
            })),
        })),
      };

      const res = await fetch("/api/meets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        meetId?: number;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Nepavyko sukurti");
      }

      router.push(`/meets/${json.meetId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko sukurti");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card card-pad manual-meet-form">
      <div>
        <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>
          Įvesti rankiniu būdu
        </h3>
        <p style={{ margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
          Suveskite nugalėtojo laiką ir TRItono dalyvius su jų laikais. Taškai
          skaičiuojami automatiškai.
        </p>
      </div>

      <div className="manual-meet-fields">
        <div>
          <label className="label" htmlFor="manual-name">
            Varžybų pavadinimas
          </label>
          <input
            id="manual-name"
            className="input"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="pvz. LTT Panevėžys"
          />
        </div>
        <div>
          <label className="label" htmlFor="manual-date">
            Data
          </label>
          <input
            id="manual-date"
            className="input"
            type="date"
            lang="lt"
            required
            value={meetDate}
            onChange={(e) => setMeetDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        {legs.map((leg, legIndex) => (
          <div key={leg.key} className="manual-leg">
            <div className="manual-leg-head">
              <span className="manual-leg-index">{legIndex + 1}</span>
              <div className="manual-meet-fields" style={{ flex: 1 }}>
                <div>
                  <label className="label" htmlFor={`manual-dist-${leg.key}`}>
                    Distancija
                  </label>
                  <select
                    id={`manual-dist-${leg.key}`}
                    className="select"
                    value={leg.distanceType}
                    onChange={(e) =>
                      updateLeg(leg.key, {
                        distanceType: e.target.value as DistanceType,
                      })
                    }
                  >
                    <option value="sprint">Sprint / SD — 900</option>
                    <option value="olympic">Olimpinė / OD — 1000</option>
                    <option value="half">Half — 1100</option>
                    <option value="full">Full — 1100</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor={`manual-leader-${leg.key}`}>
                    Nugalėtojo laikas
                  </label>
                  <input
                    id={`manual-leader-${leg.key}`}
                    className="input font-mono"
                    required
                    placeholder="pvz. 1:08:19.0"
                    value={leg.leaderTime}
                    onChange={(e) =>
                      updateLeg(leg.key, { leaderTime: e.target.value })
                    }
                  />
                </div>
              </div>
              {legs.length > 1 && (
                <button
                  type="button"
                  className="btn btn-ghost text-sm"
                  onClick={() =>
                    setLegs((prev) => prev.filter((l) => l.key !== leg.key))
                  }
                  title="Pašalinti distanciją"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="manual-participants">
              {leg.participants.length > 0 && (
                <div className="manual-participants-label">Dalyviai</div>
              )}
              {leg.participants.map((p) => (
                <div key={p.key} className="manual-participant-row">
                  <select
                    className="select"
                    value={p.memberId}
                    onChange={(e) =>
                      updateParticipant(leg.key, p.key, {
                        memberId: e.target.value,
                        name: e.target.value ? "" : p.name,
                      })
                    }
                    aria-label="Narys"
                  >
                    <option value="">— narys arba vardas —</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display_name}
                      </option>
                    ))}
                  </select>
                  {!p.memberId && (
                    <input
                      className="input"
                      placeholder="Vardas Pavardė"
                      value={p.name}
                      onChange={(e) =>
                        updateParticipant(leg.key, p.key, { name: e.target.value })
                      }
                    />
                  )}
                  <input
                    className="input font-mono"
                    placeholder="Vieta"
                    inputMode="numeric"
                    value={p.place}
                    onChange={(e) =>
                      updateParticipant(leg.key, p.key, { place: e.target.value })
                    }
                    style={{ maxWidth: "5rem" }}
                  />
                  <input
                    className="input font-mono"
                    placeholder="Laikas / DNF"
                    value={p.time}
                    onChange={(e) =>
                      updateParticipant(leg.key, p.key, { time: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="link-muted"
                    onClick={() => removeParticipant(leg.key, p.key)}
                  >
                    šalinti
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={leg.participants.length === 0 ? "btn btn-ghost text-sm" : "link-action"}
                onClick={() => addParticipant(leg.key)}
              >
                {leg.participants.length === 0 ? "Pridėti dalyvį" : "+ Pridėti dar"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="manual-meet-actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Kuriama…" : "Sukurti varžybas"}
        </button>
        <button
          type="button"
          className="btn btn-ghost text-sm"
          onClick={() => setLegs((prev) => [...prev, newLeg()])}
        >
          + Pridėti distanciją
        </button>
      </div>

      {error && (
        <p style={{ margin: 0, color: "var(--danger)", fontSize: "0.9rem" }}>
          {error}
        </p>
      )}
    </form>
  );
}

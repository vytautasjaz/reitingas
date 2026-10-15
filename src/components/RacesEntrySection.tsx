"use client";

import { useState } from "react";
import type { DistanceSetting } from "@/lib/settings";
import { ImportForm } from "./ImportForm";
import { ManualMeetForm } from "./ManualMeetForm";

type Mode = "closed" | "choose" | "import" | "manual";

type MemberOption = { id: number; display_name: string };

export function RacesEntrySection({
  members,
  distances,
}: {
  members: MemberOption[];
  distances: DistanceSetting[];
}) {
  const [mode, setMode] = useState<Mode>("closed");

  if (mode === "closed") {
    return (
      <div className="races-add-bar">
        <button
          type="button"
          className="btn btn-primary text-sm"
          onClick={() => setMode("choose")}
        >
          Pridėti varžybas
        </button>
      </div>
    );
  }

  if (mode === "choose") {
    return (
      <div className="races-add-choose card card-pad">
        <div className="races-add-choose-head">
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>
            Kaip pridėti varžybas?
          </h3>
          <button
            type="button"
            className="link-muted"
            onClick={() => setMode("closed")}
          >
            Atšaukti
          </button>
        </div>
        <div className="races-add-choose-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setMode("import")}
          >
            Įkelti protokolą
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setMode("manual")}
          >
            Įvesti rankiniu būdu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="races-entry-active">
      <div className="races-entry-active-bar">
        <button
          type="button"
          className="link-muted"
          onClick={() => setMode("choose")}
        >
          ← Keisti būdą
        </button>
        <button
          type="button"
          className="link-muted"
          onClick={() => setMode("closed")}
        >
          Uždaryti
        </button>
      </div>
      {mode === "import" ? (
        <ImportForm distances={distances} />
      ) : (
        <ManualMeetForm members={members} distances={distances} />
      )}
    </div>
  );
}

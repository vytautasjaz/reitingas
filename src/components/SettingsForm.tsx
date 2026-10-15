"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AppSettings, DistanceSetting } from "@/lib/settings";

export function SettingsForm({
  initial,
  initialFormula,
}: {
  initial: AppSettings;
  initialFormula: string;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>(initial);
  const [formula, setFormula] = useState(initialFormula);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState("");
  const [newShort, setNewShort] = useState("");
  const [newBase, setNewBase] = useState("800");

  const previewFormula = useMemo(() => {
    const exp =
      settings.formulaExponent === 1
        ? "lyderis / dalyvis"
        : `(lyderis / dalyvis)^${settings.formulaExponent}`;
    const foreign =
      settings.foreignBonusPercent > 0
        ? ` × ${(1 + settings.foreignBonusPercent / 100).toFixed(2)} užs.`
        : "";
    return `taškai = ROUND(${exp} × bazė${foreign})`;
  }, [settings.formulaExponent, settings.foreignBonusPercent]);

  function updateDistance(id: string, patch: Partial<DistanceSetting>) {
    setSettings((prev) => ({
      ...prev,
      distances: prev.distances.map((d) =>
        d.id === id ? { ...d, ...patch } : d
      ),
    }));
  }

  async function save() {
    setPending(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bestN: settings.bestN,
          foreignBonusPercent: settings.foreignBonusPercent,
          maxForeignInBestN: settings.maxForeignInBestN,
          formulaExponent: settings.formulaExponent,
          distances: settings.distances,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        settings?: AppSettings;
        formula?: string;
        recalc?: { racesUpdated: number; resultsUpdated: number };
      };
      if (!res.ok || !json.ok || !json.settings) {
        throw new Error(json.error ?? "Nepavyko išsaugoti");
      }
      setSettings(json.settings);
      setFormula(json.formula ?? previewFormula);
      const r = json.recalc;
      setMsg(
        r
          ? `Išsaugota · ${r.resultsUpdated} rezultatų perskaičiuota`
          : "Išsaugota"
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Klaida");
    } finally {
      setPending(false);
    }
  }

  async function addDistance() {
    if (!newLabel.trim()) return;
    setPending(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addDistance: {
            label: newLabel.trim(),
            shortLabel: newShort.trim() || undefined,
            basePoints: Number(newBase),
          },
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        settings?: AppSettings;
        formula?: string;
      };
      if (!res.ok || !json.ok || !json.settings) {
        throw new Error(json.error ?? "Nepavyko pridėti");
      }
      setSettings(json.settings);
      if (json.formula) setFormula(json.formula);
      setNewLabel("");
      setNewShort("");
      setNewBase("800");
      setMsg("Pridėta");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Klaida");
    } finally {
      setPending(false);
    }
  }

  async function removeDistance(id: string) {
    if (!window.confirm("Ištrinti šią distanciją?")) return;
    setPending(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeDistanceId: id }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        settings?: AppSettings;
      };
      if (!res.ok || !json.ok || !json.settings) {
        throw new Error(json.error ?? "Nepavyko ištrinti");
      }
      setSettings(json.settings);
      setMsg("Pašalinta");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Klaida");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="settings-panel">
      <section className="card settings-card">
        <div className="settings-card-head">
          <h2>Reitingas</h2>
          <p>Kaip skaičiuojama sezono suma ir taškai.</p>
        </div>

        <div className="settings-rules-grid">
          <label className="settings-rule">
            <span className="settings-rule-label">Geriausi etapai</span>
            <span className="settings-rule-hint">Top N į bendrą sumą</span>
            <input
              className="input settings-rule-input font-mono"
              type="number"
              min={1}
              max={20}
              value={settings.bestN}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  bestN: Number(e.target.value) || 1,
                }))
              }
            />
          </label>

          <label className="settings-rule">
            <span className="settings-rule-label">Užsienio limitas</span>
            <span className="settings-rule-hint">kiek iš Top N</span>
            <input
              className="input settings-rule-input font-mono"
              type="number"
              min={0}
              max={10}
              value={settings.maxForeignInBestN}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  maxForeignInBestN: Number(e.target.value) || 0,
                }))
              }
            />
          </label>

          <label className="settings-rule">
            <span className="settings-rule-label">Užsienio priedas</span>
            <span className="settings-rule-hint">procentais, pvz. 10</span>
            <input
              className="input settings-rule-input font-mono"
              type="number"
              min={0}
              max={100}
              value={settings.foreignBonusPercent}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  foreignBonusPercent: Number(e.target.value) || 0,
                }))
              }
            />
          </label>

          <label className="settings-rule">
            <span className="settings-rule-label">Eksponentė</span>
            <span className="settings-rule-hint">1 = lyderis / dalyvis</span>
            <input
              className="input settings-rule-input font-mono"
              type="number"
              min={0.1}
              max={5}
              step={0.1}
              value={settings.formulaExponent}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  formulaExponent: Number(e.target.value) || 1,
                }))
              }
            />
          </label>
        </div>

        <div className="settings-formula font-mono" title={formula}>
          {previewFormula}
        </div>
      </section>

      <section className="card table-wrap settings-card">
        <div className="settings-card-head settings-card-head-pad">
          <h2>Distancijos</h2>
          <p>Bazė naudojama taškų formulei. Galite pridėti savo tipus.</p>
        </div>

        <table className="ranking settings-dist-table">
          <thead>
            <tr>
              <th>Pavadinimas</th>
              <th>Trump.</th>
              <th>Bazė</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {settings.distances.map((d) => (
              <tr key={d.id}>
                <td>
                  <input
                    className="input settings-cell-input"
                    value={d.label}
                    onChange={(e) =>
                      updateDistance(d.id, { label: e.target.value })
                    }
                    aria-label={`${d.id} pavadinimas`}
                  />
                </td>
                <td>
                  <input
                    className="input settings-cell-input settings-cell-center font-mono"
                    value={d.shortLabel}
                    onChange={(e) =>
                      updateDistance(d.id, { shortLabel: e.target.value })
                    }
                    aria-label={`${d.id} trumpinys`}
                  />
                </td>
                <td>
                  <input
                    className="input settings-cell-input settings-cell-center font-mono"
                    type="number"
                    min={1}
                    value={d.basePoints}
                    onChange={(e) =>
                      updateDistance(d.id, {
                        basePoints: Number(e.target.value) || 1,
                      })
                    }
                    aria-label={`${d.id} bazė`}
                  />
                </td>
                <td className="settings-cell-act">
                  {!d.builtin ? (
                    <button
                      type="button"
                      className="btn btn-ghost text-sm"
                      disabled={pending}
                      onClick={() => removeDistance(d.id)}
                    >
                      Ištrinti
                    </button>
                  ) : (
                    <span className="muted text-sm">įmont.</span>
                  )}
                </td>
              </tr>
            ))}
            <tr className="settings-add-row">
              <td>
                <input
                  className="input settings-cell-input"
                  placeholder="Akvatlonas…"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </td>
              <td>
                <input
                  className="input settings-cell-input settings-cell-center font-mono"
                  placeholder="AQ"
                  value={newShort}
                  onChange={(e) => setNewShort(e.target.value)}
                />
              </td>
              <td>
                <input
                  className="input settings-cell-input settings-cell-center font-mono"
                  type="number"
                  min={1}
                  value={newBase}
                  onChange={(e) => setNewBase(e.target.value)}
                />
              </td>
              <td className="settings-cell-act">
                <button
                  type="button"
                  className="btn btn-ghost text-sm"
                  disabled={pending || !newLabel.trim()}
                  onClick={addDistance}
                >
                  Pridėti
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <div className="settings-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending}
          onClick={save}
        >
          {pending ? "Saugoma…" : "Išsaugoti ir perskaičiuoti"}
        </button>
        {msg && <span className="settings-msg ok">{msg}</span>}
        {error && <span className="settings-msg err">{error}</span>}
      </div>
    </div>
  );
}

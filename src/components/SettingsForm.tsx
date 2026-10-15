"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AppSettings, DistanceSetting } from "@/lib/settings";

function InfoIcon({ title }: { title: string }) {
  return (
    <span className="settings-info" title={title} aria-label={title}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M12 11v5.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="12" cy="8" r="1" fill="currentColor" />
      </svg>
    </span>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5 15V5a2 2 0 0 1 2-2h10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

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
  const [copied, setCopied] = useState(false);

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
    return `ROUND( ${exp} × bazė${foreign} )`;
  }, [settings.formulaExponent, settings.foreignBonusPercent]);

  function updateDistance(id: string, patch: Partial<DistanceSetting>) {
    setSettings((prev) => ({
      ...prev,
      distances: prev.distances.map((d) =>
        d.id === id ? { ...d, ...patch } : d
      ),
    }));
  }

  async function copyFormula() {
    try {
      await navigator.clipboard.writeText(previewFormula);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
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
    <div className="settings-shell">
      <div className="settings-card">
        <div className="settings-params">
          <label className="settings-row">
            <span className="settings-row-main">
              <span className="settings-row-title">
                Kiek geriausių etapų įskaitoma
                <InfoIcon title="Kiek geriausių startų įeina į bendrą sezono sumą" />
              </span>
              <span className="settings-row-hint">Top N į bendrą sumą</span>
            </span>
            <input
              className="settings-num"
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

          <label className="settings-row">
            <span className="settings-row-main">
              <span className="settings-row-title">
                Kiek užsienio startų galima įskaityti
                <InfoIcon title="Iš Top N į sumą gali įeiti tiek užsienio startų" />
              </span>
              <span className="settings-row-hint">Iš Top N</span>
            </span>
            <input
              className="settings-num"
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

          <label className="settings-row">
            <span className="settings-row-main">
              <span className="settings-row-title">
                Užsienio starto taškų priedas
                <InfoIcon title="Papildomi procentai užsienio starto taškams" />
              </span>
              <span className="settings-row-hint">%, pvz. 10 = +10 %</span>
            </span>
            <input
              className="settings-num"
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

          <label className="settings-row">
            <span className="settings-row-main">
              <span className="settings-row-title">
                Formulės eksponentė
                <InfoIcon title="1 = tiesioginis santykis lyderis / dalyvis" />
              </span>
              <span className="settings-row-hint">1 = lyderis / dalyvis</span>
            </span>
            <input
              className="settings-num"
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

        <div className="settings-formula-box">
          <div className="settings-formula-head">
            <span>Skaičiavimo formulė</span>
            <button
              type="button"
              className="settings-icon-btn"
              onClick={copyFormula}
              title={copied ? "Nukopijuota" : "Kopijuoti"}
            >
              <CopyIcon />
            </button>
          </div>
          <code className="settings-formula-code" title={formula}>
            {previewFormula}
          </code>
        </div>

        <div className="settings-dist-block">
          <div className="settings-dist-head">
            <span>Distancija</span>
            <span>Trump.</span>
            <span>Bazė</span>
            <span />
          </div>
          <div className="settings-dist-rows">
            {settings.distances.map((d) => (
              <div key={d.id} className="settings-dist-row">
                <input
                  className="settings-field"
                  value={d.label}
                  onChange={(e) =>
                    updateDistance(d.id, { label: e.target.value })
                  }
                  aria-label={`${d.id} pavadinimas`}
                />
                <input
                  className="settings-field settings-field-center"
                  value={d.shortLabel}
                  onChange={(e) =>
                    updateDistance(d.id, { shortLabel: e.target.value })
                  }
                  aria-label={`${d.id} trumpinys`}
                />
                <input
                  className="settings-field settings-field-center font-mono"
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
                {d.builtin ? (
                  <span className="settings-icon-btn settings-icon-btn-ghost" />
                ) : (
                  <button
                    type="button"
                    className="settings-icon-btn settings-icon-btn-danger"
                    disabled={pending}
                    onClick={() => removeDistance(d.id)}
                    title="Ištrinti"
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            ))}

            <div className="settings-dist-row settings-dist-row-add">
              <input
                className="settings-field"
                placeholder="Nauja (pvz. Akvatlonas)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
              <input
                className="settings-field settings-field-center"
                placeholder="AQ"
                value={newShort}
                onChange={(e) => setNewShort(e.target.value)}
              />
              <input
                className="settings-field settings-field-center font-mono"
                type="number"
                min={1}
                value={newBase}
                onChange={(e) => setNewBase(e.target.value)}
              />
              <button
                type="button"
                className="settings-icon-btn settings-icon-btn-add"
                disabled={pending || !newLabel.trim()}
                onClick={addDistance}
                title="Pridėti"
              >
                <PlusIcon />
              </button>
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button
            type="button"
            className="settings-save"
            disabled={pending}
            onClick={save}
          >
            {pending ? "Saugoma…" : "Išsaugoti ir perskaičiuoti"}
            {!pending && <span aria-hidden>→</span>}
          </button>
          {msg && <span className="settings-msg ok">{msg}</span>}
          {error && <span className="settings-msg err">{error}</span>}
        </div>
      </div>
    </div>
  );
}

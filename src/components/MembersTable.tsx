"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Member } from "@/lib/db";
import { sexLabel, sexTitle } from "@/lib/gender";

type EditableMember = Pick<
  Member,
  "id" | "display_name" | "normalized_name" | "sex" | "sex_manual"
>;

type Draft = {
  name: string;
  sex: "M" | "F" | "";
};

type SortKey = "name" | "sex";
type SortDir = "asc" | "desc";

function sexRank(sex: string | null | undefined): number {
  if (sex === "M") return 0;
  if (sex === "F") return 1;
  return 2;
}

export function MembersTable({ members }: { members: EditableMember[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newSex, setNewSex] = useState<Draft["sex"]>("");
  const [adding, setAdding] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sortedMembers = useMemo(() => {
    const rows = [...members];
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (sortKey === "sex") {
        const bySex = sexRank(a.sex) - sexRank(b.sex);
        if (bySex !== 0) return bySex * dir;
        return (
          a.display_name.localeCompare(b.display_name, "lt", {
            sensitivity: "base",
          }) * dir
        );
      }
      const byName = a.display_name.localeCompare(b.display_name, "lt", {
        sensitivity: "base",
      });
      if (byName !== 0) return byName * dir;
      return (sexRank(a.sex) - sexRank(b.sex)) * dir;
    });
    return rows;
  }, [members, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }


  function startEdit(m: EditableMember) {
    setEditingId(m.id);
    setDraft({
      name: m.display_name,
      sex: m.sex ?? "",
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setError(null);
  }

  async function saveEdit(id: number) {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: draft.name.trim(),
          sex: draft.sex === "" ? null : draft.sex,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Nepavyko išsaugoti");
      cancelEdit();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko išsaugoti");
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(m: EditableMember) {
    const ok = window.confirm(
      `Pašalinti „${m.display_name}“ iš reitinguojamų narių?`
    );
    if (!ok) return;
    setBusyId(m.id);
    setError(null);
    try {
      const res = await fetch(`/api/members/${m.id}`, { method: "DELETE" });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Nepavyko pašalinti");
      if (editingId === m.id) cancelEdit();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko pašalinti");
    } finally {
      setBusyId(null);
    }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: newName.trim(),
          sex: newSex === "" ? null : newSex,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Nepavyko pridėti");
      setNewName("");
      setNewSex("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko pridėti");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="card card-pad" style={{ color: "var(--danger)" }}>
          {error}
        </div>
      )}

      <form className="card card-pad members-add" onSubmit={addMember}>
        <div className="members-add-fields">
          <div>
            <label className="label" htmlFor="add-member-name">
              Naujas reitinguojamas narys
            </label>
            <input
              id="add-member-name"
              className="input"
              placeholder="Vardas Pavardė"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={adding || editingId != null}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="add-member-sex">
              Lytis
            </label>
            <select
              id="add-member-sex"
              className="select"
              value={newSex}
              onChange={(e) => setNewSex(e.target.value as Draft["sex"])}
              disabled={adding || editingId != null}
            >
              <option value="">Automatiškai</option>
              <option value="M">Vyras</option>
              <option value="F">Moteris</option>
            </select>
          </div>
          <div className="members-add-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={adding || !newName.trim() || editingId != null}
            >
              {adding ? "Pridedama…" : "Pridėti"}
            </button>
          </div>
        </div>
      </form>

      <div className="card table-wrap">
        <table className="ranking ranking-compact">
          <thead>
            <tr>
              <th>#</th>
              <th className={`sortable-th${sortKey === "sex" ? " sorted" : ""}`}>
                <button
                  type="button"
                  className="sort-btn"
                  onClick={() => toggleSort("sex")}
                >
                  <span className="sort-btn-label">Lytis</span>
                  <span className="sort-indicator" aria-hidden>
                    {sortKey === "sex" ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </button>
              </th>
              <th className={`sortable-th${sortKey === "name" ? " sorted" : ""}`}>
                <button
                  type="button"
                  className="sort-btn"
                  onClick={() => toggleSort("name")}
                >
                  <span className="sort-btn-label">Vardas</span>
                  <span className="sort-indicator" aria-hidden>
                    {sortKey === "name" ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </button>
              </th>
              <th>Veiksmai</th>
            </tr>
          </thead>
          <tbody>
            {sortedMembers.map((m, i) => {
              const isEditing = editingId === m.id && draft;
              if (isEditing && draft) {
                return (
                  <tr key={m.id} className="row-editing">
                    <td colSpan={4} style={{ whiteSpace: "normal", padding: "0.75rem" }}>
                      <div className="edit-participant-grid">
                        <div>
                          <label className="label" htmlFor={`m-name-${m.id}`}>
                            Vardas
                          </label>
                          <input
                            id={`m-name-${m.id}`}
                            className="input"
                            value={draft.name}
                            onChange={(e) =>
                              setDraft({ ...draft, name: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="label" htmlFor={`m-sex-${m.id}`}>
                            Lytis
                          </label>
                          <select
                            id={`m-sex-${m.id}`}
                            className="select"
                            value={draft.sex}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                sex: e.target.value as Draft["sex"],
                              })
                            }
                          >
                            <option value="">— nenurodyta —</option>
                            <option value="M">Vyras</option>
                            <option value="F">Moteris</option>
                          </select>
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: "0.65rem",
                          display: "flex",
                          gap: "0.85rem",
                          alignItems: "center",
                        }}
                      >
                        <button
                          type="button"
                          className="link-action"
                          disabled={saving}
                          onClick={() => saveEdit(m.id)}
                        >
                          {saving ? "Saugoma…" : "išsaugoti"}
                        </button>
                        <button
                          type="button"
                          className="link-muted"
                          disabled={saving}
                          onClick={cancelEdit}
                        >
                          atšaukti
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={m.id}
                  className={
                    m.sex === "M" ? "row-male" : m.sex === "F" ? "row-female" : ""
                  }
                >
                  <td style={{ fontWeight: 600 }}>{i + 1}</td>
                  <td>
                    <span
                      className={`sex-mark sex-${m.sex === "F" ? "f" : m.sex === "M" ? "m" : "u"}`}
                      title={
                        m.sex_manual
                          ? `${sexTitle(m.sex)} (pataisyta rankiniu būdu)`
                          : sexTitle(m.sex)
                      }
                    >
                      {sexLabel(m.sex)}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{m.display_name}</td>
                  <td>
                    <div className="row-actions" style={{ gap: "0.65rem" }}>
                      <button
                        type="button"
                        className="link-muted"
                        disabled={editingId != null || busyId === m.id}
                        onClick={() => startEdit(m)}
                      >
                        redaguoti
                      </button>
                      <button
                        type="button"
                        className="link-danger"
                        disabled={busyId === m.id || editingId != null}
                        onClick={() => removeMember(m)}
                      >
                        {busyId === m.id ? "…" : "šalinti"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminSaveLeague, adminDeleteLeague } from "@/lib/actions";

type League = {
  id: string;
  name: string;
  description: string | null;
  prize: string | null;
  starts_on: string | null;
  ends_on: string | null;
};

const empty = { id: "", name: "", description: "", prize: "", starts_on: "", ends_on: "" };

export function AdminLeagueForm({ leagues }: { leagues: League[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ ...empty });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function edit(l: League) {
    setMsg(null);
    setForm({
      id: l.id,
      name: l.name,
      description: l.description ?? "",
      prize: l.prize ?? "",
      starts_on: l.starts_on ?? "",
      ends_on: l.ends_on ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setForm({ ...empty });
    setMsg(null);
  }

  function save() {
    setMsg(null);
    start(async () => {
      const res = await adminSaveLeague({
        id: form.id || undefined,
        name: form.name,
        description: form.description,
        prize: form.prize,
        starts_on: form.starts_on || null,
        ends_on: form.ends_on || null,
      });
      if (res.ok) {
        setMsg(form.id ? "Liga uppdaterad ✓" : "Liga skapad ✓");
        reset();
        router.refresh();
      } else {
        setMsg(res.error ?? "Något gick fel.");
      }
    });
  }

  function remove(l: League) {
    if (!confirm(`Ta bort ligan "${l.name}"? Detta går inte att ångra.`)) return;
    setMsg(null);
    start(async () => {
      const res = await adminDeleteLeague(l.id);
      if (res.ok) {
        setMsg("Liga borttagen ✓");
        if (form.id === l.id) reset();
        router.refresh();
      } else {
        setMsg(res.error ?? "Något gick fel.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="card space-y-3 p-5">
        <h3 className="font-semibold">{form.id ? "Redigera liga" : "Skapa ny publik liga"}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="label">Namn *</span>
            <input className="input mt-1 w-full" value={form.name} onChange={set("name")} placeholder="SSK-femman #5 – Play off" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="label">Beskrivning</span>
            <input className="input mt-1 w-full" value={form.description} onChange={set("description")} placeholder="Kort beskrivning" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="label">Pris (valfritt)</span>
            <input className="input mt-1 w-full" value={form.prize} onChange={set("prize")} placeholder="Presentkort 500:- i sskshoppen.se" />
          </label>
          <label className="text-sm">
            <span className="label">Startdatum</span>
            <input type="date" className="input mt-1 w-full" value={form.starts_on} onChange={set("starts_on")} />
          </label>
          <label className="text-sm">
            <span className="label">Slutdatum</span>
            <input type="date" className="input mt-1 w-full" value={form.ends_on} onChange={set("ends_on")} />
          </label>
        </div>
        <p className="text-xs text-ssk-muted">
          Lämna datumen tomma för en liga som gäller hela säsongen. Datumen avgör vilka omgångar/matcher
          som räknas i ligans topplista.
        </p>
        <div className="flex gap-2">
          <button onClick={save} disabled={pending || form.name.trim().length < 2} className="btn-primary">
            {form.id ? "Spara ändringar" : "Skapa liga"}
          </button>
          {form.id && (
            <button onClick={reset} disabled={pending} className="btn-ghost">Avbryt</button>
          )}
        </div>
        {msg && <p className="text-sm text-ssk-blue">{msg}</p>}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ssk-navy text-white">
            <tr>
              <th className="px-4 py-2 text-left">Liga</th>
              <th className="px-4 py-2 text-left">Period</th>
              <th className="px-4 py-2 text-right">Åtgärd</th>
            </tr>
          </thead>
          <tbody>
            {leagues.map((l) => (
              <tr key={l.id} className="border-t border-ssk-line">
                <td className="px-4 py-2">
                  <div className="font-medium">{l.name}</div>
                  {l.prize && <div className="text-xs text-ssk-blue">🏆 {l.prize}</div>}
                </td>
                <td className="px-4 py-2 text-ssk-muted">
                  {l.starts_on || l.ends_on ? `${l.starts_on ?? "…"} → ${l.ends_on ?? "…"}` : "Hela säsongen"}
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => edit(l)} disabled={pending} className="text-ssk-blue hover:underline">Redigera</button>
                  <button onClick={() => remove(l)} disabled={pending} className="ml-3 text-red-600 hover:underline">Ta bort</button>
                </td>
              </tr>
            ))}
            {leagues.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-ssk-muted">Inga publika ligor ännu.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

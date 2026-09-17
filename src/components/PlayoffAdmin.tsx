"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  adminCreatePlayoff,
  adminStartPlayoff,
  adminSetPlayoffRoundGw,
  adminSettlePlayoffRound,
  adminDeletePlayoff,
} from "@/lib/actions";

type PL = {
  id: string;
  name: string;
  size: number;
  status: string;
  current_round: number;
  total_rounds: number;
};
type GW = { id: string; label: string };

export function PlayoffAdmin({ leagues, gameweeks }: { leagues: PL[]; gameweeks: GW[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [size, setSize] = useState(8);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [gwSel, setGwSel] = useState<Record<string, string>>({});

  async function run(p: Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setMsg(null);
    const r = await p;
    setBusy(false);
    if (!r.ok) setMsg(r.error ?? "Något gick fel.");
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-4">
        <p className="font-semibold">Skapa slutspelsliga</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[180px] flex-1 text-sm">
            Namn
            <input
              className="input mt-1 w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="SSK-slutspelet"
            />
          </label>
          <label className="text-sm">
            Antal deltagare
            <select className="input mt-1 block" value={size} onChange={(e) => setSize(+e.target.value)}>
              {[2, 4, 8, 16, 32].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button disabled={busy} className="btn-primary" onClick={() => run(adminCreatePlayoff(name, size))}>
            Skapa
          </button>
        </div>
        <p className="label">
          Öppen anmälan tills platserna är fyllda. Vid start seedas deltagarna i anmälningsordning.
        </p>
      </div>

      {leagues.map((l) => (
        <div key={l.id} className="card space-y-2 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="font-medium">{l.name}</span>
              <span className="label ml-2">
                {l.status === "open"
                  ? "Anmälan öppen"
                  : l.status === "running"
                  ? `Omgång ${l.current_round}/${l.total_rounds}`
                  : "Avgjord"}{" "}
                · {l.size} platser
              </span>
            </div>
            <button
              className="text-xs text-red-500 hover:underline"
              onClick={() => {
                if (confirm("Ta bort slutspelsligan? Detta går inte att ångra.")) run(adminDeletePlayoff(l.id));
              }}
            >
              Ta bort
            </button>
          </div>

          {l.status === "open" && (
            <button disabled={busy} className="btn-ghost text-sm" onClick={() => run(adminStartPlayoff(l.id))}>
              Starta slutspelet (seeda + skapa omgång 1)
            </button>
          )}

          {l.status === "running" && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="input"
                value={gwSel[l.id] ?? ""}
                onChange={(e) => setGwSel((s) => ({ ...s, [l.id]: e.target.value }))}
              >
                <option value="">Välj speleomgång för omgång {l.current_round}…</option>
                {gameweeks.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
              <button
                disabled={busy || !gwSel[l.id]}
                className="btn-ghost text-sm"
                onClick={() => run(adminSetPlayoffRoundGw(l.id, l.current_round, gwSel[l.id]))}
              >
                Koppla omgång
              </button>
              <button
                disabled={busy}
                className="btn-primary text-sm"
                onClick={() => {
                  if (confirm(`Avgör omgång ${l.current_round}? Vinnare räknas fram ur femmapoängen.`))
                    run(adminSettlePlayoffRound(l.id));
                }}
              >
                Avgör omgång {l.current_round}
              </button>
            </div>
          )}
        </div>
      ))}

      {msg && <p className="text-sm text-red-500">{msg}</p>}
    </div>
  );
}

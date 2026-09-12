"use client";

import { useMemo, useState, useTransition } from "react";
import type { Match, Player, Round } from "@/lib/types";
import { saveEntry, saveTip } from "@/lib/actions";

interface TipState {
  match_id: string;
  pred_ssk: number;
  pred_opp: number;
}

export function FemmaPicker({
  round,
  players,
  matches,
  initialPicks,
  initialGoalie,
  initialTips,
  locked,
}: {
  round: Round;
  players: Player[];
  matches: Match[];
  initialPicks: string[];
  initialGoalie: string | null;
  initialTips: TipState[];
  locked: boolean;
}) {
  const skaters = useMemo(() => players.filter((p) => p.position !== "G"), [players]);
  const goalies = useMemo(() => players.filter((p) => p.position === "G"), [players]);

  const [picks, setPicks] = useState<string[]>(initialPicks);
  const [goalie, setGoalie] = useState<string | null>(initialGoalie);
  const [tips, setTips] = useState<Record<string, { s: string; o: string }>>(() => {
    const m: Record<string, { s: string; o: string }> = {};
    for (const t of initialTips) m[t.match_id] = { s: String(t.pred_ssk), o: String(t.pred_opp) };
    return m;
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function togglePick(id: string) {
    if (locked) return;
    setPicks((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 5 ? [...cur, id] : cur
    );
  }

  function submitEntry() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveEntry(round.id, picks, goalie);
      setMsg(res.ok ? "Femman sparad! ✓" : res.error ?? "Något gick fel.");
    });
  }

  function submitTip(matchId: string) {
    const t = tips[matchId];
    if (!t || t.s === "" || t.o === "") {
      setMsg("Fyll i båda siffrorna för tipset.");
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const res = await saveTip(matchId, parseInt(t.s, 10), parseInt(t.o, 10));
      setMsg(res.ok ? "Tips sparat! ✓" : res.error ?? "Något gick fel.");
    });
  }

  const deadline = new Date(round.deadline);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{round.name ?? `Omgång ${round.number}`}</h1>
          <p className="label">
            Deadline: {deadline.toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        {locked && (
          <span className="rounded-full bg-ssk-dark px-3 py-1 text-xs text-ssk-orange border border-ssk-line">
            Låst
          </span>
        )}
      </header>

      {msg && <div className="card p-3 text-sm">{msg}</div>}

      {/* FEMMA */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Din femma <span className="text-ssk-muted">({picks.length}/5)</span></h2>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {skaters.map((p) => {
            const on = picks.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePick(p.id)}
                disabled={locked || (!on && picks.length >= 5)}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  on
                    ? "border-ssk-orange bg-ssk-orange/10"
                    : "border-ssk-line hover:bg-ssk-dark disabled:opacity-40"
                }`}
              >
                <span>
                  {p.jersey_no ? <span className="text-ssk-muted mr-2">#{p.jersey_no}</span> : null}
                  {p.full_name}
                </span>
                <span className="text-xs text-ssk-muted">{p.position}</span>
              </button>
            );
          })}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Målvakt (gissa vem som startar)</h3>
          <div className="flex flex-wrap gap-2">
            {goalies.map((g) => (
              <button
                key={g.id}
                onClick={() => !locked && setGoalie(goalie === g.id ? null : g.id)}
                disabled={locked}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  goalie === g.id
                    ? "border-ssk-orange bg-ssk-orange/10"
                    : "border-ssk-line hover:bg-ssk-dark"
                }`}
              >
                {g.jersey_no ? `#${g.jersey_no} ` : ""}{g.full_name}
              </button>
            ))}
            {goalies.length === 0 && <p className="label">Inga målvakter i truppen ännu.</p>}
          </div>
        </div>

        <button
          onClick={submitEntry}
          disabled={locked || pending || picks.length !== 5}
          className="btn-primary"
        >
          {pending ? "Sparar…" : "Spara femma"}
        </button>
      </section>

      {/* RESULTATTIPS */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Resultattips</h2>
        {matches.length === 0 && <p className="label">Inga matcher i omgången.</p>}
        <div className="space-y-2">
          {matches.map((m) => {
            const started = new Date(m.starts_at) < new Date() || m.status !== "upcoming";
            const t = tips[m.id] ?? { s: "", o: "" };
            return (
              <div key={m.id} className="card flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="text-sm">
                  <span className="font-medium">
                    {m.is_home ? "SSK" : m.opponent} – {m.is_home ? m.opponent : "SSK"}
                  </span>
                  <span className="ml-2 text-ssk-muted">
                    {new Date(m.starts_at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  {m.status === "final" && (
                    <span className="ml-2 text-ssk-orange">
                      Slut: {m.is_home ? m.ssk_goals : m.opp_goals}–{m.is_home ? m.opp_goals : m.ssk_goals}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="label">{m.is_home ? "SSK" : m.opponent}</span>
                  <input
                    type="number" min={0} max={30}
                    className="input w-14 text-center"
                    value={t.s}
                    disabled={started}
                    onChange={(e) => setTips((c) => ({ ...c, [m.id]: { ...t, s: e.target.value } }))}
                  />
                  <span className="text-ssk-muted">–</span>
                  <input
                    type="number" min={0} max={30}
                    className="input w-14 text-center"
                    value={t.o}
                    disabled={started}
                    onChange={(e) => setTips((c) => ({ ...c, [m.id]: { ...t, o: e.target.value } }))}
                  />
                  <span className="label">{m.is_home ? m.opponent : "SSK"}</span>
                  <button
                    onClick={() => submitTip(m.id)}
                    disabled={started || pending}
                    className="btn-ghost text-sm"
                  >
                    Spara
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

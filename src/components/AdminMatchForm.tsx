"use client";

import { useState, useTransition } from "react";
import type { Match, Player, AdminSkaterLine, AdminGoalieLine } from "@/lib/types";
import { adminSaveMatch } from "@/lib/actions";

const emptySkater = (): AdminSkaterLine => ({
  player_id: "", goals: 0, assists: 0, pp_points: 0, plus_minus: 0, minor_pen: 0, major_pen: 0,
});
const emptyGoalie = (): AdminGoalieLine => ({ player_id: "", saves: 0, goals_against: 0, is_starter: true });

export function AdminMatchForm({ matches, players }: { matches: Match[]; players: Player[] }) {
  const skaterPlayers = players.filter((p) => p.position !== "G");
  const goaliePlayers = players.filter((p) => p.position === "G");

  const [matchId, setMatchId] = useState("");
  const [sskGoals, setSskGoals] = useState(0);
  const [oppGoals, setOppGoals] = useState(0);
  const [overtime, setOvertime] = useState(false);
  const [skaters, setSkaters] = useState<AdminSkaterLine[]>([emptySkater()]);
  const [goalies, setGoalies] = useState<AdminGoalieLine[]>([emptyGoalie()]);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const match = matches.find((m) => m.id === matchId);

  function save() {
    if (!matchId) {
      setMsg("Välj en match.");
      return;
    }
    setMsg(null);
    start(async () => {
      const res = await adminSaveMatch(
        matchId,
        sskGoals,
        oppGoals,
        skaters.filter((s) => s.player_id),
        goalies.filter((g) => g.player_id),
        overtime
      );
      setMsg(res.ok ? "Sparat & poäng omräknad ✓" : res.error ?? "Fel.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-3 p-4">
        <label className="label">Match</label>
        <select className="input w-full" value={matchId} onChange={(e) => setMatchId(e.target.value)}>
          <option value="">— välj match —</option>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              {new Date(m.starts_at).toLocaleDateString("sv-SE")} · {m.is_home ? "SSK" : m.opponent} –{" "}
              {m.is_home ? m.opponent : "SSK"} {m.status === "final" ? "(klar)" : ""}
            </option>
          ))}
        </select>

        {match && (
          <div className="flex items-center gap-3">
            <span className="label">Resultat (SSK):</span>
            <input type="number" min={0} className="input w-16 text-center"
              value={sskGoals} onChange={(e) => setSskGoals(+e.target.value)} />
            <span>–</span>
            <input type="number" min={0} className="input w-16 text-center"
              value={oppGoals} onChange={(e) => setOppGoals(+e.target.value)} />
            <span className="label">({match.opponent})</span>
            <label className="ml-3 flex items-center gap-1 text-sm">
              <input type="checkbox" checked={overtime} onChange={(e) => setOvertime(e.target.checked)} />
              Avgjord på förlängning/straffar (OT/SO)
            </label>
          </div>
        )}
      </div>

      {/* Utespelare */}
      <div className="card space-y-2 p-4">
        <h3 className="font-semibold">Utespelarstatistik</h3>
        <div className="hidden sm:grid grid-cols-[1fr_50px_50px_50px_50px_50px_50px_36px] gap-2 text-xs text-ssk-muted">
          <span>Spelare</span><span>Mål</span><span>Ass</span><span>PP-p</span><span>+/−</span><span>2min</span><span>&gt;2min</span><span></span>
        </div>
        {skaters.map((s, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_50px_50px_50px_50px_50px_50px_36px] gap-2">
            <select className="input" value={s.player_id}
              onChange={(e) => setSkaters((c) => c.map((x, j) => j === i ? { ...x, player_id: e.target.value } : x))}>
              <option value="">— spelare —</option>
              {skaterPlayers.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
            {(["goals", "assists", "pp_points", "plus_minus", "minor_pen", "major_pen"] as const).map((f) => (
              <input key={f} type="number" className="input text-center" value={(s as any)[f]}
                onChange={(e) => setSkaters((c) => c.map((x, j) => j === i ? { ...x, [f]: +e.target.value } : x))} />
            ))}
            <button className="text-ssk-muted hover:text-red-400"
              onClick={() => setSkaters((c) => c.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="btn-ghost text-sm" onClick={() => setSkaters((c) => [...c, emptySkater()])}>
          + Rad
        </button>
      </div>

      {/* Målvakter */}
      <div className="card space-y-2 p-4">
        <h3 className="font-semibold">Målvakter</h3>
        <div className="hidden sm:grid grid-cols-[1fr_80px_80px_80px_40px] gap-2 text-xs text-ssk-muted">
          <span>Målvakt</span><span>Räddn.</span><span>Insläppta</span><span>Startade</span><span></span>
        </div>
        {goalies.map((g, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_80px_80px_80px_40px] gap-2 items-center">
            <select className="input" value={g.player_id}
              onChange={(e) => setGoalies((c) => c.map((x, j) => j === i ? { ...x, player_id: e.target.value } : x))}>
              <option value="">— målvakt —</option>
              {goaliePlayers.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
            <input type="number" min={0} className="input text-center" value={g.saves}
              onChange={(e) => setGoalies((c) => c.map((x, j) => j === i ? { ...x, saves: +e.target.value } : x))} />
            <input type="number" min={0} className="input text-center" value={g.goals_against}
              onChange={(e) => setGoalies((c) => c.map((x, j) => j === i ? { ...x, goals_against: +e.target.value } : x))} />
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={g.is_starter}
                onChange={(e) => setGoalies((c) => c.map((x, j) => j === i ? { ...x, is_starter: e.target.checked } : x))} />
              start
            </label>
            <button className="text-ssk-muted hover:text-red-400"
              onClick={() => setGoalies((c) => c.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="btn-ghost text-sm" onClick={() => setGoalies((c) => [...c, emptyGoalie()])}>
          + Rad
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending} className="btn-primary">
          {pending ? "Sparar…" : "Spara match & räkna om poäng"}
        </button>
        {msg && <span className="text-sm text-ssk-orange">{msg}</span>}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import type { Match, Player, Round } from "@/lib/types";
import { saveEntry, saveTips } from "@/lib/actions";
import { Jersey } from "./Jersey";
import { SKATER_2526, GOALIE_2526 } from "@/lib/player-stats-2526";

function skaterStatLine(name: string): string {
  const s = SKATER_2526[name];
  return s ? `’25/26: ${s.g}+${s.a}=${s.tp}p · ${s.gp} GP` : "Ny i klubben";
}
function goalieStatLine(name: string): string {
  const g = GOALIE_2526[name];
  return g ? `’25/26: ${g.gp} M · ${(g.svs * 100).toFixed(1)}% · ${g.gaa.toFixed(2)} GAA` : "Ny i klubben";
}

function isoWeekOf(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return { year: date.getUTCFullYear(), week };
}

interface TipState {
  match_id: string;
  pred_ssk: number;
  pred_opp: number;
}

const MAX_D = 2;
const MAX_F = 3;

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
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const backs = useMemo(() => players.filter((p) => p.position === "D"), [players]);
  const forwards = useMemo(() => players.filter((p) => p.position === "F"), [players]);
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
  const [showAllTips, setShowAllTips] = useState(false);
  const [tab, setTab] = useState<"femma" | "tips">("femma");

  // Gruppera tips-matcher per omgång (ISO-vecka); visa bara närmaste 3 som standard.
  const tipGroups = useMemo(() => {
    const map = new Map<string, { label: string; list: Match[] }>();
    for (const m of matches) {
      const d = new Date(m.starts_at);
      const { year, week } = isoWeekOf(d);
      const key = `${year}-${String(week).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, { label: `Omgång v${week}`, list: [] });
      map.get(key)!.list.push(m);
    }
    return Array.from(map.values());
  }, [matches]);
  const visibleGroups = showAllTips ? tipGroups : tipGroups.slice(0, 3);

  const pickedBacks = picks.filter((id) => byId.get(id)?.position === "D");
  const pickedForwards = picks.filter((id) => byId.get(id)?.position === "F");
  const complete = pickedBacks.length === MAX_D && pickedForwards.length === MAX_F;

  function togglePick(p: Player) {
    if (locked) return;
    setPicks((cur) => {
      if (cur.includes(p.id)) return cur.filter((x) => x !== p.id);
      const count = cur.filter((id) => byId.get(id)?.position === p.position).length;
      const cap = p.position === "D" ? MAX_D : MAX_F;
      return count < cap ? [...cur, p.id] : cur;
    });
  }

  function submitEntry() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveEntry(round.id, picks, goalie);
      setMsg(res.ok ? "Femman sparad! ✓" : res.error ?? "Något gick fel.");
    });
  }

  const filledTipCount = Object.values(tips).filter((v) => v.s !== "" && v.o !== "").length;

  function submitAllTips() {
    const items = Object.entries(tips)
      .filter(([, v]) => v.s !== "" && v.o !== "")
      .map(([matchId, v]) => ({ matchId, predSsk: parseInt(v.s, 10), predOpp: parseInt(v.o, 10) }))
      .filter((it) => Number.isFinite(it.predSsk) && Number.isFinite(it.predOpp));
    if (!items.length) {
      setMsg("Fyll i minst ett tips först.");
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const res = await saveTips(items);
      setMsg(res.ok ? `Sparade ${res.saved} tips ✓` : res.error ?? "Något gick fel.");
    });
  }

  const deadline = new Date(round.deadline);
  const surname = (p?: Player) => (p ? p.full_name.split(" ").slice(-1)[0] : "");

  const fwSlots = [...pickedForwards.map((id) => byId.get(id)!), ...Array(Math.max(0, MAX_F - pickedForwards.length)).fill(null)];
  const dSlots = [...pickedBacks.map((id) => byId.get(id)!), ...Array(Math.max(0, MAX_D - pickedBacks.length)).fill(null)];
  const gSlot = goalie ? byId.get(goalie) ?? null : null;

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
          <span className="rounded-full bg-ssk-navy px-3 py-1 text-xs font-medium text-ssk-yellow">
            Låst
          </span>
        )}
      </header>

      {msg && <div className="card p-3 text-sm">{msg}</div>}

      {/* Flikar */}
      <div className="flex gap-1 rounded-lg border border-ssk-line bg-ssk-cream p-1 text-sm">
        <button
          onClick={() => setTab("femma")}
          className={`flex-1 rounded-md px-3 py-2 font-medium transition-colors ${
            tab === "femma" ? "bg-ssk-blue text-white" : "text-ssk-ink hover:bg-ssk-goldSoft"
          }`}
        >
          Din femma
        </button>
        <button
          onClick={() => setTab("tips")}
          className={`flex-1 rounded-md px-3 py-2 font-medium transition-colors ${
            tab === "tips" ? "bg-ssk-blue text-white" : "text-ssk-ink hover:bg-ssk-goldSoft"
          }`}
        >
          Resultattips{filledTipCount > 0 ? ` (${filledTipCount})` : ""}
        </button>
      </div>

      {/* FEMMA: lista vänster, rink höger */}
      {tab === "femma" && (
      <section>
        <div className="mb-4 flex items-center justify-between border-b border-ssk-line pb-2">
          <h2 className="text-lg font-semibold">Din femma</h2>
          <span className="label">
            Backar {pickedBacks.length}/{MAX_D} · Forwards {pickedForwards.length}/{MAX_F}
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* VÄNSTER: val */}
          <div className="space-y-6">
            <PickSection title="Backar" count={pickedBacks.length} max={MAX_D}
              players={backs} picks={picks} locked={locked} onToggle={togglePick} />
            <PickSection title="Forwards" count={pickedForwards.length} max={MAX_F}
              players={forwards} picks={picks} locked={locked} onToggle={togglePick} />

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Målvakt (gissa vem som startar)</h3>
              <div className="flex flex-wrap gap-2">
                {goalies.map((g) => (
                  <button key={g.id}
                    onClick={() => !locked && setGoalie(goalie === g.id ? null : g.id)}
                    disabled={locked}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition-colors ${
                      goalie === g.id
                        ? "border-ssk-blue bg-ssk-blue/10 ring-1 ring-ssk-blue"
                        : "border-ssk-line bg-ssk-cream hover:border-ssk-blue hover:bg-ssk-goldSoft"
                    }`}>
                    <Jersey number={g.jersey_no} size={24} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] leading-tight">{g.full_name}</span>
                      <span className="block text-[10px] leading-tight text-ssk-muted">{goalieStatLine(g.full_name)}</span>
                    </span>
                  </button>
                ))}
                {goalies.length === 0 && <p className="label">Inga målvakter i truppen ännu.</p>}
              </div>
            </div>

            <button onClick={submitEntry} disabled={locked || pending || !complete} className="btn-primary w-full sm:w-auto">
              {pending ? "Sparar…" : "Spara femma"}
            </button>
          </div>

          {/* HÖGER: rink */}
          <div className="lg:sticky lg:top-4 h-fit">
            <div className="relative overflow-hidden rounded-2xl border border-ssk-line"
              style={{ background: "linear-gradient(180deg,#eef4fb,#dde9f6)" }}>
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-red-500/70" />
                <div className="absolute inset-x-0 top-[28%] h-[2px] bg-blue-600/50" />
                <div className="absolute inset-x-0 top-[72%] h-[2px] bg-blue-600/50" />
                <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-500/40" />
                <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/60" />
              </div>
              <div className="relative z-10 space-y-5 px-3 py-6">
                <RinkRow label="Forward" slots={fwSlots} surname={surname} />
                <RinkRow label="Back" slots={dSlots} surname={surname} />
                <RinkRow label="Målvakt" slots={[gSlot]} surname={surname} goalie />
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* RESULTATTIPS */}
      {tab === "tips" && (
      <section className="space-y-3">
        <h2 className="border-b border-ssk-line pb-2 text-lg font-semibold">Resultattips</h2>
        <p className="label">
          Tippa resultatet efter <b>ordinarie tid</b> (60 min). Lika resultat = matchen går till
          förlängning. Rätt utfall +2, exakt resultat +4. Fyll i de matcher du vill och spara alla
          på en gång med knappen längst ner.
        </p>
        {tipGroups.length === 0 && <p className="label">Inga kommande matcher.</p>}

        {visibleGroups.map((group) => (
          <div key={group.label} className="space-y-2">
            <h3 className="pt-2 text-sm font-semibold text-ssk-blue">{group.label}</h3>
            {group.list.map((m) => {
              const started = new Date(m.starts_at) < new Date() || m.status !== "upcoming";
              const t = tips[m.id] ?? { s: "", o: "" };
              const home = m.is_home ? "SSK" : m.opponent;
              const away = m.is_home ? m.opponent : "SSK";
              const when = new Date(m.starts_at).toLocaleString("sv-SE", {
                weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
              });
              return (
                <div key={m.id} className="card grid items-center gap-3 p-3 sm:grid-cols-[1fr_auto]">
                  <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                    <span className="min-w-0 flex-1 truncate text-right text-sm font-semibold">{home}</span>
                    <input type="number" min={0} max={30} inputMode="numeric" className="input w-11 shrink-0 px-1 text-center" value={t.s}
                      disabled={started}
                      onChange={(e) => setTips((c) => ({ ...c, [m.id]: { ...t, s: e.target.value } }))} />
                    <span className="shrink-0 text-ssk-muted">–</span>
                    <input type="number" min={0} max={30} inputMode="numeric" className="input w-11 shrink-0 px-1 text-center" value={t.o}
                      disabled={started}
                      onChange={(e) => setTips((c) => ({ ...c, [m.id]: { ...t, o: e.target.value } }))} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{away}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="text-xs text-ssk-muted sm:text-sm">{when}</span>
                    {started && <span className="shrink-0 text-xs font-medium text-ssk-muted">Låst</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {!showAllTips && tipGroups.length > 3 && (
          <button onClick={() => setShowAllTips(true)} className="btn-ghost w-full text-sm">
            Visa fler omgångar ({tipGroups.length - 3} till)
          </button>
        )}

        {tipGroups.length > 0 && (
          <div className="sticky bottom-2 z-20 pt-2">
            <button
              onClick={submitAllTips}
              disabled={pending || filledTipCount === 0}
              className="btn-primary w-full shadow-lg"
            >
              {pending ? "Sparar…" : `Spara alla tips${filledTipCount > 0 ? ` (${filledTipCount})` : ""}`}
            </button>
          </div>
        )}
      </section>
      )}
    </div>
  );
}

function RinkRow({
  label,
  slots,
  surname,
  goalie = false,
}: {
  label: string;
  slots: (Player | null)[];
  surname: (p?: Player) => string;
  goalie?: boolean;
}) {
  return (
    <div className="flex items-start justify-center gap-3 sm:gap-6">
      {slots.map((p, i) => (
        <div key={i} className="flex w-20 flex-col items-center gap-1">
          {p ? (
            <>
              <Jersey number={p.jersey_no} size={goalie ? 58 : 52} />
              <span className="max-w-full truncate rounded bg-ssk-black/85 px-1.5 py-0.5 text-[11px] leading-tight text-white">
                {p.jersey_no ? `${p.jersey_no} ` : ""}{surname(p)}
              </span>
            </>
          ) : (
            <>
              <div className="rounded-full border-2 border-dashed border-black/25"
                style={{ height: goalie ? 58 : 52, width: goalie ? 58 : 52 }} />
              <span className="text-[11px] font-medium text-black/45">{label}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function PickSection({
  title,
  count,
  max,
  players,
  picks,
  locked,
  onToggle,
}: {
  title: string;
  count: number;
  max: number;
  players: Player[];
  picks: string[];
  locked: boolean;
  onToggle: (p: Player) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between border-b border-ssk-line pb-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="label">{count}/{max}</span>
      </div>
      <div className="grid gap-2">
        {players.map((p) => {
          const on = picks.includes(p.id);
          return (
            <button key={p.id} onClick={() => onToggle(p)}
              disabled={locked || (!on && count >= max)}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                on
                  ? "border-ssk-blue bg-ssk-blue/10 ring-1 ring-ssk-blue"
                  : "border-ssk-line bg-ssk-cream hover:border-ssk-blue hover:bg-ssk-goldSoft disabled:opacity-40"
              }`}>
              <Jersey number={p.jersey_no} size={22} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] leading-tight">{p.full_name}</span>
                <span className="block text-[10px] leading-tight text-ssk-muted">{skaterStatLine(p.full_name)}</span>
              </span>
            </button>
          );
        })}
        {players.length === 0 && <p className="label">Inga spelare i truppen ännu.</p>}
      </div>
    </section>
  );
}

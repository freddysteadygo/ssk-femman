"use client";

import { useMemo, useState, useTransition } from "react";
import type { Match, Player, Round } from "@/lib/types";
import { saveEntry, saveTips } from "@/lib/actions";
import { Jersey } from "./Jersey";

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

export interface LastRoundSummary {
  name: string;
  femmaPoints: number;
  tipPoints: number;
  rows: {
    id: string;
    name: string;
    jersey: number | null;
    role: string;
    points: number;
    captain: boolean;
  }[];
}

/** 4 → "4", 4.5 → "4,5". Svenskt decimaltecken, inga onödiga nollor. */
function pts(n: number | undefined): string {
  const v = n ?? 0;
  return (Math.round(v * 10) / 10).toLocaleString("sv-SE");
}

const MAX_D = 2;
const MAX_F = 3;

export function FemmaPicker({
  round,
  players,
  matches,
  initialPicks,
  initialGoalie,
  initialCaptain,
  initialTips,
  locked,
  carriedOver,
  pointsLast,
  pointsSeason,
  lastRound,
}: {
  round: Round;
  players: Player[];
  matches: Match[];
  initialPicks: string[];
  initialGoalie: string | null;
  initialCaptain: string | null;
  initialTips: TipState[];
  locked: boolean;
  carriedOver: boolean;
  pointsLast: Record<string, number>;
  pointsSeason: Record<string, number>;
  lastRound: LastRoundSummary | null;
}) {
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const backs = useMemo(() => players.filter((p) => p.position === "D"), [players]);
  const forwards = useMemo(() => players.filter((p) => p.position === "F"), [players]);
  const goalies = useMemo(() => players.filter((p) => p.position === "G"), [players]);

  const [picks, setPicks] = useState<string[]>(initialPicks);
  const [goalie, setGoalie] = useState<string | null>(initialGoalie);
  const [captain, setCaptain] = useState<string | null>(initialCaptain);
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
    // Plockar man bort kaptenen ur femman faller kaptensbindeln bort.
    if (captain === p.id) setCaptain(null);
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
      const res = await saveEntry(round.id, picks, goalie, captain);
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
            Deadline: {deadline.toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Stockholm" })}
          </p>
        </div>
        {locked && (
          <span className="rounded-full bg-ssk-navy px-3 py-1 text-xs font-medium text-ssk-yellow">
            Låst
          </span>
        )}
      </header>

      {carriedOver && !locked && (
        <div className="card border-ssk-blue/40 bg-ssk-goldSoft p-3 text-sm">
          <b>Din femma följde med från förra omgången.</b> Du behöver inte göra något —
          ändra bara om du vill, och spara.
        </div>
      )}

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
        {lastRound && (
          <div className="card mb-6 p-4">
            <div className="flex items-baseline justify-between gap-3 border-b border-ssk-line pb-2">
              <h3 className="font-semibold">Så gick det i {lastRound.name}</h3>
              <span className="text-xl font-extrabold tabular-nums text-ssk-blue">
                {pts(lastRound.femmaPoints + lastRound.tipPoints)} p
              </span>
            </div>

            {lastRound.rows.length === 0 ? (
              <p className="label mt-3">Du hade ingen femma den omgången.</p>
            ) : (
              <ul className="mt-1 divide-y divide-ssk-line text-sm">
                {lastRound.rows.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-6 shrink-0 text-right text-[11px] tabular-nums text-ssk-muted">
                        {r.jersey ?? ""}
                      </span>
                      <span className="truncate">{r.name}</span>
                      {r.captain && (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-ssk-yellow text-[10px] font-extrabold text-ssk-navy">
                          C
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="hidden text-[11px] text-ssk-muted sm:inline">{r.role}</span>
                      <span className="w-14 text-right font-semibold tabular-nums">{pts(r.points)} p</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex justify-between border-t border-ssk-line pt-2 text-sm">
              <span className="text-ssk-muted">Femman {pts(lastRound.femmaPoints)} p · Resultattips {pts(lastRound.tipPoints)} p</span>
            </div>
          </div>
        )}

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
              players={backs} picks={picks} locked={locked} onToggle={togglePick}
              pointsLast={pointsLast} pointsSeason={pointsSeason} />
            <PickSection title="Forwards" count={pickedForwards.length} max={MAX_F}
              players={forwards} picks={picks} locked={locked} onToggle={togglePick}
              pointsLast={pointsLast} pointsSeason={pointsSeason} />

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
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] leading-tight">{g.full_name}</span>
                    </span>
                    <PointsChip last={pointsLast[g.id]} season={pointsSeason[g.id]} />
                  </button>
                ))}
                {goalies.length === 0 && <p className="label">Inga målvakter i truppen ännu.</p>}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Kapten (dubbla poäng)</h3>
              {picks.length === 0 ? (
                <p className="label">Välj din femma först — sedan utser du kapten.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {picks.map((id) => byId.get(id)).filter((p): p is Player => !!p).map((p) => (
                      <button key={p.id}
                        onClick={() => !locked && setCaptain(captain === p.id ? null : p.id)}
                        disabled={locked}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition-colors ${
                          captain === p.id
                            ? "border-ssk-blue bg-ssk-blue/10 ring-1 ring-ssk-blue"
                            : "border-ssk-line bg-ssk-cream hover:border-ssk-blue hover:bg-ssk-goldSoft"
                        }`}>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                          captain === p.id ? "bg-ssk-yellow text-ssk-navy" : "bg-ssk-line text-ssk-muted"
                        }`}>C</span>
                        <span className="truncate text-[13px] leading-tight">{p.full_name}</span>
                      </button>
                    ))}
                  </div>
                  <p className="label">
                    Kaptenens poäng räknas dubbelt — även minuspoäng. Frivilligt, och låses vid deadline.
                  </p>
                </>
              )}
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
                <RinkRow label="Forward" slots={fwSlots} surname={surname} captainId={captain} />
                <RinkRow label="Back" slots={dSlots} surname={surname} captainId={captain} />
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
                timeZone: "Europe/Stockholm",
              });
              return (
                <div key={m.id} className="card grid items-center gap-3 p-3 sm:grid-cols-[1fr_auto]">
                  <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                    <span className="min-w-0 flex-1 truncate text-right text-sm font-semibold">{home}</span>
                    <input type="number" min={0} max={30} inputMode="numeric" className="score-input" value={t.s}
                      disabled={started}
                      onChange={(e) => setTips((c) => ({ ...c, [m.id]: { ...t, s: e.target.value } }))} />
                    <span className="shrink-0 text-ssk-muted">–</span>
                    <input type="number" min={0} max={30} inputMode="numeric" className="score-input" value={t.o}
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
  captainId = null,
}: {
  label: string;
  slots: (Player | null)[];
  surname: (p?: Player) => string;
  goalie?: boolean;
  captainId?: string | null;
}) {
  return (
    <div className="flex items-start justify-center gap-3 sm:gap-6">
      {slots.map((p, i) => (
        <div key={i} className="flex w-20 flex-col items-center gap-1">
          {p ? (
            <>
              <span className="relative inline-block">
                <Jersey number={p.jersey_no} size={goalie ? 58 : 52} />
                {captainId === p.id && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ssk-yellow text-[11px] font-extrabold text-ssk-navy ring-2 ring-white">
                    C
                  </span>
                )}
              </span>
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

function PointsChip({ last, season }: { last?: number; season?: number }) {
  const has = (season ?? 0) !== 0 || (last ?? 0) !== 0;
  return (
    <span className="shrink-0 text-right leading-tight">
      <span className={`block text-[13px] font-bold tabular-nums ${has ? "text-ssk-blue" : "text-ssk-muted"}`}>
        {pts(season)} p
      </span>
      <span className="block text-[10px] tabular-nums text-ssk-muted">senast {pts(last)}</span>
    </span>
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
  pointsLast,
  pointsSeason,
}: {
  title: string;
  count: number;
  max: number;
  players: Player[];
  picks: string[];
  locked: boolean;
  onToggle: (p: Player) => void;
  pointsLast: Record<string, number>;
  pointsSeason: Record<string, number>;
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
              <span className="min-w-0 flex-1 truncate text-[13px] leading-tight">{p.full_name}</span>
              <PointsChip last={pointsLast[p.id]} season={pointsSeason[p.id]} />
            </button>
          );
        })}
        {players.length === 0 && <p className="label">Inga spelare i truppen ännu.</p>}
      </div>
    </section>
  );
}

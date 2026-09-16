import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

type Row = { name: string; total: number };

function nameOf(p: any): string {
  return p?.team_name || p?.username || "—";
}

async function leagueTop(admin: any, league: any, limit = 5): Promise<Row[]> {
  const { data: members } = await admin
    .from("league_members")
    .select("user_id, profiles(username, team_name)")
    .eq("league_id", league.id);
  const ids = (members ?? []).map((m: any) => m.user_id);
  if (!ids.length) return [];

  const inRange = (iso?: string | null) => {
    if (!league.starts_on && !league.ends_on) return true;
    const d = (iso ?? "").slice(0, 10);
    if (league.starts_on && d < league.starts_on) return false;
    if (league.ends_on && d > league.ends_on) return false;
    return true;
  };

  const totals = new Map<string, number>();
  for (const id of ids) totals.set(id, 0);

  const { data: entries } = await admin
    .from("entries")
    .select("user_id, points, rounds(deadline)")
    .in("user_id", ids);
  for (const e of entries ?? [])
    if (inRange((e as any).rounds?.deadline)) totals.set(e.user_id, (totals.get(e.user_id) ?? 0) + Number(e.points));

  const { data: tips } = await admin
    .from("result_tips")
    .select("user_id, points, matches(starts_at)")
    .in("user_id", ids);
  for (const t of tips ?? [])
    if (inRange((t as any).matches?.starts_at)) totals.set(t.user_id, (totals.get(t.user_id) ?? 0) + Number(t.points));

  return (members ?? [])
    .map((m: any) => ({ name: nameOf(m.profiles), total: totals.get(m.user_id) ?? 0 }))
    .sort((a: Row, b: Row) => b.total - a.total)
    .slice(0, limit);
}

function RankList({ rows, empty }: { rows: Row[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-ssk-muted">{empty}</p>;
  return (
    <ol className="space-y-1.5">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center justify-between gap-3 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i === 0 ? "bg-ssk-yellow text-ssk-navy" : "bg-ssk-goldSoft text-ssk-ink"
              }`}
            >
              {i + 1}
            </span>
            <span className="truncate">{r.name}</span>
          </span>
          <span className="shrink-0 font-semibold tabular-nums">{r.total.toFixed(1)}</span>
        </li>
      ))}
    </ol>
  );
}

export default async function Scoreboard({ showCta = true }: { showCta?: boolean }) {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);

  const { data: pastRounds } = await admin
    .from("rounds")
    .select("id, number, name, deadline")
    .lt("deadline", nowIso)
    .order("deadline", { ascending: false })
    .limit(1);
  const lastRound = (pastRounds ?? [])[0] ?? null;
  const lastRoundTitle = lastRound ? lastRound.name ?? `Omgång ${lastRound.number}` : null;

  let topPlayers: Row[] = [];
  let topTeams: Row[] = [];
  if (lastRound) {
    const { data: rMatches } = await admin.from("matches").select("id").eq("round_id", lastRound.id);
    const matchIds = (rMatches ?? []).map((m: any) => m.id);
    if (matchIds.length) {
      const { data: pms } = await admin
        .from("player_match_stats")
        .select("player_id, points, players(full_name)")
        .in("match_id", matchIds);
      const byPlayer = new Map<string, Row>();
      for (const s of pms ?? []) {
        const cur = byPlayer.get(s.player_id) ?? { name: (s as any).players?.full_name ?? "—", total: 0 };
        cur.total += Number(s.points);
        byPlayer.set(s.player_id, cur);
      }
      topPlayers = [...byPlayer.values()].sort((a, b) => b.total - a.total).slice(0, 5);
    }
    const { data: entries } = await admin
      .from("entries")
      .select("points, profiles(username, team_name)")
      .eq("round_id", lastRound.id)
      .order("points", { ascending: false })
      .limit(5);
    topTeams = (entries ?? []).map((e: any) => ({ name: nameOf(e.profiles), total: Number(e.points) }));
  }

  const { data: publicLeagues } = await admin
    .from("leagues")
    .select("id, name, prize, starts_on, ends_on")
    .eq("type", "public");
  const timeboxed = (publicLeagues ?? []).filter((l: any) => l.starts_on || l.ends_on);
  const active =
    timeboxed
      .filter((l: any) => (!l.starts_on || l.starts_on <= today) && (!l.ends_on || l.ends_on >= today))
      .sort((a: any, b: any) => (b.starts_on ?? "").localeCompare(a.starts_on ?? ""))[0] ??
    timeboxed.sort((a: any, b: any) => (a.starts_on ?? "").localeCompare(b.starts_on ?? ""))[0] ??
    null;
  const season = (publicLeagues ?? []).find((l: any) => !l.starts_on && !l.ends_on) ?? null;

  const activeTop = active ? await leagueTop(admin, active, 5) : [];
  const seasonTop = season ? await leagueTop(admin, season, 5) : [];

  const noResultsYet = "Ingen avslutad omgång ännu — kika tillbaka efter första matcherna! 🏒";

  return (
    <div className="space-y-4">
      <p className="label">
        {lastRoundTitle ? `Senaste avgjorda omgången: ${lastRoundTitle}` : "Säsongen är på väg att dra igång."}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3 p-5">
          <h2 className="font-semibold text-ssk-blue">⭐ Bästa SSK-spelaren – senaste omgången</h2>
          <RankList rows={topPlayers} empty={noResultsYet} />
        </div>

        <div className="card space-y-3 p-5">
          <h2 className="font-semibold text-ssk-blue">🏆 Bästa laget – senaste omgången</h2>
          <RankList rows={topTeams} empty={noResultsYet} />
        </div>

        <div className="card space-y-3 p-5">
          <h2 className="font-semibold text-ssk-blue">
            🔥 Topp 5 – {active ? active.name : "aktuell SSK5-liga"}
          </h2>
          {active?.prize && <p className="-mt-1 text-xs font-medium text-ssk-navy">🎁 {active.prize}</p>}
          <RankList rows={activeTop} empty="Inga deltagare ännu — bli först!" />
          {active && (
            <Link href={`/ligor/${active.id}`} className="inline-block text-xs text-ssk-blue hover:underline">
              Hela ligan →
            </Link>
          )}
        </div>

        <div className="card space-y-3 p-5">
          <h2 className="font-semibold text-ssk-blue">👑 Topp 5 – {season ? season.name : "säsongsligan"}</h2>
          <RankList rows={seasonTop} empty="Inga deltagare ännu — bli först!" />
          {season && (
            <Link href={`/ligor/${season.id}`} className="inline-block text-xs text-ssk-blue hover:underline">
              Hela ligan →
            </Link>
          )}
        </div>
      </div>

      {showCta && (
        <div className="card flex flex-col items-center gap-3 p-6 text-center">
          <p className="font-semibold">Vill du klättra på listan?</p>
          <p className="text-sm text-ssk-muted">Det är gratis och det är aldrig för sent att hoppa in.</p>
          <Link href="/spela" className="btn-primary">Fixa din femma</Link>
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PlayoffJoinButton } from "@/components/PlayoffJoinButton";
import { roundLabel } from "@/lib/playoff";

export const dynamic = "force-dynamic";

export default async function PlayoffBracketPage({ params }: { params: { id: string } }) {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const { data: league } = await sb.from("playoff_leagues").select("*").eq("id", params.id).maybeSingle();
  if (!league) return <div className="card p-6">Slutspelsligan finns inte.</div>;

  const { data: parts } = await sb
    .from("playoff_participants")
    .select("user_id, seed, eliminated_round, profiles(username, team_name)")
    .eq("league_id", params.id)
    .order("seed", { ascending: true, nullsFirst: false });

  const { data: matchups } = await sb
    .from("playoff_matchups")
    .select("*")
    .eq("league_id", params.id)
    .order("round", { ascending: true })
    .order("slot", { ascending: true });

  const nameOf = new Map<string, string>();
  for (const p of parts ?? []) {
    const prof: any = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
    nameOf.set(p.user_id, prof?.team_name || prof?.username || "Spelare");
  }
  const display = (uid: string | null) => (uid ? nameOf.get(uid) ?? "Spelare" : "—");

  const count = (parts ?? []).length;
  const isMember = !!(parts ?? []).find((p) => p.user_id === user?.id);

  const rounds = new Map<number, any[]>();
  for (const m of matchups ?? []) {
    const a = rounds.get(m.round) ?? [];
    a.push(m);
    rounds.set(m.round, a);
  }

  const statusText =
    league.status === "open"
      ? "Anmälan öppen"
      : league.status === "running"
      ? `Pågår — omgång ${league.current_round}/${league.total_rounds}`
      : "Avgjord";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/slutspel" className="label hover:text-ssk-ink">← Alla slutspel</Link>
        <h1 className="mt-1 text-2xl font-bold">{league.name}</h1>
        <p className="label">
          {statusText} · {count}/{league.size} deltagare
        </p>
      </div>

      {league.status === "open" && (
        <div className="card flex flex-col items-center gap-3 p-5 text-center">
          {!user ? (
            <>
              <p className="text-sm">Logga in för att anmäla dig till slutspelet.</p>
              <Link href="/login" className="btn-primary">Logga in</Link>
            </>
          ) : (
            <PlayoffJoinButton leagueId={league.id} joined={isMember} full={!isMember && count >= league.size} />
          )}
        </div>
      )}

      {(matchups ?? []).length === 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Anmälda ({count})</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {(parts ?? []).map((p, i) => (
              <div key={p.user_id} className="card p-3 text-sm">
                {i + 1}. {display(p.user_id)}
              </div>
            ))}
            {count === 0 && <p className="label">Inga anmälda än.</p>}
          </div>
        </section>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-4 pb-2">
            {[...rounds.keys()]
              .sort((a, b) => a - b)
              .map((rn) => {
                const ms = rounds.get(rn)!;
                return (
                  <div key={rn} className="w-56 shrink-0 space-y-3">
                    <h3 className="text-center text-sm font-semibold text-ssk-blue">{roundLabel(ms.length)}</h3>
                    {ms.map((m) => (
                      <div key={m.id} className="card overflow-hidden text-sm">
                        {[
                          { u: m.p1_user, p: m.p1_points },
                          { u: m.p2_user, p: m.p2_points },
                        ].map((side, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center justify-between px-3 py-2 ${
                              m.winner_user && m.winner_user === side.u ? "bg-ssk-goldSoft font-semibold" : ""
                            } ${idx === 0 ? "border-b border-ssk-line" : ""}`}
                          >
                            <span className="truncate">{display(side.u)}</span>
                            <span className="ml-2 tabular-nums text-ssk-muted">{side.p != null ? side.p : ""}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadRoundDetail } from "@/lib/round-history";
import { RoundParticipants } from "@/components/RoundParticipants";

export const dynamic = "force-dynamic";

const pts = (n: number) => (Math.round(n * 10) / 10).toLocaleString("sv-SE");

const SITUATION: Record<string, string> = {
  PP: "PP",
  SH: "BX",
  PS: "straff",
  EN: "tomt mål",
};

export default async function OmgangPage({ params }: { params: { id: string } }) {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const data = await loadRoundDetail(params.id, user.id);
  if (!data) {
    return (
      <div className="card p-6">
        <h1 className="text-xl font-bold">Omgången är inte öppen än</h1>
        <p className="mt-2 text-sm text-ssk-muted">
          Omgångar visas först när deadline passerat — annars skulle man kunna se andras
          femmor innan man låst sin egen.
        </p>
        <Link href="/omgangar" className="label mt-3 inline-block hover:text-ssk-ink">
          ← Alla omgångar
        </Link>
      </div>
    );
  }

  const { round, participants } = data;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/omgangar" className="label hover:text-ssk-ink">
          ← Alla omgångar
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold">{round.name}</h1>
          {round.myTotal != null && (
            <span className="text-xl font-extrabold tabular-nums text-ssk-blue">
              Din poäng: {pts(round.myTotal)}
            </span>
          )}
        </div>
      </div>

      {/* MATCHERNA */}
      <section className="space-y-3">
        <h2 className="border-b border-ssk-line pb-2 text-lg font-semibold">Matcherna</h2>
        {round.matches.map((m) => {
          const home = m.isHome ? "SSK" : m.opponent;
          const away = m.isHome ? m.opponent : "SSK";
          const hg = m.isHome ? m.sskGoals : m.oppGoals;
          const ag = m.isHome ? m.oppGoals : m.sskGoals;
          const spelad = m.status === "final" && hg != null && ag != null;
          const when = new Date(m.startsAt).toLocaleString("sv-SE", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Stockholm",
          });

          return (
            <div key={m.id} className="card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ssk-line pb-2">
                <span className="font-semibold">
                  {home} – {away}
                </span>
                <span className="flex items-baseline gap-2">
                  {(m.result === "OTW" || m.result === "OTL") && (
                    <span className="text-[11px] text-ssk-muted">efter förlängning</span>
                  )}
                  <span className="text-lg font-extrabold tabular-nums">
                    {spelad ? `${hg}–${ag}` : "–"}
                  </span>
                </span>
              </div>
              <p className="label mt-1">{when}</p>

              {m.goals.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {m.goals.map((g, i) => (
                    <li
                      key={i}
                      className={`flex gap-2 ${g.isSsk ? "" : "text-ssk-muted"}`}
                    >
                      <span className="w-12 shrink-0 tabular-nums text-ssk-muted">{g.time}</span>
                      <span className="min-w-0">
                        <b className={g.isSsk ? "text-ssk-ink" : "font-normal"}>{g.scorer}</b>
                        {g.assists.length > 0 && (
                          <span className="text-ssk-muted"> ({g.assists.join(", ")})</span>
                        )}
                        {SITUATION[g.situation] && (
                          <span className="ml-1 text-[11px] text-ssk-muted">
                            {SITUATION[g.situation]}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                spelad && <p className="label mt-2">Inga målhändelser sparade för matchen.</p>
              )}
            </div>
          );
        })}
        {round.matches.length === 0 && <p className="label">Inga matcher i omgången.</p>}
      </section>

      {/* DELTAGARNA */}
      <RoundParticipants participants={participants} />
    </div>
  );
}

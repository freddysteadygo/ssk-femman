import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadRoundList } from "@/lib/round-history";

export const dynamic = "force-dynamic";
export const metadata = { title: "Omgångar · SSK-femman" };

const pts = (n: number) => (Math.round(n * 10) / 10).toLocaleString("sv-SE");

function matchLine(m: {
  opponent: string;
  isHome: boolean;
  sskGoals: number | null;
  oppGoals: number | null;
}) {
  const home = m.isHome ? "SSK" : m.opponent;
  const away = m.isHome ? m.opponent : "SSK";
  const hg = m.isHome ? m.sskGoals : m.oppGoals;
  const ag = m.isHome ? m.oppGoals : m.sskGoals;
  return { home, away, hg, ag };
}

export default async function OmgangarPage() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const rounds = await loadRoundList(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Omgångar</h1>
        <p className="label mt-1">
          Så gick SSK:s matcher, och vad din femma gav. Välj en omgång för hela bilden.
        </p>
      </div>

      {rounds.length === 0 && (
        <div className="card p-6">
          <p className="text-sm">
            Ingen omgång har stängt än. Här dyker de upp så fort första deadlinen passerat.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {rounds.map((r) => {
          const played = r.matches.filter((m) => m.status === "final");
          const wins = played.filter((m) => m.result === "W" || m.result === "OTW").length;
          return (
            <Link
              key={r.id}
              href={`/omgangar/${r.id}`}
              className="card block p-4 transition-colors hover:border-ssk-blue"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">{r.name}</h2>
                {r.myTotal != null ? (
                  <span className="text-lg font-extrabold tabular-nums text-ssk-blue">
                    {pts(r.myTotal)} p
                  </span>
                ) : (
                  <span className="label">Ingen femma</span>
                )}
              </div>

              <ul className="mt-2 space-y-1 text-sm">
                {r.matches.map((m) => {
                  const { home, away, hg, ag } = matchLine(m);
                  const spelad = m.status === "final" && hg != null && ag != null;
                  return (
                    <li key={m.id} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate">
                        {home} – {away}
                      </span>
                      <span className="shrink-0 tabular-nums font-medium">
                        {spelad ? `${hg}–${ag}` : "–"}
                      </span>
                      {m.result === "OTW" || m.result === "OTL" ? (
                        <span className="shrink-0 text-[10px] text-ssk-muted">efter förl.</span>
                      ) : null}
                    </li>
                  );
                })}
                {r.matches.length === 0 && <li className="label">Inga matcher.</li>}
              </ul>

              {played.length > 0 && (
                <p className="label mt-2">
                  {wins} av {played.length} matcher vunna
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

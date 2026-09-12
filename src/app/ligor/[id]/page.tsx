import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LeaveButton } from "@/components/LeagueForms.leave";

export const dynamic = "force-dynamic";

export default async function LeagueStandings({ params }: { params: { id: string } }) {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: league } = await sb
    .from("leagues")
    .select("id, name, type, join_code, owner_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!league) notFound();

  const { data: standings } = await sb
    .from("league_standings")
    .select("user_id, username, total_points")
    .eq("league_id", params.id)
    .order("total_points", { ascending: false });

  const isMember = (standings ?? []).some((s) => s.user_id === user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/ligor" className="label hover:text-white">← Ligor</Link>
          <h1 className="text-2xl font-bold">{league.name}</h1>
          <p className="label">
            {league.type === "public" ? "Publik liga" : "Privat liga"}
            {(league.owner_id === user.id || league.type === "private") && ` · kod: ${league.join_code}`}
          </p>
        </div>
        {isMember && <LeaveButton leagueId={league.id} />}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ssk-dark text-ssk-muted">
            <tr>
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">Spelare</th>
              <th className="px-4 py-2 text-right">Poäng</th>
            </tr>
          </thead>
          <tbody>
            {(standings ?? []).map((s, i) => (
              <tr
                key={s.user_id}
                className={`border-t border-ssk-line ${s.user_id === user.id ? "bg-ssk-orange/5" : ""}`}
              >
                <td className="px-4 py-2">{i + 1}</td>
                <td className="px-4 py-2">
                  {s.username}
                  {s.user_id === user.id && <span className="ml-2 text-xs text-ssk-orange">du</span>}
                </td>
                <td className="px-4 py-2 text-right font-medium">{Number(s.total_points).toFixed(1)}</td>
              </tr>
            ))}
            {(standings ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-ssk-muted">
                  Inga medlemmar ännu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

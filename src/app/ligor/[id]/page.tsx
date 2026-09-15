import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LeaveButton } from "@/components/LeagueForms.leave";

export const dynamic = "force-dynamic";

export default async function LeagueStandings({ params }: { params: { id: string } }) {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  // RLS avgör om användaren får se ligan (publik / medlem / ägare)
  const { data: league } = await sb
    .from("leagues")
    .select("id, name, type, join_code, owner_id, description, prize, starts_on, ends_on")
    .eq("id", params.id)
    .maybeSingle();
  if (!league) notFound();

  // Topplistan beräknas server-side med service-role (behöver läsa alla medlemmars
  // poäng), och filtreras på ligans datumintervall om det är satt.
  const admin = createAdminClient();
  const { data: members } = await admin
    .from("league_members")
    .select("user_id, profiles(username, team_name)")
    .eq("league_id", league.id);
  const userIds = (members ?? []).map((m: any) => m.user_id);

  const inRange = (iso?: string | null) => {
    if (!league.starts_on && !league.ends_on) return true;
    const d = (iso ?? "").slice(0, 10);
    if (league.starts_on && d < league.starts_on) return false;
    if (league.ends_on && d > league.ends_on) return false;
    return true;
  };

  const totals = new Map<string, number>();
  for (const id of userIds) totals.set(id, 0);

  if (userIds.length) {
    const { data: entries } = await admin
      .from("entries")
      .select("user_id, points, rounds(deadline)")
      .in("user_id", userIds);
    for (const e of entries ?? []) {
      if (inRange((e as any).rounds?.deadline)) totals.set(e.user_id, (totals.get(e.user_id) ?? 0) + Number(e.points));
    }
    const { data: tips } = await admin
      .from("result_tips")
      .select("user_id, points, matches(starts_at)")
      .in("user_id", userIds);
    for (const t of tips ?? []) {
      if (inRange((t as any).matches?.starts_at)) totals.set(t.user_id, (totals.get(t.user_id) ?? 0) + Number(t.points));
    }
  }

  const standings = (members ?? [])
    .map((m: any) => ({ user_id: m.user_id, username: m.profiles?.team_name || m.profiles?.username || "—", total: totals.get(m.user_id) ?? 0 }))
    .sort((a, b) => b.total - a.total);

  const isMember = userIds.includes(user.id);
  const range =
    league.starts_on || league.ends_on
      ? `${league.starts_on ?? "…"} → ${league.ends_on ?? "…"}`
      : "Hela säsongen";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/ligor" className="label hover:text-ssk-ink">← Ligor</Link>
          <h1 className="text-2xl font-bold">{league.name}</h1>
          {league.description && <p className="text-sm text-ssk-muted">{league.description}</p>}
          <p className="label">
            {league.type === "public" ? "Publik liga" : "Privat liga"} · {range}
            {(league.owner_id === user.id || league.type === "private") && ` · kod: ${league.join_code}`}
          </p>
          {league.prize && (
            <p className="mt-1 inline-block rounded bg-ssk-yellow px-2 py-0.5 text-sm font-semibold text-ssk-navy">
              🏆 {league.prize}
            </p>
          )}
        </div>
        {isMember && <LeaveButton leagueId={league.id} />}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ssk-navy text-white">
            <tr>
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">Spelare</th>
              <th className="px-4 py-2 text-right">Poäng</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.user_id} className={`border-t border-ssk-line ${s.user_id === user.id ? "bg-ssk-blue/5" : ""}`}>
                <td className="px-4 py-2">{i + 1}</td>
                <td className="px-4 py-2">
                  {s.username}
                  {s.user_id === user.id && <span className="ml-2 text-xs text-ssk-blue">du</span>}
                </td>
                <td className="px-4 py-2 text-right font-medium">{s.total.toFixed(1)}</td>
              </tr>
            ))}
            {standings.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-ssk-muted">Inga medlemmar ännu.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

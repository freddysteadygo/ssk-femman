import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LeagueForms, PublicJoinButton } from "@/components/LeagueForms";

export const dynamic = "force-dynamic";

export default async function LigorPage() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: myMemberships } = await sb
    .from("league_members")
    .select("league_id, leagues(id, name, type, join_code, owner_id)")
    .eq("user_id", user.id);

  const myLeagueIds = (myMemberships ?? []).map((m: any) => m.league_id);

  const { data: publicLeagues } = await sb
    .from("leagues")
    .select("id, name, type")
    .eq("type", "public")
    .order("created_at", { ascending: false })
    .limit(25);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Ligor</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Mina ligor</h2>
        {(myMemberships ?? []).length === 0 && (
          <p className="label">Du är inte med i någon liga ännu. Skapa en eller gå med nedan.</p>
        )}
        <div className="grid gap-2">
          {(myMemberships ?? []).map((m: any) => (
            <Link
              key={m.league_id}
              href={`/ligor/${m.league_id}`}
              className="card flex items-center justify-between p-4 hover:border-ssk-orange"
            >
              <div>
                <div className="font-medium">{m.leagues?.name}</div>
                <div className="label">
                  {m.leagues?.type === "public" ? "Publik" : "Privat"}
                  {m.leagues?.owner_id === user.id && " · du äger"}
                  {m.leagues?.type === "private" && ` · kod: ${m.leagues?.join_code}`}
                </div>
              </div>
              <span className="text-ssk-orange text-sm">Topplista →</span>
            </Link>
          ))}
        </div>
      </section>

      <LeagueForms />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Publika ligor</h2>
        <div className="grid gap-2">
          {(publicLeagues ?? []).map((l) => (
            <div key={l.id} className="card flex items-center justify-between p-4">
              <Link href={`/ligor/${l.id}`} className="font-medium hover:text-ssk-orange">
                {l.name}
              </Link>
              {myLeagueIds.includes(l.id) ? (
                <span className="label">Med</span>
              ) : (
                <PublicJoinButton leagueId={l.id} />
              )}
            </div>
          ))}
          {(publicLeagues ?? []).length === 0 && <p className="label">Inga publika ligor ännu.</p>}
        </div>
      </section>
    </div>
  );
}

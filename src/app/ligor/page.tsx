import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LeagueForms, PublicJoinButton } from "@/components/LeagueForms";

export const dynamic = "force-dynamic";

export default async function LigorPage() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const { data: myMemberships } = user
    ? await sb
        .from("league_members")
        .select("league_id, leagues(id, name, type, join_code, owner_id)")
        .eq("user_id", user.id)
    : { data: [] as any[] };

  const myLeagueIds = (myMemberships ?? []).map((m: any) => m.league_id);

  const { data: publicLeagues } = await sb
    .from("leagues")
    .select("id, name, type, description, prize")
    .eq("type", "public")
    .order("created_at", { ascending: true })
    .limit(25);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Ligor</h1>

      {!user && (
        <div className="card flex flex-col items-center gap-3 p-6 text-center">
          <p className="font-semibold">Gå med i en liga — gratis</p>
          <p className="text-sm text-ssk-muted">
            Registrera dig (det tar 30 sekunder med en inloggningslänk) så kan du gå med i ligorna nedan
            och skapa egna med kompisarna.
          </p>
          <Link href="/login" className="btn-primary">Kom igång — gratis</Link>
        </div>
      )}

      {user && (
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
      )}

      {user && <LeagueForms />}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Publika ligor</h2>
        <div className="grid gap-2">
          {(publicLeagues ?? []).map((l: any) => (
            <div key={l.id} className="card flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link href={`/ligor/${l.id}`} className="font-medium hover:text-ssk-blue">
                  {l.name}
                </Link>
                {l.description && <p className="text-xs text-ssk-muted">{l.description}</p>}
                {l.prize && <p className="text-xs font-semibold text-ssk-blue">🏆 {l.prize}</p>}
              </div>
              {!user ? (
                <Link href="/login" className="btn-ghost shrink-0 text-sm">Gå med</Link>
              ) : myLeagueIds.includes(l.id) ? (
                <span className="label shrink-0">Med</span>
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

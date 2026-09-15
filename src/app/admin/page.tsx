import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminMatchForm } from "@/components/AdminMatchForm";
import { AdminLeagueForm } from "@/components/AdminLeagueForm";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) {
    return <div className="card p-6">Kräver admin-behörighet.</div>;
  }

  const [{ data: matches }, { data: players }, { data: leagues }] = await Promise.all([
    sb.from("matches").select("*").order("starts_at", { ascending: false }).limit(40),
    sb.from("players").select("*").eq("active", true).order("position").order("full_name"),
    sb
      .from("leagues")
      .select("id, name, description, prize, starts_on, ends_on")
      .eq("type", "public")
      .order("starts_on", { ascending: true, nullsFirst: true }),
  ]);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Admin — publika ligor</h1>
          <p className="label mt-1">Skapa och redigera de publika ligorna som visas för alla spelare.</p>
        </div>
        <AdminLeagueForm leagues={leagues ?? []} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Admin — manuell resultatinmatning</h2>
          <p className="label mt-1">
            Fallback när scrapern inte hämtat en match. Fyll i resultat och statistik, spara — poängen
            räknas om automatiskt för alla lag och tips.
          </p>
        </div>
        <AdminMatchForm matches={matches ?? []} players={players ?? []} />
      </section>
    </div>
  );
}

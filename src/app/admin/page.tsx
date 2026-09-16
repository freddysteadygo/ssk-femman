import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // Statistik via service-role (RLS-fritt) — bara admin ser den här sidan.
  const admin = createAdminClient();
  const [{ data: matches }, { data: players }, { data: leagues }, playerCount, entryCount, tipCount] =
    await Promise.all([
      sb.from("matches").select("*").order("starts_at", { ascending: false }).limit(40),
      sb.from("players").select("*").eq("active", true).order("position").order("full_name"),
      sb
        .from("leagues")
        .select("id, name, description, prize, starts_on, ends_on")
        .eq("type", "public")
        .order("starts_on", { ascending: true, nullsFirst: true }),
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("entries").select("*", { count: "exact", head: true }),
      admin.from("result_tips").select("*", { count: "exact", head: true }),
    ]);

  const stats = [
    { label: "Registrerade spelare", value: playerCount.count ?? 0 },
    { label: "Inlämnade femmor", value: entryCount.count ?? 0 },
    { label: "Resultattips", value: tipCount.count ?? 0 },
  ];

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold">Admin</h1>
        <div className="grid gap-3 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="card p-4 text-center">
              <div className="text-3xl font-extrabold text-ssk-blue">{s.value}</div>
              <div className="label mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Publika ligor</h2>
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

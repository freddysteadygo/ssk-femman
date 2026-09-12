import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminMatchForm } from "@/components/AdminMatchForm";

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

  const [{ data: matches }, { data: players }] = await Promise.all([
    sb.from("matches").select("*").order("starts_at", { ascending: false }).limit(40),
    sb.from("players").select("*").eq("active", true).order("position").order("full_name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin — manuell resultatinmatning</h1>
        <p className="label mt-1">
          Fallback när scrapern inte hämtat en match. Fyll i resultat och statistik, spara — poängen
          räknas om automatiskt för alla lag och tips.
        </p>
      </div>
      <AdminMatchForm matches={matches ?? []} players={players ?? []} />
    </div>
  );
}

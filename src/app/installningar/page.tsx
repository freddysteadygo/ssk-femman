import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inställningar · SSK-femman" };

export default async function InstallningarPage() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await sb
    .from("profiles")
    .select("username, email, notify_round")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Inställningar</h1>

      <div className="card p-5">
        <p className="label">Inloggad som</p>
        <p className="font-medium">{profile?.username}</p>
        <p className="text-sm text-ssk-muted">{profile?.email}</p>
      </div>

      <SettingsForm initialNotify={profile?.notify_round ?? true} />
    </div>
  );
}

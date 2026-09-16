import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";

export async function Nav() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    isAdmin = !!data?.is_admin;
  }

  return <NavBar isLoggedIn={!!user} isAdmin={isAdmin} />;
}

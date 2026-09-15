import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <header className="border-b-4 border-ssk-yellow bg-ssk-navy text-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ssk-logo.svg" alt="SSK" className="h-7 w-7" />
          SSK-femman
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/regler" className="text-white/90 hover:text-ssk-yellow">Regler</Link>
          {user ? (
            <>
              <Link href="/spela" className="text-white/90 hover:text-ssk-yellow">Spela</Link>
              <Link href="/ligor" className="text-white/90 hover:text-ssk-yellow">Ligor</Link>
              {isAdmin && <Link href="/admin" className="text-white/90 hover:text-ssk-yellow">Admin</Link>}
              <Link href="/installningar" className="text-white/90 hover:text-ssk-yellow">Inställningar</Link>
              <form action="/auth/signout" method="post">
                <button className="text-white/60 hover:text-white">Logga ut</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn-primary text-sm">Logga in</Link>
          )}
        </div>
      </nav>
    </header>
  );
}

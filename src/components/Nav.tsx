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
    <header className="border-b border-ssk-line bg-ssk-dark">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="inline-block h-6 w-6 rounded bg-ssk-orange" />
          SSK-femman
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link href="/spela" className="hover:text-ssk-orange">Spela</Link>
              <Link href="/ligor" className="hover:text-ssk-orange">Ligor</Link>
              {isAdmin && <Link href="/admin" className="hover:text-ssk-orange">Admin</Link>}
              <form action="/auth/signout" method="post">
                <button className="text-ssk-muted hover:text-white">Logga ut</button>
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

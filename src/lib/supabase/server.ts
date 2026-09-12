import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase-klient för server components / route handlers.
// Respekterar inloggad användare via cookies (RLS gäller).
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // anropas från en server component utan skrivbar cookie-store — ignoreras
          }
        },
      },
    }
  );
}

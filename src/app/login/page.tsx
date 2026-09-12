"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="text-2xl font-bold">Logga in</h1>
      <p className="mt-2 text-sm text-ssk-muted">
        Vi mejlar en inloggningslänk. Ingen lösenord behövs. Första gången skapas ditt konto automatiskt.
      </p>

      {sent ? (
        <div className="card mt-6 p-5 text-sm">
          Kolla din mejl <b>{email}</b> och klicka på länken för att logga in.
        </div>
      ) : (
        <form onSubmit={signIn} className="mt-6 space-y-3">
          <input
            type="email"
            required
            className="input w-full"
            placeholder="din@mejl.se"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Skickar…" : "Skicka inloggningslänk"}
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      )}
    </div>
  );
}

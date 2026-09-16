"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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

  async function signInGoogle() {
    setGoogleLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
    // vid lyckad start sker en redirect till Google
  }

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="text-2xl font-bold">Logga in</h1>
      <p className="mt-2 text-sm text-ssk-muted">
        Inget lösenord behövs. Första gången skapas ditt konto automatiskt.
      </p>

      {sent ? (
        <div className="card mt-6 p-5 text-sm">
          Kolla din mejl <b>{email}</b> och klicka på länken för att logga in.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <button
            onClick={signInGoogle}
            disabled={googleLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-ssk-line bg-white px-4 py-2 font-medium text-ssk-ink transition-colors hover:bg-ssk-goldSoft disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.97 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
            </svg>
            {googleLoading ? "Öppnar Google…" : "Logga in med Google"}
          </button>

          <div className="flex items-center gap-3 text-xs text-ssk-muted">
            <span className="h-px flex-1 bg-ssk-line" />
            eller med e-post
            <span className="h-px flex-1 bg-ssk-line" />
          </div>

          <form onSubmit={signIn} className="space-y-3">
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
          </form>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-ssk-muted">
        Genom att logga in godkänner du vår{" "}
        <a href="/integritetspolicy" className="text-ssk-blue hover:underline">integritetspolicy</a>.
      </p>
    </div>
  );
}

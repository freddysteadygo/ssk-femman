"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinPlayoff, leavePlayoff } from "@/lib/actions";

export function PlayoffJoinButton({
  leagueId,
  joined,
  full,
}: {
  leagueId: string;
  joined: boolean;
  full: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function act(fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setLoading(true);
    setErr(null);
    const r = await fn(leagueId);
    setLoading(false);
    if (!r.ok) setErr(r.error ?? "Något gick fel.");
    else router.refresh();
  }

  if (joined) {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-semibold text-ssk-blue">Du är anmäld ✓</p>
        <button onClick={() => act(leavePlayoff)} disabled={loading} className="btn-ghost text-sm">
          Avanmäl
        </button>
        {err && <p className="text-sm text-red-500">{err}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button onClick={() => act(joinPlayoff)} disabled={loading || full} className="btn-primary">
        {full ? "Fullt" : loading ? "Anmäler…" : "Anmäl dig"}
      </button>
      {err && <p className="text-sm text-red-500">{err}</p>}
    </div>
  );
}

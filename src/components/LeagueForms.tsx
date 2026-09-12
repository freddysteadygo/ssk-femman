"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLeague, joinLeague, joinPublicLeague } from "@/lib/actions";

export function LeagueForms() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<"private" | "public">("private");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function create() {
    setMsg(null);
    start(async () => {
      const res = await createLeague(name, type);
      if (res.ok) {
        setName("");
        setMsg("Liga skapad ✓");
        if (res.id) router.push(`/ligor/${res.id}`);
      } else setMsg(res.error ?? "Fel.");
    });
  }
  function join() {
    setMsg(null);
    start(async () => {
      const res = await joinLeague(code);
      if (res.ok) {
        setCode("");
        setMsg("Gick med ✓");
        if (res.id) router.push(`/ligor/${res.id}`);
      } else setMsg(res.error ?? "Fel.");
    });
  }

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="card space-y-3 p-4">
        <h2 className="font-semibold">Skapa liga</h2>
        <input
          className="input w-full"
          placeholder="Ligans namn"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2 text-sm">
          {(["private", "public"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-lg border px-3 py-1 ${
                type === t ? "border-ssk-orange bg-ssk-orange/10" : "border-ssk-line"
              }`}
            >
              {t === "private" ? "Privat" : "Publik"}
            </button>
          ))}
        </div>
        <button onClick={create} disabled={pending} className="btn-primary">Skapa</button>
      </div>

      <div className="card space-y-3 p-4">
        <h2 className="font-semibold">Gå med via kod</h2>
        <input
          className="input w-full uppercase"
          placeholder="T.EX. A1B2C3D4"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button onClick={join} disabled={pending} className="btn-ghost">Gå med</button>
      </div>

      {msg && <p className="md:col-span-2 text-sm text-ssk-orange">{msg}</p>}
    </section>
  );
}

export function PublicJoinButton({ leagueId }: { leagueId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      className="btn-ghost text-sm"
      disabled={pending}
      onClick={() => start(async () => {
        await joinPublicLeague(leagueId);
        router.refresh();
      })}
    >
      Gå med
    </button>
  );
}

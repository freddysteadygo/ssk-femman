"use client";

import { useState, useTransition } from "react";
import { setNotifyRound } from "@/lib/actions";

export function SettingsForm({ initialNotify }: { initialNotify: boolean }) {
  const [notify, setNotify] = useState(initialNotify);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle(v: boolean) {
    setNotify(v);
    setMsg(null);
    start(async () => {
      const res = await setNotifyRound(v);
      setMsg(res.ok ? "Sparat ✓" : res.error ?? "Något gick fel.");
      if (!res.ok) setNotify(!v);
    });
  }

  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold">Notiser</h2>
      <label className="flex items-center justify-between gap-4">
        <span className="text-sm">
          Mejla mig inför varje omgång
          <span className="block text-xs text-ssk-muted">
            Påminnelse ~24h innan deadline så du hinner göra din femma.
          </span>
        </span>
        <input
          type="checkbox"
          className="h-5 w-5 accent-ssk-blue"
          checked={notify}
          disabled={pending}
          onChange={(e) => toggle(e.target.checked)}
        />
      </label>
      {msg && <p className="text-sm text-ssk-blue">{msg}</p>}
    </div>
  );
}

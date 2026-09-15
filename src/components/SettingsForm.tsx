"use client";

import { useState, useTransition } from "react";
import { setNotifyRound, setTeamName } from "@/lib/actions";

export function SettingsForm({
  initialNotify,
  initialTeamName,
}: {
  initialNotify: boolean;
  initialTeamName: string;
}) {
  const [notify, setNotify] = useState(initialNotify);
  const [team, setTeam] = useState(initialTeamName);
  const [savedTeam, setSavedTeam] = useState(initialTeamName);
  const [teamMsg, setTeamMsg] = useState<string | null>(null);
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

  function saveTeam() {
    setTeamMsg(null);
    start(async () => {
      const res = await setTeamName(team);
      if (res.ok) {
        setSavedTeam(team.trim());
        setTeamMsg("Sparat ✓");
      } else {
        setTeamMsg(res.error ?? "Något gick fel.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-3 p-5">
        <h2 className="font-semibold">Lagnamn</h2>
        <p className="text-xs text-ssk-muted">
          Namnet som visas i topplistor och ligor. Välj något kul!
        </p>
        <div className="flex gap-2">
          <input
            className="input w-full"
            placeholder="T.ex. Kringlans Kings"
            maxLength={40}
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          />
          <button
            onClick={saveTeam}
            disabled={pending || team.trim() === savedTeam.trim() || team.trim().length < 2}
            className="btn-primary shrink-0"
          >
            Spara
          </button>
        </div>
        {teamMsg && <p className="text-sm text-ssk-blue">{teamMsg}</p>}
      </div>

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
    </div>
  );
}

"use client";

import { useState } from "react";
import type { ParticipantRound } from "@/lib/round-history";

const pts = (n: number) => (Math.round(n * 10) / 10).toLocaleString("sv-SE");

function tipOutcome(t: ParticipantRound["tips"][number]): string {
  if (t.actualSsk == null || t.actualOpp == null) return "";
  if (t.points >= 4) return "exakt";
  if (t.points > 0) return "rätt utfall";
  return "fel";
}

/**
 * Deltagarnas femmor för en avgjord omgång. Vem som syns avgörs på servern
 * (egen + ligakamrater) — den här komponenten visar bara det den får.
 */
export function RoundParticipants({ participants }: { participants: ParticipantRound[] }) {
  const [open, setOpen] = useState<string | null>(
    participants.find((p) => p.isMe)?.userId ?? participants[0]?.userId ?? null
  );

  if (!participants.length) {
    return (
      <section className="space-y-3">
        <h2 className="border-b border-ssk-line pb-2 text-lg font-semibold">Femmorna</h2>
        <p className="label">Ingen i dina ligor lämnade in en femma den här omgången.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="border-b border-ssk-line pb-2">
        <h2 className="text-lg font-semibold">Femmorna</h2>
        <p className="label mt-1">
          Du och de du delar liga med. Klicka på ett lag för att se femman och tipsen.
        </p>
      </div>

      <div className="space-y-2">
        {participants.map((p, i) => {
          const isOpen = open === p.userId;
          return (
            <div
              key={p.userId}
              className={`card overflow-hidden ${p.isMe ? "border-ssk-blue" : ""}`}
            >
              <button
                onClick={() => setOpen(isOpen ? null : p.userId)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ssk-goldSoft"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ssk-navy text-xs font-bold text-ssk-yellow">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {p.teamName}
                    {p.isMe && <span className="ml-2 text-[11px] text-ssk-blue">du</span>}
                  </span>
                  <span className="block text-[11px] text-ssk-muted">
                    Femma {pts(p.femmaPoints)} p · Tips {pts(p.tipPoints)} p
                    {p.carriedOver && " · överförd femma"}
                  </span>
                </span>
                <span className="shrink-0 text-lg font-extrabold tabular-nums text-ssk-blue">
                  {pts(p.total)}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-ssk-line px-4 py-3">
                  <ul className="divide-y divide-ssk-line text-sm">
                    {p.lines.map((l) => (
                      <li key={l.playerId} className="flex items-center gap-2 py-1.5">
                        <span className="w-7 shrink-0 text-right text-[11px] tabular-nums text-ssk-muted">
                          {l.jersey ?? ""}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {l.name}
                          {l.captain && (
                            <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-ssk-yellow text-[10px] font-extrabold text-ssk-navy">
                              C
                            </span>
                          )}
                          {l.goalie && (
                            <span className="ml-1.5 text-[11px] text-ssk-muted">målvakt</span>
                          )}
                        </span>
                        <span className="w-12 shrink-0 text-right font-semibold tabular-nums">
                          {pts(l.points)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {p.tips.length > 0 && (
                    <>
                      <h3 className="mt-3 border-t border-ssk-line pt-2 text-sm font-semibold">
                        Resultattips
                      </h3>
                      <ul className="divide-y divide-ssk-line text-sm">
                        {p.tips.map((t) => (
                          <li key={t.matchId} className="flex items-center gap-2 py-1.5">
                            <span className="min-w-0 flex-1 truncate">
                              {t.isHome ? "SSK" : t.opponent} – {t.isHome ? t.opponent : "SSK"}
                            </span>
                            <span className="shrink-0 tabular-nums text-ssk-muted">
                              tippade {t.isHome ? t.predSsk : t.predOpp}–
                              {t.isHome ? t.predOpp : t.predSsk}
                            </span>
                            <span className="w-16 shrink-0 text-right text-[11px] text-ssk-muted">
                              {tipOutcome(t)}
                            </span>
                            <span className="w-10 shrink-0 text-right font-semibold tabular-nums">
                              {pts(t.points)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

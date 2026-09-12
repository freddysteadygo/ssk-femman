"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveLeague } from "@/lib/actions";

export function LeaveButton({ leagueId }: { leagueId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      className="btn-ghost text-sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await leaveLeague(leagueId);
          router.push("/ligor");
        })
      }
    >
      Lämna liga
    </button>
  );
}

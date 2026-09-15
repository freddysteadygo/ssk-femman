import Scoreboard from "@/components/Scoreboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scoreboard · SSK-femman" };

export default function ScoreboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Scoreboard</h1>
      {/* @ts-expect-error Async Server Component */}
      <Scoreboard />
    </div>
  );
}

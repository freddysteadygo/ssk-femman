import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Scoreboard from "@/components/Scoreboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Inloggad: visa scoreboard + snabblänkar
  if (user) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Scoreboard</h1>
          <div className="flex gap-2">
            <Link href="/spela" className="btn-primary text-sm">Spela</Link>
            <Link href="/ligor" className="btn-ghost text-sm">Ligor</Link>
          </div>
        </div>
        {/* @ts-expect-error Async Server Component */}
        <Scoreboard />
      </div>
    );
  }

  // Utloggad: marknadsförings-hero
  return (
    <div className="space-y-10">
      <section className="text-center py-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ssk-logo.svg" alt="Södertälje SK" className="mx-auto mb-6 h-24 w-24" />
        <h1 className="text-4xl font-extrabold tracking-tight">
          Bygg din <span className="text-ssk-orange">femma</span>.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ssk-muted">
          Fantasyspelet för Södertälje SK. Välj de fem spelare du tror gör mest poäng
          varje omgång, gissa vem som står i mål och tippa matcherna. Skapa ligor med
          kompisarna och toppa tabellen.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/login" className="btn-primary">Kom igång — gratis</Link>
          <Link href="/scoreboard" className="btn-ghost">Scoreboard</Link>
          <Link href="/ligor" className="btn-ghost">Ligor</Link>
        </div>
        <div className="mx-auto mt-5 max-w-xl rounded-lg bg-ssk-cream/70 px-4 py-3 text-sm text-ssk-ink">
          <b>Det är inte för sent att haka på!</b> Du kan registrera dig och börja spela när som
          helst under säsongen — nya ligor och tävlingar startas löpande.
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { t: "Välj din femma", d: "Fem utespelare per omgång (2 backar + 3 forwards). Inga priser, inga budgetar — bara din magkänsla." },
          { t: "Gissa målvakten", d: "Rätt målvakt i mål ger bonus. Vågar du chansa på rotationen?" },
          { t: "Tippa matcherna", d: "Rätt vinnare ger poäng, exakt resultat ger mer." },
        ].map((f) => (
          <div key={f.t} className="card p-5">
            <h3 className="font-semibold text-ssk-orange">{f.t}</h3>
            <p className="mt-2 text-sm text-ssk-muted">{f.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

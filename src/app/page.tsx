import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
        <div className="mt-6 flex justify-center gap-3">
          <Link href={user ? "/spela" : "/login"} className="btn-primary">
            {user ? "Till spelet" : "Kom igång — gratis"}
          </Link>
          <Link href="/ligor" className="btn-ghost">Ligor</Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { t: "Välj din femma", d: "Fem utespelare per omgång. Inga priser, inga budgetar — bara din magkänsla." },
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

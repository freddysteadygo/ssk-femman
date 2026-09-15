import Link from "next/link";

export const metadata = { title: "Integritetspolicy · SSK-femman" };

export default function IntegritetspolicyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/" className="label hover:text-ssk-ink">← Till startsidan</Link>
        <h1 className="mt-1 text-2xl font-bold">Integritetspolicy</h1>
        <p className="label">Senast uppdaterad: {new Date().getFullYear()}</p>
      </div>

      <div className="card space-y-4 p-6 text-sm leading-relaxed">
        <p>
          SSK-femman är ett inofficiellt fanprojekt. Vi värnar om din integritet och samlar bara in det
          som behövs för att spelet ska fungera.
        </p>

        <div>
          <h2 className="mb-1 font-semibold text-ssk-navy">Vilka uppgifter vi lagrar</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Din e-postadress (för inloggning via länk och eventuella notiser du valt).</li>
            <li>Ditt lagnamn och användarnamn.</li>
            <li>Dina val i spelet: femmor, målvaktsgissningar, resultattips och ligamedlemskap.</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-ssk-navy">Så här används uppgifterna</h2>
          <p>
            Uppgifterna används <b>enbart</b> för att driva spelet — visa topplistor, räkna poäng och
            skicka de notiser du själv valt. Dina uppgifter används <b>inte</b> för marknadsföring och
            <b> delas inte</b> med någon tredje part.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-ssk-navy">Notiser</h2>
          <p>
            E-postnotiser inför nya omgångar är frivilliga. Du slår av och på dem när du vill under{" "}
            <Link href="/installningar" className="text-ssk-blue hover:underline">Inställningar</Link>.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-ssk-navy">Dina rättigheter</h2>
          <p>
            Vill du få ut eller radera dina uppgifter, hör av dig till{" "}
            <a href="mailto:hej@steadygo.se" className="text-ssk-blue hover:underline">hej@steadygo.se</a>{" "}
            så hjälper vi dig.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-ssk-navy">Teknik</h2>
          <p>
            Spelet körs på Vercel och lagrar data hos Supabase (databas inom EU). Matchdata hämtas från
            stats.swehockey.se. Inga spårningskakor eller annonsnätverk används.
          </p>
        </div>
      </div>
    </div>
  );
}

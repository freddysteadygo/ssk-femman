import Link from "next/link";

export const metadata = { title: "Om projektet · SSK-femman" };

export default function OmProjektetPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/" className="label hover:text-ssk-ink">← Till startsidan</Link>
        <h1 className="mt-1 text-2xl font-bold">Om projektet</h1>
      </div>

      <div className="card space-y-4 p-6 text-sm leading-relaxed">
        <p>
          SSK-femman är ett inofficiellt fanprojekt för oss som älskar Södertälje SK. Idén är enkel:
          gör hockeyn ännu roligare att följa genom att välja din femma, gissa målvakten och tippa
          matcherna — och tävla mot kompisar och andra supportrar omgång för omgång.
        </p>
        <p>
          Jag byggde det för att jag tycker det är kul, och för att visa vad man kan skapa med modern
          webbteknik och lite AI-hjälp. Spelet är gratis och kommer att <b>utvecklas löpande</b> under
          säsongen — nya ligor, tävlingar och funktioner tillkommer efter hand. Har du idéer eller hittar
          något som strular är jag tacksam för allt du hör av dig om.
        </p>
        <p>
          Poängen räknas automatiskt utifrån offentlig matchstatistik från stats.swehockey.se. Projektet
          har ingen koppling till Södertälje SK som förening.
        </p>
        <div className="flex items-center gap-4 border-t border-ssk-line pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/freddy.png"
            alt="Freddy Karlsson"
            className="h-20 w-20 shrink-0 rounded-full border-2 border-ssk-yellow object-cover"
          />
          <div>
            <p className="text-ssk-muted">Byggt av</p>
            <p className="font-semibold">Freddy Karlsson · SteadyGo AB</p>
            <p className="mt-1">
              <a href="https://steadygo.se" target="_blank" rel="noopener noreferrer" className="text-ssk-blue hover:underline">steadygo.se</a>
              {" · "}
              <a href="mailto:hej@steadygo.se" className="text-ssk-blue hover:underline">hej@steadygo.se</a>
            </p>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-ssk-muted">
        Se även vår{" "}
        <Link href="/integritetspolicy" className="text-ssk-blue hover:underline">integritetspolicy</Link>.
      </p>
    </div>
  );
}

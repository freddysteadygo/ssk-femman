export const metadata = { title: "Så funkar poängen · SSK-femman" };

function Row({ h, p }: { h: string; p: string }) {
  return (
    <div className="flex items-center justify-between border-t border-ssk-line py-2 text-sm">
      <span>{h}</span>
      <span className="font-semibold text-ssk-orange">{p}</span>
    </div>
  );
}

export default function ReglerPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Så funkar SSK-femman</h1>
        <p className="mt-2 text-ssk-muted">
          Varje omgång väljer du <b>2 backar + 3 forwards</b>, gissar vilken <b>målvakt</b> som
          startar, och tippar <b>resultatet</b> på omgångens matcher. En av de fem utser du till
          <b> kapten</b> — kaptenens poäng räknas dubbelt. Dina spelare samlar poäng utifrån vad de
          gör i SSK:s matcher. Mest poäng i din liga vinner.
        </p>
      </div>

      <section className="card p-5">
        <h2 className="font-semibold">Utespelare (var och en av dina 5)</h2>
        <div className="mt-2">
          <Row h="Mål" p="+3" />
          <Row h="Assist" p="+2" />
          <Row h="Powerplay-mål eller -assist (bonus)" p="+0,5" />
          <Row h="På isen vid mål (+/−)" p="+0,5 / −0,5 per mål" />
          <Row h="Utvisning 2 min" p="−0,5" />
          <Row h="Utvisning över 2 min" p="−2" />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Målvakt (den du gissat)</h2>
        <div className="mt-2">
          <Row h="Rätt gissad (startade i mål)" p="+3" />
          <Row h="Vinst" p="+3" />
          <Row h="Räddning" p="+0,2" />
          <Row h="Insläppt mål" p="−1" />
          <Row h="Hållen nolla" p="+2" />
          <Row h="Fel gissad målvakt" p="0" />
        </div>
        <p className="mt-3 text-xs text-ssk-muted">
          Spelade två målvakter räknas den med flest skott emot som startande.
        </p>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Resultattips</h2>
        <div className="mt-2">
          <Row h="Rätt utfall (1 / X / 2)" p="+2" />
          <Row h="Exakt resultat" p="+4 totalt" />
        </div>
        <p className="mt-3 text-sm text-ssk-muted">
          Tipset gäller <b>ordinarie tid</b> (60 min). Ett <b>lika</b> resultat betyder att du tror
          matchen går till förlängning — hockey har ju ingen oavgjort i slutänden. Gick matchen till
          förlängning/straffar räknas ordinarie tid som oavgjort.
        </p>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Bra att veta</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ssk-muted">
          <li>Femman, kaptenen och tipsen låses vid omgångens deadline (30 min före första matchen).</li>
          <li>
            Din femma följer med till nästa omgång automatiskt — du behöver bara gå in om du vill
            ändra något.
          </li>
          <li>Kaptenen dubblar spelarens poäng, även när poängen är negativ. Att utse kapten är frivilligt.</li>
          <li>+/- räknas ur vilka som stod på isen vid varje mål.</li>
          <li>All statistik hämtas från stats.swehockey.se efter varje match.</li>
          <li>Poängvärdena kan justeras något efter de första omgångarna.</li>
        </ul>
      </section>
    </div>
  );
}

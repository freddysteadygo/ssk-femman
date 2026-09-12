# SSK-femman 🏒

Fantasyspel för **Södertälje SK** (herr, HockeyAllsvenskan). Välj din femma, gissa
målvakten, tippa matcherna och tävla i ligor. FPL-inspirerat, byggt i **Next.js +
Supabase**.

- Välj **5 utespelare** per omgång (ingen budget, inga priser)
- Gissa **målvakten** som startar → bonus om du har rätt
- **Resultattips** på omgångens matcher
- **Publika & privata ligor** med topplistor
- Poäng hämtas automatiskt från **stats.swehockey.se** (med admin-fallback för manuell inmatning)

---

## 1. Kom igång lokalt

### Förkrav
- Node 18+ (helst 20/22)
- Ett gratis [Supabase](https://supabase.com)-projekt

### Steg

```bash
npm install
cp .env.example .env      # fyll i värden (se nedan)
```

**Skapa databasen:** öppna Supabase → SQL Editor → klistra in hela
`supabase/schema.sql` och kör. Det skapar alla tabeller, RLS-policies,
topplistvyn och en trigger som auto-skapar en profil vid registrering.

**Miljövariabler (`.env`):**

| Variabel | Var den hämtas |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (⚠️ hemlig, bara server-side) |
| `SWEHOCKEY_SEASON_ID` | Se avsnitt 3 |
| `SWEHOCKEY_TEAM_ID` | Se avsnitt 3 (valfritt, filtrering sker på lagnamn) |
| `CRON_SECRET` | Slumpad lång sträng du hittar på |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` lokalt |

**Seeda truppen** (startlista finns i `supabase/roster.seed.json` — verifiera och
komplettera de 14 forwards + tröjnummer):

```bash
npm run seed:roster
```

**Kör appen:**

```bash
npm run dev        # http://localhost:3000
```

Logga in med magic link (mejlas av Supabase). Första inloggningen skapar kontot.

### Gör dig själv till admin
Kör i Supabase SQL Editor efter din första inloggning:

```sql
update profiles set is_admin = true where email = 'freddy@steadygo.se';
```

Då syns **Admin**-fliken (manuell resultatinmatning).

---

## 2. Poängsystem

Definieras på ett ställe: `src/lib/scoring.ts` (justera `SCORING` för att kalibrera).

**Utespelare (var och en av dina 5):**
| Händelse | Poäng |
|---|---|
| Mål | +3 |
| Assist | +2 |
| Powerplay-mål/assist | +0,5 (bonus) |
| På isen vid mål (+/−) | +0,5 / −0,5 per mål |
| Utvisning 2 min | −0,5 |
| Utvisning > 2 min | −2 |

**Målvakt (din gissade):**
| Händelse | Poäng |
|---|---|
| Rätt gissad (startade) | +3 |
| Vinst | +3 |
| Räddning | +0,2 |
| Insläppt mål | −1 |
| Hållen nolla | +2 |
| Fel gissad målvakt | 0 |

**Resultattips:** rätt vinnare +2 · exakt resultat +4 (totalt).

> **Speltid (topp-5/topp-1 mest spelade):** swehockey publicerar *ingen* istid för
> HockeyAllsvenskan, så den mekaniken går inte att driva automatiskt och är därför
> inte inbyggd. Se avsnitt 6.

+/- beräknas ur rapportens "Pos. Part."/"Neg. Part." (spelare på isen vid varje mål).

Enkla tester: `npx tsx src/lib/scoring.test.ts`

---

## 3. swehockey-data

Ingen öppen API finns → appen parsar HTML från `stats.swehockey.se`
(`src/lib/swehockey.ts`).

**Hitta `SWEHOCKEY_SEASON_ID`:** gå till HockeyAllsvenskans säsong på swehockey,
öppna schemavyn. URL:en ser ut som `.../ScheduleAndResults/Schedule/XXXXX` →
`XXXXX` är season-id.

**Ingest-jobb:**
```bash
npm run ingest:schedule    # läser in omgångar + matcher
npm run ingest:results     # hämtar matchrapporter, fyller stats, räknar poäng
npx tsx scripts/run-ingest.ts results --force   # tvinga omräkning
```

Samma jobb finns som skyddade API-endpoints för cron:
- `GET /api/cron/schedule`
- `GET /api/cron/results`

Anropas med `?secret=<CRON_SECRET>` eller `Authorization: Bearer <CRON_SECRET>`.

> ⚠️ **Verifiera parsern mot live-HTML.** swehockey-sidan är tabelltung och
> markup kan variera per vy. Parsern är byggd defensivt (extraherar alla tabeller
> och tolkar dem tolerant), men kolla utfallet mot en riktig SSK-match och justera
> selektorerna vid behov. **Admin-panelen fungerar oavsett** — du kan alltid mata
> in en match manuellt om en scrape missar.

**Omgångar (spelenhet)** definieras som ISO-kalendervecka (mån–sön) för SSK:s
matcher. Vill du använda seriens officiella omgångsindelning istället — ändra
grupperingen i `syncSchedule()` i `src/lib/ingest.ts`.

---

## 4. Deploy (Vercel + Supabase)

1. Pusha repot till GitHub.
2. Importera i [Vercel](https://vercel.com), lägg in **alla env-variabler** (sätt
   `NEXT_PUBLIC_SITE_URL` till din prod-URL).
3. I Supabase → Authentication → URL Configuration: lägg din Vercel-URL som
   **Site URL** och `.../auth/callback` som **Redirect URL**.
4. Cron körs automatiskt enligt `vercel.json`:
   - schema-synk kl 04 varje dag
   - resultat/poäng kl 06 och 23
   Sätt `CRON_SECRET` i Vercel så skickas den i cron-anropen.

---

## 5. Projektstruktur

```
supabase/
  schema.sql            # hela databasen + RLS + topplistvy
  roster.seed.json      # startrupp att seeda
src/
  lib/
    scoring.ts          # poängmotorn (all poänglogik + värden)
    swehockey.ts        # HTML-scraper
    ingest.ts           # synk + settlement (scraper → DB → poäng)
    actions.ts          # server actions (femma, tips, ligor, admin)
    supabase/           # klient-, server- och admin-klienter
    types.ts
  app/
    page.tsx            # landningssida
    login/              # magic link-inloggning
    spela/              # välj femma + målvakt + tips
    ligor/              # skapa/gå med + topplistor
    admin/              # manuell resultatinmatning
    api/cron/           # skyddade ingest-endpoints
  components/           # UI-komponenter
scripts/                # lokala ingest-/seed-körningar
```

---

## 6. Vad som INTE är med i V1 (nästa steg)

- **Nyförvärvs-loop** (fas 2): schemalagt AI-jobb som bevakar `sodertaljesk.se` +
  `eliteprospects.com` och flaggar nya spelare för godkännande innan de läggs i
  truppen. Byggs som ett extra cron-jobb + admin-godkännandevy.
- **Speltids-mekanik** (topp-5/topp-1 mest spelade): önskad men blockerad —
  HockeyAllsvenskan publicerar ingen istid på swehockey. Möjliga vägar: hitta en
  annan datakälla med TOL, låta en admin mata in topp-spelarna manuellt, eller
  släppa mekaniken. Beslut öppet.
- Historik/badges, säsongstotal vid sidan av per-omgång.

---

*Inofficiellt fanprojekt. Data från stats.swehockey.se. Byggt av Freddy Karlsson.*

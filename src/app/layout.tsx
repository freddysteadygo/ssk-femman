import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  metadataBase: new URL("https://sskfemman.se"),
  title: {
    default: "SSK-femman – fantasyspel för Södertälje SK",
    template: "%s · SSK-femman",
  },
  description:
    "Fantasyspel för Södertälje SK — välj din femma, gissa målvakten, tippa matcherna och toppa ligan. Gratis att spela.",
  icons: { icon: "/ssk-logo.svg" },
  openGraph: {
    type: "website",
    locale: "sv_SE",
    url: "https://sskfemman.se",
    siteName: "SSK-femman",
    title: "SSK-femman – fantasyspel för Södertälje SK",
    description:
      "Välj din femma, tippa matcherna och toppa ligan. Gratis fantasyspel för Södertälje SK.",
  },
  twitter: {
    card: "summary_large_image",
    title: "SSK-femman – fantasyspel för Södertälje SK",
    description:
      "Välj din femma, tippa matcherna och toppa ligan. Gratis fantasyspel för Södertälje SK.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>

        <footer className="mt-10 border-t-4 border-ssk-yellow bg-ssk-navy text-white">
          <div className="mx-auto max-w-5xl px-4 py-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ssk-logo.svg" alt="Södertälje SK" className="mx-auto mb-6 h-12 w-12" />
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              {/* Profilbild: lägg en bild på /public/freddy.jpg — annars visas initialerna */}
              <div
                className="h-16 w-16 shrink-0 rounded-full border-2 border-ssk-yellow bg-ssk-blueDark bg-cover bg-center"
                style={{ backgroundImage: "url(/freddy.png)" }}
                aria-hidden="true"
              />
              <div className="flex-1">
                <p className="text-sm text-white/70">Utvecklad av</p>
                <p className="text-base font-semibold text-white">Freddy Karlsson · SteadyGo AB</p>
                <p className="mt-1 text-sm text-white/70">
                  Digital marknadsföring &amp; skräddarsydda webbverktyg. Vill du ha något liknande byggt?
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm sm:justify-start">
                  <a href="https://steadygo.se" target="_blank" rel="noopener noreferrer" className="font-medium text-ssk-yellow hover:underline">
                    steadygo.se
                  </a>
                  <a href="mailto:hej@steadygo.se" className="font-medium text-ssk-yellow hover:underline">
                    hej@steadygo.se
                  </a>
                </div>
              </div>
            </div>
            <p className="mt-6 text-center text-xs text-white/50">
              SSK-femman · inofficiellt fanprojekt · data från stats.swehockey.se
            </p>
            <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs">
              <Link href="/om-projektet" className="text-white/60 hover:text-ssk-yellow hover:underline">
                Om projektet
              </Link>
              <span className="text-white/30">·</span>
              <Link href="/integritetspolicy" className="text-white/60 hover:text-ssk-yellow hover:underline">
                Integritetspolicy
              </Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

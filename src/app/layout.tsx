import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "SSK-femman",
  description: "Fantasyspel för Södertälje SK — välj din femma, gissa målvakten, tippa matcherna.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-10 text-center text-xs text-ssk-muted">
          SSK-femman · inofficiellt fanprojekt · data från stats.swehockey.se
        </footer>
      </body>
    </html>
  );
}

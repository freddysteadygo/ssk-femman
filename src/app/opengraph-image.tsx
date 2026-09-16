import { ImageResponse } from "next/og";

// Dynamiskt genererad delningsbild (Open Graph + Twitter/X).
// Visas när sskfemman.se delas i Messenger, iMessage, WhatsApp, X, LinkedIn m.fl.
export const runtime = "edge";
export const alt = "SSK-femman – fantasyspel för Södertälje SK";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#122a6b";
const BLUE = "#1b3fb0";
const LIGHT = "#7aa2ff";
const YELLOW = "#ffd21e";

// "SSK" med varannan gul och blå bokstav (samma känsla som HEJA SSK-mejlet).
const wordmark = [
  { c: "S", color: YELLOW },
  { c: "S", color: LIGHT },
  { c: "K", color: YELLOW },
  { c: "-", color: "#ffffff" },
  { c: "f", color: "#ffffff" },
  { c: "e", color: "#ffffff" },
  { c: "m", color: "#ffffff" },
  { c: "m", color: "#ffffff" },
  { c: "a", color: "#ffffff" },
  { c: "n", color: "#ffffff" },
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "90px",
          backgroundColor: NAVY,
          backgroundImage: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)`,
          position: "relative",
        }}
      >
        {/* Stor genomskinlig "5:a" som dekorativ vattenstämpel */}
        <div
          style={{
            position: "absolute",
            right: "-40px",
            top: "-90px",
            fontSize: "620px",
            fontWeight: 800,
            color: "rgba(255,210,30,0.12)",
            lineHeight: 1,
          }}
        >
          5
        </div>

        {/* Etikett överst */}
        <div style={{ display: "flex", alignItems: "center", gap: "18px", marginBottom: "28px" }}>
          <div style={{ width: "18px", height: "18px", borderRadius: "50%", backgroundColor: YELLOW }} />
          <div
            style={{
              fontSize: "30px",
              letterSpacing: "6px",
              color: "rgba(255,255,255,0.75)",
              fontWeight: 700,
            }}
          >
            SÖDERTÄLJE SK · FANTASYSPEL
          </div>
        </div>

        {/* Wordmark */}
        <div style={{ display: "flex", fontSize: "130px", fontWeight: 800, lineHeight: 1 }}>
          {wordmark.map((l, i) => (
            <span key={i} style={{ color: l.color }}>
              {l.c}
            </span>
          ))}
        </div>

        {/* Tagline */}
        <div style={{ fontSize: "40px", color: "rgba(255,255,255,0.9)", marginTop: "26px", fontWeight: 600, maxWidth: "1000px" }}>
          Välj din femma. Tippa matcherna. Toppa ligan.
        </div>

        {/* Nedre rad */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px", marginTop: "48px" }}>
          <div style={{ fontSize: "38px", color: YELLOW, fontWeight: 800 }}>sskfemman.se</div>
          <div style={{ fontSize: "30px", color: "rgba(255,255,255,0.6)" }}>· gratis att spela</div>
        </div>

        {/* Gul kantlinje nedtill */}
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "100%",
            height: "14px",
            backgroundColor: YELLOW,
          }}
        />
      </div>
    ),
    { ...size }
  );
}

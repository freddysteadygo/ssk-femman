// Tröjikon som SVG. SSK-färger (blå/gul) som standard.
// Justera BASE/TRIM/TEXT för att matcha en specifik matchtröja.
const BASE = "#1e50c8"; // tröjans grundfärg (blå)
const TRIM = "#ffd21e"; // axlar/krage/kant (gul)
const TEXT = "#ffd21e"; // nummerfärg (gul)

export function Jersey({
  number,
  size = 54,
  base = BASE,
  trim = TRIM,
  text = TEXT,
  dimmed = false,
}: {
  number?: number | null;
  size?: number;
  base?: string;
  trim?: string;
  text?: string;
  dimmed?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ opacity: dimmed ? 0.35 : 1 }}
      aria-hidden="true"
    >
      {/* tröjsilhuett */}
      <path
        d="M35,16 L27,19 L6,34 L18,54 L31,47 L31,92 L69,92 L69,47 L82,54 L94,34 L73,19 L65,16 C60,25 40,25 35,16 Z"
        fill={base}
        stroke={trim}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* gula axelränder */}
      <path d="M27,19 L6,34 L18,54 L26,49 L14,35 L31,24 Z" fill={trim} opacity="0.95" />
      <path d="M73,19 L94,34 L82,54 L74,49 L86,35 L69,24 Z" fill={trim} opacity="0.95" />
      {/* gul nederkant */}
      <rect x="31" y="87" width="38" height="5" fill={trim} opacity="0.95" />
      {number != null && (
        <text
          x="50"
          y="72"
          textAnchor="middle"
          fontSize="34"
          fontWeight="800"
          fontFamily="system-ui, sans-serif"
          fill={text}
        >
          {number}
        </text>
      )}
    </svg>
  );
}

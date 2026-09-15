// Referensstatistik säsongen 2025/26 (Södertälje SK) — källa: eliteprospects.
// Visas som "förra säsongen" på spelarkorten tills årets säsong genererar egen data.
// Endast spelare som fanns i SSK 25/26. Nyförvärv saknas här (visas som "Ny i klubben").
// Nyckel = spelarens full_name exakt som i truppen.

export interface SkaterStat2526 { gp: number; g: number; a: number; tp: number; pim: number }
export interface GoalieStat2526 { gp: number; gaa: number; svs: number }

export const SKATER_2526: Record<string, SkaterStat2526> = {
  "Daniel Norbe": { gp: 51, g: 8, a: 23, tp: 31, pim: 14 },
  "Roope Laavainen": { gp: 40, g: 4, a: 13, tp: 17, pim: 22 },
  "Niklas Arell": { gp: 50, g: 3, a: 4, tp: 7, pim: 16 },
  "Ludvig Söderberg": { gp: 6, g: 0, a: 0, tp: 0, pim: 0 },
  "Hampus Harlestam": { gp: 48, g: 4, a: 19, tp: 23, pim: 20 },
  "Adam Hesselvall": { gp: 49, g: 1, a: 8, tp: 9, pim: 12 },
  "Filip Holst Persson": { gp: 38, g: 1, a: 3, tp: 4, pim: 31 },
  "Måns Lindbäck": { gp: 25, g: 4, a: 3, tp: 7, pim: 14 },
  "A.J. Vanderbeck": { gp: 7, g: 2, a: 2, tp: 4, pim: 4 },
  "Teemu Väyrynen": { gp: 30, g: 4, a: 6, tp: 10, pim: 14 },
};

export const GOALIE_2526: Record<string, GoalieStat2526> = {
  "Love Härenstam": { gp: 32, gaa: 1.81, svs: 0.92 },
};

import type { ArchiveRecord } from "./data";

/**
 * Per-game loading screens shown on the monitor while the disc is read.
 * A record opts in with `loader` in content/archives.json; `t` runs 0 → 1
 * across the read and the painter owns the whole 16:9 canvas.
 */
export type GameLoader = (c: CanvasRenderingContext2D, w: number, h: number, t: number) => void;

const ease = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
const span = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));

// LOCKDOWN: the game's ingredient pieces drop into the pan one by one as the
// progress bar, then the cell-built title snaps in. Colours match the game;
// the shapes are fitted so they fill the 6×4 pan exactly.
const PAN_COLS = 6, PAN_ROWS = 4;
const PIECES: { color: string; cells: [number, number][] }[] = [
  { color: "#d9706a", cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2], [0, 3]] }, // pork
  { color: "#ece8dc", cells: [[2, 0], [3, 0], [4, 0], [3, 1], [3, 2]] },                   // rice
  { color: "#86cf5e", cells: [[2, 1], [2, 2], [1, 3], [2, 3], [3, 3]] },                   // cabbage
  { color: "#c9a54e", cells: [[5, 0], [5, 1], [5, 2], [4, 1]] },                           // potato
  { color: "#f5e39a", cells: [[4, 2], [4, 3], [5, 3]] },                                   // egg
];
const GLYPHS: Record<string, string[]> = {
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
};

const lockdown: GameLoader = (c, w, h, t) => {
  c.fillStyle = "#1d2326";
  c.fillRect(0, 0, w, h);
  const cell = h * 0.085, pw = PAN_COLS * cell, ph = PAN_ROWS * cell;
  const ox = (w - pw) / 2, oy = h * 0.2;
  // Pan rim and empty grid.
  c.fillStyle = "#151a1c";
  c.fillRect(ox - cell * 0.4, oy - cell * 0.4, pw + cell * 0.8, ph + cell * 0.8);
  c.strokeStyle = "#8c9396";
  c.lineWidth = 3;
  c.strokeRect(ox - cell * 0.4, oy - cell * 0.4, pw + cell * 0.8, ph + cell * 0.8);
  c.fillStyle = "#262c2e";
  for (let y = 0; y < PAN_ROWS; y++) for (let x = 0; x < PAN_COLS; x++) c.fillRect(ox + x * cell + 2, oy + y * cell + 2, cell - 4, cell - 4);
  // Pieces fall in sequence over the first 80% of the read, with a small settle.
  PIECES.forEach((p, i) => {
    const k = span(t, i * 0.15, i * 0.15 + 0.16);
    if (!k) return;
    const drop = (1 - ease(k)) * -h * 0.25, bounce = Math.sin(Math.min(1, k * 1.3) * Math.PI) * (k > 0.75 ? 4 : 0);
    c.globalAlpha = Math.min(1, k * 3);
    c.fillStyle = p.color;
    for (const [x, y] of p.cells) c.fillRect(ox + x * cell + 3, oy + y * cell + 3 + drop - bounce, cell - 6, cell - 6);
    c.globalAlpha = 1;
  });
  // Title snaps in once the pan is full.
  const title = ease(span(t, 0.78, 0.9));
  if (title) {
    const tc = h * 0.016, tw = "LOCKDOWN".length * tc * 6 - tc;
    let x = (w - tw) / 2;
    const y = oy + ph + h * 0.11 + (1 - title) * 10;
    c.globalAlpha = title;
    for (const ch of "LOCKDOWN") {
      GLYPHS[ch].forEach((row, r) => [...row].forEach((bit, col) => {
        if (bit !== "1") return;
        c.fillStyle = ch === "O" && r === 3 && col === 0 && x > (w - tw) / 2 ? "#d48c80" : "#f2ece4";
        c.fillRect(x + col * tc, y + r * tc, tc - 1, tc - 1);
      }));
      x += tc * 6;
    }
    c.globalAlpha = 1;
  }
  c.textAlign = "center";
  c.font = `500 ${h * 0.032}px MiSans, sans-serif`;
  c.fillStyle = "rgba(242,236,228,.55)";
  c.fillText(t < 0.78 ? "Preparing today's meal…" : "STAY HOME. KEEP EVERYONE FED.", w / 2, h * 0.92);
};

const LOADERS: Record<string, GameLoader> = { lockdown };

export function loaderFor(record: ArchiveRecord): GameLoader | undefined {
  return record.loader ? LOADERS[record.loader] : undefined;
}

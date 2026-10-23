import type { ArchiveRecord } from "./data";

/**
 * Per-game loading screens shown on the monitor while the disc is read.
 * A record opts in with `loader` in content/archives.json; `t` runs 0 → 1
 * across the read and the painter owns the whole 16:9 canvas. `art` is the work's key
 * art when it has loaded, for loaders that end on it so the handoff to the page is seamless.
 */
export type GameLoader = (c: CanvasRenderingContext2D, w: number, h: number, t: number, art?: CanvasImageSource) => void;

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

// Trail Adventure: the monitor becomes Leo's camera. The live view is the key art
// (public/works/x-003/hero.jpg) seen through the viewfinder, zoomed in on the trail
// and panning up it to the summit while the focus box hunts, then locks on the hiker.
// The shutter fires, the game's rating card scores the shot, and the frame left
// behind is the key art itself, so the page grows out of the very photo just taken.
const TRAIL_GREEN = "#8ee08a";
// Where the hiker stands in the key art, as fractions (summit at 1300, 420 of 1920 × 1080;
// the figure is about 0.15 of the height tall).
const TRAIL_HIKER: [number, number] = [1300 / 1920, 340 / 1080];
// Stand-in ranges for when the key art has not loaded (hero() in trail_poster.mjs).
const TRAIL_FRONT: { color: string; pts: [number, number][] }[] = [
  { color: "#b7d2c3", pts: [[0.5, 0.75], [0.6, 0.48], [0.677, 0.39], [0.72, 0.46], [0.86, 0.62], [1.02, 0.7]] },
  { color: "#97b9aa", pts: [[-0.02, 0.66], [0.1, 0.6], [0.24, 0.65], [0.4, 0.57], [0.55, 0.64], [0.78, 0.55], [0.9, 0.6], [1.02, 0.57]] },
  { color: "#779d90", pts: [[-0.02, 0.7], [0.12, 0.66], [0.3, 0.72], [0.5, 0.65], [0.66, 0.71], [0.86, 0.64], [1.02, 0.69]] },
  { color: "#5a8076", pts: [[-0.02, 0.8], [0.09, 0.74], [0.26, 0.8], [0.45, 0.74], [0.6, 0.81], [0.79, 0.76], [1.02, 0.82]] },
  { color: "#41645c", pts: [[-0.02, 0.88], [0.15, 0.84], [0.32, 0.9], [0.52, 0.85], [0.7, 0.91], [0.88, 0.86], [1.02, 0.9]] },
  { color: "#2c4640", pts: [[-0.02, 0.95], [0.2, 0.92], [0.42, 0.96], [0.64, 0.93], [0.84, 0.97], [1.02, 0.94]] },
];
const inOut = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
let trailFallback: HTMLCanvasElement | undefined;

/** A flat dusk scene in the key art's layout, drawn once, for when the art is not ready. */
function trailStandIn(w: number, h: number) {
  if (trailFallback?.width === w) return trailFallback;
  const canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
  const c = canvas.getContext("2d")!;
  const sky = c.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#efdccb");
  sky.addColorStop(1, "#d3e8da");
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);
  for (const { color, pts } of TRAIL_FRONT) {
    c.fillStyle = color;
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x * w, y * h) : c.moveTo(x * w, y * h)));
    c.lineTo(pts[pts.length - 1][0] * w, h);
    c.lineTo(pts[0][0] * w, h);
    c.fill();
  }
  c.fillStyle = "#ffffff";
  c.fillRect(TRAIL_HIKER[0] * w - h * 0.012, TRAIL_HIKER[1] * h - h * 0.07, h * 0.024, h * 0.15);
  return (trailFallback = canvas);
}

const trail: GameLoader = (c, w, h, t, art) => {
  // The caller fades the loader in through globalAlpha; every layer here multiplies into it.
  const alpha = c.globalAlpha;
  const view = art ?? trailStandIn(w, h);
  // Live view: zoomed in on the trail low on the left, panning up to the summit, then
  // easing back out to the full frame, which is exactly the key art.
  const a = inOut(span(t, 0, 0.36)), b = inOut(span(t, 0.3, 0.58));
  const zoom = lerp(lerp(1.5, 1.28, a), 1, b);
  const cx = lerp(lerp(0.36, 0.6, a), 0.5, b), cy = lerp(lerp(0.66, 0.42, a), 0.5, b);
  const toScreen = (fx: number, fy: number) => [w / 2 + (fx - cx) * w * zoom, h / 2 + (fy - cy) * h * zoom] as const;
  const [vx, vy] = toScreen(0, 0);
  c.fillStyle = "#1f2a27";
  c.fillRect(0, 0, w, h);
  c.drawImage(view, vx, vy, w * zoom, h * zoom);
  // Viewfinder chrome, as in the game: a dark rounded mask, corner brackets, thirds,
  // the exposure strip and the shot counter. It clears away after the shot.
  const ui = 1 - ease(span(t, 0.66, 0.74));
  const fired = t >= 0.62;
  if (ui) {
    c.globalAlpha = alpha * ui;
    const ix = w * 0.07, iy = h * 0.08, iw = w - ix * 2, ih = h * 0.8, r = h * 0.06;
    c.fillStyle = "rgba(18,26,24,.5)";
    c.beginPath();
    c.rect(0, 0, w, h);
    c.roundRect(ix, iy, iw, ih, r);
    c.fill("evenodd");
    const arm = h * 0.05;
    c.strokeStyle = "rgba(255,255,255,.92)";
    c.lineWidth = 3;
    for (const [px, py, sx, sy] of [[ix + r * 0.6, iy + r * 0.6, 1, 1], [ix + iw - r * 0.6, iy + r * 0.6, -1, 1], [ix + r * 0.6, iy + ih - r * 0.6, 1, -1], [ix + iw - r * 0.6, iy + ih - r * 0.6, -1, -1]]) {
      c.beginPath(); c.moveTo(px, py + sy * arm); c.lineTo(px, py); c.lineTo(px + sx * arm, py); c.stroke();
    }
    c.strokeStyle = "rgba(255,255,255,.25)";
    c.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      c.beginPath(); c.moveTo(ix + (iw * i) / 3, iy); c.lineTo(ix + (iw * i) / 3, iy + ih); c.stroke();
      c.beginPath(); c.moveTo(ix, iy + (ih * i) / 3); c.lineTo(ix + iw, iy + (ih * i) / 3); c.stroke();
    }
    // The focus box drifts across the trail, then finds the hiker and locks.
    const [hx, hy] = toScreen(TRAIL_HIKER[0], TRAIL_HIKER[1]);
    const find = inOut(span(t, 0.3, 0.5)), locked = t > 0.5;
    const drift = (1 - find) * h * 0.03;
    const fx = lerp(w * 0.42, hx, find) + Math.sin(t * 40) * drift, fy = lerp(h * 0.58, hy, find) + Math.cos(t * 33) * drift;
    const fs = h * lerp(0.16, 0.11, find) * (locked ? 1 - 0.08 * Math.sin(Math.min(1, (t - 0.5) / 0.04) * Math.PI) : 1);
    c.strokeStyle = locked ? TRAIL_GREEN : "rgba(255,255,255,.9)";
    c.lineWidth = 3;
    const q = fs * 0.28;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const px = fx + (sx * fs) / 2, py = fy + (sy * fs) / 2;
      c.beginPath(); c.moveTo(px, py - sy * q); c.lineTo(px, py); c.lineTo(px - sx * q, py); c.stroke();
    }
    c.font = `500 ${h * 0.032}px MiSans, sans-serif`;
    c.textAlign = "left";
    c.fillStyle = locked ? TRAIL_GREEN : "rgba(255,255,255,.75)";
    c.fillText(locked ? "●  HIKER   STILL" : "●  FOCUSING…", ix + r * 0.4, iy - h * 0.022);
    c.fillStyle = "rgba(18,26,24,.6)";
    c.fillRect(ix, iy + ih + h * 0.025, iw, h * 0.065);
    c.fillStyle = TRAIL_GREEN;
    c.fillText(`1/250   F5.6   ISO 200   ${Math.round(35 * zoom)}MM`, ix + h * 0.025, iy + ih + h * 0.068);
    c.textAlign = "right";
    c.fillText(fired ? "[ 15 ]" : "[ 16 ]", ix + iw - h * 0.025, iy + ih + h * 0.068);
    c.globalAlpha = alpha;
  }
  // Shutter: two curtains meet in the middle and part again, with a soft flash.
  const shut = span(t, 0.6, 0.64);
  if (shut > 0 && shut < 1) {
    const k = shut < 0.5 ? inOut(shut * 2) : 1 - inOut((shut - 0.5) * 2);
    c.fillStyle = "#0b0f0e";
    c.fillRect(0, 0, w, (h / 2) * k);
    c.fillRect(0, h - (h / 2) * k, w, (h / 2) * k);
  }
  const flash = span(t, 0.62, 0.68);
  if (flash > 0 && flash < 1) {
    c.fillStyle = `rgba(255,250,240,${0.28 * (1 - flash)})`;
    c.fillRect(0, 0, w, h);
  }
  // The game's rating card rises in the corner, the stars stamp in one by one, then it goes.
  const card = ease(span(t, 0.66, 0.72)) * (1 - inOut(span(t, 0.84, 0.92)));
  if (card) {
    const cw = h * 0.5, ch = h * 0.2, x = w * 0.06, y = h * 0.92 - ch + (1 - card) * h * 0.12;
    c.globalAlpha = alpha * Math.min(1, card * 1.4);
    c.fillStyle = "rgba(0,0,0,.18)";
    c.fillRect(x + 6, y + 8, cw, ch);
    c.fillStyle = "#fbf4e2";
    c.fillRect(x, y, cw, ch);
    c.fillStyle = "rgba(169,216,196,.9)";
    c.save(); c.translate(x + cw * 0.12, y); c.rotate(-0.08); c.fillRect(-cw * 0.08, -ch * 0.08, cw * 0.18, ch * 0.18); c.restore();
    for (let i = 0; i < 3; i++) {
      const k = ease(span(t, 0.72 + i * 0.03, 0.76 + i * 0.03));
      const s = h * 0.03 * (k ? 1 + (1 - k) * 0.7 : 1), sx = x + cw * 0.14 + i * h * 0.075, sy = y + ch * 0.4;
      c.fillStyle = k ? "#e08e3c" : "rgba(67,54,42,.18)";
      c.beginPath();
      for (let j = 0; j < 10; j++) {
        const an = -Math.PI / 2 + (j * Math.PI) / 5, rr = j % 2 ? s * 0.45 : s;
        c.lineTo(sx + Math.cos(an) * rr, sy + Math.sin(an) * rr);
      }
      c.fill();
    }
    c.textAlign = "left";
    c.fillStyle = "#43362a";
    c.font = `600 ${h * 0.03}px MiSans, sans-serif`;
    c.fillText("SUMMIT  ·  GOLDEN HOUR", x + cw * 0.08, y + ch * 0.8);
    c.globalAlpha = alpha;
  }
};

const LOADERS: Record<string, GameLoader> = { lockdown, trail };

export function loaderFor(record: ArchiveRecord): GameLoader | undefined {
  return record.loader ? LOADERS[record.loader] : undefined;
}

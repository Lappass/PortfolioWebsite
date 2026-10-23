// Cover and key art for LOCKDOWN (work X-002).
// Homage in method only: the composition of the Ratatouille poster, the view from a
// rooftop at night over a city of lit windows. Here it is the view from a balcony ledge
// during the lockdown: a low-poly skyline where only a few windows are still lit, and in
// front of it one apartment block whose lit windows spell out the game's packed pan,
// steam rising from its kitchen vent. Flat, faceted shapes throughout; the title is built
// from cells.
// Run: node art/lockdown_poster.mjs  (needs sharp; SHARP_MODULE may point to it)
// OUT_DIR renders somewhere else (drafts); screenshots are always read from public/works/x-002.
import { mkdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const { default: sharp } = await import(process.env.SHARP_MODULE ? pathToFileURL(resolve(process.env.SHARP_MODULE)).href : "sharp");
const WORKS = resolve(new URL("../public/works/x-002/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const OUT = process.env.OUT_DIR ? resolve(process.env.OUT_DIR) : WORKS;
mkdirSync(OUT, { recursive: true });

// Palette sampled from the game.
const C = {
  night: "#1d2326", wall: "#2c3438", wallLit: "#353e42", frame: "#151a1c", pane: "#232b2e",
  warm: "#f2c879", glow: "#e9a75a", pork: "#d48c80", tofu: "#ece5cf", green: "#9cc77a", tan: "#c9a54e",
  ink: "#f2ece4", muted: "#8f9690",
};

// The game's five cooking pieces (Assets/Art/UI cooking panel): pork, rice, cabbage,
// potato and egg, packed into a round pan (# is outside the pan, . an empty cell); the
// lit windows draw this map. Colours are sampled from the game's fridge grid; pork is
// not shown there, so it is the same pale tone pushed toward pink.
const PIECE = { P: "#dcb0a4", R: "#d4dbcb", C: "#a2dd83", T: "#bdb586", E: "#dbddae" };
const PAN = ["#PP.C#", "PPPCCC", "PPRTCE", "RRRTEE", "#.RTT#"];

// Cell-built letters, 5 wide x 7 tall.
const GLYPHS = {
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
};
function blockWord(word, x, y, cell, gap, fill) {
  let out = "", cx = x;
  for (const ch of word) {
    const g = GLYPHS[ch];
    g.forEach((row, r) => [...row].forEach((bit, c) => {
      if (bit === "1") out += `<rect x="${cx + c * cell}" y="${y + r * cell}" width="${cell - gap}" height="${cell - gap}" fill="${ch === "O" && r === 3 && c === 0 && cx > x ? C.pork : fill}"/>`;
    }));
    cx += cell * 6;
  }
  return { svg: out, width: cx - x - cell };
}
const wordWidth = (word, cell) => word.length * cell * 6 - cell;

// Deterministic randomness so re-runs match.
let seed = 20200323;
const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

const mix = (a, b, t) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("");
const pt = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;

const defs = `<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e1213"/><stop offset=".6" stop-color="${C.night}"/><stop offset="1" stop-color="#33404a"/></linearGradient>
  <radialGradient id="halo"><stop offset="0" stop-color="${C.glow}" stop-opacity=".55"/><stop offset="1" stop-color="${C.glow}" stop-opacity="0"/></radialGradient>
  <radialGradient id="moonHalo"><stop offset="0" stop-color="${C.tofu}" stop-opacity=".3"/><stop offset=".3" stop-color="${C.tofu}" stop-opacity=".08"/><stop offset="1" stop-color="${C.tofu}" stop-opacity="0"/></radialGradient>
  <radialGradient id="planet"><stop offset=".42" stop-color="#3f4e58"/><stop offset=".56" stop-color="#34414a"/><stop offset=".86" stop-color="${C.night}"/><stop offset="1" stop-color="#0e1213"/></radialGradient>
  <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.glow}" stop-opacity="0"/><stop offset="1" stop-color="${C.glow}" stop-opacity=".14"/></linearGradient>
  <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.night}" stop-opacity=".1"/><stop offset="1" stop-color="${C.night}"/></linearGradient>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .05 0"/></filter>
</defs>`;
const text = (x, y, size, str, opts = "", fill = C.ink) => `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" fill="${fill}" ${opts}>${str}</text>`;

// Building tones by distance: far blocks sit in the haze, near ones are almost silhouettes.
const DIST = { front: "#2e3a41", side: "#344149", roof: "#39464e", pane: "#2b363c", win: 5 };
const FAR = { front: "#2b363c", side: "#36434b", roof: "#3e4c54", pane: "#273137", win: 6 };
const MID = { front: "#1f272a", side: "#2a3438", roof: "#333f45", pane: "#1a2124", win: 8 };
const NEAR = { front: "#161b1d", side: "#1f2629", roof: "#293236", pane: "#121618", win: 11 };

const stars = (x0, y0, w, h, n) => Array.from({ length: n }, () =>
  `<circle cx="${(x0 + rand() * w).toFixed(1)}" cy="${(y0 + rand() * h).toFixed(1)}" r="${rand() < 0.15 ? 2.2 : 1.2}" fill="${C.tofu}" opacity="${(0.2 + rand() * 0.5).toFixed(2)}"/>`).join("");

/** A faceted moon: a polygon cut into wedges, each shaded by its angle to the light. */
function moon(x, y, r, halo = true) {
  let out = halo ? `<circle cx="${x}" cy="${y}" r="${r * 4.5}" fill="url(#moonHalo)"/>` : "";
  const n = 14, c = [x + r * 0.2, y + r * 0.14];
  const p = (i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return [x + r * Math.cos(a), y + r * Math.sin(a)]; };
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2, lit = 0.5 + 0.5 * Math.cos(a + 2.3);
    const fill = mix(C.tofu, "#a9b0a6", (1 - lit) * 0.45);
    out += `<polygon points="${pt(...c)} ${pt(...p(i))} ${pt(...p(i + 1))}" fill="${fill}" stroke="${fill}" stroke-width=".8"/>`;
  }
  for (const [dx, dy, k] of [[-0.35, -0.2, 0.22], [0.25, 0.35, 0.16], [0.4, -0.35, 0.1]])
    out += `<polygon points="${[0, 1, 2, 3, 4, 5].map((i) => pt(x + dx * r + Math.cos(i * 1.047) * k * r, y + dy * r + Math.sin(i * 1.047) * k * r)).join(" ")}" fill="#b9bdb0" opacity=".55"/>`;
  return out;
}

/** One low-poly block standing on `base`: front face with windows, a moonlit side and a
 *  roof seen from above. Only a few windows are lit. */
function block(x, base, w, h, tone, litP, roof) {
  const d = Math.max(5, w * 0.22), rise = d * 0.45, top = base - h;
  let out = `<polygon points="${pt(x + w, top)} ${pt(x + w + d, top - rise)} ${pt(x + w + d, base)} ${pt(x + w, base)}" fill="${tone.side}"/>`;
  out += `<polygon points="${pt(x, top)} ${pt(x + d, top - rise)} ${pt(x + w + d, top - rise)} ${pt(x + w, top)}" fill="${tone.roof}"/>`;
  out += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${tone.front}"/>`;
  const cw = tone.win, cols = Math.floor((w - cw) / (cw * 2)), rows = Math.floor((h - cw * 2) / (cw * 2.3));
  const mx = x + (w - (cols * cw * 2 - cw)) / 2;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const wx = mx + c * cw * 2, wy = top + cw * 1.6 + r * cw * 2.3;
    if (rand() < litP) out += `<rect x="${(wx - cw * 1.5).toFixed(1)}" y="${(wy - cw * 1.5).toFixed(1)}" width="${cw * 4}" height="${cw * 4.3}" fill="url(#halo)" opacity=".75"/><rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${cw}" height="${(cw * 1.3).toFixed(1)}" fill="${C.warm}"/>`;
    else out += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${cw}" height="${(cw * 1.3).toFixed(1)}" fill="${tone.pane}"/>`;
  }
  const rx = x + d * 0.5, ry = top - rise * 0.5;
  if (roof === "tank" && w > 40) {
    const tw = Math.min(26, w * 0.3), tx = rx + w * 0.55, th = tw * 0.9;
    out += `<rect x="${tx}" y="${ry - th - tw * 0.4}" width="${tw}" height="${th}" fill="${tone.side}"/><rect x="${tx}" y="${ry - th - tw * 0.4}" width="${tw * 0.45}" height="${th}" fill="${tone.front}"/>`;
    out += `<polygon points="${pt(tx - 2, ry - th - tw * 0.4)} ${pt(tx + tw / 2, ry - th - tw * 0.85)} ${pt(tx + tw + 2, ry - th - tw * 0.4)}" fill="${tone.roof}"/>`;
    out += `<rect x="${tx + 2}" y="${ry - tw * 0.4}" width="2" height="${tw * 0.4}" fill="${tone.side}"/><rect x="${tx + tw - 4}" y="${ry - tw * 0.4}" width="2" height="${tw * 0.4}" fill="${tone.side}"/>`;
  } else if (roof === "mast") {
    const mh = 30 + h * 0.25;
    out += `<rect x="${rx + w * 0.3}" y="${ry - mh}" width="2.5" height="${mh}" fill="${tone.side}"/><rect x="${rx + w * 0.3 - 6}" y="${ry - mh * 0.7}" width="14" height="2" fill="${tone.side}"/>`;
  } else if (roof === "step" && w > 36) {
    const sw = w * 0.5, sh = Math.min(h * 0.18, 60);
    out += block(x + w * 0.18, top - rise * 0.2, sw, sh, tone, litP, "flat");
  }
  return out;
}

/** A row of blocks across [x0, x1], overlapping like a dense city. */
function skyline(x0, x1, base, hMin, hMax, wMin, wMax, tone, litP) {
  let out = "", x = x0 - rand() * wMax;
  while (x < x1) {
    const w = wMin + rand() * (wMax - wMin), h = hMin + rand() * (hMax - hMin), k = rand();
    out += block(x, base, w, h, tone, litP, k < 0.18 ? "tank" : k < 0.3 ? "mast" : k < 0.42 ? "step" : "flat");
    x += w * (0.72 + rand() * 0.45);
  }
  return out;
}

/** Steam: three thin curls rising from (x, y) and drifting toward `drift`, flat and pale like
 *  the game's UI, thinning into the sky as they climb. */
function steam(x, y, len, drift, width) {
  let out = "";
  for (let k = 0; k < 3; k++) {
    const ph = rand() * 6.28, ph2 = rand() * 6.28, f1 = 6 + rand() * 3, f2 = 12 + rand() * 5, amp = width * (1.6 + rand() * 0.8), x0 = x + (k - 1) * width * 1.1, reach = len * [0.82, 1, 0.68][k];
    let prev = null, line = "";
    for (let i = 0; i <= 64; i++) {
      const t = i / 64, py = y - reach * t, px = x0 + (k - 1) * width * 3 * t + drift * Math.pow(t, 1.3) + (Math.sin(t * f1 + ph) * 0.75 + Math.sin(t * f2 + ph2) * 0.25) * amp * (0.3 + 2 * t);
      if (prev) {
        const w = width * (0.5 + t * 0.7) * (k === 1 ? 1 : 0.7);
        const col = mix("#d6d5c3", "#1b2124", Math.pow(t, 1.1) * 0.95);
        line += `<line x1="${prev}" x2="${px.toFixed(1)}" y1="${(py + reach / 64).toFixed(1)}" y2="${py.toFixed(1)}" stroke="${col}" stroke-width="${w.toFixed(1)}" stroke-linecap="round"/>`;
      }
      prev = px.toFixed(1);
    }
    out += `<g opacity="${k === 1 ? 0.6 : 0.4}">${line}</g>`;
  }
  return out;
}

/** The balcony ledge across the foreground: top face warmed by the kitchen light behind
 *  the viewer, a dark front, then balusters fading into the balcony floor. */
function ledge(x, w, y, light, scale = 1) {
  const top = 38 * scale, front = 46 * scale, bars = 120 * scale;
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${top}" fill="#384246"/>`;
  out += `<ellipse cx="${light}" cy="${y + top / 2}" rx="${w * 0.36}" ry="${top / 2}" fill="url(#halo)" opacity=".7"/>`;
  out += `<rect x="${x}" y="${y}" width="${w}" height="${3 * scale}" fill="#56626a"/>`;
  out += `<rect x="${x}" y="${y + top}" width="${w}" height="${front}" fill="#252d30"/><rect x="${x}" y="${y + top}" width="${w}" height="${5 * scale}" fill="${C.frame}"/>`;
  const by = y + top + front, step = 66 * scale, bw = 20 * scale;
  out += `<rect x="${x}" y="${by}" width="${w}" height="${bars}" fill="#0f1314"/>`;
  for (let bx = x + step / 2; bx < x + w; bx += step) out += `<rect x="${bx}" y="${by}" width="${bw}" height="${bars}" fill="#2a3236"/><rect x="${bx}" y="${by}" width="${bw * 0.3}" height="${bars}" fill="#343e43"/>`;
  out += `<rect x="${x}" y="${by}" width="${w}" height="${bars}" fill="url(#dusk)"/>`;
  return { svg: out, bottom: by + bars };
}

/** The household: one apartment block in front of the city whose lit windows spell out the
 *  packed pan, each window a cell in its piece's colour, dimmed to the night. Steam rises
 *  from the kitchen vent on its roof. Centred on cx, standing on `base`, w wide. */
function litBlock(cx, base, w) {
  const h = w * 1.75, x = cx - w / 2, top = base - h, d = w * 0.22, rise = d * 0.45;
  let out = `<polygon points="${pt(x + w, top)} ${pt(x + w + d, top - rise)} ${pt(x + w + d, base)} ${pt(x + w, base)}" fill="${MID.side}"/>`;
  out += `<polygon points="${pt(x, top)} ${pt(x + d, top - rise)} ${pt(x + w + d, top - rise)} ${pt(x + w, top)}" fill="${MID.roof}"/>`;
  out += `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${MID.front}"/>`;
  // Eight columns of windows with even gaps, inset from the edges by three quarters of a window.
  const cols = 8, ww = w / (cols * 1.5 + 1), step = ww * 1.5, mx = x + ww * 0.75, pitch = ww * 1.8, rows = Math.floor((h - ww) / pitch);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const key = PAN[r - 2]?.[c - 1], wx = mx + c * step, wy = top + ww * 0.9 + r * pitch;
    if (PIECE[key]) out += `<rect x="${wx - ww * 0.6}" y="${wy - ww * 0.6}" width="${ww * 2.2}" height="${ww * 2.5}" fill="url(#halo)" opacity=".45"/><rect x="${wx}" y="${wy}" width="${ww}" height="${ww * 1.3}" fill="${mix(PIECE[key], "#1d2a33", 0.28)}"/>`;
    else out += `<rect x="${wx}" y="${wy}" width="${ww}" height="${ww * 1.3}" fill="${MID.pane}"/>`;
  }
  const vx = x + w * 0.62, vy = top - rise * 0.5;
  out += `<rect x="${vx}" y="${vy - w * 0.12}" width="${w * 0.07}" height="${w * 0.12}" fill="${MID.side}"/><rect x="${vx - w * 0.015}" y="${vy - w * 0.14}" width="${w * 0.1}" height="${w * 0.03}" fill="${MID.roof}"/>`;
  return { svg: out, steam: [vx + w * 0.035, vy - w * 0.14] };
}

/** The night view shared by the cover and the hero: sky and moon, a far and a mid skyline,
 *  the household block with its steam, and the ledge in front. */
function scene(W, o) {
  seed = o.seed;
  let s = `<rect width="${W}" height="${o.ledge + 60}" fill="url(#sky)"/>`;
  s += stars(0, 0, W, o.ledge * 0.6, o.stars);
  s += moon(o.moon[0], o.moon[1], o.moon[2]);
  s += skyline(-40, W + 40, o.ledge + 10, o.far[1] * 0.7, o.far[1] * 1.35, 50, 110, DIST, 0.006);
  s += skyline(-40, W + 40, o.ledge + 10, o.far[0], o.far[1], 60, 130, FAR, 0.012);
  s += `<rect x="0" y="${o.ledge - 240}" width="${W}" height="250" fill="url(#haze)"/>`;
  s += skyline(-40, W + 40, o.ledge + 10, o.mid[0], o.mid[1], 90, 190, MID, 0.018);
  for (const [x, w, h] of o.near) s += block(x, o.ledge + 10, w, h, NEAR, 0.03, "tank");
  const home = litBlock(o.home[0], o.ledge + 10, o.home[1]), ld = ledge(0, W, o.ledge, o.home[0]);
  s += home.svg + steam(...home.steam, o.steam[0], o.steam[1], o.home[1] * 0.05) + ld.svg;
  return { svg: s, bottom: ld.bottom };
}

function cover() {
  const W = 1350, H = 1700;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}<rect width="${W}" height="${H}" fill="${C.night}"/>`;
  s += scene(W, { seed: 20200323, ledge: 1040, moon: [1030, 300, 96], stars: 70, far: [130, 330], mid: [50, 220], near: [[-70, 230, 640]], home: [640, 300], steam: [400, 150] }).svg;
  // Billing block, on the balcony floor.
  const cell = 27, title = "LOCKDOWN", tw = wordWidth(title, cell);
  s += blockWord(title, (W - tw) / 2, 1282, cell, 1, C.ink).svg;
  s += text(W / 2, 1545, 34, "A HOUSEHOLD SURVIVAL GAME", `text-anchor="middle" letter-spacing="10"`);
  s += `<rect x="${W / 2 - 60}" y="1578" width="120" height="4" fill="${C.warm}"/>`;
  s += text(W / 2, 1636, 22, "A GAME BY SHUHANG CHEN", `text-anchor="middle" letter-spacing="8"`, C.muted);
  s += `<rect width="${W}" height="${H}" filter="url(#grain)"/></svg>`;
  return { svg: s, W, H };
}

function hero() {
  const W = 1920, H = 1080;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}<rect width="${W}" height="${H}" fill="${C.night}"/>`;
  s += scene(W, { seed: 20200401, ledge: 880, moon: [1620, 220, 84], stars: 90, far: [110, 300], mid: [40, 200], near: [[-60, 250, 560]], home: [1260, 230], steam: [340, 140] }).svg;
  // No billing here: the project page sets the title over this art.
  s += `<rect width="${W}" height="${H}" filter="url(#grain)"/></svg>`;
  return { svg: s, W, H };
}

/** Spine strip, 148×1700 (the case spine is 0.148 × 1.7 units): a sliver of the night view
 *  with the household block steaming, the cell-built title running down, engine and year at the foot. */
function spine() {
  const W = 148, H = 1700, L = 300;
  seed = 20200410;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}<rect width="${W}" height="${H}" fill="${C.night}"/>`;
  s += `<rect width="${W}" height="${L}" fill="url(#sky)"/>` + stars(0, 0, W, 140, 8) + moon(112, 50, 15, false);
  s += skyline(-20, W + 20, L + 4, 40, 150, 26, 50, { ...FAR, win: 3 }, 0.03);
  s += skyline(-20, W + 20, L + 4, 20, 80, 34, 60, { ...MID, win: 4 }, 0.04);
  const home = litBlock(70, L + 4, 96);
  s += home.svg + steam(...home.steam, 120, 30, 4);
  s += `<rect x="0" y="${L}" width="${W}" height="14" fill="#384246"/><ellipse cx="70" cy="${L + 7}" rx="60" ry="7" fill="url(#halo)" opacity=".7"/><rect x="0" y="${L + 14}" width="${W}" height="18" fill="#252d30"/><rect x="0" y="${L + 14}" width="${W}" height="3" fill="${C.frame}"/>`;
  // Title down the spine, letters stacked top to bottom (read by tilting the head right).
  const cell = 15, tw = wordWidth("LOCKDOWN", cell), t0 = L + 90;
  s += `<g transform="translate(${W / 2 + 3.5 * cell} ${t0}) rotate(90)">${blockWord("LOCKDOWN", 0, 0, cell, 1, C.ink).svg}</g>`;
  const foot = t0 + tw + 70;
  s += `<rect x="${W / 2 - 22}" y="${foot}" width="44" height="4" fill="${C.warm}"/>`;
  s += `<g transform="translate(${W / 2 + 8} ${foot + 40}) rotate(90)">${text(0, 0, 22, "SHUHANG CHEN", 'letter-spacing="5"', C.muted)}</g>`;
  s += text(W / 2, H - 120, 22, "UNITY", 'text-anchor="middle" letter-spacing="3"', C.muted);
  s += text(W / 2, H - 70, 30, "2026", 'text-anchor="middle" font-weight="700" letter-spacing="2"', C.warm);
  s += `<rect width="${W}" height="${H}" filter="url(#grain)"/></svg>`;
  return { svg: s, W, H };
}

/** Disc label, 1024 square mapped onto the disc (hub hole ≈ 36% of the radius): the city as
 *  a tiny planet, blocks radiating out from the hub. The household block stands at the top,
 *  steaming, the moon beside it; the title rides a thin strip of caution tape. */
function disc() {
  const W = 1024, R = 512, ground = 214, hole = 184;
  seed = 20200415;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${defs}`;
  s += `<rect width="${W}" height="${W}" fill="${C.night}"/><circle cx="${R}" cy="${R}" r="${R}" fill="url(#planet)"/>`;
  for (let i = 0; i < 90; i++) {
    const a = rand() * Math.PI * 2, r = 400 + rand() * 105;
    s += `<circle cx="${(R + r * Math.cos(a)).toFixed(1)}" cy="${(R + r * Math.sin(a)).toFixed(1)}" r="${rand() < 0.15 ? 2 : 1.1}" fill="${C.tofu}" opacity="${(0.2 + rand() * 0.45).toFixed(2)}"/>`;
  }
  // The moon sits 38° clockwise of the top; blocks under it stay low so none cross it.
  const moonAt = 38, ma = ((moonAt - 90) * Math.PI) / 180;
  s += moon(R + 440 * Math.cos(ma), R + 440 * Math.sin(ma), 38);
  // Two rings of blocks, far (tall, hazy) then near (low, dark); the top is kept for the household.
  for (const [tone, hMin, hMax, wMin, wMax, lit] of [[{ ...FAR, win: 5 }, 70, 180, 30, 54, 0.03], [{ ...MID, win: 6 }, 30, 100, 36, 64, 0.04]]) {
    let a = rand() * 6;
    while (a < 354) {
      const w = wMin + rand() * (wMax - wMin), k = rand(), low = Math.abs(a - moonAt) < 14;
      const h = low ? Math.min(hMin + rand() * 40, 110) : hMin + rand() * (hMax - hMin);
      if (a > 13 && a < 347) s += `<g transform="rotate(${a.toFixed(2)} ${R} ${R})">${block(R - w / 2, R - ground + 6, w, h, tone, lit, low ? "flat" : k < 0.2 ? "tank" : k < 0.32 ? "mast" : k < 0.45 ? "step" : "flat")}</g>`;
      a += ((w * 0.8) / ground) * (180 / Math.PI);
    }
  }
  // The household stands on the planet like its neighbours: its foot goes under the ground.
  const home = litBlock(R - 8, R - ground + 22, 100);
  s += home.svg + steam(...home.steam, 90, 40, 5);
  s += `<circle cx="${R}" cy="${R}" r="${ground}" fill="#161b1d"/><circle cx="${R}" cy="${R}" r="${ground - 8}" fill="none" stroke="#2a3236" stroke-width="2" stroke-dasharray="10 8"/>`;
  // Hub.
  s += `<circle cx="${R}" cy="${R}" r="${hole}" fill="${C.night}"/><circle cx="${R}" cy="${R}" r="${hole - 60}" fill="none" stroke="#3a4246" stroke-width="2"/><circle cx="${R}" cy="${R}" r="56" fill="#0c0f10"/>`;
  // Billing on a thin strip of caution tape across the lower ring.
  s += `<g transform="rotate(-8 ${R} 815)">`;
  s += `<rect x="-100" y="776" width="${W + 200}" height="78" fill="#e9c443"/>`;
  for (let x = -100; x < W + 100; x += 34) s += `<polygon points="${x},776 ${x + 16},776 ${x + 4},786 ${x - 12},786" fill="#151a1c"/><polygon points="${x},854 ${x + 16},854 ${x + 4},844 ${x - 12},844" fill="#151a1c"/>`;
  const tc = 7, tw = wordWidth("LOCKDOWN", tc);
  s += blockWord("LOCKDOWN", R - tw / 2, 791, tc, 1, "#151a1c").svg.replaceAll(C.pork, "#b4483f");
  s += `</g>`;
  s += text(R, 925, 18, "UNITY · 2026", 'text-anchor="middle" letter-spacing="6"', C.ink);
  s += `<rect width="${W}" height="${W}" filter="url(#grain)"/></svg>`;
  return { svg: s, W, H: W };
}

/** Back cover, 1350×1700: pitch under the night sky, a screenshot strip, features, and the
 *  balcony ledge as the footer. */
function back() {
  const W = 1350, H = 1700, M = 96;
  const shot = (name) => "data:image/jpeg;base64," + readFileSync(resolve(WORKS, name)).toString("base64");
  seed = 20200420;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}`;
  s += `<rect width="${W}" height="${H}" fill="${C.night}"/><rect width="${W}" height="420" fill="url(#sky)"/>`;
  s += stars(0, 0, W, 300, 40) + moon(1262, 108, 42);
  s += skyline(860, W + 40, 420, 50, 190, 50, 100, FAR, 0.02);
  const home = litBlock(1150, 424, 108);
  s += home.svg + steam(...home.steam, 120, 50, 5);
  s += `<rect x="0" y="380" width="${W}" height="${H - 380}" fill="url(#dusk)" opacity=".9"/><rect x="0" y="420" width="${W}" height="${H - 420}" fill="${C.night}"/>`;
  // Pitch.
  s += text(M, 170, 30, "STAY HOME. KEEP EVERYONE FED.", 'letter-spacing="6" font-weight="700"', C.warm);
  const pitch = ["The city has gone quiet. Every day the delivery arrives,", "the family group chat fills up, and the news gets worse.", "Fit what you have into the pan, and make it last."];
  pitch.forEach((l, i) => { s += text(M, 240 + i * 46, 30, l, "", C.ink); });
  // Screenshot strip: one wide, two below.
  const frame = (img, x, y, w, h) => `<rect x="${x - 6}" y="${y - 6}" width="${w + 12}" height="${h + 12}" fill="${C.frame}"/><image href="${shot(img)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>`;
  const fw = W - M * 2;
  s += frame("kitchen.jpg", M, 420, fw, 470);
  const sw = (fw - 24) / 2, sh = Math.round(sw * 9 / 16), sy = 420 + 470 + 26;
  s += frame("prep.jpg", M, sy, sw, sh) + frame("fridge.jpg", M + sw + 24, sy, sw, sh);
  // Features, each marked with a small ingredient cell.
  const feats = ["Cook by fitting ingredient pieces into the pan", "Keep the fridge in order before food spoils", "Deliveries, messages and news shape each day"];
  const cols = [C.pork, C.green, C.tan];
  feats.forEach((t, i) => { const y = sy + sh + 84 + i * 54; s += `<rect x="${M}" y="${y - 24}" width="26" height="26" rx="3" fill="${cols[i]}"/>`; s += text(M + 50, y - 2, 30, t, "", C.ink); });
  // Footer: the balcony ledge, then billing over the balusters.
  s += ledge(0, W, 1490, W / 2, 0.8).svg;
  s += text(M, 1640, 24, "UNITY · 2026 · SOLO DEVELOPER", 'letter-spacing="6"', C.muted);
  s += text(W - M, 1640, 24, "SHUHANG CHEN", 'text-anchor="end" letter-spacing="6"', C.ink);
  s += `<rect width="${W}" height="${H}" filter="url(#grain)"/></svg>`;
  return { svg: s, W, H };
}

for (const [name, make, size] of [["cover", cover, 1350], ["hero", hero, 1920], ["spine", spine, 148], ["disc", disc, 1024], ["back", back, 1350]]) {
  const { svg } = make();
  await sharp(Buffer.from(svg)).resize(size).jpeg({ quality: 88, mozjpeg: true }).toFile(resolve(OUT, `${name}.jpg`));
  console.log("wrote", name);
}

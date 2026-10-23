// Cover and key art for Trail Adventure (work X-003).
// Homage in method only: the layered-ridge composition of a minimalist Secret Life
// of Walter Mitty poster. Ranges stack from pale to dark like the game's flat-shaded
// low-poly slopes, a hiker with Leo’s camera sits on the summit, and the title is
// printed on Leo's camera at the foot, where that poster has its suitcase.
// Run: node art/trail_poster.mjs  (needs sharp; SHARP_MODULE may point to it)
// OUT_DIR renders somewhere else (drafts); TRAIL_SHOTS points at the game's GDD screenshots.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const { default: sharp } = await import(process.env.SHARP_MODULE ? pathToFileURL(resolve(process.env.SHARP_MODULE)).href : "sharp");
const OUT = process.env.OUT_DIR ? resolve(process.env.OUT_DIR) : resolve(new URL("../public/works/x-003/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const WORKS = resolve(new URL("../public/works/x-003/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const SHOTS = process.env.TRAIL_SHOTS ?? "F:/UnityProject/Trail_Adventure/Docs/GDD/Screenshots";
mkdirSync(OUT, { recursive: true });
mkdirSync(WORKS, { recursive: true });

// Palette from the game's journal UI (Ui.cs) and its dusk sky.
const C = {
  paper: "#fbf4e2", cream: "#fffaf0", ink: "#25322e", brown: "#43362a", muted: "#6b5d4c",
  orange: "#e08e3c", mint: "#a9d8c4", tape: "#f2cf6e", pink: "#f2a9a0", stamp: "#c4553f",
  skyTop: "#efdccb", skyLow: "#d3e8da",
};
// Ridge layers from the summit (palest) down to the foreground (darkest).
const LAYERS = ["#b7d2c3", "#97b9aa", "#779d90", "#5a8076", "#41645c", "#2c4640"];

let seed = 20261006;
const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const mix = (a, b, k) => "#" + [0, 1, 2].map((i) => {
  const x = parseInt(a.slice(1 + i * 2, 3 + i * 2), 16), y = parseInt(b.slice(1 + i * 2, 3 + i * 2), 16);
  return Math.round(x + (y - x) * k).toString(16).padStart(2, "0");
}).join("");

const defs = `<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.skyTop}"/><stop offset="1" stop-color="${C.skyLow}"/></linearGradient>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="11"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .2  0 0 0 0 .15  0 0 0 .07 0"/></filter>
</defs>`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const text = (x, y, size, str, opts = "", fill = C.ink, family = "Segoe UI, Arial, sans-serif") =>
  `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" fill="${fill}" ${opts}>${esc(str)}</text>`;
const COND = "Bahnschrift SemiBold Condensed, Bahnschrift, Arial Narrow, sans-serif";
const HAND = "Segoe Print, Ink Free, cursive";
const grain = (W, H) => `<rect width="${W}" height="${H}" filter="url(#grain)"/>`;

/**
 * One range: a jagged ridgeline through `peaks` ([x, y] pairs), filled down to `bottom`.
 * Each peak gets a lit left face and a shaded right face meeting on a crease, which
 * is how the game's flat-shaded slopes read.
 */
function ridge(peaks, bottom, color) {
  const pts = peaks.map(([x, y]) => `${x},${y}`).join(" ");
  let out = `<polygon points="${pts} ${peaks.at(-1)[0]},${bottom} ${peaks[0][0]},${bottom}" fill="${color}"/>`;
  for (let i = 1; i < peaks.length - 1; i++) {
    const [px, py] = peaks[i], [lx, ly] = peaks[i - 1], [rx, ry] = peaks[i + 1];
    if (py > ly || py > ry) continue; // only true peaks get facets
    const depth = Math.max(ly, ry) - py, crease = [px + depth * 0.18, py + depth * 0.95];
    out += `<polygon points="${lx},${ly} ${px},${py} ${crease}" fill="${mix(color, "#ffffff", 0.13)}"/>`;
    out += `<polygon points="${px},${py} ${rx},${ry} ${crease}" fill="${mix(color, "#000000", 0.1)}"/>`;
  }
  return out;
}

/** A ridgeline from x0 to x1 around height y, `n` teeth of up to `amp` px. */
function line(x0, x1, y, n, amp, tilt = 0) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n + (i && i < n ? (rand() - 0.5) * ((x1 - x0) / n) * 0.5 : 0);
    const up = i % 2 ? amp * (0.55 + rand() * 0.45) : amp * rand() * 0.25;
    pts.push([Math.round(x), Math.round(y - up + tilt * ((x - x0) / (x1 - x0) - 0.5))]);
  }
  return pts;
}

/**
 * The hiker on the summit, facing out of the picture as in that poster, arms down and
 * Leo's camera hanging at the chest. Deliberately ungendered (knit cap, plain jacket).
 * About 270 units tall; (x, y) is the hip line and the feet stand 120 units below it.
 */
function climber(x, y, s = 1, fill = "#ffffff", mark = C.ink) {
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="${fill}">
    <ellipse cx="0" cy="-127" rx="13" ry="15"/>
    <path d="M-14 -131 C-15 -151 15 -151 14 -131 Z"/><rect x="-15.5" y="-134" width="31" height="6" rx="3"/>
    <rect x="-5" y="-115" width="10" height="10"/>
    <path d="M-8 -108 C-19 -107 -25 -103 -26 -94 L-25 -54 C-26 -32 -27 -14 -26 2 L26 2 C27 -14 26 -32 25 -54 L26 -94 C25 -103 19 -107 8 -108 Z"/>
    <path d="M-24 -100 C-32 -96 -35 -82 -36 -62 C-37 -44 -35 -26 -32 -6 L-23 -6 C-25 -26 -27 -44 -26 -60 Z"/>
    <path d="M24 -100 C32 -96 35 -82 36 -62 C37 -44 35 -26 32 -6 L23 -6 C25 -26 27 -44 26 -60 Z"/>
    <path d="M-21 -2L-3 -2L-4 20C-5 60 -6 90 -6 110L-1 120L-21 120L-18 110C-18 90 -19 60 -20 20Z"/>
    <path d="M21 -2L3 -2L4 20C5 60 6 90 6 110L1 120L21 120L18 110C18 90 19 60 20 20Z"/>
    <path d="M-17 -104 L-6 -76 M17 -104 L6 -76" stroke="${mark}" stroke-width="2.5" fill="none" opacity=".55"/>
    <rect x="-13" y="-80" width="26" height="17" rx="3" fill="${mark}"/>
    <circle cx="0" cy="-71.5" r="5.5" fill="${fill}"/><circle cx="0" cy="-71.5" r="3" fill="${mark}"/>
  </g>`;
}

/** Summit flag, as planted at the top of the game's mountain; `dir` -1 flies it to the left. */
const flag = (x, y, s = 1, dir = 1) => `<g transform="translate(${x} ${y}) scale(${s * dir} ${s})"><rect x="-2" y="-90" width="4" height="90" fill="${C.brown}"/><path d="M2 -88 L46 -76 L2 -62 Z" fill="${C.orange}"/></g>`;

/** A soaring bird, two strokes. */
const bird = (x, y, s) => `<path d="M${x - 14 * s} ${y - 4 * s} Q${x - 6 * s} ${y - 9 * s} ${x} ${y} Q${x + 6 * s} ${y - 9 * s} ${x + 14 * s} ${y - 4 * s}" fill="none" stroke="${C.brown}" stroke-width="${2.4 * s}" stroke-linecap="round" opacity=".7"/>`;

/** A dashed trail switchback across one range, ending at a campfire. */
function switchback(x0, y0, x1, y1, color) {
  const mx = (x0 + x1) / 2 + (rand() - 0.5) * 60;
  return `<path d="M${x0} ${y0} Q${mx} ${(y0 + y1) / 2 + 30} ${x1} ${y1}" fill="none" stroke="${color}" stroke-width="5" stroke-dasharray="2 13" stroke-linecap="round" opacity=".85"/>` +
    `<circle cx="${x1}" cy="${y1}" r="16" fill="${C.orange}" opacity=".22"/><path d="M${x1 - 7} ${y1 + 5} L${x1} ${y1 - 10} L${x1 + 7} ${y1 + 5} Z" fill="${C.orange}"/>`;
}

/** The whole range for a frame of width W: ranges, trail, figure. Returns svg and summit point. */
function range(W, H, summitX, summitY, opts = {}) {
  const k = H / 1700, q = k * (opts.wide ?? 1), bottom = H + 10;
  let s = "";
  // Summit range: one tall peak with shoulders.
  const sx = summitX, sy = summitY;
  const summit = [[-60, sy + 700 * k], [sx - 380 * q, sy + 420 * k], [sx - 300 * q, sy + 450 * k], [sx - 150 * q, sy + 190 * k], [sx - 100 * q, sy + 215 * k], [sx - 24 * q, sy + 6 * k], [sx, sy],
    [sx + 26 * q, sy + 8 * k], [sx + 140 * q, sy + 250 * k], [sx + 200 * q, sy + 230 * k], [sx + 360 * q, sy + 470 * k], [W * 0.98, sy + 600 * k], [W + 60, sy + 560 * k]];
  s += ridge(summit, bottom, LAYERS[0]);
  if (opts.figure !== false) s += flag(sx - 50 * q, sy + 78 * k, k * 1.75, -1) + climber(sx, sy - 118 * k * 0.8, k * 0.8);
  const bands = opts.bands ?? [sy + 560 * k, sy + 700 * k, sy + 830 * k, sy + 960 * k, sy + 1080 * k];
  const camps = [];
  bands.forEach((y, i) => {
    const teeth = 3 + i + Math.round(W / 700);
    const pts = line(-60, W + 60, y, teeth, (230 - i * 26) * k, (i % 2 ? 90 : -90) * k);
    s += ridge(pts, bottom, LAYERS[i + 1]);
    // The trail climbs from the foreground up the ranges, one switchback per range.
    const side = i % 2 ? 0.28 : 0.62;
    camps.push([W * side + (rand() - 0.5) * 80 * k, y + 60 * k]);
  });
  if (opts.trail !== false) {
    // Drawn after all ranges so it reads as one path climbing toward the summit.
    for (let i = camps.length - 1; i > 0; i--) s += switchback(camps[i][0], camps[i][1], camps[i - 1][0], camps[i - 1][1], C.cream);
    s += `<path d="M${camps[0][0]} ${camps[0][1]} Q${(camps[0][0] + sx) / 2 - 40 * k} ${sy + 380 * k} ${sx - 30 * k} ${sy + 60 * k}" fill="none" stroke="${C.cream}" stroke-width="5" stroke-dasharray="2 13" stroke-linecap="round" opacity=".85"/>`;
  }
  return s;
}

/** Leo's camera, an old rangefinder, as a cream silhouette with the title printed on its body. */
function camera(cx, top, w, h) {
  const x = cx - w / 2, y = top;
  let s = `<clipPath id="body"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26"/></clipPath>`;
  // Top plate: rewind knob, viewfinder housing (the "handle"), shutter button and dial.
  s += `<rect x="${x + w * 0.08}" y="${y - 34}" width="${w * 0.14}" height="40" rx="8" fill="${C.cream}"/>`;
  s += `<rect x="${cx - w * 0.2}" y="${y - 70}" width="${w * 0.4}" height="80" rx="14" fill="${C.cream}"/>`;
  s += `<rect x="${cx - w * 0.11}" y="${y - 50}" width="${w * 0.22}" height="30" rx="7" fill="${LAYERS[5]}"/>`;
  s += `<rect x="${x + w * 0.74}" y="${y - 30}" width="${w * 0.15}" height="36" rx="8" fill="${C.cream}"/>`;
  s += `<rect x="${x + w * 0.79}" y="${y - 46}" width="${w * 0.05}" height="18" rx="4" fill="${C.cream}"/>`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26" fill="${C.cream}"/>`;
  // Leatherette band, and the lens up beside the short first line of the title.
  s += `<g clip-path="url(#body)"><rect x="${x}" y="${y + h * 0.14}" width="${w}" height="${h * 0.72}" fill="${mix(C.cream, C.tape, 0.18)}"/>`;
  const lx = x + w * 0.79, ly = y + h * 0.3;
  s += `<circle cx="${lx}" cy="${ly}" r="${h * 0.2}" fill="${C.cream}" stroke="${C.ink}" stroke-width="10"/>`;
  s += `<circle cx="${lx}" cy="${ly}" r="${h * 0.1}" fill="${C.ink}"/><circle cx="${lx - h * 0.035}" cy="${ly - h * 0.035}" r="${h * 0.025}" fill="${C.cream}"/>`;
  // Title, hand-lettered as in the game's journal, at a slight angle.
  s += `<g transform="rotate(-4 ${cx} ${y + h / 2})">`;
  s += text(x + w * 0.07, y + h * 0.42, h * 0.27, "TRAIL", `font-weight="700" letter-spacing="2"`, C.ink, HAND);
  s += text(cx, y + h * 0.8, h * 0.235, "ADVENTURE", `text-anchor="middle" font-weight="700"`, C.ink, HAND);
  s += `</g></g>`;
  return s;
}

function cover() {
  const W = 1350, H = 1700, M = 64, art = 1500;
  seed = 20261006;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}`;
  s += `<rect width="${W}" height="${H}" fill="${C.paper}"/>`;
  // The picture sits in a paper border, as a printed one-sheet does.
  s += `<clipPath id="frame"><rect x="${M}" y="${M}" width="${W - M * 2}" height="${art - M}"/></clipPath><g clip-path="url(#frame)">`;
  s += `<rect x="${M}" y="${M}" width="${W - M * 2}" height="${art - M}" fill="url(#sky)"/>`;
  s += bird(930, 330, 1.3) + bird(1010, 290, 0.9) + bird(860, 395, 0.75);
  s += range(W, art, 560, 470, { bands: [1010, 1110, 1200, 1290, 1370] });
  s += camera(W / 2, 1210, 640, 330);
  s += `</g>`;
  s += text(W / 2, 170, 46, "A CABIN.  A CAMERA.  A MOUNTAIN.", `text-anchor="middle" letter-spacing="4"`, C.brown, COND);
  // Billing block on the paper.
  s += text(W / 2, 1572, 30, "A GAME BY SHUHANG CHEN", `text-anchor="middle" letter-spacing="8"`, C.ink, COND);
  s += text(W / 2, 1614, 19, "DESIGN, PROGRAMMING AND NARRATIVE BY SHUHANG CHEN  ·  MADE WITH UNITY 6  ·  24 SPECIES  ·  16 PEOPLE", `text-anchor="middle" letter-spacing="2"`, C.muted, COND);
  s += text(W / 2, 1650, 19, "CLIMBING · WILDLIFE PHOTOGRAPHY · SOLO DEVELOPER · 2026", `text-anchor="middle" letter-spacing="3"`, C.muted, COND);
  s += grain(W, H) + `</svg>`;
  return { svg: s, W, H };
}

function hero() {
  const W = 1920, H = 1080;
  seed = 20261006;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}`;
  s += `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  s += bird(1560, 330, 1.1) + bird(1630, 295, 0.8) + bird(1490, 370, 0.6);
  // No billing: the project page sets the title over the dark lower left.
  s += range(W, 1280, 1300, 420, { bands: [740, 810, 880, 950, 1020], wide: 1.9 });
  s += grain(W, H) + `</svg>`;
  return { svg: s, W, H };
}

/** Spine strip, 148×1700: summit and climber at the head, title running down, engine and year at the foot. */
function spine() {
  const W = 148, H = 1700;
  seed = 20261007;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}`;
  s += `<rect width="${W}" height="${H}" fill="${LAYERS[5]}"/>`;
  s += `<rect width="${W}" height="300" fill="url(#sky)"/>`;
  s += ridge([[-10, 210], [30, 170], [74, 120], [104, 150], [160, 200]], 320, LAYERS[0]);
  s += ridge(line(-10, 160, 250, 4, 40), 320, LAYERS[2]);
  s += ridge(line(-10, 160, 300, 5, 30), 330, LAYERS[4]);
  s += climber(74, 86, 0.29, "#ffffff", LAYERS[2]);
  s += `<g transform="translate(${W / 2 + 18} 380) rotate(90)">${text(0, 0, 58, "TRAIL ADVENTURE", 'font-weight="700"', C.cream, HAND)}</g>`;
  s += `<rect x="${W / 2 - 22}" y="1050" width="44" height="4" fill="${C.orange}"/>`;
  s += `<g transform="translate(${W / 2 + 8} 1090) rotate(90)">${text(0, 0, 24, "SHUHANG CHEN", 'letter-spacing="5"', C.mint, COND)}</g>`;
  s += text(W / 2, H - 120, 24, "UNITY", 'text-anchor="middle" letter-spacing="3"', C.mint, COND);
  s += text(W / 2, H - 70, 32, "2026", 'text-anchor="middle" letter-spacing="2"', C.orange, COND);
  s += grain(W, H) + `</svg>`;
  return { svg: s, W, H };
}

/** Characters set one by one round a circle (librsvg has no textPath), centred on angle `at`. */
function arcText(c, r, at, str, size, fill, family = COND, spacing = 0.62, opts = "") {
  // Along the top, letters run clockwise; along the bottom, anticlockwise so they stay upright.
  const below = Math.sin(at) > 0, step = ((size * spacing) / r) * (below ? -1 : 1);
  let out = "";
  [...str].forEach((ch, i) => {
    const a = at + (i - (str.length - 1) / 2) * step, x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
    const deg = (a * 180) / Math.PI + (below ? -90 : 90);
    out += `<text x="0" y="0" font-family="${family}" font-size="${size}" fill="${fill}" text-anchor="middle" dominant-baseline="central" ${opts} transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)})">${esc(ch)}</text>`;
  });
  return out;
}

/**
 * Disc label, 1024²: the front of Leo's lens. Knurled barrel, focus and aperture
 * scales, the title engraved round the bezel, and the cover's ranges reflected in the glass.
 */
function disc() {
  const W = 1024, c = W / 2;
  seed = 20261011;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${defs}`;
  s += `<radialGradient id="glass" cx=".42" cy=".38" r=".62"><stop offset="0" stop-color="#3f6a66"/><stop offset=".7" stop-color="#1f3533"/><stop offset="1" stop-color="#14201f"/></radialGradient>`;
  s += `<rect width="${W}" height="${W}" fill="#1a2422"/>`;
  // Knurled grip.
  s += `<circle cx="${c}" cy="${c}" r="512" fill="#24302d"/>`;
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * Math.PI * 2;
    s += `<line x1="${c + Math.cos(a) * 478}" y1="${c + Math.sin(a) * 478}" x2="${c + Math.cos(a) * 512}" y2="${c + Math.sin(a) * 512}" stroke="#34433f" stroke-width="5"/>`;
  }
  // Focus ring: cream band with distance scale.
  s += `<circle cx="${c}" cy="${c}" r="474" fill="${C.paper}"/><circle cx="${c}" cy="${c}" r="420" fill="#2c3936"/>`;
  s += arcText(c, 447, -Math.PI / 2, "∞   10   5   3   2   1.5   1 m", 30, C.ink, COND, 0.58);
  s += arcText(c, 447, Math.PI / 2, "A CABIN · A CAMERA · A MOUNTAIN", 26, C.muted, COND, 0.62, 'letter-spacing="2"');
  // Aperture ring with the title engraved.
  s += arcText(c, 392, -Math.PI / 2, "TRAIL ADVENTURE", 40, C.cream, HAND, 0.66, 'font-weight="700"');
  s += arcText(c, 392, Math.PI / 2, "LEO 35mm  1:5.6  ·  UNITY 2026", 24, C.mint, COND, 0.62, 'letter-spacing="2"');
  s += `<path d="M${c} ${c - 424} l-12 -18 h24 Z" fill="${C.orange}"/>`;
  // Glass, with the ranges reflected in it and a highlight.
  s += `<clipPath id="lens"><circle cx="${c}" cy="${c}" r="360"/></clipPath><circle cx="${c}" cy="${c}" r="366" fill="#0f1716"/><circle cx="${c}" cy="${c}" r="420" fill="none" stroke="#56635f" stroke-width="2"/>`;
  s += `<g clip-path="url(#lens)"><rect width="${W}" height="${W}" fill="url(#glass)"/><g opacity=".55">`;
  s += ridge([[150, 820], [380, 700], [440, 720], [600, 650], [650, 670], [730, 586], [760, 600], [820, 690], [900, 740]], 900, "#5d8a80");
  s += ridge(line(140, 890, 790, 6, 70, 40), 900, "#3d6159");
  s += ridge(line(140, 890, 850, 7, 50, -30), 900, "#2a4540") + `</g>`;
  s += climber(730, 558, 0.24, "#cfe6dc", "#2a4540");
  // The rear element's bevel round the hole: thin clean rings, no blades.
  s += `<circle cx="${c}" cy="${c}" r="205" fill="none" stroke="#0e1615" stroke-width="22"/>`;
  s += `<circle cx="${c}" cy="${c}" r="218" fill="none" stroke="#6f9a92" stroke-width="2" opacity=".5"/>`;
  s += `<circle cx="${c}" cy="${c}" r="194" fill="none" stroke="#6f9a92" stroke-width="1.5" opacity=".35"/>`;
  s += `</g>` + grain(W, W) + `</svg>`;
  return { svg: s, W, H: W };
}

/** Back cover, 1350×1700: Leo's line, pitch, photos pegged on a line, features, a ridge footer. */
function back() {
  const W = 1350, H = 1700, M = 96;
  seed = 20261009;
  const shot = (name) => "data:image/jpeg;base64," + readFileSync(resolve(WORKS, name)).toString("base64");
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}`;
  s += `<rect width="${W}" height="${H}" fill="${C.paper}"/>`;
  for (let y = 60; y < 1380; y += 34) for (let x = 48; x < W; x += 34) s += `<circle cx="${x}" cy="${y}" r="1.6" fill="${C.muted}" opacity=".18"/>`;
  // Leo's letter.
  s += text(M, 190, 84, "It’s yours now.", 'font-weight="700"', C.ink, HAND);
  s += text(M + 6, 245, 30, "— Leo", "", C.stamp, HAND);
  const pitch = ["An old photographer left you his cabin, his camera and a mountain.", "Pack your bag, climb any rock face, creep up on the wildlife,", "and send your best shots to the people who live on the island."];
  pitch.forEach((l, i) => { s += text(M, 330 + i * 46, 29, l, "", C.brown); });
  // Photos pegged on a line, as at the game's campfires.
  s += `<path d="M30 500 Q${W / 2} 560 ${W - 30} 500" fill="none" stroke="${C.muted}" stroke-width="4"/>`;
  const photos = [["viewfinder.jpg", "The deer by the pond", -4], ["campfire.jpg", "Dusk at the campfire", 3], ["cabin.jpg", "Leo’s cabin", -2]];
  photos.forEach(([img, cap, rot], i) => {
    const pw = 340, ph = Math.round(pw * 9 / 16), x = M - 20 + i * 395, y = 548 + (i === 1 ? 18 : 0);
    s += `<g transform="rotate(${rot} ${x + pw / 2} ${y})">`;
    s += `<rect x="${x - 4}" y="${y + 4}" width="${pw + 36}" height="${ph + 100}" fill="#000" opacity=".12"/>`;
    s += `<rect x="${x - 10}" y="${y - 6}" width="${pw + 36}" height="${ph + 100}" fill="${C.cream}"/>`;
    s += `<image href="${shot(img)}" x="${x + 8}" y="${y + 12}" width="${pw}" height="${ph}" preserveAspectRatio="xMidYMid slice"/>`;
    s += text(x + 8 + pw / 2, y + ph + 64, 26, cap, 'text-anchor="middle"', C.brown, HAND);
    s += `<rect x="${x + pw / 2 - 2}" y="${y - 30}" width="16" height="52" rx="3" fill="#b88a5a"/></g>`;
  });
  // Three verbs, each on a scrap of tape.
  const feats = [["Climb.", C.orange], ["Take photos.", C.mint], ["Make friends.", C.pink]];
  feats.forEach(([t, col], i) => {
    const y = 1020 + i * 82;
    s += `<rect x="${M}" y="${y - 36}" width="54" height="34" fill="${col}" opacity=".9" transform="rotate(-6 ${M + 27} ${y - 19})"/>`;
    s += text(M + 84, y, 48, t, 'font-weight="700"', C.ink, HAND);
  });
  // Footer: the ranges again, darkest at the bottom, with billing on top.
  s += ridge(line(-40, W + 40, 1300, 11, 90, 40), H + 10, LAYERS[3]);
  s += ridge(line(-40, W + 40, 1400, 13, 70, -40), H + 10, LAYERS[4]);
  s += ridge(line(-40, W + 40, 1490, 15, 50, 30), H + 10, LAYERS[5]);
  s += text(M, 1620, 26, "UNITY 6 · URP · 2026 · SOLO DEVELOPER", 'letter-spacing="5"', C.mint, COND);
  s += text(W - M, 1620, 26, "SHUHANG CHEN", 'text-anchor="end" letter-spacing="6"', C.cream, COND);
  s += grain(W, H) + `</svg>`;
  return { svg: s, W, H };
}

// Gallery and back-cover photos, cut from the GDD screenshots when they are at hand.
const GALLERY = [["S01_cabin.png", "cabin"], ["S04_viewfinder.png", "viewfinder"], ["S07_campfire.png", "campfire"], ["S17_postcards.png", "postcards"]];
if (existsSync(SHOTS)) for (const [src, name] of GALLERY) {
  await sharp(readFileSync(resolve(SHOTS, src))).resize(1280, 720).jpeg({ quality: 86, mozjpeg: true }).toFile(resolve(WORKS, `${name}.jpg`));
}

for (const [name, make, size] of [["cover", cover, 1350], ["hero", hero, 1920], ["spine", spine, 148], ["disc", disc, 1024], ["back", back, 1350]]) {
  const { svg } = make();
  await sharp(Buffer.from(svg)).resize(size).jpeg({ quality: 88, mozjpeg: true }).toFile(resolve(OUT, `${name}.jpg`));
  console.log("wrote", name);
}


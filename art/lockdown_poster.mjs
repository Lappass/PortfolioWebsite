// Cover and key art for LOCKDOWN (work X-002).
// Homage in method only: a Rear Window-style wall of apartment windows, rendered
// as flat cut-paper shapes in the manner of mid-century film posters. One lit
// window holds the game's polyomino ingredients; the title is built from cells.
// Run: node art/lockdown_poster.mjs  (needs sharp; SHARP_MODULE may point to it)
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const { default: sharp } = await import(process.env.SHARP_MODULE ? pathToFileURL(resolve(process.env.SHARP_MODULE)).href : "sharp");
const OUT = new URL("../public/works/x-002/", import.meta.url);
mkdirSync(OUT, { recursive: true });

// Palette sampled from the game.
const C = {
  night: "#1d2326", wall: "#2c3438", wallLit: "#353e42", frame: "#151a1c", pane: "#232b2e",
  warm: "#f2c879", glow: "#e9a75a", pork: "#d48c80", tofu: "#ece5cf", green: "#9cc77a", tan: "#c9a54e",
  ink: "#f2ece4", muted: "#8f9690",
};

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

/** The facade: a grid of dark windows, a few faintly lit, one fully lit. */
function facade(x, y, cols, rows, w, h, gx, gy, lit) {
  let out = "";
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const wx = x + c * (w + gx), wy = y + r * (h + gy);
    if (r === lit.r && c === lit.c) continue;
    const faint = rand() < 0.07;
    out += `<rect x="${wx}" y="${wy}" width="${w}" height="${h}" fill="${C.frame}"/>`;
    out += `<rect x="${wx + 6}" y="${wy + 6}" width="${w - 12}" height="${h - 12}" fill="${faint ? "#2f4048" : C.pane}"/>`;
    if (faint) out += `<rect x="${wx + 6}" y="${wy + 6}" width="${w - 12}" height="${h - 12}" fill="#6f98b0" opacity=".16"/>`;
    // Curtain line, sill.
    out += `<rect x="${wx + w / 2 - 1.5}" y="${wy + 6}" width="3" height="${h - 12}" fill="${C.frame}"/>`;
    out += `<rect x="${wx - 6}" y="${wy + h}" width="${w + 12}" height="6" fill="#262d30"/>`;
  }
  return out;
}

/** The lit window: a 5x4 grid of polyomino ingredients, like the game's pan. */
function litWindow(x, y, w, h) {
  const cols = 5, rows = 4, pad = 10, cw = (w - pad * 2) / cols, ch = (h - pad * 2) / rows;
  // Piece map (letters) filling the grid like a solved puzzle.
  const map = ["PPTGG", "PTTGN", "PPNNN", "KKKNY"];
  const colors = { P: C.pork, T: C.tofu, G: C.green, N: C.tan, K: C.pork, Y: C.green };
  let out = `<rect x="${x - 40}" y="${y - 40}" width="${w + 80}" height="${h + 80}" fill="url(#halo)"/>`;
  out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.frame}"/>`;
  out += `<rect x="${x + 6}" y="${y + 6}" width="${w - 12}" height="${h - 12}" fill="${C.warm}"/>`;
  map.forEach((row, r) => [...row].forEach((k, c) => {
    out += `<rect x="${x + pad + c * cw + 2}" y="${y + pad + r * ch + 2}" width="${cw - 4}" height="${ch - 4}" rx="3" fill="${colors[k]}"/>`;
  }));
  // Piece seams: merge same-letter neighbours visually by bridging gaps.
  map.forEach((row, r) => [...row].forEach((k, c) => {
    if (row[c + 1] === k) out += `<rect x="${x + pad + (c + 1) * cw - 3}" y="${y + pad + r * ch + 2}" width="6" height="${ch - 4}" fill="${colors[k]}"/>`;
    if (map[r + 1]?.[c] === k) out += `<rect x="${x + pad + c * cw + 2}" y="${y + pad + (r + 1) * ch - 3}" width="${cw - 4}" height="6" fill="${colors[k]}"/>`;
  }));
  out += `<polygon points="${x - 8},${y + h + 7} ${x + w + 8},${y + h + 7} ${x + w + 170},${y + h + 900} ${x - 170},${y + h + 900}" fill="url(#spill)"/>`;
  out += `<rect x="${x - 8}" y="${y + h}" width="${w + 16}" height="7" fill="${C.glow}"/>`;
  // A thin wisp of steam rising from the window.
  const sx = x + w * 0.62, sy = y - 4;
  out += `<path d="M${sx} ${sy} C ${sx - 30} ${sy - 60}, ${sx + 40} ${sy - 110}, ${sx + 4} ${sy - 170} S ${sx + 30} ${sy - 260}, ${sx - 6} ${sy - 330}" fill="none" stroke="${C.tofu}" stroke-width="5" stroke-linecap="round" opacity=".85"/>`;
  return out;
}

const defs = `<defs>
  <linearGradient id="spill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.glow}" stop-opacity=".32"/><stop offset="1" stop-color="${C.glow}" stop-opacity="0"/></linearGradient>
  <radialGradient id="halo"><stop offset="0" stop-color="${C.glow}" stop-opacity=".55"/><stop offset="1" stop-color="${C.glow}" stop-opacity="0"/></radialGradient>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141819"/><stop offset="1" stop-color="${C.night}"/></linearGradient>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .05 0"/></filter>
</defs>`;
const text = (x, y, size, str, opts = "", fill = C.ink) => `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" fill="${fill}" ${opts}>${str}</text>`;

function cover() {
  const W = 1350, H = 1700;
  seed = 20200323;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}`;
  s += `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  // Building block with a slight lean into frame, like a low camera.
  s += `<g transform="rotate(-5 675 620)"><rect x="-200" y="-220" width="1750" height="1420" fill="${C.wall}"/>`;
  s += facade(-170, -170, 9, 8, 118, 122, 40, 38, { r: 4, c: 5 });
  s += litWindow(-170 + 5 * 158, -170 + 4 * 160, 118, 122);
  s += `</g><rect x="0" y="1180" width="${W}" height="${H - 1180}" fill="${C.night}"/><rect x="0" y="1180" width="${W}" height="10" fill="${C.frame}"/>`;
  // Billing block.
  const cell = 27, title = "LOCKDOWN", tw = wordWidth(title, cell);
  s += blockWord(title, (W - tw) / 2, 1265, cell, 1, C.ink).svg;
  s += text(W / 2, 1530, 34, "A HOUSEHOLD SURVIVAL GAME", `text-anchor="middle" letter-spacing="10"`);
  s += `<rect x="${W / 2 - 60}" y="1565" width="120" height="4" fill="${C.warm}"/>`;
  s += text(W / 2, 1625, 22, "A GAME BY SHUHANG CHEN", `text-anchor="middle" letter-spacing="8"`, C.muted);
  s += `<rect width="${W}" height="${H}" filter="url(#grain)"/></svg>`;
  return { svg: s, W, H };
}

function hero() {
  const W = 1920, H = 1080;
  seed = 20200323;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}`;
  s += `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  s += `<g transform="rotate(-5 1450 540)"><rect x="1000" y="-300" width="1300" height="1700" fill="${C.wall}"/>`;
  s += facade(1040, -250, 7, 9, 118, 122, 40, 38, { r: 4, c: 2 });
  s += litWindow(1040 + 2 * 158, -250 + 4 * 160, 118, 122);
  s += `</g>`;
  const cell = 17, title = "LOCKDOWN";
  s += blockWord(title, 122, 430, cell, 1, C.ink).svg;
  s += text(122, 600, 28, "A HOUSEHOLD SURVIVAL GAME", `letter-spacing="9"`);
  s += `<rect x="122" y="628" width="110" height="4" fill="${C.warm}"/>`;
  s += text(122, 684, 20, "A GAME BY SHUHANG CHEN", `letter-spacing="7"`, C.muted);
  s += `<rect width="${W}" height="${H}" filter="url(#grain)"/></svg>`;
  return { svg: s, W, H };
}

/** Spine strip, 148×1700 (the case spine is 0.148 × 1.7 units): night sky,
 *  the lit window at the head, the cell-built title running down, engine and year at the foot. */
function spine() {
  const W = 148, H = 1700;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}`;
  s += `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  // Head: the lit window, cropped small, with its glow.
  s += `<rect x="0" y="0" width="${W}" height="250" fill="${C.wall}"/>`;
  s += litWindow(24, 60, 100, 104).replace(/<polygon[^>]*\/>/, "").replace(/<path[^>]*\/>/, "");
  s += `<rect x="0" y="250" width="${W}" height="6" fill="${C.frame}"/>`;
  // Title down the spine, letters stacked top to bottom (read by tilting the head right).
  const cell = 15, tw = wordWidth("LOCKDOWN", cell);
  s += `<g transform="translate(${W / 2 + 3.5 * cell} ${330}) rotate(90)">${blockWord("LOCKDOWN", 0, 0, cell, 1, C.ink).svg}</g>`;
  const foot = 330 + tw + 70;
  s += `<rect x="${W / 2 - 22}" y="${foot}" width="44" height="4" fill="${C.warm}"/>`;
  s += `<g transform="translate(${W / 2 + 8} ${foot + 40}) rotate(90)">${text(0, 0, 22, "SHUHANG CHEN", 'letter-spacing="5"', C.muted)}</g>`;
  s += text(W / 2, H - 120, 22, "UNITY", 'text-anchor="middle" letter-spacing="3"', C.muted);
  s += text(W / 2, H - 70, 30, "2026", 'text-anchor="middle" font-weight="700" letter-spacing="2"', C.warm);
  s += `<rect width="${W}" height="${H}" filter="url(#grain)"/></svg>`;
  return { svg: s, W, H };
}

/** Exact-cover search: place every shape (any rotation) to tile a cols×rows pan. */
function solvePan(shapes, cols, rows, slack = 0) {
  const norm = (c) => { const mx = Math.min(...c.map((p) => p[0])), my = Math.min(...c.map((p) => p[1])); return c.map(([x, y]) => [x - mx, y - my]); };
  const turns = (c) => { const out = []; let cur = c; for (const m of [c, c.map(([x, y]) => [-x, y])]) { cur = m; for (let i = 0; i < 4; i++) { cur = norm(cur.map(([x, y]) => [-y, x])); out.push(cur); } } return out; };
  const names = Object.keys(shapes), grid = new Set(), out = [];
  const go = (i) => {
    if (i === names.length) return grid.size >= cols * rows - slack;
    for (const t of turns(shapes[names[i]])) for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const cells = t.map(([a, b]) => [a + x, b + y]);
      if (cells.some(([a, b]) => a >= cols || b >= rows || grid.has(a + "," + b))) continue;
      cells.forEach(([a, b]) => grid.add(a + "," + b)); out.push({ name: names[i], cells });
      if (go(i + 1)) return true;
      out.pop(); cells.forEach(([a, b]) => grid.delete(a + "," + b));
    }
    return false;
  };
  if (!go(0)) throw new Error("pieces do not tile the pan");
  return out;
}

/** Disc label, 1024 square mapped onto a ring (hub hole ≈ 36% of the radius).
 *  The disc face is a solved tangram: the seven classic pieces, each an
 *  ingredient colour, fitted into a square pan around the hub. */
function disc() {
  const W = 1024, R = 512, hole = 196;
  // The game's own cooking pieces (Assets/Art/UI cooking panel), fitted into a 6×5 pan, part-filled.
  const SHAPES = {
    pork: [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 2]],
    rice: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]],
    cabbage: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
    potato: [[1, 0], [1, 1], [1, 2], [0, 2]],
    egg: [[1, 0], [0, 1], [1, 1]],
  };
  const COLORS = { pork: "#d9706a", rice: "#ece8dc", cabbage: "#86cf5e", potato: "#c9a54e", egg: "#f5e39a" };
  const placed = solvePan(SHAPES, 6, 5, 6);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${defs}`;
  s += `<rect width="${W}" height="${W}" fill="${C.night}"/>`;
  s += `<circle cx="${R}" cy="${R}" r="${R}" fill="${C.wall}"/>`;
  s += `<circle cx="${R}" cy="${R}" r="${R - 14}" fill="none" stroke="${C.glow}" stroke-width="4" opacity=".7"/>`;
  // The pan: metal rim, dark well, cell grid.
  const cell = 38, gw = 6 * cell, gh = 5 * cell, ox = R - gw / 2, oy = 74;
  s += `<rect x="${ox - 26}" y="${oy - 26}" width="${gw + 52}" height="${gh + 52}" rx="14" fill="#1a1f21" stroke="#8c9396" stroke-width="5"/>`;
  s += `<rect x="${ox - 2}" y="${oy - 2}" width="${gw + 4}" height="${gh + 4}" fill="#262c2e"/>`;
  for (const { name, cells } of placed) {
    const lifted = name === "egg";
    if (lifted) for (const [x, y] of cells) s += `<rect x="${ox + x * cell + 3}" y="${oy + y * cell + 3}" width="${cell - 6}" height="${cell - 6}" fill="none" stroke="${C.warm}" stroke-width="2" stroke-dasharray="5 5" opacity=".7"/>`;
    const g = lifted ? ` transform="translate(${gw / 2 + 70} 40) rotate(-12 ${ox} ${oy})"` : "";
    s += `<g${g}>`;
    for (const [x, y] of cells) s += `<rect x="${ox + x * cell + 2}" y="${oy + y * cell + 2}" width="${cell - 4}" height="${cell - 4}" rx="3" fill="${COLORS[name]}"/>`;
    s += `</g>`;
  }
  // Hub shadow, so the hole reads as cut through the pieces.
  s += `<circle cx="${R}" cy="${R}" r="${hole + 10}" fill="none" stroke="${C.frame}" stroke-width="20"/>`;
  // Centre hole: punched through, as on a real disc.
  s += `<circle cx="${R}" cy="${R}" r="${hole}" fill="${C.night}"/><circle cx="${R}" cy="${R}" r="${hole - 60}" fill="none" stroke="#3a4246" stroke-width="2"/><circle cx="${R}" cy="${R}" r="56" fill="#0c0f10"/>`;
  // Billing: year across the top segment, the cell-built title across the bottom.
  s += text(R, 800, 22, "UNITY · 2026 · X-002", 'text-anchor="middle" letter-spacing="6"', C.warm);
  const tcell = 10, tw = wordWidth("LOCKDOWN", tcell);
  s += blockWord("LOCKDOWN", R - tw / 2, 880, tcell, 1, C.ink).svg;
  s += `<rect width="${W}" height="${W}" filter="url(#grain)"/></svg>`;
  return { svg: s, W, H: W };
}

for (const [name, make, size] of [["cover", cover, 1350], ["hero", hero, 1920], ["spine", spine, 148], ["disc", disc, 1024]]) {
  const { svg } = make();
  await sharp(Buffer.from(svg)).resize(size).jpeg({ quality: 88, mozjpeg: true }).toFile(new URL(`${name}.jpg`, OUT).pathname.replace(/^\//, ""));
  console.log("wrote", name);
}

// Cover and key art for Sniff & Snitch (work X-007), a two-player co-op escape from a magic prison.
// The cover is the police lineup from the game's own character select: the height chart, the
// booking placards ("Charge: Theft") and the two thieves themselves, cut out of the team's
// character sheets and stood against the chart at their heights (Lyra 5'9", Fia 3'3"). Colours
// are the game UI's: charcoal and plum brushwork, mustard banners, crimson display type, the
// grey board.
// Run: node art/sniff_poster.mjs  (needs sharp; SHARP_MODULE may point to it)
// OUT_DIR renders somewhere else (drafts).
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const { default: sharp } = await import(process.env.SHARP_MODULE ? pathToFileURL(resolve(process.env.SHARP_MODULE)).href : "sharp");
const WORKS = resolve(new URL("../public/works/x-007/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const OUT = process.env.OUT_DIR ? resolve(process.env.OUT_DIR) : WORKS;
mkdirSync(resolve(OUT, "menu"), { recursive: true });

// The game UI's colours (Assets/Sniff/art/2d: EndScreenUI, SelectionUI).
const INK = "#1d171f", PLUM2 = "#4a3345", MUSTARD = "#d3a24f", CRIMSON = "#b8232f", SHADOW = "#4a0e14",
  BONE = "#ece6da", BOARD = "#4a4448", WALL = "#d8d5cf", LINE = "#3b373a";
const TITLE = "Sniff & Snitch", LINEUP = "TWO THIEVES. ONE WAY OUT.";
const CREDIT = "A TEAM CAPSTONE GAME  ·  SHUHANG CHEN: PROGRAMMING & DESIGN  ·  ONLINE CO-OP  ·  2026";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const text = (x, y, size, str, fill, opts = "", family = "Bahnschrift") =>
  `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" fill="${fill}" ${opts}>${esc(str)}</text>`;
const deg = (a) => (a * 180) / Math.PI;

const defs = `<defs>
  <filter id="wear" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="2" seed="11" result="w"/>
    <feDisplacementMap in="SourceGraphic" in2="w" scale="7" xChannelSelector="R" yChannelSelector="G" result="r"/>
    <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="1" seed="14" result="s"/>
    <feColorMatrix in="s" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -12 0 0 0 8.2" result="k"/>
    <feComposite in="r" in2="k" operator="in"/></filter>
  <filter id="brush" x="-5%" y="-30%" width="110%" height="160%"><feTurbulence type="fractalNoise" baseFrequency=".012 .09" numOctaves="3" seed="4" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="34" xChannelSelector="R" yChannelSelector="G"/></filter>
</defs>`;
const svg = (W, H, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}${body}</svg>`;

/** A brush-stroke banner like the game's menu buttons: a long rough quad with ragged ends. */
const brush = (x, y, w, h, fill, rot = -4) =>
  `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})" filter="url(#brush)"><path d="M${x} ${y + h * 0.2} L${x + w * 0.97} ${y} L${x + w} ${y + h * 0.55} L${x + w * 0.96} ${y + h} L${x + w * 0.02} ${y + h * 0.92} L${x + w * 0.05} ${y + h * 0.55} Z" fill="${fill}"/></g>`;

/** The title, crimson with a dark drop, as on the game's end screens; (x, y) is its centre baseline. */
const title = (x, y, size, rot = -3) => `<g transform="rotate(${rot} ${x} ${y - size * 0.3})">
  ${text(x + size * 0.04, y + size * 0.06, size, TITLE, SHADOW, 'text-anchor="middle" font-weight="700" font-style="italic"', "Georgia")}
  ${text(x, y, size, TITLE, CRIMSON, 'text-anchor="middle" font-weight="700" font-style="italic"', "Georgia")}</g>`;

/** The lineup's height chart: a line every 4", heavier each foot, the feet marked at `labelX`. */
function chart(floor, ft, x0, x1, labelX, from = 36, to = 96) {
  let s = "";
  for (let inch = from; inch <= to; inch += 4) {
    const y = floor - (inch / 12) * ft, major = inch % 12 === 0;
    s += `<rect x="${x0}" y="${y - (major ? 3 : 1.5)}" width="${x1 - x0}" height="${major ? 6 : 3}" fill="${LINE}" opacity="${major ? 0.85 : 0.55}"/>`;
    if (labelX !== undefined) {
      s += `<rect x="${x0 - 36}" y="${y - 2}" width="${major ? 26 : 14}" height="4" fill="${LINE}"/>`;
      if (major) s += text(labelX, y + 10, 30, `${inch / 12}'`, LINE, 'font-weight="700"');
    }
  }
  return `<g filter="url(#wear)">${s}</g>`;
}

/* ---------- The two of them: the team's character art on the lineup wall ---------- */
// Cut-outs from the character sheets (art/sniff/lyra.png, fia.png) and the game's own booking
// placards (art/sniff/placard-*.png, from Assets/Sniff/art/2d/ui/SelectionUI).
const ART = resolve(new URL("./sniff/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
// Lyra's head is 94% of her cut-out's height (the ponytail rises above it); Fia's ears are hers.
const FIGURES = { lyra: { file: "lyra.png", feet: 5.75, head: 0.94 }, fia: { file: "fia.png", feet: 3.25, head: 1 } };

/**
 * The lineup's overlays for a wall with its floor at `floor` and a foot to `ft` px: each figure
 * standing on the floor centred on its x, each placard at its box. Shadows go in the SVG.
 */
async function lineup(floor, ft, { lyra, fia, cards }) {
  const out = [];
  for (const [name, cx] of [["lyra", lyra], ["fia", fia]]) {
    const f = FIGURES[name], height = Math.round((f.feet * ft) / f.head);
    const input = await sharp(resolve(ART, f.file)).resize({ height }).png().toBuffer();
    const { width } = await sharp(input).metadata();
    out.push({ input, left: Math.round(cx - width / 2), top: Math.round(floor - height) });
  }
  for (const [name, [x, y, w]] of Object.entries(cards)) {
    out.push({ input: await sharp(resolve(ART, `placard-${name}.png`)).resize({ width: w }).png().toBuffer(), left: x, top: y });
  }
  return out;
}
const shadows = (floor, xs) => xs.map(([x, rx]) => `<ellipse cx="${x}" cy="${floor - 4}" rx="${rx}" ry="${rx * 0.12}" fill="${INK}" opacity=".18"/>`).join("");

/* ---------- Pieces ---------- */
async function render(name, W, H, body, size = W, overlays = []) {
  const flat = await sharp(Buffer.from(svg(W, H, body))).composite(overlays).png().toBuffer();
  await sharp(flat).resize(size).jpeg({ quality: 88, mozjpeg: true }).toFile(resolve(OUT, `${name}.jpg`));
  console.log("wrote", name);
}

/** Cover, 1350×1700: the lineup, a foot to 150 px, the title on a mustard stroke below the floor. */
const COVER = { floor: 1430, ft: 150, lyra: 400, fia: 930, cards: { lyra: [640, 470, 290], fia: [790, 712, 290] } };
function cover() {
  const W = 1350, H = 1700, { floor, ft } = COVER;
  return `<rect width="${W}" height="${H}" fill="${WALL}"/>${chart(floor, ft, 96, 1254, 1270)}
    ${text(W / 2, 150, 46, LINEUP, LINE, 'text-anchor="middle" font-weight="700" letter-spacing="7"')}
    ${shadows(floor, [[COVER.lyra, 190], [COVER.fia, 170]])}
    <rect y="${floor}" width="${W}" height="${H - floor}" fill="${INK}"/>
    ${brush(150, floor + 36, 1050, 128, MUSTARD, -3)}${title(W / 2, floor + 130, 104)}
    ${text(W / 2, H - 44, 22, CREDIT, BONE, 'text-anchor="middle" letter-spacing="3" opacity=".8"')}`;
}

/**
 * Key art, 1920×1080: the same lineup wide, the two of them right of centre so the title menu
 * can sit on the wall to their left. A foot is 115 px; the floor is at 960.
 * The loader in src/game-loaders.ts (SN_FOCUS) closes in between the two placards.
 */
const HERO = { floor: 960, ft: 115, lyra: 1120, fia: 1560, cards: { lyra: [1300, 330, 220], fia: [1580, 400, 220] } };
function hero() {
  const W = 1920, H = 1080, { floor, ft } = HERO;
  return `<rect width="${W}" height="${H}" fill="${WALL}"/>${chart(floor, ft, 0, 1840, 1852)}
    ${shadows(floor, [[HERO.lyra, 150], [HERO.fia, 130]])}
    <rect y="${floor}" width="${W}" height="${H - floor}" fill="${INK}"/>`;
}

/** Spine, 148×1700: the spike crown at the head, the title down a mustard stroke, the year at the foot. */
function spine() {
  const W = 148, H = 1700;
  const crown = [-160, -134, -110, -86, -62, -36, -14].map((a, i) => {
    const r = (a * Math.PI) / 180, l = [40, 62, 80, 84, 72, 56, 40][i], ox = W / 2 + 14, oy = 210;
    const tx = ox + Math.cos(r) * l, ty = oy + Math.sin(r) * l, nx = -Math.sin(r) * 5, ny = Math.cos(r) * 5;
    return `<path d="M${ox + nx} ${oy + ny} L${tx} ${ty} L${ox - nx} ${oy - ny} Z" fill="${BONE}"/>`;
  }).join("");
  return `<rect width="${W}" height="${H}" fill="${INK}"/>${crown}<ellipse cx="${W / 2 + 6}" cy="236" rx="34" ry="30" fill="${INK}"/>
    <rect x="18" y="292" width="${W - 36}" height="3" fill="${BONE}" opacity=".5"/>
    <g transform="translate(${W / 2} 0)">${brush(-52, 330, 104, 980, MUSTARD, 0)}</g>
    <g transform="translate(${W / 2 - 28} 820) rotate(90)">${text(0, 0, 76, TITLE, SHADOW, 'text-anchor="middle" font-weight="700" font-style="italic"', "Georgia")}</g>
    <g transform="translate(${W / 2 - 32} 816) rotate(90)">${text(0, 0, 76, TITLE, CRIMSON, 'text-anchor="middle" font-weight="700" font-style="italic"', "Georgia")}</g>
    ${text(W / 2, H - 170, 24, "CO-OP", BONE, 'text-anchor="middle" letter-spacing="3"')}
    <rect x="${W / 2 - 44}" y="${H - 132}" width="88" height="46" fill="${CRIMSON}"/>
    ${text(W / 2, H - 98, 30, "2026", BONE, 'text-anchor="middle" letter-spacing="2"')}`;
}

/** Characters set one by one round a circle (librsvg has no textPath), centred on angle `at`. */
function arcText(c, r, at, str, size, fill, spacing = 0.6, opts = "") {
  const below = Math.sin(at) > 0, step = ((size * spacing) / r) * (below ? -1 : 1);
  return [...str].map((ch, i) => {
    const a = at + (i - (str.length - 1) / 2) * step, x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
    return `<text x="0" y="0" font-family="Bahnschrift" font-size="${size}" fill="${fill}" text-anchor="middle" dominant-baseline="central" ${opts} transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(deg(a) + (below ? -90 : 90)).toFixed(1)})">${esc(ch)}</text>`;
  }).join("");
}

/** Disc label, 1024²: the height chart runs across the whole disc, the title rides a stroke above the hole. */
function disc() {
  const W = 1024, c = W / 2;
  return `<rect width="${W}" height="${W}" fill="${WALL}"/>${chart(W * 0.98, 92, 0, W, undefined, 0, 132)}
    <circle cx="${c}" cy="${c}" r="150" fill="${WALL}"/><circle cx="${c}" cy="${c}" r="150" fill="none" stroke="${INK}" stroke-width="12"/>
    <circle cx="${c}" cy="${c}" r="468" fill="none" stroke="${INK}" stroke-width="20"/>
    ${brush(150, 176, 724, 104, MUSTARD, -3)}${title(c, 258, 82)}
    ${text(c, 326, 26, "X-007 · CHARGE: THEFT", INK, 'text-anchor="middle" font-weight="700" letter-spacing="4"')}
    ${arcText(c, 432, Math.PI / 2, "TWO THIEVES · ONE WAY OUT · ONLINE CO-OP · 2026", 22, INK, 0.52, 'font-weight="700"')}`;
}

await render("cover", 1350, 1700, cover(), 1350, await lineup(COVER.floor, COVER.ft, COVER));
const heroArt = await lineup(HERO.floor, HERO.ft, HERO);
await render("hero", 1920, 1080, hero(), 1920, heroArt);
await render("spine", 148, 1700, spine());
await render("disc", 1024, 1024, disc());

// Title menu art (src/title-menus.ts): the wall from the key art, the title on its stroke, on
// transparent, and the game's paw icon (Fia's door-barrier mark) in ink as the menu's pointer.
await render("menu/lineup", 1920, 1080, hero(), 1920, heroArt);
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="210" viewBox="0 0 720 210">${defs}${brush(30, 60, 660, 112, MUSTARD, -3)}${title(360, 146, 92)}</svg>`))
  .png().toFile(resolve(OUT, "menu/title.png"));
{
  const icon = await sharp(resolve(ART, "paw.png")).trim().resize({ height: 96 }).ensureAlpha().toBuffer();
  const { width, height } = await sharp(icon).metadata();
  const alpha = await sharp(icon).extractChannel("alpha").toBuffer();
  await sharp({ create: { width, height, channels: 3, background: INK } }).joinChannel(alpha).png().toFile(resolve(OUT, "menu/paw.png"));
}
console.log("wrote menu");

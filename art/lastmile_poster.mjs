// Cover and key art for Last Mile (work X-004).
// Homage in method only: the Modern Times idea of a worker caught in the machine's
// gears, printed like an old screen-printed one-sheet. Three inks on paper (ink,
// amber, the paper itself): each ink is its own layer with rough edges and worn
// specks, the amber plate sits a few pixels out of register, and the plates are
// multiplied together like overprinted ink. Halftone dots stand in for tints. The gears
// are the game's own dispatch parts (order slips, countdown pins, a drive wheel);
// the rider running on top of them wears the station's helmet, the only amber on them.
// Run: node art/lastmile_poster.mjs  (needs sharp; SHARP_MODULE may point to it)
// OUT_DIR renders somewhere else (drafts); LASTMILE_SHOTS points at the game's captures.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const { default: sharp } = await import(process.env.SHARP_MODULE ? pathToFileURL(resolve(process.env.SHARP_MODULE)).href : "sharp");
const WORKS = resolve(new URL("../public/works/x-004/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const OUT = process.env.OUT_DIR ? resolve(process.env.OUT_DIR) : WORKS;
const SHOTS = process.env.LASTMILE_SHOTS ?? "F:/UnityProject/DeliveryService/Captures";
mkdirSync(OUT, { recursive: true });
mkdirSync(WORKS, { recursive: true });

// Inks from the game's station UI (LastMileDemo.Station.cs); white on a plate means "no ink".
const PAPER = "#ede6d6", INK = "#272c30", AMBER = "#f1b05f", NONE = "#ffffff";
const COND = "Bahnschrift SemiBold Condensed, Bahnschrift, Arial Narrow, sans-serif";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const text = (x, y, size, str, fill, opts = "", family = COND) =>
  `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" fill="${fill}" ${opts}>${esc(str)}</text>`;
const deg = (a) => (a * 180) / Math.PI;

/** Rough edges and worn specks for one plate; `seed` varies the wear between plates. */
const plateDefs = (seed) => `<defs>
  <filter id="print" x="-2%" y="-2%" width="104%" height="104%">
    <feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="2" seed="${seed}" result="warp"/>
    <feDisplacementMap in="SourceGraphic" in2="warp" scale="6" xChannelSelector="R" yChannelSelector="G" result="rough"/>
    <feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="1" seed="${seed + 7}" result="speck"/>
    <feColorMatrix in="speck" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -14 0 0 0 9.4" result="worn"/>
    <feComposite in="rough" in2="worn" operator="in"/>
  </filter>
  <pattern id="dots" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="5.5" cy="5.5" r="3.1" fill="${AMBER}"/></pattern>
</defs>`;

/** An order slip centred on the origin, pointing up: card with side notches, tear line, label. */
function slip(w, h, fill, cut, label) {
  const n = w * 0.08, ty = -h / 2 + h * 0.38;
  return `<path d="M${-w / 2} ${-h / 2}h${w}V${ty - n}a${n} ${n} 0 0 0 0 ${n * 2}V${h / 2}h${-w}V${ty + n}a${n} ${n} 0 0 0 0 ${-n * 2}Z" fill="${fill}"/>` +
    `<line x1="${-w / 2 + n * 1.6}" y1="${ty}" x2="${w / 2 - n * 1.6}" y2="${ty}" stroke="${cut}" stroke-width="${w * 0.035}" stroke-dasharray="${w * 0.07} ${w * 0.055}"/>` +
    (label ? text(0, h / 2 - h * 0.16, w * 0.15, label, cut, `text-anchor="middle" letter-spacing="1"`) : "");
}

/** A countdown pin centred on the origin, pointing outward (up), its time knocked out. */
function pin(w, h, fill, cut, label) {
  return `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h * 0.78}" rx="${h * 0.14}" fill="${fill}"/>` +
    `<path d="M${-w * 0.12} ${h * 0.27} L0 ${h / 2} L${w * 0.12} ${h * 0.27} Z" fill="${fill}"/>` +
    text(0, h * 0.13, h * 0.42, label, cut, `text-anchor="middle" font-weight="700"`);
}

const TIMES = ["0:09", "0:31", "0:05", "0:18", "0:03", "0:12", "0:07", "0:24"];
const GOODS = ["BREAKFAST", "MILK", "SNACKS", "NOODLES", "PARCEL", "COFFEE", "MEDS", "FRUIT"];

/** A gear body with lightening holes knocked out (even-odd), as one silhouette. */
function body(R, holes, rot, fill) {
  const circle = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
  let d = circle(0, 0, R) + circle(0, 0, R * 0.09);
  for (let i = 0; i < holes; i++) {
    const a = rot + (i / holes) * Math.PI * 2;
    d += circle(Math.cos(a) * R * 0.56, Math.sin(a) * R * 0.56, R * 0.19);
  }
  return `<path d="${d}" fill="${fill}" fill-rule="evenodd"/>`;
}

/** Teeth round a gear: `make(i)` draws one tooth at the origin pointing up. */
function teeth(R, n, rot, lift, make) {
  let s = "";
  for (let i = 0; i < n; i++) s += `<g transform="rotate(${deg(rot + (i / n) * Math.PI * 2) + 90}) translate(0 ${-(R + lift)})">${make(i)}</g>`;
  return s;
}

/**
 * The rider, side on and running hard with the courier box on their back: a solid ink
 * silhouette, faceless, with the helmet knocked out of the ink and printed amber, the
 * only colour on them. (x, y) is the planted foot; about 270 units tall, facing right.
 */
function rider(x, y, s) {
  const g = (inner) => `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`;
  const limb = (d, w) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const helmet = '<path d="M-12 -240 C-12 -276 40 -278 42 -240 Z M-16 -244 h66 v9 h-66 Z"/>';
  const ink = g(
    limb("M-2 -194 L-32 -150 L-22 -122", 17) +                         // back arm
    limb("M-14 -112 L-40 -66 L-84 -52", 21) +                          // back leg, kicked out behind
    `<path d="M-90 -58 l-8 18 h22 l6 -14 Z" fill="${INK}"/>` +
    // The box rides on the back, tilted with the lean; a band across it, as on the station's bags.
    `<g transform="rotate(14 -40 -164)"><rect x="-76" y="-202" width="70" height="74" rx="5" fill="${INK}"/>` +
    `<path d="M-70 -168 H-14" stroke="${NONE}" stroke-width="5"/></g>` +
    `<path d="M-14 -102 C-26 -130 -18 -176 4 -204 L30 -196 C26 -168 18 -132 12 -104 Z" fill="${INK}"/>` + // torso, leaning in
    // A hairline of paper parts back from box; the strap runs from the box over the shoulder to the chest.
    `<path d="M-20 -118 C-27 -140 -20 -178 2 -203" stroke="${NONE}" stroke-width="4" fill="none"/>` +
    `<path d="M-6 -201 C10 -208 24 -194 20 -150 L4 -146" stroke="${NONE}" stroke-width="5" fill="none" stroke-linejoin="round"/>` +
    `<rect x="6" y="-226" width="14" height="22" fill="${INK}" transform="rotate(14 12 -214)"/>` +
    `<ellipse cx="16" cy="-236" rx="21" ry="24" fill="${INK}"/>` +
    limb("M-8 -110 L34 -66 L18 -8", 21) +                              // front leg, planted
    `<path d="M8 -12 h30 l8 12 h-42 Z" fill="${INK}"/>` +
    limb("M12 -192 L44 -160 L70 -176", 17) +                           // front arm, pumping
    `<g fill="${NONE}">${helmet}</g>`);
  const amber = g(`<g fill="${AMBER}">${helmet}</g>`);
  return { ink, amber };
}

/** Speed lines trailing to the left of (x, y): three ink strokes of falling length. */
function speed(x, y, k, len = 120) {
  return [0, 1, 2].map((i) => `<path d="M${x - (len - i * 26) * k} ${y + i * 34 * k} H${x - 8 * k}" stroke="${INK}" stroke-width="${(9 - i * 2) * k}" stroke-linecap="round"/>`).join("");
}

/** A curved arrow round (cx, cy) at radius r from angle a0 to a1 (radians, clockwise). */
function spin(cx, cy, r, a0, a1, w) {
  const [x0, y0] = [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r], [x1, y1] = [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r];
  const t = a1 + Math.PI / 2, h = w * 3.2;
  return `<path d="M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round"/>` +
    `<path d="M${x1 + Math.cos(t) * h} ${y1 + Math.sin(t) * h} L${x1 + Math.cos(a1) * h * 0.7} ${y1 + Math.sin(a1) * h * 0.7} L${x1 - Math.cos(a1) * h * 0.7} ${y1 - Math.sin(a1) * h * 0.7} Z" fill="${INK}"/>`;
}

/**
 * The machine, laid out in cover coordinates and placed with (dx, dy, k): a big ink gear
 * toothed with order slips, an amber gear toothed with countdown pins, and a halftone
 * drive gear. The rider runs on top of the slip gear as it turns, like a treadmill.
 */
function machine(dx, dy, k) {
  const P = (x, y) => [dx + x * k, dy + y * k];
  const [ax, ay] = P(430, 1010), [bx, by] = P(950, 700), [cx, cy] = P(940, 1300), [rx, ry] = P(420, 574);
  const RA = 330 * k, RB = 230 * k, RC = 200 * k;
  const pinTeeth = (fill, cut) => teeth(RB, 9, 0.45, RB * 0.1, (i) => pin(78 * k, 70 * k, fill, cut, TIMES[i % 8]));
  let ink = "", amber = "";
  // Drive gear: halftone body and blocky teeth on the amber plate.
  amber += `<g transform="translate(${cx} ${cy})">${teeth(RC, 18, 0.1, 10 * k, () => `<path d="M${-22 * k} ${18 * k} L${-15 * k} ${-16 * k} L${15 * k} ${-16 * k} L${22 * k} ${18 * k} Z" fill="url(#dots)"/>`)}<circle r="${RC}" fill="url(#dots)"/></g>`;
  // A plain ink hub with its axle knocked out: the one that drives the rest.
  ink += `<circle cx="${cx}" cy="${cy}" r="${RC * 0.42}" fill="${INK}"/><circle cx="${cx}" cy="${cy}" r="${RC * 0.12}" fill="${NONE}"/>`;
  // Slip gear, all ink, tear lines and labels knocked out.
  ink += `<g transform="translate(${ax} ${ay})">${teeth(RA, 12, -Math.PI / 2, RA * 0.16, (i) => slip(70 * k, 108 * k, INK, NONE, GOODS[i % 8]))}${body(RA, 6, -0.05, INK)}</g>`;
  // Pin gear, all amber, times knocked out.
  amber += `<g transform="translate(${bx} ${by})">${pinTeeth(AMBER, NONE)}${body(RB, 5, 0.45, AMBER)}</g>`;
  // The rider, running on the top tooth of the slip gear.
  const r = rider(rx, ry, 1.15 * k);
  ink += r.ink + speed(rx - 110 * k, ry - 236 * k, k, 150);
  amber += r.amber;
  // The gears are turning, fast.
  ink += spin(ax, ay, RA + 150 * k, Math.PI * 0.62, Math.PI * 0.92, 7 * k) + spin(ax, ay, RA + 150 * k, Math.PI * 1.12, Math.PI * 1.36, 7 * k);
  ink += spin(bx, by, RB + 110 * k, -Math.PI * 0.32, -Math.PI * 0.05, 6 * k) + spin(bx, by, RB + 110 * k, Math.PI * 0.18, Math.PI * 0.4, 6 * k);
  return { ink, amber };
}

/** Print a design: paper, then the amber plate (out of register by `off`), then ink, multiplied. */
async function print(name, W, H, plates, size, off = [5, 3]) {
  const plate = (content, seed, shift = [0, 0]) =>
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${plateDefs(seed)}<rect width="${W}" height="${H}" fill="${NONE}"/><g filter="url(#print)" transform="translate(${shift[0]} ${shift[1]})">${content}</g></svg>`);
  const paper = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><filter id="f"><feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="3" seed="2"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .4  0 0 0 0 .32  0 0 0 .09 0"/></filter><rect width="${W}" height="${H}" fill="${PAPER}"/><rect width="${W}" height="${H}" filter="url(#f)"/></svg>`);
  const layers = [
    { input: await sharp(plate(plates.amber, 11, off)).png().toBuffer(), blend: "multiply" },
    ...(plates.images ?? []),
    { input: await sharp(plate(plates.ink, 3)).png().toBuffer(), blend: "multiply" },
  ];
  const flat = await sharp(paper).composite(layers).png().toBuffer();
  await sharp(flat).resize(size).jpeg({ quality: 88, mozjpeg: true }).toFile(resolve(OUT, `${name}.jpg`));
  console.log("wrote", name);
}

function cover() {
  const W = 1350, H = 1700, m = machine(0, 40, 1);
  let ink = m.ink, amber = m.amber;
  ink += text(78, 214, 196, "LAST MILE", INK, 'font-weight="700" letter-spacing="2"');
  amber += `<rect x="84" y="246" width="338" height="54" fill="${AMBER}"/>` + text(100, 284, 30, "A TEN-DAY TRIAL", NONE, 'letter-spacing="4"');
  ink += text(84, 1532, 40, "DELIVER THE ORDERS.", INK, 'letter-spacing="4"');
  ink += text(84, 1580, 40, "LOOK AFTER THE PEOPLE.", INK, 'letter-spacing="4"');
  amber += `<rect x="78" y="1548" width="560" height="44" fill="url(#dots)"/>`;
  ink += `<rect x="84" y="1606" width="${W - 168}" height="3" fill="${INK}"/>`;
  ink += text(84, 1648, 23, "A GAME BY SHUHANG CHEN   ·   DELIVERY STATION MANAGEMENT   ·   UNITY 2026", INK, 'letter-spacing="4"');
  return { W, H, ink, amber };
}

function hero() {
  const W = 1920, H = 1080, m = machine(860, -110, 0.82);
  // No billing: the project page sets the title over the lower left.
  return { W, H, ink: m.ink, amber: m.amber };
}

/** Spine strip, 148×1700: a quarter of the slip gear and the helmet at the head, title down. */
function spine() {
  const W = 148, H = 1700;
  let ink = `<clipPath id="head"><rect width="${W}" height="296"/></clipPath><g clip-path="url(#head)"><g transform="translate(150 220)">${teeth(170, 10, 0.3, 26, () => slip(44, 70, INK, NONE, ""))}${body(170, 5, 0.3, INK)}</g></g>`;
  let amber = `<path d="M40 76 C40 30 104 30 104 76 Z" fill="${AMBER}"/><rect x="34" y="72" width="76" height="11" rx="4" fill="${AMBER}"/>`;
  ink += `<rect y="300" width="${W}" height="5" fill="${INK}"/>`;
  // Rotated 90°, glyphs grow to the right of their baseline.
  ink += `<g transform="translate(20 350) rotate(90)">${text(0, 0, 84, "LAST MILE", INK, 'font-weight="700" letter-spacing="4"')}</g>`;
  amber += `<rect x="94" y="346" width="34" height="240" fill="${AMBER}"/>`;
  amber += `<g transform="translate(100 360) rotate(90)">${text(0, 0, 22, "A TEN-DAY TRIAL", NONE, 'letter-spacing="3"')}</g>`;
  ink += `<g transform="translate(${W / 2 + 8} 1180) rotate(90)">${text(0, 0, 24, "SHUHANG CHEN", INK, 'letter-spacing="5"')}</g>`;
  ink += text(W / 2, H - 120, 24, "UNITY", INK, 'text-anchor="middle" letter-spacing="3"');
  amber += `<rect x="${W / 2 - 44}" y="${H - 104}" width="88" height="46" fill="${AMBER}"/>`;
  ink += text(W / 2, H - 70, 32, "2026", INK, 'text-anchor="middle" letter-spacing="2"');
  return { W, H, ink, amber };
}

/** Characters set one by one round a circle (librsvg has no textPath), centred on angle `at`. */
function arcText(c, r, at, str, size, fill, family = COND, spacing = 0.6, opts = "") {
  const below = Math.sin(at) > 0, step = ((size * spacing) / r) * (below ? -1 : 1);
  let out = "";
  [...str].forEach((ch, i) => {
    const a = at + (i - (str.length - 1) / 2) * step, x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
    out += `<text x="0" y="0" font-family="${family}" font-size="${size}" fill="${fill}" text-anchor="middle" dominant-baseline="central" ${opts} transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(deg(a) + (below ? -90 : 90)).toFixed(1)})">${esc(ch)}</text>`;
  });
  return out;
}

/**
 * Disc label, 1024²: a ten-day dial. Ticks and day numbers round the rim; the band round
 * the hole (radius 184 on the label) is the time used, fading from solid to halftone to a
 * bare outline as the days run out. The hand stands on day 10, its last minutes marked as
 * overdue, and the rider runs the track just ahead of it.
 */
function disc() {
  const W = 1024, c = W / 2;
  const at = (d) => -Math.PI / 2 + (d / 10) * Math.PI * 2;
  const pt = (d, r) => [c + Math.cos(at(d)) * r, c + Math.sin(at(d)) * r];
  const sector = (d0, d1, r0, r1) => {
    const [ax, ay] = pt(d0, r1), [bx, by] = pt(d1, r1), [cx2, cy2] = pt(d1, r0), [dx2, dy2] = pt(d0, r0), big = d1 - d0 > 5 ? 1 : 0;
    return `M${ax} ${ay}A${r1} ${r1} 0 ${big} 1 ${bx} ${by}L${cx2} ${cy2}A${r0} ${r0} 0 ${big} 0 ${dx2} ${dy2}Z`;
  };
  let ink = `<circle cx="${c}" cy="${c}" r="468" fill="none" stroke="${INK}" stroke-width="20"/>`;
  let amber = "";
  for (let d = 0; d < 10; d++) {
    const [x1, y1] = pt(d, 456), [x2, y2] = pt(d, 414);
    ink += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="9"/>`;
    for (let m = 1; m < 5; m++) { const [u1, v1] = pt(d + m / 5, 456), [u2, v2] = pt(d + m / 5, 438); ink += `<line x1="${u1}" y1="${v1}" x2="${u2}" y2="${v2}" stroke="${INK}" stroke-width="4"/>`; }
    const [tx, ty] = pt(d + 0.5, 410);
    ink += `<text x="${tx}" y="${ty}" font-family="${COND}" font-size="40" fill="${INK}" text-anchor="middle" dominant-baseline="central" font-weight="700">${String(d + 1).padStart(2, "0")}</text>`;
  }
  // Time used, fading as it runs out.
  amber += `<path d="${sector(0, 5, 206, 300)}" fill="${AMBER}"/>`;
  amber += `<path d="${sector(5, 8, 206, 300)}" fill="url(#dots)"/>`;
  amber += `<path d="${sector(8, 9.7, 210, 296)}" fill="none" stroke="${AMBER}" stroke-width="7"/>`;
  ink += arcText(c, 253, at(4.1), "LAST MILE", 58, INK, COND, 0.58, 'font-weight="700"');
  // The track the rider runs, the hand on day 10, and the rider just ahead of it.
  ink += `<circle cx="${c}" cy="${c}" r="304" fill="none" stroke="${INK}" stroke-width="4"/>`;
  amber += `<path d="${sector(9.7, 10, 438, 458)}" fill="${AMBER}"/>`;
  for (const d of [9.42, 9.56]) { const [g0x, g0y] = pt(d, 200), [g1x, g1y] = pt(d, 392); amber += `<path d="M${g0x} ${g0y}L${g1x} ${g1y}" stroke="url(#dots)" stroke-width="16" stroke-linecap="round"/>`; }
  const [hx0, hy0] = pt(9.7, 196), [hx1, hy1] = pt(9.7, 400);
  ink += `<path d="M${hx0} ${hy0}L${hx1} ${hy1}" stroke="${INK}" stroke-width="14" stroke-linecap="round"/><circle cx="${hx1}" cy="${hy1}" r="13" fill="${INK}"/>`;
  const r = rider(0, 0, 0.38), lean = (deg(at(0.2)) + 90).toFixed(1);
  const place = (s) => `<g transform="translate(${c} ${c}) rotate(${lean}) translate(0 -306)">${s}</g>`;
  ink += place(r.ink + speed(-44, -82, 0.8, 64));
  amber += place(r.amber);
  amber += `<circle cx="${c}" cy="${c}" r="194" fill="none" stroke="${AMBER}" stroke-width="12"/>`;
  ink += arcText(c, 488, Math.PI / 2, "A TEN-DAY TRIAL  ·  UNITY 2026", 20, INK, COND, 0.62, 'letter-spacing="3"');
  return { W, H: W, ink, amber };
}

/** Back cover, 1350×1700: a headline, pitch, screenshots printed in ink, three verbs, gear footer. */
async function back() {
  const W = 1350, H = 1700, M = 96;
  let ink = "", amber = "";
  amber += `<rect x="${M - 8}" y="114" width="200" height="44" fill="${AMBER}"/>`;
  ink += text(M, 146, 26, "DAY 01  /  06:00", INK, 'letter-spacing="4"');
  ink += text(M, 236, 70, "Somebody has to", INK);
  ink += text(M, 312, 70, "be on time.", INK);
  ["Ten days running a neighbourhood delivery station.", "Dispatch riders, robots and drones against the clock,", "and keep an eye on the people doing the delivering."]
    .forEach((l, i) => { ink += text(M, 396 + i * 44, 30, l, INK, "", "Segoe UI, Arial, sans-serif"); });
  // Screenshot frames: slips with notches and a tear line; the pictures go on as one-colour prints.
  const half = (W - M * 2 - 30) / 2;
  const frames = [[M, 560, W - M * 2, 520, "dispatch.jpg"], [M, 1110, half, 300, "briefing.jpg"], [M + half + 30, 1110, half, 300, "title.jpg"]];
  const images = [];
  for (const [x, y, w, h, img] of frames) {
    ink += `<path d="M${x} ${y}h${w}v${h - 70}a12 12 0 0 0 0 24V${y + h}h${-w}V${y + h - 46}a12 12 0 0 0 0 -24Z" fill="none" stroke="${INK}" stroke-width="4"/>`;
    ink += `<line x1="${x + 24}" y1="${y + h - 58}" x2="${x + w - 24}" y2="${y + h - 58}" stroke="${INK}" stroke-width="3" stroke-dasharray="12 9"/>`;
    const iw = Math.round(w - 28), ih = Math.round(h - 98);
    const pic = await sharp(readFileSync(resolve(WORKS, img))).resize(iw, ih, { fit: "cover" }).grayscale().linear(1.15, 10).png().toBuffer();
    images.push({ input: pic, left: Math.round(x + 14), top: Math.round(y + 14), blend: "multiply" });
  }
  [["Dispatch.", 0], ["Look after them.", 330], ["Beat the clock.", 770]].forEach(([t, dx], i) => {
    if (i === 1) amber += `<rect x="${M + dx - 8}" y="1452" width="300" height="40" fill="url(#dots)"/>`;
    ink += text(M + dx, 1488, 46, t, INK, 'font-weight="700"');
  });
  ink += `<rect y="1560" width="${W}" height="${H - 1560}" fill="${INK}"/>`;
  for (let x = -20; x < W + 40; x += 56) ink += `<path d="M${x} 1561 l10 -22 h26 l10 22 Z" fill="${INK}"/>`;
  ink += text(M, 1636, 26, "UNITY 6 · URP · 2026 · SOLO DEVELOPER", NONE, 'letter-spacing="5"');
  amber += `<rect x="${W - M - 282}" y="1606" width="296" height="42" fill="${AMBER}"/>`;
  ink += text(W - M, 1636, 26, "SHUHANG CHEN", NONE, 'text-anchor="end" letter-spacing="6"');
  return { W, H, ink, amber, images };
}

// Gallery and back-cover shots, cut from the game's own captures when they are at hand.
const GALLERY = [["english-title.png", "title"], ["ui-scene-palette-morning-final.png", "dispatch"], ["english-dispatch-final.png", "evening"], ["manager-replacement-notice.png", "briefing"]];
if (existsSync(SHOTS)) for (const [src, name] of GALLERY) {
  await sharp(readFileSync(resolve(SHOTS, src))).resize(1280, 720, { fit: "cover" }).jpeg({ quality: 86, mozjpeg: true }).toFile(resolve(WORKS, `${name}.jpg`));
}

for (const [name, make, size] of [["cover", cover, 1350], ["hero", hero, 1920], ["spine", spine, 148], ["disc", disc, 1024], ["back", back, 1350]]) {
  const plates = await make();
  await print(name, plates.W, plates.H, plates, size);
}


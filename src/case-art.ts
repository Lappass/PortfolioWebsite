import type { ArchiveRecord } from "./data";

// Wraparound insert layout from art/game_case.py: [back][spine][front], in model units.
export const CASE_W = 1.35, CASE_H = 1.7, CASE_SPINE = 0.13 + 0.018;
export const INSERT_ASPECT = (CASE_W * 2 + CASE_SPINE) / CASE_H;
const HUES: Record<string, number> = { Games: 32, Web: 215, "3D Graphics": 24, Interaction: 165, "Visual Design": 340, Experiments: 265 };

/** Cover art supplied per work (content/archives.json `cover`), decoded before cases are printed. */
const coverImages = new Map<string, HTMLImageElement>();
export async function preloadCovers(works: ArchiveRecord[], url: (path: string) => string) {
  await Promise.all(works.flatMap((r) => (["cover", "spine", "disc"] as const).filter((k) => r[k]).map(async (k) => {
    const key = `${r.id}:${k}`;
    if (coverImages.has(key)) return;
    const image = new Image();
    image.src = url(r[k]!);
    try { await image.decode(); coverImages.set(key, image); } catch { /* Fall back to the printed art. */ }
  })));
}
/** Draw an image to fill a box, cropping the overflow (CSS object-fit: cover). */
function drawCover(c: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const k = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / k, sh = h / k;
  c.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}
const hash = (text: string) => [...text].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);
/** Per-work palette: the category sets the hue family, each work shifts it. */
export function paletteOf(r: ArchiveRecord) {
  const seed = hash(r.id + r.title);
  const hue = (HUES[r.category] ?? 40) + ((seed % 41) - 20);
  const light = 34 + (seed >> 6) % 22, sat = 50 + (seed >> 11) % 25;
  return {
    seed,
    base: `hsl(${hue} ${sat}% ${light}%)`,
    deep: `hsl(${hue + 8} ${sat}% ${Math.max(10, light - 20)}%)`,
    bright: `hsl(${hue - 14} ${Math.min(95, sat + 15)}% ${Math.min(78, light + 26)}%)`,
    contrast: `hsl(${hue + 160} ${sat}% ${light + 10}%)`,
  };
}
const CASE_PAPER = "#c9c9c4", CASE_INK = "#272a28", CASE_MUTED = "#6d6f69";

/** One of several generated compositions, so neighbouring cases never match. */
export function paintArtwork(c: CanvasRenderingContext2D, r: ArchiveRecord, x: number, w: number, h: number) {
  const p = paletteOf(r), layout = p.seed % 5, rand = (i: number) => ((p.seed >> (i % 24)) % 1000) / 1000;
  c.fillStyle = p.base;
  c.fillRect(x, 0, w, h);
  c.save();
  c.beginPath();
  c.rect(x, 0, w, h);
  c.clip();
  if (layout === 0) {
    c.fillStyle = p.deep;
    c.beginPath(); c.moveTo(x, h * (0.25 + rand(1) * 0.3)); c.lineTo(x + w, h * (0.05 + rand(2) * 0.2)); c.lineTo(x + w, h); c.lineTo(x, h); c.fill();
    c.fillStyle = p.bright;
    c.beginPath(); c.moveTo(x, h * 0.62); c.lineTo(x + w, h * (0.38 + rand(3) * 0.2)); c.lineTo(x + w, h * 0.5); c.lineTo(x, h * 0.74); c.fill();
  } else if (layout === 1) {
    const cx = x + w * (0.3 + rand(4) * 0.4), cy = h * (0.3 + rand(5) * 0.2);
    for (let i = 7; i > 0; i--) {
      c.fillStyle = i % 2 ? p.deep : p.bright;
      c.beginPath(); c.arc(cx, cy, w * 0.11 * i, 0, Math.PI * 2); c.fill();
    }
  } else if (layout === 2) {
    const n = 6, cell = w / n;
    for (let i = 0; i < n * 5; i++) {
      const on = ((p.seed >> (i % 28)) & 3) === 0;
      c.fillStyle = on ? p.bright : (i % 3 ? p.deep : p.base);
      c.fillRect(x + (i % n) * cell + cell * 0.08, h * 0.08 + Math.floor(i / n) * cell + cell * 0.08, cell * 0.84, cell * 0.84);
    }
  } else if (layout === 3) {
    for (let i = 0; i < 9; i++) {
      c.fillStyle = [p.deep, p.base, p.bright][(i + p.seed) % 3];
      c.fillRect(x, h * (0.06 + i * 0.065), w, h * 0.065);
    }
    c.fillStyle = p.contrast;
    c.beginPath(); c.arc(x + w * (0.25 + rand(6) * 0.5), h * 0.36, w * 0.16, 0, Math.PI * 2); c.fill();
  } else {
    c.strokeStyle = p.bright;
    c.lineWidth = w * 0.035;
    for (let i = -6; i < 12; i++) { c.beginPath(); c.moveTo(x + i * w * 0.16, 0); c.lineTo(x + i * w * 0.16 + h * 0.7, h * 0.7); c.stroke(); }
    c.fillStyle = p.deep;
    c.fillRect(x + w * 0.1, h * (0.15 + rand(7) * 0.15), w * 0.8, h * 0.3);
  }
  // Keep the title legible over any composition.
  c.fillStyle = "rgba(8,10,12,.55)";
  c.fillRect(x, h * 0.6, w, h * 0.4);
  c.restore();
}

function wrapLines(c: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    if (c.measureText(line + ch).width > width && line) { lines.push(line); line = ch; } else line += ch;
  }
  return line ? [...lines, line] : lines;
}

/** Paint one wraparound insert into `c` at (x, y) with total width `width`. */
export function paintInsert(c: CanvasRenderingContext2D, r: ArchiveRecord, number: number, x: number, y: number, width: number) {
  const px = width / (CASE_W * 2 + CASE_SPINE), h = CASE_H * px;
  const bx = x, bw = CASE_W * px, sx = x + bw, sw = CASE_SPINE * px, fx = sx + sw, fw = bw;
  c.save();
  c.beginPath();
  c.rect(x, y, width, h);
  c.clip();
  c.translate(0, y);
  // Front cover: the work's own art when it has one, otherwise a printed title card.
  const art = coverImages.get(`${r.id}:cover`);
  if (art) drawCover(c, art, fx, 0, fw, h);
  else {
  c.fillStyle = CASE_PAPER;
  c.fillRect(fx, 0, fw, h);
  c.fillStyle = CASE_MUTED;
  c.textAlign = "left";
  c.font = `500 ${h * 0.026}px MiSans`;
  c.fillText(r.category, fx + fw * 0.07, h * 0.09);
  c.textAlign = "right";
  c.fillText(r.id, fx + fw * 0.93, h * 0.09);
  c.fillStyle = CASE_INK;
  c.textAlign = "left";
  c.font = `700 ${h * 0.075}px MiSans`;
  wrapLines(c, r.title, fw * 0.86).slice(0, 3).forEach((line, i) => c.fillText(line, fx + fw * 0.07, h * 0.72 + i * h * 0.085));
  c.font = `500 ${h * 0.024}px MiSans`;
  c.fillStyle = CASE_MUTED;
  c.fillText(r.en, fx + fw * 0.07, h * 0.94, fw * 0.6);
  c.textAlign = "right";
  c.fillText(r.id, fx + fw * 0.93, h * 0.94);
  c.textAlign = "left";
  }
  // Spine.
  const spineArt = coverImages.get(`${r.id}:spine`);
  if (spineArt) drawCover(c, spineArt, sx, 0, sw, h);
  else {
  c.fillStyle = CASE_PAPER;
  c.fillRect(sx, 0, sw, h);
  c.save();
  c.translate(sx + sw * 0.66, h * 0.12);
  c.rotate(Math.PI / 2);
  c.fillStyle = CASE_INK;
  c.font = `700 ${sw * 0.42}px MiSans`;
  c.fillText(r.title, 0, 0, h * 0.7);
  c.restore();
  c.fillStyle = CASE_MUTED;
  c.font = `500 ${sw * 0.3}px MiSans`;
  c.textAlign = "center";
  c.fillText(String(number).padStart(2, "0"), sx + sw / 2, h * 0.96);
  c.textAlign = "left";
  }
  // Back.
  c.fillStyle = CASE_PAPER;
  c.fillRect(bx, 0, bw, h);
  c.fillStyle = CASE_INK;
  c.font = `700 ${h * 0.034}px MiSans`;
  c.fillText(r.title, bx + bw * 0.07, h * 0.15, bw * 0.86);
  c.fillStyle = CASE_MUTED;
  c.font = `400 ${h * 0.022}px MiSans`;
  wrapLines(c, r.abstract, bw * 0.86).slice(0, 6).forEach((line, i) => c.fillText(line, bx + bw * 0.07, h * 0.22 + i * h * 0.036));
  r.findings.slice(0, 3).forEach((f, i) => c.fillText(`· ${f}`, bx + bw * 0.07, h * 0.66 + i * h * 0.04, bw * 0.86));
  c.fillStyle = CASE_MUTED;
  c.font = `500 ${h * 0.02}px MiSans`;
  c.fillText(`${r.category} · ${r.lead}`, bx + bw * 0.07, h * 0.93, bw * 0.86);
  c.restore();
}

export function insertCanvas(r: ArchiveRecord, number: number, width = 2400) {
  const canvas = Object.assign(document.createElement("canvas"), { width, height: Math.round(width / INSERT_ASPECT) });
  paintInsert(canvas.getContext("2d")!, r, number, 0, 0, width);
  return canvas;
}

export function paintDiscLabel(c: CanvasRenderingContext2D, r: ArchiveRecord, size = 1024) {
  const k = size / 1024;
  const discArt = coverImages.get(`${r.id}:disc`);
  if (discArt) { c.drawImage(discArt, 0, 0, size, size); return; }
  c.fillStyle = CASE_PAPER;
  c.fillRect(0, 0, size, size);
  c.fillStyle = CASE_INK;
  c.textAlign = "center";
  c.font = `700 ${64 * k}px MiSans`;
  c.fillText(r.title, 512 * k, 790 * k, 560 * k);
  c.font = `500 ${34 * k}px MiSans`;
  c.fillStyle = CASE_MUTED;
  c.fillText(r.id, 512 * k, 850 * k);
  c.textAlign = "left";
}

export function discLabelCanvas(r: ArchiveRecord, size = 512) {
  const canvas = Object.assign(document.createElement("canvas"), { width: size, height: size });
  paintDiscLabel(canvas.getContext("2d")!, r, size);
  return canvas;
}

import type { ArchiveRecord } from "./data";

// Wraparound insert layout from art/game_case.py: [back][spine][front], in model units.
export const CASE_W = 1.35, CASE_H = 1.7, CASE_SPINE = 0.13 + 0.018;
export const INSERT_ASPECT = (CASE_W * 2 + CASE_SPINE) / CASE_H;
const HUES: Record<string, number> = { 网页开发: 215, 三维图形: 24, 交互设计: 165, 视觉设计: 340, 实验项目: 265 };
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
const accentOf = (r: ArchiveRecord) => paletteOf(r).base;

/** One of several generated compositions, so neighbouring cases never match. */
function paintArtwork(c: CanvasRenderingContext2D, r: ArchiveRecord, x: number, w: number, h: number) {
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
  const accent = accentOf(r);
  c.save();
  c.beginPath();
  c.rect(x, y, width, h);
  c.clip();
  c.translate(0, y);
  // Front cover.
  paintArtwork(c, r, fx, fw, h);
  c.fillStyle = "#e9ecea";
  c.textAlign = "left";
  c.font = `700 ${h * 0.075}px MiSans`;
  wrapLines(c, r.title, fw * 0.86).slice(0, 3).forEach((line, i) => c.fillText(line, fx + fw * 0.07, h * 0.72 + i * h * 0.085));
  c.font = `500 ${h * 0.024}px MiSans`;
  c.fillStyle = "rgba(255,255,255,.7)";
  c.fillText(r.en, fx + fw * 0.07, h * 0.94, fw * 0.6);
  c.textAlign = "right";
  c.fillText(r.id, fx + fw * 0.93, h * 0.94);
  c.textAlign = "left";
  // Spine.
  c.fillStyle = "#0e1113";
  c.fillRect(sx, 0, sw, h);
  c.fillStyle = accent;
  c.fillRect(sx, 0, sw, h * 0.075);
  c.save();
  c.translate(sx + sw * 0.66, h * 0.12);
  c.rotate(Math.PI / 2);
  c.fillStyle = "#e9ecea";
  c.font = `700 ${sw * 0.42}px MiSans`;
  c.fillText(r.title, 0, 0, h * 0.7);
  c.restore();
  c.fillStyle = "#8c979a";
  c.font = `500 ${sw * 0.3}px MiSans`;
  c.textAlign = "center";
  c.fillText(String(number).padStart(2, "0"), sx + sw / 2, h * 0.96);
  c.textAlign = "left";
  // Back.
  c.fillStyle = "#1b2024";
  c.fillRect(bx, 0, bw, h);
  for (let i = 0; i < 3; i++) {
    c.fillStyle = i === 0 ? accent : "#2a3237";
    c.fillRect(bx + bw * (0.07 + i * 0.3), h * 0.08, bw * 0.26, h * 0.17);
  }
  c.fillStyle = "#e9ecea";
  c.font = `700 ${h * 0.034}px MiSans`;
  c.fillText(r.title, bx + bw * 0.07, h * 0.33, bw * 0.86);
  c.fillStyle = "#aab3b5";
  c.font = `400 ${h * 0.022}px MiSans`;
  wrapLines(c, r.abstract, bw * 0.86).slice(0, 6).forEach((line, i) => c.fillText(line, bx + bw * 0.07, h * 0.39 + i * h * 0.036));
  r.findings.slice(0, 3).forEach((f, i) => c.fillText(`· ${f}`, bx + bw * 0.07, h * 0.66 + i * h * 0.04, bw * 0.86));
  c.fillStyle = "#8c979a";
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
  c.fillStyle = accentOf(r);
  c.fillRect(0, 0, size, size);
  c.fillStyle = "#0e1113";
  c.beginPath();
  c.arc(512 * k, 512 * k, 380 * k, Math.PI * 0.15, Math.PI * 0.85);
  c.fill();
  c.fillStyle = "#e9ecea";
  c.textAlign = "center";
  c.font = `700 ${64 * k}px MiSans`;
  c.fillText(r.title, 512 * k, 790 * k, 560 * k);
  c.font = `500 ${34 * k}px MiSans`;
  c.fillText(`LAPPAS WORKS · ${r.id}`, 512 * k, 850 * k);
  c.textAlign = "left";
}

export function discLabelCanvas(r: ArchiveRecord, size = 512) {
  const canvas = Object.assign(document.createElement("canvas"), { width: size, height: size });
  paintDiscLabel(canvas.getContext("2d")!, r, size);
  return canvas;
}

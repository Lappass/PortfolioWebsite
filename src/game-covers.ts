import "./game-covers.css";
import type { ArchiveRecord } from "./data";
import { escapeHtml as e } from "./html";
import { embedUrl, isFile, seconds, youtubeId } from "./video";

/**
 * Covers for games with a `menu` theme: the first screen of a game's page is drawn in the
 * game's own shape (order slips on a gear machine, camps up a mountain, a block of flats, a
 * lineup wall), and the shape's parts are the contents: each stands for one section of the
 * page below. Clicking one scrolls there; as the page scrolls, the cover marks the section on
 * screen. The page itself (src/project-page.ts) owns the scrolling and the text block.
 */
export interface CoverSection { id: string; heading: string }

const isWeb = (value: string) => /^https?:\/\//i.test(value);
const url = (value: string) => (isWeb(value) ? value : `${import.meta.env.BASE_URL}${value.replace(/^\//, "")}`);
const media = (value: string) => e(url(value));
const pad = (value: number) => String(value).padStart(2, "0");
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

abstract class GameCover {
  readonly el = document.createElement("div");
  /** The section on screen, as an index into `nav`; -1 while the cover itself is on screen. */
  protected sel = -1;
  private timers: number[] = [];
  private onResize = () => this.resize();

  constructor(protected r: ArchiveRecord, protected nav: CoverSection[], protected text: string, private onPick: (id: string) => void) {}

  /** Builds the cover; call once the subclass fields are set. */
  protected build(theme: string) {
    this.el.className = `tm tm-${theme}`;
    this.el.innerHTML = this.markup() + this.runMarkup();
    this.el.addEventListener("click", (event) => {
      const target = event.target as Element;
      const part = target.closest<HTMLElement>("[data-sec]");
      if (part) this.onPick(part.dataset.sec!);
      const run = target.closest<HTMLElement>("[data-run]");
      if (run) this.play(Number(run.dataset.run) || 0);
    });
    // The largest YouTube still when the video has one (a missing one comes back as a 120 px placeholder).
    const still = this.el.querySelector<HTMLImageElement>(".tm-run img[data-fallback]");
    still?.addEventListener("load", () => { if (still.naturalWidth <= 120) still.src = still.dataset.fallback!; }, { once: true });
    addEventListener("resize", this.onResize);
  }

  /** The full playthrough on the cover: a still with a play mark until it is clicked, then the player in its place. */
  private runMarkup() {
    const run = this.r.playthrough;
    if (!run) return "";
    const id = youtubeId(run.src);
    const poster = id ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` : this.r.cover ?? this.r.hero;
    const still = poster ? `<img src="${media(poster)}" alt=""${id ? ` data-fallback="https://i.ytimg.com/vi/${id}/hqdefault.jpg"` : ""} decoding="async">` : "";
    const chapters = run.chapters?.length ? `<ol>${run.chapters.map((c) => `<li><button type="button" data-run="${seconds(c.at)}"><span>${e(c.at)}</span>${e(c.label)}</button></li>`).join("")}</ol>` : "";
    return `<figure class="tm-run tm-in">
      <div class="tm-run-frame"><button type="button" class="tm-run-start" data-run="0" aria-label="Play the full playthrough of ${e(this.r.title)}">${still}<span class="tm-run-mark" aria-hidden="true"></span></button></div>
      <figcaption>Full playthrough</figcaption>${chapters}</figure>`;
  }

  private play(at: number) {
    const run = this.r.playthrough!, frame = this.el.querySelector<HTMLElement>(".tm-run-frame")!;
    const video = frame.querySelector("video");
    if (video) { video.currentTime = at; void video.play().catch(() => {}); return; }
    if (isFile(run.src)) {
      const player = Object.assign(document.createElement("video"), { src: url(run.src), controls: true, autoplay: true, playsInline: true });
      player.currentTime = at;
      frame.replaceChildren(player);
      return;
    }
    const player = Object.assign(document.createElement("iframe"), { src: embedUrl(run.src, { start: at, autoplay: true }), title: `${this.r.title}: full playthrough`, allowFullscreen: true });
    player.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
    player.referrerPolicy = "strict-origin-when-cross-origin";
    frame.replaceChildren(player);
    player.focus();
  }

  /** The art (inside `.tm-art`, with the key art on top for the handover), the title block and the parts. */
  protected abstract markup(): string;
  /** Mark the section on screen; `from` is the previous one. */
  protected abstract show(from: number, instant: boolean): void;
  protected layout() {}

  /** Once in the document. */
  mount() {
    this.resize();
    this.show(-1, true);
  }
  /** The page has come up (and can be measured). */
  begin(_instant: boolean) { this.resize(); }
  /** The page scrolled to section `k` of `nav` (-1: back on the cover). */
  current(k: number) {
    if (k === this.sel) return;
    const from = this.sel;
    this.sel = k;
    this.show(from, reduced());
  }

  protected heroArt() {
    const src = this.r.hero ?? this.r.cover;
    return src ? `<img class="tm-hero" src="${media(src)}" alt="" decoding="async">` : "";
  }
  protected asset(name: string) { return media(`works/${this.r.id.toLowerCase()}/menu/${name}`); }
  protected title(inner: string) { return `<h1 id="pp-title" tabindex="-1" class="tm-title">${inner}</h1>`; }
  protected later(ms: number, run: () => void) { this.timers.push(window.setTimeout(run, ms)); }

  private resize() {
    // The covers are drawn for a 1440×900 window and scale with it.
    const narrow = innerWidth < 760;
    const z = narrow ? Math.min(1, innerWidth / 660) : Math.min(1.4, Math.max(0.7, Math.min(innerWidth / 1440, innerHeight / 900)));
    this.el.style.setProperty("--tmz", z.toFixed(3));
    this.layout();
    // On a phone the playthrough sits right under the text, clear of the cover's parts lower down.
    const run = this.el.querySelector<HTMLElement>(".tm-run"), text = this.el.querySelector(".pg-intro")?.closest(".tm-in");
    if (!run) return;
    const below = text ? text.getBoundingClientRect().bottom - this.el.getBoundingClientRect().top : 0;
    run.style.top = narrow && below > 0 ? `${Math.round(below + 8)}px` : "";
    run.style.bottom = narrow && below > 0 ? "auto" : "";
  }

  destroy() {
    this.timers.forEach(clearTimeout);
    removeEventListener("resize", this.onResize);
    this.el.remove();
  }
}

/* ---------------------------------------------------------------------------------------- */
/* Last Mile: order slips on the dispatch board; the machine from the key art turns one tooth */
/* per section, and the rider on the slip gear runs while it does.                           */

// The cover's running rider with each limb on its own so it can swing (art/lastmile_poster.mjs, rider()).
const riderMarkup = (lines: boolean) => `<g class="lm-bob"><g fill="#272c30" stroke="#272c30" stroke-linecap="round" stroke-linejoin="round">
  ${lines ? `<g class="lm-lines">${[0, 1, 2].map((i) => `<path d="M${-260 + i * 26} ${-236 + i * 34} H-118" stroke-width="${9 - i * 2}"/>`).join("")}</g>` : ""}
  <path class="lm-arm-b" d="M-2 -194 L-32 -150 L-22 -122" fill="none" stroke-width="17"/>
  <path class="lm-leg-b" d="M-14 -112 L-40 -66 L-84 -52" fill="none" stroke-width="21"/>
  <g transform="rotate(14 -40 -164)"><rect x="-76" y="-202" width="70" height="74" rx="5" stroke="none"/><path d="M-70 -168 H-14" stroke="#ede6d6" stroke-width="5"/></g>
  <path d="M-14 -102 C-26 -130 -18 -176 4 -204 L30 -196 C26 -168 18 -132 12 -104 Z" stroke="none"/>
  <path d="M-6 -201 C10 -208 24 -194 20 -150 L4 -146" stroke="#ede6d6" stroke-width="5" fill="none"/>
  <rect x="6" y="-226" width="14" height="22" transform="rotate(14 12 -214)" stroke="none"/>
  <ellipse cx="16" cy="-236" rx="21" ry="24" stroke="none"/>
  <path class="lm-leg-f" d="M-8 -110 L34 -66 L18 -8" fill="none" stroke-width="21"/>
  <path class="lm-arm-f" d="M12 -192 L44 -160 L70 -176" fill="none" stroke-width="17"/></g>
  <path d="M-12 -240 C-12 -276 40 -278 42 -240 Z M-16 -244 h66 v9 h-66 Z" fill="#f1b05f"/></g>`;

// The machine in the key art (machine(860, -110, 0.82)): each gear's axle, teeth and the square its layer covers.
const GEARS = [
  { file: "gear-drive.jpg", x: 1630.8, y: 956, r: 204, teeth: 18, dir: 1 },
  { file: "gear-slips.jpg", x: 1212.6, y: 718.2, r: 380.6, teeth: 12, dir: -1 },
  { file: "gear-pins.jpg", x: 1639, y: 464, r: 258.6, teeth: 9, dir: 1 },
];

class LastMileCover extends GameCover {
  private turn = 0;
  private sprint = 0;

  constructor(r: ArchiveRecord, nav: CoverSection[], text: string, onPick: (id: string) => void) { super(r, nav, text, onPick); this.build("lastmile"); }

  protected markup() {
    const gear = GEARS.map((g) => `<img class="lm-gear" src="${this.asset(g.file)}" alt="" style="left:${(g.x - g.r) / 19.2}%;top:${(g.y - g.r) / 10.8}%;width:${g.r / 9.6}%;height:${g.r / 5.4}%">`).join("");
    return `<div class="tm-art"><div class="lm-frame">${gear}<svg viewBox="0 0 1920 1080" aria-hidden="true"><g class="lm-rider" transform="translate(1204.4 362) scale(.943)">${riderMarkup(true)}</g></svg></div>${this.heroArt()}</div>
      <div class="lm-board tm-in">
        ${this.title(`<img src="${this.asset("title.png")}" alt="${e(this.r.title)}">`)}
        ${this.text}
      </div>`;
  }

  protected layout() {
    // The art covers the first screen the way the key art does, so the handover lines up.
    const frame = this.el.querySelector<HTMLElement>(".lm-frame")!;
    const k = Math.max(innerWidth / 1920, innerHeight / 1080);
    Object.assign(frame.style, { width: `${1920 * k}px`, height: `${1080 * k}px`, left: `${(innerWidth - 1920 * k) / 2}px`, top: `${(innerHeight - 1080 * k) / 2}px` });
  }

  protected show(from: number, instant: boolean) {
    const at = Math.max(0, this.sel);
    // Every change is one more tooth forward, whichever way the page moved: the treadmill never reverses.
    const steps = Math.min(3, Math.abs(at - Math.max(0, from)));
    if (!steps) return;
    this.turn += steps;
    this.el.querySelectorAll<HTMLElement>(".lm-gear").forEach((el, i) => {
      const g = GEARS[i];
      el.style.transition = instant ? "none" : `transform ${0.6 * steps}s cubic-bezier(.45,0,.55,1)`;
      el.style.transform = `rotate(${this.turn * 30 * (12 / g.teeth) * g.dir}deg)`;
    });
    if (instant) return;
    // The rider runs while the gears turn: two strides per tooth.
    this.el.classList.add("sprint");
    clearTimeout(this.sprint);
    this.sprint = window.setTimeout(() => this.el.classList.remove("sprint"), 600 * steps);
  }

  destroy() { clearTimeout(this.sprint); super.destroy(); }
}

/* ---------------------------------------------------------------------------------------- */
/* Trail Adventure: camps up the mountain from the key art, the trailhead at the bottom and  */
/* the summit at the top, one camp per section. The hiker walks to the section on screen.    */

// The trail's shape, in key-art coordinates, from the trailhead to the summit.
const TRAIL = [{ x: 420, y: 962 }, { x: 900, y: 872 }, { x: 620, y: 778 }, { x: 1010, y: 694 }, { x: 1225, y: 566 }, { x: 1300, y: 424 }];

class TrailCover extends GameCover {
  private camps: { x: number; y: number }[] = [];
  private at: number[] = [];
  private walkFrom = 0;
  private walking = 0;
  private trail!: SVGPathElement;
  private total = 0;

  constructor(r: ArchiveRecord, nav: CoverSection[], text: string, onPick: (id: string) => void) { super(r, nav, text, onPick); this.build("trail"); }

  protected markup() {
    const c = TRAIL;
    const d = "M" + c.map((p, i) => (i ? `Q${(c[i - 1].x + p.x) / 2 + (i % 2 ? 70 : -70)} ${(c[i - 1].y + p.y) / 2 + 34} ${p.x} ${p.y}` : `${p.x} ${p.y}`)).join(" ");
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const stars = Array.from({ length: 90 }, () => `<circle cx="${(rnd() * 1920).toFixed(0)}" cy="${(rnd() * rnd() * 560).toFixed(0)}" r="${(0.8 + rnd() * 1.6).toFixed(1)}" opacity="${(0.4 + rnd() * 0.6).toFixed(2)}"/>`).join("");
    // Camps are placed along the path once it exists (mount); the last section is the summit.
    const camps = this.nav.slice(0, -1).map((s, i) => `<g class="tr-camp" data-sec="${e(s.id)}" data-i="${i}">
      <circle class="tr-glow" r="70" fill="url(#tr-fire)"/>
      <g class="tr-tent"><path d="M-46 0 L-22 -40 L2 0 Z" fill="#fbf4e2"/><path d="M-22 -40 L-14 0 L-28 0 Z" fill="#25322e" opacity=".75"/><path d="M-22 -40 L2 0 L8 0 L-16 -40 Z" fill="#d8ccb2"/></g>
      <g transform="translate(20 0)"><path d="M-12 2 h24" stroke="#43362a" stroke-width="5" stroke-linecap="round"/><path class="tr-flame" d="M-9 0 C-9 -12 0 -16 0 -26 C6 -16 9 -12 9 0 Z" fill="#e08e3c"/></g>
      <rect x="-60" y="-60" width="110" height="80" fill="transparent"/></g>`).join("");
    const last = this.nav.at(-1);
    const summit = c.at(-1)!;
    return `<div class="tm-art"><svg class="tr-map" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs><linearGradient id="tr-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2a3a"/><stop offset=".55" stop-color="#3b4a5a" stop-opacity=".75"/><stop offset="1" stop-color="#e8b48a" stop-opacity="0"/></linearGradient>
          <radialGradient id="tr-fire"><stop offset="0" stop-color="#f2cf6e" stop-opacity=".7"/><stop offset="1" stop-color="#e08e3c" stop-opacity="0"/></radialGradient></defs>
        <g class="tr-cam">
          <image href="${this.asset("bg.jpg")}" width="1920" height="1080"/>
          <rect class="tr-dusk" width="1920" height="700" fill="url(#tr-night)" opacity="0"/>
          <g class="tr-stars" opacity="0" fill="#fbf4e2">${stars}</g>
          <path d="${d}" fill="none" stroke="#fbf4e2" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 15" opacity=".45"/>
          <path class="tr-done" d="${d}" fill="none" stroke="#fbf4e2" stroke-width="4" stroke-linecap="round" opacity=".9"/>
          <g class="tr-camps">${camps}</g>
          ${last ? `<g data-sec="${e(last.id)}" data-i="${this.nav.length - 1}" class="tr-summit" transform="translate(${summit.x - 38} ${summit.y})"><rect x="-3" y="-120" width="5" height="120" fill="#43362a"/><path d="M-1 -118 L-58 -102 L-1 -86 Z" fill="#e08e3c"/><rect x="-70" y="-130" width="90" height="140" fill="transparent"/></g>` : ""}
          <g class="tr-hiker"><g transform="scale(.42) translate(0 -118)" fill="#fff">
            <path d="M13 -127A13 15 0 1 1 -13 -127A13 15 0 1 1 13 -127Z"/><path d="M-14 -131C-15 -151 15 -151 14 -131ZM-15.5 -134h31v6h-31ZM-5 -115h10v10h-10Z"/>
            <path d="M-8 -108C-19 -107 -25 -103 -26 -94L-25 -54C-26 -32 -27 -14 -26 2L26 2C27 -14 26 -32 25 -54L26 -94C25 -103 19 -107 8 -108Z"/>
            <path d="M-24 -100C-32 -96 -35 -82 -36 -62C-37 -44 -35 -26 -32 -6L-23 -6C-25 -26 -27 -44 -26 -60Z"/><path d="M24 -100C32 -96 35 -82 36 -62C37 -44 35 -26 32 -6L23 -6C25 -26 27 -44 26 -60Z"/>
            <path d="M-21 -2L-3 -2L-4 20C-5 60 -6 90 -6 110L-1 120L-21 120L-18 110C-18 90 -19 60 -20 20Z"/><path d="M21 -2L3 -2L4 20C5 60 6 90 6 110L1 120L21 120L18 110C18 90 19 60 20 20Z"/>
            <path d="M-17 -104 L-6 -76 M17 -104 L6 -76" stroke="#25322e" stroke-width="2.5" fill="none" opacity=".55"/>
            <rect x="-13" y="-80" width="26" height="17" rx="3" fill="#25322e"/>
            <circle cy="-71.5" r="5.5"/><circle cy="-71.5" r="3" fill="#25322e"/></g></g>
        </g></svg>${this.heroArt()}</div>
      <div class="tr-head tm-in">${this.title(`<span class="tr-title" style="--src:url('${this.asset("title.png")}')">${e(this.r.title)}</span>`)}${this.text}</div>`;
  }

  mount() {
    this.trail = this.el.querySelector<SVGPathElement>(".tr-done")!;
    this.total = this.trail.getTotalLength();
    // One camp per section, evenly along the trail; the last one is the summit.
    const n = this.nav.length;
    this.at = this.nav.map((_, i) => (this.total * (i + 1)) / Math.max(1, n));
    this.camps = this.at.map((l) => { const p = this.trail.getPointAtLength(l); return { x: p.x, y: p.y }; });
    this.el.querySelectorAll<SVGGElement>(".tr-camp").forEach((g) => {
      const c = this.camps[Number(g.dataset.i)];
      g.setAttribute("transform", `translate(${c.x} ${c.y})`);
    });
    this.trail.style.strokeDasharray = `${this.total} ${this.total}`;
    this.walkFrom = 0;
    this.place(0);
    this.el.querySelector<SVGGElement>(".tr-cam")!.style.transition = "none";
    super.mount();
  }

  private place(len: number) {
    const p = this.trail.getPointAtLength(len);
    this.el.querySelector(".tr-hiker")!.setAttribute("transform", `translate(${p.x} ${p.y})`);
    this.trail.style.strokeDashoffset = String(this.total - len);
  }

  private walk(to: number) {
    cancelAnimationFrame(this.walking);
    const from = this.walkFrom, t0 = performance.now(), ms = 900 + Math.abs(to - from) * 0.6;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms), eased = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      this.walkFrom = from + (to - from) * eased;
      this.place(this.walkFrom);
      if (k < 1) this.walking = requestAnimationFrame(step);
    };
    this.walking = requestAnimationFrame(step);
  }

  /** Frame the camp right of centre, closer the higher it is; the cover itself shows the whole mountain. */
  private frame(instant: boolean) {
    const cam = this.el.querySelector<SVGGElement>(".tr-cam")!;
    cam.style.transition = instant ? "none" : "";
    if (this.sel < 0) { cam.style.transform = ""; return; }
    const c = this.camps[this.sel], high = this.sel / Math.max(1, this.camps.length - 1), S = 1.55 - 0.35 * high;
    // The part of the 1920×1080 art the window shows (the map is cropped to cover it).
    const a = innerWidth / innerHeight, vw = Math.min(1920, 1080 * a), vh = Math.min(1080, 1920 / a);
    const x0 = (1920 - vw) / 2, y0 = (1080 - vh) / 2;
    const tx = Math.min(x0, Math.max(x0 + vw - 1920 * S, x0 + vw * (a < 1 ? 0.5 : 0.6) - c.x * S));
    const ty = Math.min(y0, Math.max(y0 + vh - 1080 * S, y0 + vh * 0.58 - c.y * S));
    cam.style.transform = `translate(${tx}px, ${ty}px) scale(${S})`;
  }

  protected layout() { if (this.trail) this.frame(true); }

  protected show(from: number, instant: boolean) {
    const high = this.sel < 0 ? 0 : this.sel / Math.max(1, this.camps.length - 1);
    this.frame(instant);
    this.el.querySelector(".tr-dusk")!.setAttribute("opacity", (high * 0.85).toFixed(2));
    this.el.querySelector(".tr-stars")!.setAttribute("opacity", Math.max(0, high * 1.4 - 0.5).toFixed(2));
    this.el.classList.toggle("high", this.sel >= 3);
    this.el.querySelectorAll<SVGGElement>(".tr-camp, .tr-summit").forEach((g) => { const i = Number(g.dataset.i); g.classList.toggle("on", i === this.sel); g.classList.toggle("ahead", i > this.sel); });
    const to = this.sel < 0 ? 0 : this.at[this.sel];
    if (instant || from === this.sel) { this.walkFrom = to; this.place(to); } else this.walk(to);
  }

  destroy() { cancelAnimationFrame(this.walking); super.destroy(); }
}

/* ---------------------------------------------------------------------------------------- */
/* LOCKDOWN: a block of flats rising from the bottom edge; its windows are a grid and each   */
/* section is a piece of it, in the colour of an ingredient.                                 */

const PIECES: { c: string; cells: [number, number][] }[] = [
  { c: "#f2c879", cells: [[0, 7], [1, 7], [2, 7], [3, 7], [0, 6]] },
  { c: "#d48c80", cells: [[4, 7], [5, 7], [6, 7], [5, 6]] },
  { c: "#9cc77a", cells: [[1, 5], [2, 5], [2, 6], [3, 6]] },
  { c: "#c9a54e", cells: [[6, 2], [6, 3], [6, 4], [6, 5]] },
  { c: "#ece5cf", cells: [[3, 4], [4, 4], [3, 5], [4, 5]] },
  { c: "#f5e39a", cells: [[0, 2], [1, 2], [1, 3], [1, 4]] },
  { c: "#d9a58a", cells: [[2, 3], [3, 3], [4, 3], [3, 2]] },
  { c: "#9fb8c9", cells: [[5, 2], [5, 3], [5, 4], [5, 5]] },
  // The top floors, for pages with more than eight sections.
  { c: "#b9d48f", cells: [[0, 1], [1, 1], [2, 1], [2, 2]] },
  { c: "#e8b860", cells: [[3, 0], [3, 1], [4, 1], [4, 2]] },
  { c: "#c98f6a", cells: [[4, 0], [5, 0], [5, 1], [6, 1]] },
];
// A five-by-seven cell font for the title.
const GLYPHS: Record<string, string[]> = {
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"], O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"], K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"], W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
};

class LockdownCover extends GameCover {
  constructor(r: ArchiveRecord, nav: CoverSection[], text: string, onPick: (id: string) => void) { super(r, nav, text, onPick); this.build("lockdown"); }

  protected markup() {
    const owner = new Map<string, number>();
    this.nav.forEach((_, i) => PIECES[i % PIECES.length].cells.forEach(([c, r]) => owner.set(`${c},${r}`, i)));
    let grid = "";
    for (let r = 0; r < 8; r++) for (let c = 0; c < 7; c++) {
      const i = owner.get(`${c},${r}`);
      grid += i === undefined ? "<i></i>" : `<i class="ld-piece" data-sec="${e(this.nav[i].id)}" data-i="${i}" style="--c:${PIECES[i % PIECES.length].c}"></i>`;
    }
    return `<div class="tm-art">${this.r.hero ? `<img class="ld-bg" src="${media(this.r.hero)}" alt="">` : ""}${this.heroArt()}</div>
      <div class="ld-head tm-in">${this.title(`<canvas width="620" height="90" aria-hidden="true"></canvas><span class="tm-sr">${e(this.r.title)}</span>`)}${this.text}</div>
      <div class="ld-block tm-in"><div class="ld-roof"><div class="ld-tank"></div><div class="ld-vent"></div>
        <svg class="ld-steam" viewBox="0 0 60 100" aria-hidden="true"><path d="M18 98 C4 80 30 66 16 48 S30 18 20 2" fill="none" stroke="rgba(236,229,207,.75)" stroke-width="4" stroke-linecap="round"/></svg></div>
        <div class="ld-face"><div class="ld-grid">${grid}</div></div><div class="ld-door"><i></i></div></div>`;
  }

  mount() {
    const t = this.el.querySelector("canvas")!.getContext("2d")!, s = 12;
    let x = 0;
    for (const ch of "LOCKDOWN") {
      GLYPHS[ch].forEach((row, r) => [...row].forEach((bit, k) => {
        if (bit !== "1") return;
        // One lit window in the second O.
        t.fillStyle = ch === "O" && r === 3 && k === 0 && x ? "#d48c80" : "#f2ece4";
        t.fillRect(x + k * s, r * s, s - 1, s - 1);
      }));
      x += s * 6;
    }
    const grid = this.el.querySelector<HTMLElement>(".ld-grid")!;
    grid.addEventListener("mouseover", (event) => {
      const piece = (event.target as Element).closest<HTMLElement>(".ld-piece");
      grid.querySelectorAll<HTMLElement>(".ld-piece").forEach((el) => el.classList.toggle("hover", Boolean(piece) && el.dataset.i === piece!.dataset.i));
    });
    grid.addEventListener("mouseleave", () => grid.querySelectorAll(".ld-piece").forEach((el) => el.classList.remove("hover")));
    super.mount();
  }

  protected show() {
    this.el.querySelectorAll<HTMLElement>("[data-i]").forEach((el) => el.classList.toggle("on", Number(el.dataset.i) === this.sel));
  }
}

/* ---------------------------------------------------------------------------------------- */
/* Sniff & Snitch: the lineup wall from the key art.                                          */

class SniffCover extends GameCover {
  constructor(r: ArchiveRecord, nav: CoverSection[], text: string, onPick: (id: string) => void) { super(r, nav, text, onPick); this.build("sniff"); }

  protected markup() {
    return `<div class="tm-art"><div class="sn-frame"><img src="${this.asset("lineup.jpg")}" alt=""></div>${this.heroArt()}</div>
      <div class="sn-board tm-in">
        ${this.title(`<img src="${this.asset("title.png")}" alt="${e(this.r.title)}">`)}
        ${this.text}
      </div>`;
  }

  protected layout() {
    // The wall covers the first screen the way the key art does, so the handover lines up.
    const frame = this.el.querySelector<HTMLElement>(".sn-frame")!;
    const k = Math.max(innerWidth / 1920, innerHeight / 1080);
    Object.assign(frame.style, { width: `${1920 * k}px`, height: `${1080 * k}px`, left: `${(innerWidth - 1920 * k) / 2}px`, top: `${(innerHeight - 1080 * k) / 2}px` });
  }

  protected show() {}
}

const THEMES = { lastmile: LastMileCover, trail: TrailCover, lockdown: LockdownCover, sniff: SniffCover };
export type GameCoverView = GameCover;

export function createGameCover(r: ArchiveRecord, nav: CoverSection[], text: string, onPick: (id: string) => void): GameCover | null {
  const Theme = r.menu ? THEMES[r.menu] : undefined;
  return Theme ? new Theme(r, nav, text, onPick) : null;
}

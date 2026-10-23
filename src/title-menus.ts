import "./title-menus.css";
import type { ArchiveRecord } from "./data";
import type { Sound } from "./audio";
import { escapeHtml as e } from "./html";

/**
 * Project pages for games with a `menu` theme: the page is the game's own title menu.
 * Each theme draws its options in its own way (order slips on a gear machine, camps up a
 * mountain, pieces of a block of flats), and they all share one set of items, panels and
 * input: ↑↓ or the stick to choose, Enter or A to go in, Esc or B to close a panel.
 */
type Key = "play" | "trailer" | "playthrough" | "download" | "about" | "shots";
interface MenuItem { key: Key; name: string; meta: string; text: string; go: string; soon: boolean }
export interface MenuNav { previous: ArchiveRecord; next: ArchiveRecord; position: number; total: number }

const isWeb = (value: string) => /^https?:\/\//i.test(value);
const media = (value: string) => e(isWeb(value) ? value : `${import.meta.env.BASE_URL}${value.replace(/^\//, "")}`);
const isFile = (value: string) => /\.(mp4|webm|ogv|mov)(\?|#|$)/i.test(value);
const pad = (value: number) => String(value).padStart(2, "0");
const seconds = (at: string) => at.split(":").reduce((total, part) => total * 60 + Number(part), 0);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Everything the work has to offer, plus what is announced in `soon`. */
function menuItems(r: ArchiveRecord): MenuItem[] {
  const soon = new Set(r.soon ?? []), items: MenuItem[] = [];
  const add = (key: Key, has: boolean, name: string, meta: string, text: [string, string], go: string) => {
    if (has || soon.has(key)) items.push({ key, name, soon: !has, meta: has ? meta : "COMING SOON", text: has ? text[0] : text[1], go: has ? go : "COMING SOON" });
  };
  const words = [r.abstract, ...r.findings].join(" ").split(/\s+/).length;
  const shots = r.gallery?.length ?? 0, chapters = r.playthrough?.chapters?.length ?? 0;
  add("play", Boolean(r.unity), "Play in browser", "WEBGL", ["Runs right here, with keyboard and mouse.", "A browser build is on its way."], "▶ PLAY");
  add("trailer", Boolean(r.trailer ?? r.video), "Watch trailer", "VIDEO", ["A short cut of the game.", "The trailer is still being cut."], "▶ WATCH");
  add("playthrough", Boolean(r.playthrough), "Full playthrough", chapters ? `${chapters} CHAPTERS` : "VIDEO", ["One run through the game, start to finish.", "A full playthrough is being recorded."], "▶ WATCH");
  add("download", Boolean(r.download), "Download", r.download?.size ?? "", [r.download?.label ?? "The full game, to play offline.", "A build to download is on its way."], "DOWNLOAD ↗");
  add("about", true, "About the game", `${Math.max(1, Math.round(words / 200))} MIN READ`, [r.abstract.split(/(?<=\.)\s/)[0], ""], "READ");
  add("shots", shots > 0, "Screenshots", `${shots} SHOTS`, [`${shots} shots from the game, with notes.`, ""], "OPEN");
  return items;
}

abstract class TitleMenu {
  readonly el = document.createElement("div");
  protected items: MenuItem[];
  protected sel = 0;
  private panel: HTMLElement;
  private toast: HTMLElement;
  private toastTimer = 0;
  private shot = 0;
  private timers: number[] = [];
  private onResize = () => this.resize();
  /** Selection order, first to last, by item key. */
  protected abstract order: Key[];
  /** Which way ↑ moves the selection, and whether it wraps at the ends. */
  protected up: 1 | -1 = -1;
  protected wrap = true;
  /** What the bottom bar calls each control. */
  protected abstract hints: [string, string][];

  constructor(protected r: ArchiveRecord, protected nav: MenuNav, protected sound: (name: Sound) => void) {
    this.items = [];
    this.panel = document.createElement("div");
    this.toast = document.createElement("div");
  }

  /** Builds the menu; call once the subclass fields are set. */
  protected build(theme: string) {
    const all = menuItems(this.r);
    this.items = this.order.map((key) => all.find((item) => item.key === key)).filter((item): item is MenuItem => Boolean(item));
    // Start on the first thing that can actually be opened.
    const first = (["play", "trailer", "playthrough", "download", "about"] as Key[]).find((key) => this.items.some((item) => item.key === key && !item.soon));
    this.sel = Math.max(0, this.items.findIndex((item) => item.key === first));
    this.el.className = `tm tm-${theme}`;
    this.el.innerHTML = `${this.markup()}
      <nav class="tm-nav" aria-label="Switch work"><button type="button" data-page="back">← SHELF</button><span></span><button type="button" data-page="prev" aria-label="Previous work: ${e(this.nav.previous.title)}">←</button><span class="tm-count">${pad(this.nav.position)} / ${pad(this.nav.total)}</span><button type="button" data-page="next" aria-label="Next work: ${e(this.nav.next.title)}">→</button></nav>
      <div class="tm-help tm-in" aria-hidden="true">${this.hints.map(([key, label]) => `<span><b>${key}</b>${label}</span>`).join("")}<span class="tm-end">${e(`${this.r.id} · ${this.r.lead} · ${this.r.date}`.toUpperCase())}</span></div>`;
    this.panel.className = "tm-panel";
    this.panel.hidden = true;
    this.toast.className = "tm-toast";
    this.toast.setAttribute("role", "status");
    this.el.append(this.panel, this.toast);
    this.el.addEventListener("click", (event) => this.click(event));
    addEventListener("resize", this.onResize);
  }

  /** The art (inside `.tm-art`, with the key art on top for the handover) and the options. */
  protected abstract markup(): string;
  /** Show the selection; `from` is the previous one. */
  protected abstract show(from: number, instant: boolean): void;
  /** A small acknowledgement on the chosen option when it is opened. */
  protected pulse() {}
  protected layout() {}

  /** Once in the document. */
  mount() {
    this.resize();
    this.show(this.sel, true);
  }
  /** The page has come up: start the opening move. */
  begin(instant: boolean) { this.show(this.sel, instant); }

  protected heroArt() {
    const src = this.r.hero ?? this.r.cover;
    return src ? `<img class="tm-hero" src="${media(src)}" alt="" decoding="async">` : "";
  }
  protected asset(name: string) { return media(`works/${this.r.id.toLowerCase()}/menu/${name}`); }
  protected title(inner: string) { return `<h1 id="pp-title" tabindex="-1" class="tm-title">${inner}</h1>`; }
  protected later(ms: number, run: () => void) { this.timers.push(window.setTimeout(run, ms)); }

  private resize() {
    // The menus are drawn for a 1440×900 window and scale with it.
    const narrow = innerWidth < 760;
    const z = narrow ? Math.min(1, innerWidth / 660) : Math.min(1.4, Math.max(0.7, Math.min(innerWidth / 1440, innerHeight / 900)));
    this.el.style.setProperty("--tmz", z.toFixed(3));
    this.layout();
  }

  go(to: number, focus = false) {
    const n = this.items.length;
    if (to === this.sel) { this.activate(); return; }
    to = this.wrap ? ((to % n) + n) % n : Math.max(0, Math.min(n - 1, to));
    if (to === this.sel) return;
    const from = this.sel;
    this.sel = to;
    this.sound("tick");
    this.show(from, reduced());
    if (focus) this.el.querySelector<HTMLElement>(`button[data-item="${to}"]`)?.focus({ preventScroll: true });
  }

  private activate() {
    const item = this.items[this.sel];
    this.pulse();
    if (item.soon) {
      this.say(`${item.name.toUpperCase()} · COMING SOON`);
      this.sound("ui-tick");
      return;
    }
    this.sound("confirm");
    if (item.key === "download") { window.open(this.r.download!.url, "_blank", "noopener,noreferrer"); return; }
    this.openPanel(item);
  }

  private say(text: string) {
    this.toast.textContent = text;
    this.toast.classList.add("on");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove("on"), 1400);
  }

  private openPanel(item: MenuItem) {
    const r = this.r;
    let body = "";
    if (item.key === "about") {
      const links = [...(r.links ?? []), ...(r.links?.some((link) => link.url === r.source) ? [] : [{ label: "Project link", url: r.source }])];
      body = `<div class="tm-about"><div><div class="tm-en">${e(r.en)}</div><p>${e(r.abstract)}</p>
        ${r.tags?.length ? `<ul class="tm-tags">${r.tags.map((tag) => `<li>${e(tag)}</li>`).join("")}</ul>` : ""}
        <div class="tm-links">${links.map((link) => `<a href="${e(link.url)}" target="_blank" rel="noopener noreferrer">${e(link.label)} ↗</a>`).join("")}</div></div>
        <div><dl class="tm-meta"><div><dt>Role</dt><dd>${e(r.department)}</dd></div><div><dt>Timeline</dt><dd>${e(r.date)}</dd></div><div><dt>Stack</dt><dd>${e(r.lead)}</dd></div><div><dt>Status</dt><dd>${e(r.clearance)}</dd></div></dl>
        <ol class="tm-notes">${r.findings.map((note, i) => `<li><span>${pad(i + 1)}</span>${e(note)}</li>`).join("")}</ol></div></div>`;
    } else if (item.key === "shots") {
      body = `<div class="tm-shots"><figure></figure><div class="tm-thumbs">${r.gallery!.map((shot, i) => `<button type="button" data-tm="shot" data-i="${i}" aria-label="Shot ${i + 1}"><img src="${media(shot.src)}" alt="" loading="lazy"></button>`).join("")}</div></div>`;
    } else if (item.key === "trailer" || item.key === "playthrough") {
      const src = item.key === "trailer" ? (r.trailer ?? r.video)! : r.playthrough!.src;
      const chapters = item.key === "playthrough" ? r.playthrough!.chapters ?? [] : [];
      body = `<div class="tm-watch"><div class="pp-frame">${this.videoMarkup(src)}</div>${chapters.length ? `<ol class="tm-chapters">${chapters.map((c) => `<li><button type="button" data-tm="seek" data-at="${seconds(c.at)}"><span>${e(c.at)}</span>${e(c.label)}</button></li>`).join("")}</ol>` : ""}</div>`;
    } else if (item.key === "play") {
      const poster = r.hero ?? r.cover;
      body = `<div class="pp-frame"><div class="pp-unity" data-src="${media(r.unity!)}">${poster ? `<img src="${media(poster)}" alt="">` : ""}<button type="button" class="pp-play" data-page="unity">▶ <span>Load the game</span><small>Unity WebGL · large download</small></button></div></div>`;
    }
    this.panel.innerHTML = `<div class="tm-sheet tm-sheet-${item.key}" role="dialog" aria-modal="true" aria-label="${e(item.name)}">
      <header><span class="tm-sheet-k">${e(this.r.title)}</span><h2>${e(item.name)}</h2><button type="button" data-tm="close"><b>B</b> CLOSE</button></header>
      <div class="tm-sheet-body">${body}</div></div>`;
    this.panel.hidden = false;
    this.el.classList.add("paneled");
    if (item.key === "shots") this.showShot(0);
    this.panel.querySelector<HTMLElement>("[data-tm=close]")?.focus({ preventScroll: true });
  }

  private videoMarkup(src: string) {
    if (isFile(src)) return `<video controls autoplay playsinline preload="metadata" src="${media(src)}"></video>`;
    return `<iframe src="${e(src)}" title="${e(this.r.title)} video" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen></iframe>`;
  }

  private showShot(i: number) {
    const shots = this.r.gallery!;
    this.shot = (i + shots.length) % shots.length;
    const shot = shots[this.shot];
    this.panel.querySelector("figure")!.innerHTML = `<div class="pp-frame"><img src="${media(shot.src)}" alt="${e(shot.caption ?? this.r.title)}"></div>
      <figcaption><b>${pad(this.shot + 1)} / ${pad(shots.length)}</b><span>${e(shot.caption ?? "")}</span>${shot.note ? `<p>${e(shot.note)}</p>` : ""}</figcaption>`;
    this.panel.querySelectorAll("[data-tm=shot]").forEach((el, k) => el.classList.toggle("on", k === this.shot));
  }

  get panelOpen() { return !this.panel.hidden; }
  closePanel() {
    if (this.panel.hidden) return false;
    // Stops any video or game in it.
    this.panel.innerHTML = "";
    this.panel.hidden = true;
    this.el.classList.remove("paneled");
    this.sound("back");
    this.el.querySelector<HTMLElement>(`button[data-item="${this.sel}"]`)?.focus({ preventScroll: true });
    return true;
  }

  /** Keys while the page is open; true when the menu used it. */
  handleKey(event: KeyboardEvent) {
    if (this.panelOpen) {
      if (event.key === "Escape") return this.closePanel();
      if (this.panel.querySelector(".tm-shots") && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        this.showShot(this.shot + (event.key === "ArrowRight" ? 1 : -1));
        return true;
      }
      return false;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      this.go(this.sel + (event.key === "ArrowUp" ? this.up : -this.up), true);
      return true;
    }
    if (event.key === "Enter") {
      // Other buttons (back, previous, next) keep their own Enter.
      const target = event.target as Element | null;
      if (target?.closest?.("a, button:not([data-item]), video, iframe")) return false;
      this.activate();
      return true;
    }
    return false;
  }

  private click(event: MouseEvent) {
    const target = event.target as Element;
    const item = target.closest<HTMLElement>("[data-item]");
    if (item) { this.go(Number(item.dataset.item)); return; }
    const control = target.closest<HTMLElement>("[data-tm]");
    if (control?.dataset.tm === "close") this.closePanel();
    if (control?.dataset.tm === "shot") this.showShot(Number(control.dataset.i));
    if (control?.dataset.tm === "seek") {
      const video = this.panel.querySelector("video");
      if (video) { video.currentTime = Number(control.dataset.at); void video.play().catch(() => {}); }
    }
    // A click on the dimmed menu around the sheet closes it.
    if (target === this.panel) this.closePanel();
  }

  destroy() {
    this.timers.forEach(clearTimeout);
    clearTimeout(this.toastTimer);
    removeEventListener("resize", this.onResize);
    this.el.remove();
  }
}

/* ---------------------------------------------------------------------------------------- */
/* Last Mile: a dispatch board of order slips; the machine from the key art turns one tooth  */
/* per change, and the rider on the slip gear runs while it does.                            */

// The cover's running rider with each limb on its own so it can swing (art/lastmile_poster.mjs, rider()).
const riderMarkup = (lines: boolean) => `<g class="lm-bob"><g fill="#272c30" stroke="#272c30" stroke-linecap="round" stroke-linejoin="round" filter="url(#lm-rough)">
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
  <path d="M-12 -240 C-12 -276 40 -278 42 -240 Z M-16 -244 h66 v9 h-66 Z" fill="#f1b05f" filter="url(#lm-rough)"/></g>`;

// The machine in the key art (machine(860, -110, 0.82)): each gear's axle, teeth and the square its layer covers.
const GEARS = [
  { file: "gear-drive.jpg", x: 1630.8, y: 956, r: 204, teeth: 18, dir: 1 },
  { file: "gear-slips.jpg", x: 1212.6, y: 718.2, r: 380.6, teeth: 12, dir: -1 },
  { file: "gear-pins.jpg", x: 1639, y: 464, r: 258.6, teeth: 9, dir: 1 },
];
const SLIP = 68;

class LastMileMenu extends TitleMenu {
  protected order: Key[] = ["play", "trailer", "playthrough", "download", "about", "shots"];
  protected hints: [string, string][] = [["↑↓", "PICK AN ORDER"], ["A", "DELIVER"], ["B", "BACK TO SHELF"]];
  private turn = 0;
  private sprint = 0;

  constructor(r: ArchiveRecord, nav: MenuNav, sound: (name: Sound) => void) { super(r, nav, sound); this.build("lastmile"); }

  protected markup() {
    const gear = GEARS.map((g) => `<img class="lm-gear" src="${this.asset(g.file)}" alt="" style="left:${(g.x - g.r) / 19.2}%;top:${(g.y - g.r) / 10.8}%;width:${g.r / 9.6}%;height:${g.r / 5.4}%">`).join("");
    return `<svg width="0" height="0" class="tm-defs" aria-hidden="true"><filter id="lm-rough"><feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="2" seed="3" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter></svg>
      <div class="tm-art"><div class="lm-frame">${gear}<svg viewBox="0 0 1920 1080" aria-hidden="true"><g class="lm-rider" transform="translate(1204.4 362) scale(.943)">${riderMarkup(true)}</g></svg></div>${this.heroArt()}</div>
      <div class="lm-board tm-in">
        <div class="lm-head"><span>${e(this.r.id)} · DISPATCH</span><span>DAY 01 · 06:00 · <b>MENU</b></span></div>
        ${this.title(`<img src="${this.asset("title.png")}" alt="${e(this.r.title)}">`)}
        <div class="lm-row"><span class="lm-tag">A TEN-DAY TRIAL</span><span>${this.items.length} ORDERS WAITING</span></div>
        <div class="lm-slips"><div class="lm-track"></div>
          ${this.items.map((_, i) => `<div class="lm-stop" style="top:${17 + i * SLIP}px"></div>`).join("")}
          ${this.items.map((item, i) => `<button type="button" class="lm-slip${item.soon ? " soon" : ""}" data-item="${i}"><span class="lm-n">${pad(i + 1)}</span>${e(item.name.toUpperCase())}${item.meta ? `<span class="lm-pin">${e(item.meta)}</span>` : ""}<span class="lm-stamp">PICKED UP</span></button>`).join("")}
          <svg class="lm-runner" width="78" height="104" viewBox="-110 -290 200 300" aria-hidden="true"><g class="lm-rider">${riderMarkup(false)}</g></svg>
        </div>
      </div>
      <div class="lm-grain"></div>`;
  }

  protected layout() {
    // The art covers the window the way the key art does, so the handover lines up.
    const frame = this.el.querySelector<HTMLElement>(".lm-frame")!;
    const k = Math.max(innerWidth / 1920, innerHeight / 1080);
    Object.assign(frame.style, { width: `${1920 * k}px`, height: `${1080 * k}px`, left: `${(innerWidth - 1920 * k) / 2}px`, top: `${(innerHeight - 1080 * k) / 2}px` });
  }

  protected show(from: number, instant: boolean) {
    this.el.querySelectorAll(".lm-slip").forEach((el, i) => el.classList.toggle("on", i === this.sel));
    this.el.querySelectorAll(".lm-stop").forEach((el, i) => el.classList.toggle("on", i === this.sel));
    this.el.querySelector<SVGElement>(".lm-runner")!.style.top = `${17 + this.sel * SLIP - 94}px`;
    // Every change is one more tooth forward, whichever way the selection moved: the treadmill never reverses.
    const steps = Math.min(3, Math.abs(this.sel - from));
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

  protected pulse() {
    const slip = this.el.querySelector(`.lm-slip[data-item="${this.sel}"]`)!;
    slip.classList.remove("go");
    void (slip as HTMLElement).offsetWidth;
    slip.classList.add("go");
  }

  destroy() { clearTimeout(this.sprint); super.destroy(); }
}

/* ---------------------------------------------------------------------------------------- */
/* Trail Adventure: camps up the mountain from the key art, the trailhead at the bottom and  */
/* the summit at the top. The camera cranes to the chosen camp and dusk falls as you climb.  */

// Camp sites in key-art coordinates; the last item always goes on the summit.
const CAMPS = [{ x: 420, y: 962 }, { x: 900, y: 872 }, { x: 620, y: 778 }, { x: 1010, y: 694 }, { x: 1225, y: 566 }];
const SUMMIT = { x: 1300, y: 424 };
const ALTITUDES = [0, 180, 360, 560, 820];

class TrailMenu extends TitleMenu {
  protected order: Key[] = ["about", "shots", "playthrough", "trailer", "download", "play"];
  protected hints: [string, string][] = [["↑", "CLIMB"], ["↓", "DESCEND"], ["A", "MAKE CAMP"], ["B", "BACK TO SHELF"]];
  protected up: 1 | -1 = 1;
  protected wrap = false;
  private camps: { x: number; y: number; alt: number; k: string }[] = [];
  private at: number[] = [];
  private walkFrom = 0;
  private walking = 0;
  private trail!: SVGPathElement;
  private total = 0;
  private begun = false;

  constructor(r: ArchiveRecord, nav: MenuNav, sound: (name: Sound) => void) {
    super(r, nav, sound);
    this.build("trail");
  }

  protected markup() {
    const n = this.items.length;
    this.camps = this.items.map((_, i) => (i === n - 1
      ? { ...SUMMIT, alt: 1120, k: "SUMMIT" }
      : { ...CAMPS[i], alt: ALTITUDES[i], k: i ? `CAMP ${i}` : "TRAILHEAD" }));
    const c = this.camps;
    const d = "M" + c.map((p, i) => (i ? `Q${(c[i - 1].x + p.x) / 2 + (i % 2 ? 70 : -70)} ${(c[i - 1].y + p.y) / 2 + 34} ${p.x} ${p.y}` : `${p.x} ${p.y}`)).join(" ");
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const stars = Array.from({ length: 90 }, () => `<circle cx="${(rnd() * 1920).toFixed(0)}" cy="${(rnd() * rnd() * 560).toFixed(0)}" r="${(0.8 + rnd() * 1.6).toFixed(1)}" opacity="${(0.4 + rnd() * 0.6).toFixed(2)}"/>`).join("");
    const camps = c.slice(0, -1).map((p, i) => `<g class="tr-camp" data-item="${i}" transform="translate(${p.x} ${p.y})">
      <circle class="tr-glow" r="70" fill="url(#tr-fire)"/>
      <g class="tr-tent"><path d="M-46 0 L-22 -40 L2 0 Z" fill="#fbf4e2"/><path d="M-22 -40 L-14 0 L-28 0 Z" fill="#25322e" opacity=".75"/><path d="M-22 -40 L2 0 L8 0 L-16 -40 Z" fill="#d8ccb2"/></g>
      <g transform="translate(20 0)"><path d="M-12 2 h24" stroke="#43362a" stroke-width="5" stroke-linecap="round"/><path class="tr-flame" d="M-9 0 C-9 -12 0 -16 0 -26 C6 -16 9 -12 9 0 Z" fill="#e08e3c"/></g>
      <rect x="-60" y="-60" width="110" height="80" fill="transparent"/></g>`).join("");
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
          <g data-item="${c.length - 1}" class="tr-summit" transform="translate(${summit.x - 38} ${summit.y})"><rect x="-3" y="-120" width="5" height="120" fill="#43362a"/><path d="M-1 -118 L-58 -102 L-1 -86 Z" fill="#e08e3c"/><rect x="-70" y="-130" width="90" height="140" fill="transparent"/></g>
          <g class="tr-hiker"><g transform="scale(.42) translate(0 -118)" fill="#fff">
            <path d="M13 -127A13 15 0 1 1 -13 -127A13 15 0 1 1 13 -127Z"/><path d="M-14 -131C-15 -151 15 -151 14 -131ZM-15.5 -134h31v6h-31ZM-5 -115h10v10h-10Z"/>
            <path d="M-8 -108C-19 -107 -25 -103 -26 -94L-25 -54C-26 -32 -27 -14 -26 2L26 2C27 -14 26 -32 25 -54L26 -94C25 -103 19 -107 8 -108Z"/>
            <path d="M-24 -100C-32 -96 -35 -82 -36 -62C-37 -44 -35 -26 -32 -6L-23 -6C-25 -26 -27 -44 -26 -60Z"/><path d="M24 -100C32 -96 35 -82 36 -62C37 -44 35 -26 32 -6L23 -6C25 -26 27 -44 26 -60Z"/>
            <path d="M-21 -2L-3 -2L-4 20C-5 60 -6 90 -6 110L-1 120L-21 120L-18 110C-18 90 -19 60 -20 20Z"/><path d="M21 -2L3 -2L4 20C5 60 6 90 6 110L1 120L21 120L18 110C18 90 19 60 20 20Z"/>
            <rect x="-13" y="-80" width="26" height="17" rx="3" fill="#25322e"/></g></g>
        </g></svg>${this.heroArt()}</div>
      <div class="tr-head tm-in">${this.title(`<span class="tr-title" style="--src:url('${this.asset("title.png")}')">${e(this.r.title)}</span>`)}<p>A CABIN · A CAMERA · A MOUNTAIN</p></div>
      <div class="tr-now tm-in"></div>
      <div class="tr-shade"></div>
      <div class="tr-alt tm-in"><div class="tr-rail"></div>${this.items.map((item, i) => `<button type="button" class="tr-tick" data-item="${i}" style="top:${100 - (this.camps[i].alt / 1120) * 100}%"><span>${this.camps[i].k} · ${e(item.name.toUpperCase())}</span><span>${this.camps[i].alt.toLocaleString("en")} M</span><i></i></button>`).join("")}</div>`;
  }

  mount() {
    this.trail = this.el.querySelector<SVGPathElement>(".tr-done")!;
    this.total = this.trail.getTotalLength();
    // Length along the trail at each camp, found by walking it.
    this.at = this.camps.map((c) => {
      let best = 0, bd = Infinity;
      for (let l = 0; l <= this.total; l += 4) {
        const p = this.trail.getPointAtLength(l), dd = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
        if (dd < bd) { bd = dd; best = l; }
      }
      return best;
    });
    this.trail.style.strokeDasharray = `${this.total} ${this.total}`;
    this.walkFrom = this.at[this.sel];
    this.place(this.walkFrom);
    // Wide on the key art until the page is up; begin() then cranes in.
    this.el.querySelector<SVGGElement>(".tr-cam")!.style.transition = "none";
    this.text();
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

  private text() {
    const c = this.camps[this.sel], item = this.items[this.sel], now = this.el.querySelector<HTMLElement>(".tr-now")!;
    now.innerHTML = `<div class="tr-k"><b>●</b> ${c.k} &nbsp;·&nbsp; ALT ${c.alt.toLocaleString("en")} M</div><h2>${e(item.name)}</h2><p>${e(item.text)}</p><button type="button" class="tr-go${item.soon ? " soon" : ""}" data-item="${this.sel}">${e(item.go)}</button>`;
  }

  /** Frame the camp right of centre, closer the lower it is; never past the art's edges. */
  private frame(instant: boolean) {
    const c = this.camps[this.sel], high = this.sel / (this.camps.length - 1), S = 1.55 - 0.35 * high;
    // The part of the 1920×1080 art the window shows (the map is cropped to cover it).
    const a = innerWidth / innerHeight, vw = Math.min(1920, 1080 * a), vh = Math.min(1080, 1920 / a);
    const x0 = (1920 - vw) / 2, y0 = (1080 - vh) / 2;
    const tx = Math.min(x0, Math.max(x0 + vw - 1920 * S, x0 + vw * (a < 1 ? 0.5 : 0.6) - c.x * S));
    const ty = Math.min(y0, Math.max(y0 + vh - 1080 * S, y0 + vh * 0.58 - c.y * S));
    const cam = this.el.querySelector<SVGGElement>(".tr-cam")!;
    cam.style.transition = instant ? "none" : "";
    cam.style.transform = `translate(${tx}px, ${ty}px) scale(${S})`;
  }

  protected layout() { if (this.begun) this.frame(true); }

  protected show(from: number, instant: boolean) {
    const high = this.sel / (this.camps.length - 1);
    if (from === this.sel && instant) return;
    this.begun = true;
    this.frame(instant);
    this.el.querySelector(".tr-dusk")!.setAttribute("opacity", (high * 0.85).toFixed(2));
    this.el.querySelector(".tr-stars")!.setAttribute("opacity", Math.max(0, high * 1.4 - 0.5).toFixed(2));
    this.el.classList.toggle("high", this.sel >= 3);
    this.el.querySelectorAll<SVGGElement>(".tr-camp").forEach((g) => { const i = Number(g.dataset.item); g.classList.toggle("on", i === this.sel); g.classList.toggle("ahead", i > this.sel); });
    this.el.querySelectorAll(".tr-tick").forEach((t, i) => t.classList.toggle("on", i === this.sel));
    if (from !== this.sel) {
      this.text();
      const now = this.el.querySelector<HTMLElement>(".tr-now")!;
      now.classList.remove("swap");
      void now.offsetWidth;
      now.classList.add("swap");
    }
    if (instant) { this.walkFrom = this.at[this.sel]; this.place(this.walkFrom); } else this.walk(this.at[this.sel]);
  }

  begin(instant: boolean) {
    // The first move is a crane from the whole mountain down to the camp.
    if (instant) { this.show(-1, true); return; }
    this.later(250, () => this.show(-1, false));
  }

  protected pulse() { this.el.querySelector(".tr-go")?.animate([{ transform: "scale(1)" }, { transform: "scale(.94)" }, { transform: "scale(1)" }], 260); }

  destroy() { cancelAnimationFrame(this.walking); super.destroy(); }
}

/* ---------------------------------------------------------------------------------------- */
/* LOCKDOWN: a block of flats rising from the bottom edge; its windows are a grid and each   */
/* option is a piece of it, in the colour of an ingredient.                                  */

const PIECES: Record<Key, { c: string; cells: [number, number][] }> = {
  play: { c: "#f2c879", cells: [[0, 7], [1, 7], [2, 7], [3, 7], [0, 6]] },
  trailer: { c: "#d48c80", cells: [[4, 7], [5, 7], [6, 7], [5, 6]] },
  playthrough: { c: "#9cc77a", cells: [[1, 5], [2, 5], [2, 6], [3, 6]] },
  download: { c: "#c9a54e", cells: [[6, 2], [6, 3], [6, 4], [6, 5]] },
  about: { c: "#ece5cf", cells: [[3, 4], [4, 4], [3, 5], [4, 5]] },
  shots: { c: "#f5e39a", cells: [[0, 2], [1, 2], [1, 3], [1, 4]] },
};
// A five-by-seven cell font for the title.
const GLYPHS: Record<string, string[]> = {
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"], O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"], K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"], W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
};

class LockdownMenu extends TitleMenu {
  protected order: Key[] = ["play", "trailer", "playthrough", "download", "about", "shots"];
  protected hints: [string, string][] = [["↑↓", "CHOOSE"], ["A", "GO IN"], ["B", "BACK TO SHELF"]];
  protected up: 1 | -1 = 1;

  constructor(r: ArchiveRecord, nav: MenuNav, sound: (name: Sound) => void) { super(r, nav, sound); this.build("lockdown"); }

  protected markup() {
    const owner = new Map<string, number>();
    this.items.forEach((item, i) => PIECES[item.key].cells.forEach(([c, r]) => owner.set(`${c},${r}`, i)));
    let grid = "";
    for (let r = 0; r < 8; r++) for (let c = 0; c < 7; c++) {
      const i = owner.get(`${c},${r}`);
      grid += i === undefined ? "<i></i>" : `<i class="ld-piece" data-item="${i}" style="--c:${PIECES[this.items[i].key].c}"></i>`;
    }
    // Listed top to bottom in the order the pieces sit, highest first.
    const list = [...this.items.keys()].reverse().map((i) => {
      const item = this.items[i], piece = PIECES[item.key];
      const minC = Math.min(...piece.cells.map((p) => p[0])), minR = Math.min(...piece.cells.map((p) => p[1]));
      const mini = piece.cells.map(([c, r]) => `<b style="grid-column:${c - minC + 1};grid-row:${r - minR + 1}"></b>`).join("");
      return `<button type="button" class="ld-opt${item.soon ? " soon" : ""}" data-item="${i}" style="--c:${piece.c}"><span class="ld-mini">${mini}</span><span>${item.key === "play" ? "▶ " : ""}${e(item.name.toUpperCase())}${item.meta ? `<small>${e(item.meta)}</small>` : ""}</span></button>`;
    }).join("");
    return `<div class="tm-art">${this.r.hero ? `<img class="ld-bg" src="${media(this.r.hero)}" alt="">` : ""}${this.heroArt()}</div>
      <div class="ld-head tm-in">${this.title(`<canvas width="620" height="90" aria-hidden="true"></canvas><span class="tm-sr">${e(this.r.title)}</span>`)}<p>${e(this.r.en)}</p></div>
      <div class="ld-block tm-in"><div class="ld-roof"><div class="ld-tank"></div><div class="ld-vent"></div>
        <svg class="ld-steam" viewBox="0 0 60 100" aria-hidden="true"><path d="M18 98 C4 80 30 66 16 48 S30 18 20 2" fill="none" stroke="rgba(236,229,207,.75)" stroke-width="4" stroke-linecap="round"/></svg></div>
        <div class="ld-face"><div class="ld-grid">${grid}</div></div><div class="ld-door"><i></i></div></div>
      <div class="ld-list tm-in">${list}</div>`;
  }

  mount() {
    const t = this.el.querySelector("canvas")!.getContext("2d")!, s = 12;
    let x = 0;
    for (const ch of "LOCKDOWN") {
      GLYPHS[ch].forEach((row, r) => [...row].forEach((bit, k) => {
        if (bit !== "1") return;
        // One lit window in the second O, in the colour of the trailer piece.
        t.fillStyle = ch === "O" && r === 3 && k === 0 && x ? "#d48c80" : "#f2ece4";
        t.fillRect(x + k * s, r * s, s - 1, s - 1);
      }));
      x += s * 6;
    }
    const grid = this.el.querySelector<HTMLElement>(".ld-grid")!;
    grid.addEventListener("mouseover", (event) => {
      const piece = (event.target as Element).closest<HTMLElement>(".ld-piece");
      grid.querySelectorAll<HTMLElement>(".ld-piece").forEach((el) => el.classList.toggle("hover", Boolean(piece) && el.dataset.item === piece!.dataset.item));
    });
    grid.addEventListener("mouseleave", () => grid.querySelectorAll(".ld-piece").forEach((el) => el.classList.remove("hover")));
    super.mount();
  }

  protected show() {
    this.el.querySelectorAll<HTMLElement>("[data-item]").forEach((el) => el.classList.toggle("on", Number(el.dataset.item) === this.sel));
  }

  protected pulse() {
    this.el.querySelectorAll<HTMLElement>(`.ld-piece[data-item="${this.sel}"]`).forEach((el) => el.animate([{ filter: "brightness(1)" }, { filter: "brightness(1.6)" }, { filter: "brightness(1)" }], 320));
  }
}

const THEMES = { lastmile: LastMileMenu, trail: TrailMenu, lockdown: LockdownMenu };
export type TitleMenuView = TitleMenu;

export function createTitleMenu(r: ArchiveRecord, nav: MenuNav, sound: (name: Sound) => void): TitleMenu | null {
  const Theme = r.menu ? THEMES[r.menu] : undefined;
  return Theme ? new Theme(r, nav, sound) : null;
}

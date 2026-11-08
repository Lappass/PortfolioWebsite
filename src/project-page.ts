import "./project-page.css";
import type { ArchiveRecord, CaseStudySection } from "./data";
import { escapeHtml } from "./html";
import { logo } from "./brand";
import { paintArtwork } from "./case-art";
import type { Sound } from "./audio";
import { createGameCover, type CoverSection, type GameCoverView } from "./game-covers";
import { embedUrl, isFile, isWeb, seconds } from "./video";

const heroArt = new Map<string, string>();
type ScreenRect = { left: number; top: number; right: number; bottom: number; quad?: [number, number][] };
const LIFT_MS = 1100;
/** CSS matrix3d taking the W×H box (origin top-left) onto quad tl, tr, br, bl. */
function quadMatrix(W: number, H: number, q: [number, number][]) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1 || 1e-9;
  const g = (dx3 * dy2 - dx2 * dy3) / den, h = (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3;
  return `matrix3d(${[a / W, d / W, 0, g / W, b / H, e / H, 0, h / H, 0, 0, 1, 0, x0, y0, 0, 1].join(",")})`;
}
/** Key art for the cover: the work's own image, or its generated cover art at screen size. */
function heroSource(r: ArchiveRecord) {
  const own = r.hero ?? r.cover;
  if (own) return media(own);
  let url = heroArt.get(r.id);
  if (!url) {
    const canvas = Object.assign(document.createElement("canvas"), { width: 1600, height: 900 });
    paintArtwork(canvas.getContext("2d")!, r, 0, 1600, 900);
    url = canvas.toDataURL("image/jpeg", 0.86);
    heroArt.set(r.id, url);
  }
  return url;
}

const media = (value: string) => escapeHtml(isWeb(value) ? value : `${import.meta.env.BASE_URL}${value.replace(/^\//, "")}`);
const pad = (value: number) => String(value).padStart(2, "0");
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export const workHash = (id: string) => `#/work/${id.toLowerCase()}`;
export function workIdFromHash(hash = location.hash) {
  const match = /^#\/work\/(x-\d{3})$/i.exec(hash);
  return match ? match[1].toUpperCase() : null;
}

interface Neighbours { previous: ArchiveRecord; next: ArchiveRecord; position: number; total: number }

/** One block of the page below the cover. */
type Section =
  | { id: string; heading: string; kind: "play" | "trailer" | "playthrough" | "shots" | "about" }
  | { id: string; heading: string; kind: "study"; study: CaseStudySection };

/**
 * The page a work opens on once its disc is read: one scrolling page. The first screen is the
 * cover (the game's own shape for works with a `menu` theme, the key art otherwise) with the
 * title, a pitch and the Play / Trailer / Download buttons; below it, the trailer, one block per
 * case-study section, the screenshots and the links. Dots down the right edge
 * and the cover's own parts jump between blocks; ↑↓ step through them.
 */
export class ProjectPage {
  readonly root = document.createElement("div");
  private record: ArchiveRecord | null = null;
  private sections: Section[] = [];
  private state: "closed" | "opening" | "open" | "closing" = "closed";
  private timer = 0;
  private pushed = false;
  private returnFocus: HTMLElement | null = null;
  private introTimer = 0;
  private lift?: HTMLImageElement;
  private cover: GameCoverView | null = null;
  private watcher: IntersectionObserver | null = null;
  /** The block on screen (-1: the cover) and where the last key press is taking it. */
  private at = -1;
  private aim = -2;
  private aimTimer = 0;
  private shot = 0;

  constructor(private handlers: { close: () => void; navigate: (direction: 1 | -1) => void; save: (id: string) => boolean; sound: (name: Sound) => void }) {
    this.root.id = "project-page";
    this.root.className = "project-page";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-labelledby", "pp-title");
    this.root.hidden = true;
    document.body.append(this.root);
    this.root.addEventListener("click", (event) => {
      const target = event.target as Element;
      const button = target.closest<HTMLElement>("[data-page]");
      if (!button) return;
      const action = button.dataset.page;
      if (action === "back") this.handlers.close();
      if (action === "prev") this.handlers.navigate(-1);
      if (action === "next") this.handlers.navigate(1);
      if (action === "unity") this.loadUnity(button);
      if (action === "go") this.goTo(button.dataset.to!);
      if (action === "shot") this.showShot(Number(button.dataset.i));
      if (action === "chapter") this.seek(Number(button.dataset.at));
      if (action === "save" && this.record) this.setSaved(this.handlers.save(this.record.id));
      if (action === "fullscreen") void this.root.querySelector<HTMLIFrameElement>(".pp-unity iframe")?.requestFullscreen?.().catch(() => {});
    });
    this.root.addEventListener("keydown", (event) => this.trapFocus(event));
  }

  get isOpen() { return this.state === "opening" || this.state === "open"; }
  /** Fully opaque: the 3D scene behind it can stop rendering. */
  get covering() { return this.state === "open"; }
  get currentId() { return this.record?.id ?? null; }

  open(record: ArchiveRecord, neighbours: Neighbours, options: { instant?: boolean; push?: boolean; intro?: boolean; from?: ScreenRect | null; saved?: boolean } = {}) {
    if (this.isOpen) { this.render(record, neighbours, options.saved); return; }
    this.render(record, neighbours, options.saved);
    if (options.push !== false && location.hash !== workHash(record.id)) {
      history.pushState({ work: record.id }, "", workHash(record.id));
      this.pushed = true;
    }
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    clearTimeout(this.timer);
    this.root.hidden = false;
    this.root.classList.toggle("instant", Boolean(options.instant));
    // The monitor has shown the loading and ends on this work's key art.
    clearTimeout(this.introTimer);
    this.state = "opening";
    const quad = !options.instant && options.from?.quad;
    this.root.classList.toggle("lifted", Boolean(quad));
    this.root.scrollTop = 0;
    const reveal = () => {
      this.root.classList.toggle("intro", Boolean(options.intro));
      if (options.intro) this.introTimer = window.setTimeout(() => this.root.classList.remove("intro"), 2600);
      this.cover?.begin(Boolean(options.instant));
      // Commit the hidden state first so the fade actually runs.
      void this.root.offsetWidth;
      this.root.classList.add("visible");
    };
    if (quad) this.liftFromScreen(record, quad, reveal);
    else reveal();
    this.root.querySelector<HTMLElement>("#pp-title")?.focus({ preventScroll: true });
    this.timer = window.setTimeout(() => { this.state = "open"; }, options.instant ? 0 : quad ? LIFT_MS + 340 : 340);
  }

  /** Replace the content in place, e.g. for previous/next. */
  render(record: ArchiveRecord, { previous, next, position, total }: Neighbours, saved = false) {
    const changed = this.record?.id !== record.id;
    this.record = record;
    if (changed && this.isOpen && location.hash !== workHash(record.id))
      history.replaceState({ work: record.id }, "", workHash(record.id));
    const e = escapeHtml;
    this.watcher?.disconnect();
    this.cover?.destroy();
    this.at = -1;
    this.aim = -2;
    this.shot = 0;
    this.sections = this.sectionsFor(record);
    const nav: CoverSection[] = this.sections.filter((s) => s.kind === "study").map((s) => ({ id: s.id, heading: s.heading }));
    const intro = this.introMarkup(record);
    this.cover = createGameCover(record, nav, intro, (id) => this.goTo(id));
    this.root.dataset.theme = record.menu ?? "";
    const links = [...(record.links ?? []), ...(record.links?.some((link) => link.url === record.source) ? [] : [{ label: "Project link", url: record.source }])];
    this.root.innerHTML = `
      <header class="pp-bar">
        <button type="button" data-page="back">← <span>Back</span><small>Esc</small></button>
        <span class="pp-brand" aria-hidden="true">Shuhang Chen</span>
        <nav aria-label="Switch work"><button type="button" class="pp-save" data-page="save" aria-pressed="${saved}">${saved ? "Saved" : "Save"}</button><button type="button" data-page="prev" aria-label="Previous work: ${e(previous.title)}">← <span>Prev</span></button><span class="pp-count">${pad(position)} / ${pad(total)}</span><button type="button" data-page="next" aria-label="Next work: ${e(next.title)}"><span>Next</span> →</button></nav>
      </header>
      <section class="pg-cover${this.cover ? "" : " pg-plain"}" data-block="cover" aria-label="Cover">${this.cover ? "" : `
        <div class="pp-hub-art"><img src="${heroSource(record)}" alt="" decoding="async"></div>
        <div class="pg-plain-content"><h1 id="pp-title" tabindex="-1">${e(record.title)}</h1>${intro}</div>`}</section>
      <main class="pg-body">
        ${this.sections.map((s, i) => this.sectionMarkup(record, s, i)).join("")}
        <div class="pg-end"><div class="pp-links">${links.map((link) => `<a href="${e(link.url)}" target="_blank" rel="noopener noreferrer">${e(link.label)} <span>↗</span></a>`).join("")}</div></div>
      </main>
      <footer class="pp-next"><button type="button" data-page="next"><span>Next</span><strong>${e(next.title)} →</strong></button></footer>
      <nav class="pg-dots" aria-label="Sections"><button type="button" data-page="go" data-to="cover" title="Top" aria-label="Top"></button>${this.sections.map((s) => `<button type="button" data-page="go" data-to="${e(s.id)}" title="${e(s.heading)}" aria-label="${e(s.heading)}"></button>`).join("")}</nav>`;
    if (this.cover) {
      this.root.querySelector(".pg-cover")!.append(this.cover.el);
      this.cover.mount();
      // Switched to another work while open: its cover starts straight away.
      if (this.isOpen) this.cover.begin(reduced());
    }
    if (this.sections.some((s) => s.kind === "shots")) this.showShot(0);
    this.watch();
    if (changed) this.root.scrollTop = 0;
  }

  /** The blocks below the cover, in reading order. */
  private sectionsFor(r: ArchiveRecord): Section[] {
    const out: Section[] = [];
    if (r.unity) out.push({ id: "play", heading: "Play", kind: "play" });
    if (r.trailer ?? r.video) out.push({ id: "trailer", heading: "Trailer", kind: "trailer" });
    // Games with their own cover play it on the cover itself (src/game-covers.ts).
    if (r.playthrough && !r.menu) out.push({ id: "playthrough", heading: "Full playthrough", kind: "playthrough" });
    r.study?.sections.forEach((study, i) => out.push({ id: `s${i + 1}`, heading: study.heading, kind: "study", study }));
    if (!r.study) out.push({ id: "about", heading: "About", kind: "about" });
    if (r.gallery?.length) out.push({ id: "shots", heading: "Screenshots", kind: "shots" });
    return out;
  }

  /** The cover's text block: one line, the pitch, the facts, and the Play / Trailer / Download buttons. */
  private introMarkup(r: ArchiveRecord) {
    const e = escapeHtml;
    const facts = r.study ? r.study.facts.map((f) => f.value) : [r.department, r.lead, r.date];
    const button = (has: boolean, label: string, inner: string) => has ? inner : `<span class="pg-off">${label} · not yet</span>`;
    return `<div class="pg-intro">
      <p class="pg-en">${e(r.en)}</p>
      <p class="pg-pitch">${e(r.study?.pitch ?? r.abstract)}</p>
      <p class="pg-facts">${facts.map(e).join(" · ")}</p>
      <div class="pg-actions">
        ${button(Boolean(r.unity), "Play", `<button type="button" data-page="go" data-to="play">Play</button>`)}
        ${button(Boolean(r.trailer ?? r.video), "Trailer", `<button type="button" data-page="go" data-to="trailer">Trailer</button>`)}
        ${r.playthrough && !r.menu ? `<button type="button" data-page="go" data-to="playthrough">Full playthrough</button>` : ""}
        ${button(Boolean(r.download), "Download", `<a href="${e(r.download?.url ?? "")}" target="_blank" rel="noopener noreferrer">Download${r.download?.size ? ` · ${e(r.download.size)}` : ""}</a>`)}
      </div></div>`;
  }

  private sectionMarkup(r: ArchiveRecord, s: Section, i: number) {
    const e = escapeHtml, open = `<section class="pg-sec pg-${s.kind}" id="sec-${e(s.id)}" data-block="${e(s.id)}" data-i="${i}" tabindex="-1">`;
    if (s.kind === "study") {
      const [big, small] = s.study.media ?? [];
      const figure = (m: { src: string; caption?: string }, cls: string) => `<figure class="${cls}"><img src="${media(m.src)}" alt="${e(m.caption ?? s.heading)}" loading="lazy" decoding="async">${m.caption ? `<figcaption>${e(m.caption)}</figcaption>` : ""}</figure>`;
      return `${open}<div class="pg-text"><h2>${e(s.heading)}</h2><p>${e(s.study.summary ?? s.study.body[0])}</p></div>
        ${big ? `<div class="pg-pics">${figure(big, "pg-big")}${small ? figure(small, "pg-small") : ""}</div>` : ""}</section>`;
    }
    if (s.kind === "play") return `${open}<h2>Play</h2><div class="pp-frame">${this.unityMarkup(r)}</div></section>`;
    if (s.kind === "trailer") return `${open}<h2>Trailer</h2><div class="pp-frame">${this.videoMarkup(r, (r.trailer ?? r.video)!)}</div></section>`;
    if (s.kind === "playthrough") {
      const run = r.playthrough!;
      const chapters = run.chapters?.length ? `<ol class="pg-chapters">${run.chapters.map((c) => `<li><button type="button" data-page="chapter" data-at="${seconds(c.at)}"><span>${e(c.at)}</span>${e(c.label)}</button></li>`).join("")}</ol>` : "";
      return `${open}<h2>Full playthrough</h2><div class="pp-frame">${this.videoMarkup(r, run.src)}</div>${chapters}</section>`;
    }
    if (s.kind === "shots") {
      return `${open}<h2>Screenshots</h2><div class="pg-shots"><figure class="pg-shot"></figure><div class="pg-thumbs">${r.gallery!.map((shot, k) => `<button type="button" data-page="shot" data-i="${k}" aria-label="Screenshot ${k + 1}"><img src="${media(shot.src)}" alt="" loading="lazy"></button>`).join("")}</div></div></section>`;
    }
    return `${open}<h2>About</h2><div class="pg-prose"><p>${e(r.abstract)}</p><ol class="pg-list">${r.findings.map((f) => `<li>${e(f)}</li>`).join("")}</ol>
        ${r.tags?.length ? `<p class="pg-tags">${r.tags.map(e).join(" · ")}</p>` : ""}</div></section>`;
  }

  /** Keeps the cover, the dots and the top bar in step with the block on screen. */
  private watch() {
    const blocks = [...this.root.querySelectorAll<HTMLElement>("[data-block]")];
    // A band across the middle of the window: the block inside it is the one being read.
    this.watcher = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        this.at = el.dataset.block === "cover" ? -1 : Number(el.dataset.i);
      }
      this.sync();
    }, { root: this.root, rootMargin: "-45% 0px -45% 0px", threshold: 0 });
    blocks.forEach((b) => this.watcher!.observe(b));
    this.sync();
  }

  private sync() {
    const current = this.sections[this.at];
    this.root.classList.toggle("scrolled", this.at >= 0);
    this.root.querySelectorAll<HTMLElement>(".pg-dots button").forEach((dot, i) => dot.classList.toggle("on", i === this.at + 1));
    // The cover marks its own sections and keeps the last one when the page comes back up to it,
    // so the hiker, the gears or the paw show where the reader got to.
    const study = this.sections.filter((s) => s.kind === "study");
    if (current?.kind === "study") this.cover?.current(study.indexOf(current));
  }

  /** Scroll to a block by id ("cover" for the top). */
  private goTo(id: string) {
    const behavior: ScrollBehavior = reduced() || this.root.classList.contains("instant") ? "instant" : "smooth";
    if (id === "cover") { this.root.scrollTo({ top: 0, behavior }); return; }
    this.root.querySelector<HTMLElement>(`#sec-${CSS.escape(id)}`)?.scrollIntoView({ behavior, block: "start" });
  }

  /** ↑↓ and Page keys step through the blocks; ←→ turn the screenshots; false when the page has no use for the key. */
  handleKey(event: KeyboardEvent) {
    if (event.target instanceof HTMLElement && event.target.closest("video, iframe, input")) return false;
    const step = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 }[event.key];
    if (step) {
      // Count from where the last press is headed, so quick presses add up mid-scroll.
      const from = this.aim > -2 ? this.aim : this.at;
      this.aim = Math.max(-1, Math.min(this.sections.length - 1, from + step));
      clearTimeout(this.aimTimer);
      this.aimTimer = window.setTimeout(() => (this.aim = -2), 800);
      this.goTo(this.aim < 0 ? "cover" : this.sections[this.aim].id);
      return true;
    }
    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && this.sections[this.at]?.kind === "shots") {
      this.showShot(this.shot + (event.key === "ArrowRight" ? 1 : -1));
      return true;
    }
    return false;
  }

  private showShot(i: number) {
    const shots = this.record?.gallery;
    if (!shots?.length) return;
    this.shot = (i + shots.length) % shots.length;
    const shot = shots[this.shot], e = escapeHtml;
    const figure = this.root.querySelector(".pg-shot");
    if (!figure) return;
    figure.innerHTML = `<div class="pp-frame"><img src="${media(shot.src)}" alt="${e(shot.caption ?? this.record!.title)}"></div>
      <figcaption><span>${this.shot + 1} / ${shots.length}</span>${e(shot.caption ?? "")}${shot.note ? `<p>${e(shot.note)}</p>` : ""}</figcaption>`;
    this.root.querySelectorAll("[data-page=shot]").forEach((el, k) => el.classList.toggle("on", k === this.shot));
  }

  setSaved(saved: boolean) {
    const button = this.root.querySelector<HTMLElement>(".pp-save");
    if (!button) return;
    button.textContent = saved ? "Saved" : "Save";
    button.setAttribute("aria-pressed", String(saved));
  }

  /**
   * The key art lifts off the monitor: a 16:9 image pinned to the screen's four
   * projected corners (perspective included) eases out until it sits exactly where
   * the page's cover art will be, cropped the same way, then hands over to the page,
   * whose text rises in around it. The handover itself is invisible.
   */
  private liftFromScreen(record: ArchiveRecord, quad: [number, number][], done: () => void) {
    this.lift?.remove();
    const img = Object.assign(document.createElement("img"), { src: heroSource(record), alt: "", className: "pp-lift" });
    // The cover art's box once the page shows, and the 16:9 frame that covers it as object-fit does.
    const R = this.root.querySelector(".pp-hub-art, .tm-art")?.getBoundingClientRect() ?? new DOMRect(0, 0, innerWidth, innerHeight);
    const ew = Math.max(R.width, (R.height * 16) / 9), eh = (ew * 9) / 16;
    const ex = R.left + (R.width - ew) / 2, ey = R.top + (R.height - eh) / 2;
    const target: [number, number][] = [[ex, ey], [ex + ew, ey], [ex + ew, ey + eh], [ex, ey + eh]];
    const crop = [R.top - ey, ex + ew - R.right, ey + eh - R.bottom, R.left - ex];
    Object.assign(img.style, { width: `${ew}px`, height: `${eh}px` });
    document.body.append(img);
    this.lift = img;
    const start = performance.now();
    // Ease out: it leaves the screen at the speed the camera was closing in, then settles.
    const ease = (t: number) => 1 - (1 - t) ** 3;
    const frame = (now: number) => {
      if (this.lift !== img) return;
      const t = Math.min(1, (now - start) / LIFT_MS), k = ease(t);
      const q = quad.map(([x, y], i) => [x + (target[i][0] - x) * k, y + (target[i][1] - y) * k] as [number, number]);
      img.style.transform = quadMatrix(ew, eh, q);
      img.style.clipPath = `inset(${crop.map((v) => `${v * k}px`).join(" ")})`;
      // A touch of screen glow that burns off as it lands.
      img.style.filter = `brightness(${1.12 - 0.12 * k})`;
      if (t < 1) { requestAnimationFrame(frame); return; }
      done();
      // Same picture in the same place underneath: drop it once the page has faded up.
      window.setTimeout(() => { if (this.lift === img) { img.remove(); this.lift = undefined; } }, 380);
    };
    img.style.transform = quadMatrix(ew, eh, quad);
    requestAnimationFrame(frame);
  }

  close(options: { syncHistory?: boolean } = {}) {
    this.lift?.remove();
    this.lift = undefined;
    if (!this.isOpen) return false;
    clearTimeout(this.timer);
    clearTimeout(this.introTimer);
    this.root.classList.remove("intro");
    this.state = "closing";
    this.root.classList.remove("visible");
    if (options.syncHistory !== false && workIdFromHash()) {
      if (this.pushed) history.back();
      else history.replaceState(null, "", location.pathname + location.search);
    }
    this.pushed = false;
    const instant = this.root.classList.contains("instant");
    this.timer = window.setTimeout(() => {
      this.state = "closed";
      this.root.hidden = true;
      // Stop video and Unity playback.
      this.watcher?.disconnect();
      this.watcher = null;
      this.cover?.destroy();
      this.cover = null;
      this.root.innerHTML = "";
      this.record = null;
      this.returnFocus?.focus({ preventScroll: true });
    }, instant ? 0 : 240);
    return true;
  }

  setInstant(instant: boolean) { this.root.classList.toggle("instant", instant); }

  private unityMarkup(r: ArchiveRecord) {
    const poster = r.hero ?? r.cover;
    return `<div class="pp-unity" data-src="${media(r.unity!)}">${poster ? `<img src="${media(poster)}" alt="">` : `<div class="pp-mark">${logo}</div>`}<button type="button" class="pp-play" data-page="unity">▶ <span>Load the game</span><small>Unity WebGL, a large download</small></button></div>`;
  }

  private videoMarkup(r: ArchiveRecord, src: string) {
    if (isFile(src)) return `<video controls playsinline preload="metadata"${r.cover ? ` poster="${media(r.cover)}"` : ""} src="${media(src)}"></video>`;
    if (isWeb(src)) return `<iframe src="${escapeHtml(embedUrl(src))}" title="${escapeHtml(r.title)} video" loading="lazy" allow="fullscreen; picture-in-picture; encrypted-media; autoplay" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
    return "";
  }

  /** A playthrough chapter: jump the video there and start it. */
  private seek(at: number) {
    const frame = this.root.querySelector<HTMLElement>(".pg-playthrough .pp-frame > video, .pg-playthrough .pp-frame > iframe");
    if (frame instanceof HTMLVideoElement) { frame.currentTime = at; void frame.play().catch(() => {}); }
    else if (frame instanceof HTMLIFrameElement && this.record?.playthrough) frame.src = embedUrl(this.record.playthrough.src, { start: at });
  }

  private loadUnity(button: HTMLElement) {
    const host = button.closest<HTMLElement>(".pp-unity")!;
    const frame = document.createElement("iframe");
    frame.src = host.dataset.src!;
    frame.title = `${this.record?.title ?? ""}`;
    frame.allow = "fullscreen; autoplay; gamepad; xr-spatial-tracking";
    frame.allowFullscreen = true;
    const full = document.createElement("button");
    full.type = "button";
    full.className = "pp-fullscreen";
    full.dataset.page = "fullscreen";
    full.textContent = "Full screen ⤢";
    host.replaceChildren(frame, full);
    frame.focus();
  }

  private trapFocus(event: KeyboardEvent) {
    if (event.key !== "Tab") return;
    const items = [...this.root.querySelectorAll<HTMLElement>("a[href],button,summary,iframe,video[controls],[tabindex='0']")]
      .filter((el) => el.getClientRects().length > 0);
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement?.id === "pp-title")) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
}

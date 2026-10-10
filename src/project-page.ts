import "./project-page.css";
import type { ArchiveRecord } from "./data";
import { escapeHtml } from "./html";
import { logo } from "./brand";
import { paintArtwork } from "./case-art";
import { PageChapters } from "./page-chapters";

const heroArt = new Map<string, string>();
type ScreenRect = { left: number; top: number; right: number; bottom: number; quad?: [number, number][] };
const LIFT_MS = 900;
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
/** Key art for the hub: the work's own image, or its generated cover art at screen size. */
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

const isWeb = (value: string) => /^https?:\/\//i.test(value);
const media = (value: string) => escapeHtml(isWeb(value) ? value : `${import.meta.env.BASE_URL}${value.replace(/^\//, "")}`);
const isFile = (value: string) => /\.(mp4|webm|ogv|mov)(\?|#|$)/i.test(value);
const pad = (value: number) => String(value).padStart(2, "0");

export const workHash = (id: string) => `#/work/${id.toLowerCase()}`;
export function workIdFromHash(hash = location.hash) {
  const match = /^#\/work\/(x-\d{3})$/i.exec(hash);
  return match ? match[1].toUpperCase() : null;
}

interface Neighbours { previous: ArchiveRecord; next: ArchiveRecord; position: number; total: number }

/** Full, scrollable project page shown after the archive card has been drawn out. */
export class ProjectPage {
  readonly root = document.createElement("div");
  private record: ArchiveRecord | null = null;
  private state: "closed" | "opening" | "open" | "closing" = "closed";
  private timer = 0;
  private pushed = false;
  private returnFocus: HTMLElement | null = null;
  private introTimer = 0;
  private lift?: HTMLImageElement;
  private chapters = new PageChapters(this.root);

  constructor(private handlers: { close: () => void; navigate: (direction: 1 | -1) => void }) {
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
      if (action === "more") this.root.querySelector(".pp-body")?.scrollIntoView({ behavior: "smooth" });
      if (action === "start") this.start();
      if (action === "fullscreen") void this.root.querySelector<HTMLIFrameElement>(".pp-unity iframe")?.requestFullscreen?.().catch(() => {});
    });
    this.root.addEventListener("keydown", (event) => this.trapFocus(event));
  }

  get isOpen() { return this.state === "opening" || this.state === "open"; }
  /** Fully opaque: the 3D scene behind it can stop rendering. */
  get covering() { return this.state === "open"; }
  get currentId() { return this.record?.id ?? null; }

  open(record: ArchiveRecord, neighbours: Neighbours, options: { instant?: boolean; push?: boolean; intro?: boolean; from?: ScreenRect | null } = {}) {
    if (this.isOpen) { this.render(record, neighbours); return; }
    this.render(record, neighbours);
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
    const reveal = () => {
      this.root.classList.toggle("intro", Boolean(options.intro));
      if (options.intro) this.introTimer = window.setTimeout(() => this.root.classList.remove("intro"), 2600);
      // Commit the hidden state first so the fade actually runs.
      void this.root.offsetWidth;
      this.root.classList.add("visible");
    };
    if (quad) this.liftFromScreen(record, quad, reveal);
    else reveal();
    this.root.scrollTop = 0;
    this.chapters.sync();
    this.root.querySelector<HTMLElement>("#pp-title")?.focus({ preventScroll: true });
    this.timer = window.setTimeout(() => { this.state = "open"; }, options.instant ? 0 : quad ? LIFT_MS + 340 : 340);
  }

  /** Replace the content in place, e.g. for previous/next. */
  render(record: ArchiveRecord, { previous, next, position, total }: Neighbours) {
    const changed = this.record?.id !== record.id;
    this.record = record;
    if (changed && this.isOpen && location.hash !== workHash(record.id))
      history.replaceState({ work: record.id }, "", workHash(record.id));
    const r = record, e = escapeHtml;
    const tags = r.tags?.length ? `<ul class="pp-tags">${r.tags.map((tag) => `<li>${e(tag)}</li>`).join("")}</ul>` : "";
    const links = [...(r.links ?? []), ...(r.links?.some((link) => link.url === r.source) ? [] : [{ label: "Project link", url: r.source }])];
    const gallery = r.gallery?.length
      ? `<section class="pp-section" data-section="gallery" tabindex="-1" aria-label="Visual records"><div class="pp-label"><span class="pp-section-number">${r.unity && r.video ? "04" : "03"}</span>VISUAL RECORDS</div><div class="pp-gallery">${r.gallery.map((item, i) => `<figure><div class="pp-record-image"><img src="${media(item.src)}" alt="${e(item.caption ?? r.title)}" loading="lazy" decoding="async"><span class="pp-image-index" aria-hidden="true">${pad(i + 1)}</span></div><figcaption>${item.note ? `<details class="pp-image-note"><summary><span class="pp-note-number">${pad(i + 1)}</span><span>${e(item.caption ?? "Image note")}</span><span class="pp-note-plus" aria-hidden="true">＋</span></summary><p>${e(item.note)}</p></details>` : `<span class="pp-note-number">${pad(i + 1)}</span>${e(item.caption ?? r.title)}`}</figcaption></figure>`).join("")}</div></section>`
      : "";
    const heroIsVideo = !r.unity && r.video;
    const video = r.video && !heroIsVideo ? `<section class="pp-section" data-section="video" tabindex="-1" aria-label="Demo video"><div class="pp-label">VIDEO</div><div class="pp-frame">${this.videoMarkup(r)}</div></section>` : "";
    const chapters = [["overview", "Work"], ["info", "Overview"], ...(video ? [["video", "Demo"]] : []), ...(gallery ? [["gallery", "Gallery"]] : []), ["findings", "Highlights"]];
    this.root.innerHTML = `
      <header class="pp-bar">
        <button type="button" data-page="back">← <span>Back to array</span><small>ESC</small></button>
        <span class="pp-brand" aria-hidden="true">SHUHANG CHEN</span>
        <nav aria-label="Switch work"><button type="button" data-page="prev" aria-label="Previous work: ${e(previous.title)}">← <span>Prev</span></button><span class="pp-count">${pad(position)} / ${pad(total)}</span><button type="button" data-page="next" aria-label="Next work: ${e(next.title)}"><span>Next</span> →</button></nav>
      </header>
      <nav class="pp-chapters" aria-label="Project sections"><span class="pp-index-label">WORK / ${e(r.id)}</span>${chapters.map(([id, label], i) => `<button type="button" data-chapter="${id}"><small>${pad(i + 1)}</small>${label}</button>`).join("")}</nav>
      <section class="pp-hub" data-section="overview" tabindex="-1" aria-label="Work cover">
        <div class="pp-field-index" aria-hidden="true">SELECTED WORK / ${pad(position)}<span>${e(r.clearance)}</span></div>
        <div class="pp-hub-art"><img src="${heroSource(r)}" alt="" decoding="async"></div>
        <div class="pp-hub-content">
          <div class="pp-kicker"><i></i>${e(r.category)} <span>·</span> ${e(r.id)}</div>
          <h1 id="pp-title" tabindex="-1">${e(r.title)}</h1>
          <div class="pp-en">${e(r.en)}</div>
          <div class="pp-hub-actions">
            <button type="button" class="pp-start" data-page="start">▶ <span>${r.unity ? "Play demo" : r.video ? "Play video" : "Visit project"}</span></button>
            <button type="button" data-page="more">Project info <span>↓</span></button>
          </div>
        </div>
      </section>
      <article class="pp-body">
        <section class="pp-hero" data-section="info" tabindex="-1" aria-label="Project overview">
          <div><div class="pp-label"><span class="pp-section-number">02</span>PROJECT</div><div class="pp-frame pp-hero-media">${this.heroMarkup(r)}</div><div class="pp-media-caption"><span>FIG. 01</span>${e(r.unity ? "Interactive demo" : r.video ? "Demo video" : r.title)}</div></div>
          <div class="pp-info">
            <div class="pp-kicker"><i></i>${e(r.category)} <span>·</span> ${e(r.id)}</div>
            <h2>${e(r.title)}</h2>
            <div class="pp-en">${e(r.en)}</div>
            <dl class="pp-meta">
              <div><dt>Role</dt><dd>${e(r.department)}</dd></div>
              <div><dt>Timeline</dt><dd>${e(r.date)}</dd></div>
              <div><dt>Stack</dt><dd>${e(r.lead)}</dd></div>
              <div><dt>Status</dt><dd>${e(r.clearance)}</dd></div>
            </dl>
            <p class="pp-abstract">${e(r.abstract)}</p>
            ${tags}
            <div class="pp-links">${links.map((link) => `<a href="${e(link.url)}" target="_blank" rel="noopener noreferrer">${e(link.label)} <span>↗</span></a>`).join("")}</div>
          </div>
        </section>
        ${video}
        ${gallery}
        <section class="pp-section pp-highlights" data-section="findings" tabindex="-1" aria-label="Highlights">
          <div class="pp-label"><span class="pp-section-number">${pad(chapters.length)}</span>FIELD NOTES</div>
          <ol>${r.findings.map((item, i) => `<li><span>${pad(i + 1)}</span>${e(item)}</li>`).join("")}</ol>
        </section>
      </article>
      <footer class="pp-next"><button type="button" data-page="next"><span>NEXT PROJECT</span><strong>${e(next.title)} →</strong></button></footer>`;
    if (changed) this.root.scrollTop = 0;
    this.chapters.sync();
  }

  /**
   * The key art lifts off the monitor: an image pinned to the screen's four
   * projected corners (perspective included) eases out to the window corners,
   * then hands over to the page, whose text rises in behind it.
   */
  private liftFromScreen(record: ArchiveRecord, quad: [number, number][], done: () => void) {
    this.lift?.remove();
    const img = Object.assign(document.createElement("img"), { src: heroSource(record), alt: "", className: "pp-lift" });
    document.body.append(img);
    this.lift = img;
    const W = innerWidth, H = innerHeight, target: [number, number][] = [[0, 0], [W, 0], [W, H], [0, H]];
    const start = performance.now();
    const ease = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
    const frame = (now: number) => {
      if (this.lift !== img) return;
      const t = Math.min(1, (now - start) / LIFT_MS), k = ease(t);
      const q = quad.map(([x, y], i) => [x + (target[i][0] - x) * k, y + (target[i][1] - y) * k] as [number, number]);
      img.style.transform = quadMatrix(W, H, q);
      // A touch of screen glow that burns off as it reaches the window.
      img.style.filter = `brightness(${1.25 - 0.25 * k})`;
      if (t < 1) { requestAnimationFrame(frame); return; }
      done();
      img.classList.add("out");
      window.setTimeout(() => { if (this.lift === img) { img.remove(); this.lift = undefined; } }, 420);
    };
    img.style.transform = quadMatrix(W, H, quad);
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
      this.root.innerHTML = "";
      this.record = null;
      this.returnFocus?.focus({ preventScroll: true });
    }, instant ? 0 : 240);
    return true;
  }

  setInstant(instant: boolean) { this.root.classList.toggle("instant", instant); }

  private heroMarkup(r: ArchiveRecord) {
    const e = escapeHtml;
    if (r.unity) {
      const poster = r.cover ? `<img src="${media(r.cover)}" alt="" decoding="async">` : `<div class="pp-mark">${logo}</div>`;
      return `<div class="pp-unity" data-src="${media(r.unity)}">${poster}<button type="button" class="pp-play" data-page="unity">▶ <span>Load interactive demo</span><small>Unity WebGL · large download</small></button></div>`;
    }
    if (r.video) return this.videoMarkup(r);
    if (r.cover) return `<img src="${media(r.cover)}" alt="${e(r.title)} cover" decoding="async">`;
    return `<div class="pp-mark">${logo}<span>Cover coming soon</span></div>`;
  }

  private videoMarkup(r: ArchiveRecord) {
    const src = r.video!;
    if (isFile(src)) return `<video controls playsinline preload="metadata"${r.cover ? ` poster="${media(r.cover)}"` : ""} src="${media(src)}"></video>`;
    if (isWeb(src)) return `<iframe src="${escapeHtml(src)}" title="${escapeHtml(r.title)} video" loading="lazy" allow="fullscreen; picture-in-picture; encrypted-media" allowfullscreen></iframe>`;
    return "";
  }

  /** The hub's primary action: play the demo or video, otherwise open the project. */
  private start() {
    const r = this.record;
    if (!r) return;
    const media = this.root.querySelector<HTMLElement>(".pp-hero-media");
    if (r.unity || r.video) {
      media?.scrollIntoView({ behavior: "smooth", block: "center" });
      const play = this.root.querySelector<HTMLElement>(".pp-play");
      if (play) this.loadUnity(play);
      else void this.root.querySelector<HTMLVideoElement>(".pp-hero-media video")?.play().catch(() => {});
      return;
    }
    const url = r.links?.[0]?.url ?? r.source;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  private loadUnity(button: HTMLElement) {
    const host = button.closest<HTMLElement>(".pp-unity")!;
    const frame = document.createElement("iframe");
    frame.src = host.dataset.src!;
    frame.title = `${this.record?.title ?? ""} interactive demo`;
    frame.allow = "fullscreen; autoplay; gamepad; xr-spatial-tracking";
    frame.allowFullscreen = true;
    const full = document.createElement("button");
    full.type = "button";
    full.className = "pp-fullscreen";
    full.dataset.page = "fullscreen";
    full.textContent = "Fullscreen ⤢";
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

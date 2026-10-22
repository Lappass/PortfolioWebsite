import "./project-page.css";
import { escapeHtml as e } from "./html";
import { profile } from "./profile";
import { ProfileOrb, type Chapter } from "./profile-orb";
import { records, featuredFiles } from "./data";
import { ProfileEntry } from "./profile-entry";
import { prepareIdentity } from "./profile-particles";
import "./profile-workspace.css";

const isWeb = (value: string) => /^(https?:|mailto:)/i.test(value);
const asset = (value: string) => e(isWeb(value) ? value : `${import.meta.env.BASE_URL}${value.replace(/^\//, "")}`);
export const PROFILE_HASH = "#/about";
const sections: [Chapter, string][] = [["identity", "Intro"], ["about", "About"], ["skills", "Skills"], ["experience", "Experience"]];
// Panels sit up-left, down-left, up-right, down-right of the orb; each ring arc faces its panel.
const arc = (i: number) => {
  const mid = [225, 135, 315, 45][i] * Math.PI / 180, span = 34 * Math.PI / 180, r = 96;
  const point = (a: number) => `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
  return `M${point(mid - span)}A${r} ${r} 0 0 1 ${point(mid + span)}`;
};
const stacked = matchMedia("(max-width: 980px)");
const arcAngle = { identity: 225, about: 135, skills: 315, experience: 45 } as const;
const clock = (seconds: number) => [seconds / 3600, seconds / 60 % 60, seconds % 60].map(n => String(Math.floor(n)).padStart(2, "0")).join(":");

/** Full-screen "player profile": who made the works on the shelf. */
export class ProfilePage {
  readonly root = document.createElement("div");
  private state: "closed" | "open" | "closing" = "closed";
  private timer = 0;
  private pushed = false;
  private returnFocus: HTMLElement | null = null;
  private orb?: ProfileOrb;
  private active: Chapter = "identity";
  private countFrame = 0;
  private scrollQueued = false;
  private needle = 0;
  private statusTimer = 0;
  private openedAt = 0;
  private entryFrame = 0;
  private entry?: ProfileEntry;

  constructor(private onClose: () => void, private workspace: (active: boolean, instant: boolean) => void = () => {}, private terminal: () => { ready: boolean; from: { top: number; right: number; bottom: number; left: number } | null } = () => ({ ready: true, from: null })) {
    this.root.className = "project-page profile-page";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-labelledby", "profile-title");
    this.root.hidden = true;
    document.body.append(this.root);
    this.root.addEventListener("click", (event) => {
      const target = event.target as Element;
      if (target.closest("[data-profile='back']")) this.onClose();
      // Clicking a panel (outside its links) locks it.
      const panel = target.closest<HTMLElement>(".pc-panel");
      if (panel && !target.closest("a,button")) this.select(panel.dataset.section as Chapter);
      const button = target.closest<HTMLElement>("[data-chapter]");
      const section = button && this.root.querySelector<HTMLElement>(`[data-section="${button.dataset.chapter}"]`);
      if (!section) return;
      this.select(button.dataset.chapter as Chapter);
      if (stacked.matches) section.scrollIntoView({ behavior: this.root.classList.contains("instant") || matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
      section.focus({ preventScroll: !stacked.matches });
    });
    // Wide screens: hovering a panel or its tab only lights that arc and leader line; a click or focus locks it and
    // drives the orb. Stacked: the panel scrolled under the orb drives it.
    this.root.addEventListener("pointerover", (event) => {
      if (event.pointerType !== "mouse") return;
      const node = stacked.matches ? null : (event.target as Element).closest<HTMLElement>(".pc-panel,[data-chapter]");
      this.preview((node?.dataset.section ?? node?.dataset.chapter) as Chapter | undefined);
    });
    this.root.addEventListener("pointerleave", () => this.preview());
    this.root.addEventListener("focusin", (event) => {
      const section = (event.target as Element).closest<HTMLElement>(".pc-panel");
      if (section) this.select(section.dataset.section as Chapter);
    });
    this.root.addEventListener("pointerdown", (event) => this.setInput(event.pointerType === "touch" ? "Touch" : event.pointerType === "pen" ? "Pen" : "Pointer"));
    this.root.addEventListener("keydown", () => this.setInput("Keys"));
    this.root.addEventListener("scroll", () => {
      if (!stacked.matches || this.scrollQueued) return;
      this.scrollQueued = true;
      requestAnimationFrame(() => { this.scrollQueued = false; this.readScroll(); });
    }, { passive: true });
    this.root.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const items = [...this.root.querySelectorAll<HTMLElement>("a[href],button")].filter(el => el.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement?.id === "profile-title")) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
  }

  get isOpen() { return this.state === "open"; }
  get covering() { return this.isOpen && this.root.classList.contains('visible') && !this.root.classList.contains('entering'); }

  open(options: { instant?: boolean; push?: boolean } = {}) {
    if (this.isOpen) return;
    cancelAnimationFrame(this.entryFrame);
    this.entry?.dispose();
    void prepareIdentity(profile.name);
    this.orb?.dispose();
    this.render();
    if (options.push !== false && location.hash !== PROFILE_HASH) {
      history.pushState({ profile: true }, "", PROFILE_HASH);
      this.pushed = true;
    }
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    clearTimeout(this.timer);
    this.root.hidden = false;
    this.root.classList.toggle("instant", Boolean(options.instant));
    this.root.classList.remove("visible", "from-screen");
    this.root.style.clipPath = "";
    this.state = "open";
    this.workspace(true, Boolean(options.instant));
    this.root.scrollTop = 0;
    this.active = "identity";
    this.select("identity", true);
    this.openedAt = performance.now();
    clearInterval(this.statusTimer);
    this.tickStatus();
    this.statusTimer = window.setInterval(() => this.tickStatus(), 1000);
    const reduced = Boolean(options.instant) || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startOrb = () => {
      if (!this.isOpen) return;
      this.orb = new ProfileOrb(this.root.querySelector('.profile-particle-canvas')!, this.root,
        matchMedia('(prefers-reduced-motion: reduce)').matches || Boolean(options.instant && options.push !== false));
      this.orb.select(this.active);
      this.countUp(reduced);
    };
    const reveal = () => {
      if (!this.isOpen) return;
      const { ready, from } = this.terminal();
      if (!reduced && !ready) { this.entryFrame = requestAnimationFrame(reveal); return; }
      if (!reduced) this.entry = new ProfileEntry(this.root, from, startOrb);
      void this.root.offsetWidth;
      this.root.classList.add("visible");
      if (reduced) startOrb();
      this.root.querySelector<HTMLElement>("#profile-title")?.focus({ preventScroll: true });
    };
    // Capture keyboard focus while the physical terminal performs the entrance.
    this.root.querySelector<HTMLElement>("#profile-title")?.focus({ preventScroll: true });
    reveal();
  }

  close(options: { syncHistory?: boolean } = {}) {
    if (!this.isOpen) return false;
    this.state = "closing";
    cancelAnimationFrame(this.entryFrame);
    cancelAnimationFrame(this.countFrame);
    clearInterval(this.statusTimer);
    this.entry?.dispose();
    this.workspace(false, this.root.classList.contains('instant'));
    this.orb?.dispose();
    this.root.classList.remove("visible");
    if (options.syncHistory !== false && location.hash === PROFILE_HASH) {
      if (this.pushed) history.back();
      else history.replaceState(null, "", location.pathname + location.search);
    }
    this.pushed = false;
    this.timer = window.setTimeout(() => {
      this.state = "closed";
      this.root.hidden = true;
      this.returnFocus?.focus({ preventScroll: true });
    }, this.root.classList.contains("instant") ? 0 : 240);
    return true;
  }

  private select(chapter: Chapter, force = false) {
    if (chapter === this.active && !force) return;
    this.active = chapter;
    const index = sections.findIndex(([id]) => id === chapter);
    for (const node of this.root.querySelectorAll<HTMLElement>("[data-section]")) node.classList.toggle("active", node.dataset.section === chapter);
    for (const node of this.root.querySelectorAll<SVGElement>("[data-arc]")) node.classList.toggle("active", node.dataset.arc === chapter);
    for (const button of this.root.querySelectorAll<HTMLElement>("[data-chapter]")) {
      if (button.dataset.chapter === chapter) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    }
    const count = this.root.querySelector(".pp-count");
    if (count) count.textContent = `0${index + 1} / 0${sections.length}`;
    const section = this.root.querySelector('[data-status="section"]');
    if (section) section.textContent = `0${index + 1} · ${sections[index][1]}`;
    // The ring pointer takes the short way round to the arc facing the selected panel.
    this.needle += ((arcAngle[chapter] - this.needle) % 360 + 540) % 360 - 180;
    this.root.querySelector<SVGElement>(".pc-needle")?.style.setProperty("transform", `rotate(${this.needle}deg)`);
    this.orb?.select(chapter);
  }

  private setInput(kind: string) {
    const node = this.root.querySelector('[data-status="input"]');
    if (node && node.textContent !== kind) node.textContent = kind;
  }

  private tickStatus() {
    const now = new Date();
    const uptime = this.root.querySelector('[data-status="uptime"]'), local = this.root.querySelector('[data-status="clock"]');
    if (uptime) uptime.textContent = clock((performance.now() - this.openedAt) / 1000);
    if (local) local.textContent = clock(now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds());
  }

  private preview(chapter?: Chapter) {
    for (const node of this.root.querySelectorAll<HTMLElement | SVGElement>(".pc-panel, [data-arc]"))
      node.classList.toggle("preview", chapter !== undefined && (node.dataset.section ?? node.dataset.arc) === chapter);
  }

  private readScroll() {
    const edge = this.root.getBoundingClientRect().top + (parseFloat(getComputedStyle(this.root).getPropertyValue("--chapter-edge")) || 200);
    const panels = [...this.root.querySelectorAll<HTMLElement>(".pc-panel")];
    const current = panels.filter(panel => panel.getBoundingClientRect().top <= edge).at(-1) ?? panels[0];
    if (current) this.select(current.dataset.section as Chapter);
  }

  /** Readouts tick up from zero once the console has powered on. */
  private countUp(instant: boolean) {
    const nodes = [...this.root.querySelectorAll<HTMLElement>("[data-count]")];
    const show = (node: HTMLElement, value: number) => { node.textContent = String(value).padStart(2, "0"); };
    if (instant) { nodes.forEach(node => show(node, Number(node.dataset.count))); return; }
    const start = performance.now();
    const tick = (now: number) => {
      let running = false;
      nodes.forEach((node, i) => {
        const t = Math.min(1, Math.max(0, (now - start - i * 90) / 700));
        show(node, Math.round(Number(node.dataset.count) * (1 - Math.pow(1 - t, 3))));
        running ||= t < 1;
      });
      if (running && this.isOpen) this.countFrame = requestAnimationFrame(tick);
    };
    nodes.forEach(node => show(node, 0));
    this.countFrame = requestAnimationFrame(tick);
  }

  private render() {
    const p = profile;
    const links = [...p.contact, ...(p.resume ? [{ label: "Résumé", url: p.resume }] : [])];
    const tools = p.skills.reduce((sum, s) => sum + s.items.length, 0);
    const readouts: [string, number][] = [["Works", records.length], ["Featured", featuredFiles.filter(i => i >= 0).length], ["Tools", tools], ["Milestones", p.experience.filter(x => !x.upcoming).length]];
    const panel = (chapter: Chapter, index: number, meta: string, body: string) => `
        <section class="pc-panel" data-section="${chapter}" data-side="${index < 2 ? "left" : "right"}" style="--i:${index}" tabindex="-1" aria-labelledby="pc-${chapter}">
          <i class="pc-lead" aria-hidden="true"></i>
          <header class="pc-head"><span class="pc-light" aria-hidden="true"></span><span class="pc-index">0${index + 1}</span><h2 id="pc-${chapter}">${sections[index][1]}</h2><span class="pc-meta">${e(meta)}</span></header>
          ${body}
        </section>`;
    this.root.innerHTML = `
      <header class="pp-bar">
        <button type="button" data-profile="back">← <span>Back to works</span><small>ESC</small></button>
        <span class="pp-brand">About me</span>
        <span class="pp-count" aria-hidden="true">01 / 04</span>
      </header>
      <nav class="pp-chapters" aria-label="Profile sections">
        ${sections.map(([id, label], i) => `<button type="button" data-chapter="${id}"><small>0${i + 1}</small>${label}</button>`).join("")}
      </nav>
      <article class="pp-body profile-console">
        ${panel("identity", 0, p.roleEn, `
          <div class="pc-content profile-introduction">
            <h1 id="profile-title" tabindex="-1">${e(p.name)}</h1>
            <p class="pp-abstract">${e(p.tagline)}</p>
            <div class="pp-links">${links.map((link) => `<a href="${asset(link.url)}" target="_blank" rel="noopener noreferrer">${e(link.label)} <span>↗</span></a>`).join("")}</div>
          </div>`)}
        ${panel("about", 1, `${p.bio.length} notes`, `<div class="pc-content profile-bio">${p.bio.map((paragraph) => `<p>${e(paragraph)}</p>`).join("")}</div>`)}
        <figure class="profile-orb-study" aria-label="Identity particles following the selected panel">
          <div class="profile-orb-stage">
            <svg class="pc-ring" viewBox="-100 -100 200 200" aria-hidden="true">
              <circle r="96" class="pc-ring-track"/>
              ${Array.from({ length: 72 }, (_, i) => `<line class="${i % 6 ? "" : "major"}" y1="-99" y2="${i % 6 ? -96.5 : -94.5}" transform="rotate(${i * 5})"/>`).join("")}
              ${sections.map(([id], i) => `<path data-arc="${id}" d="${arc(i)}"/>`).join("")}
              <g class="pc-needle"><path d="M88 0l-6 -3.2v6.4z"/><line x1="70" x2="80"/></g>
            </svg>
            <canvas class="profile-particle-canvas" tabindex="0" role="img" aria-label="Interactive particles. In About, drag or use arrow keys to rotate the portrait; click or press Space to scatter and regroup."></canvas>
            <div class="profile-orb-labels" aria-hidden="true"></div>
          </div>
          <figcaption><span class="profile-orb-index">01 / IDENTITY</span><p class="profile-orb-caption">A mark of my own.</p><small>Click a panel · Move to interact</small></figcaption>
          <dl class="pc-readouts">${readouts.map(([label, value]) => `<div><dt>${label}</dt><dd data-count="${value}">00</dd></div>`).join("")}</dl>
        </figure>
        ${panel("skills", 2, `${tools} tools`, `<div class="pc-content profile-skills">${p.skills.map((s, index) => `<div data-skill-group="${index}"><h3>${e(s.group)}</h3><p>${s.items.length ? s.items.map(e).join(" / ") : "—"}</p></div>`).join("")}</div>`)}
        ${panel("experience", 3, `${p.experience.length} entries`, `<ol class="pc-content profile-timeline">${p.experience.map((x) => `<li${x.upcoming ? ' class="upcoming"' : ""}><span>${e(x.time)}</span><div><strong>${e(x.title)}</strong>${x.detail ? `<p>${e(x.detail)}</p>` : ""}</div></li>`).join("")}</ol>`)}
      </article>
      <div class="pp-body pc-status" aria-hidden="true">
        <span><i class="pc-light"></i>Online</span>
        <span>Section <b data-status="section">01 · Intro</b></span>
        <span>Input <b data-status="input">Standby</b></span>
        <span>Session <b data-status="uptime">00:00:00</b></span>
        <span>Local <b data-status="clock">--:--:--</b></span>
      </div>
      <footer class="profile-model-credit"><a href="${import.meta.env.BASE_URL}model-credits.html" target="_blank" rel="noopener noreferrer">3D model credits ↗</a></footer>`;
  }
}

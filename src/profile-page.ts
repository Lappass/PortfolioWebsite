import "./project-page.css";
import { escapeHtml as e } from "./html";
import { profile } from "./profile";
import { ProfileOrb, type Chapter } from "./profile-orb";
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
// Glyphs for the contact buttons, keyed by label (Devicon paths, drawn in the text colour); other labels get none.
const linkIcons: Record<string, string> = {
  github: `<path fill-rule="evenodd" d="M64 5.103c-33.347 0-60.388 27.035-60.388 60.388 0 26.682 17.303 49.317 41.297 57.303 3.017.56 4.125-1.31 4.125-2.905 0-1.44-.056-6.197-.082-11.243-16.8 3.653-20.345-7.125-20.345-7.125-2.747-6.98-6.705-8.836-6.705-8.836-5.48-3.748.413-3.67.413-3.67 6.063.425 9.257 6.223 9.257 6.223 5.386 9.23 14.127 6.562 17.573 5.02.542-3.903 2.107-6.568 3.834-8.076-13.413-1.525-27.514-6.704-27.514-29.843 0-6.593 2.36-11.98 6.223-16.21-.628-1.52-2.695-7.662.584-15.98 0 0 5.07-1.623 16.61 6.19C53.7 35 58.867 34.327 64 34.304c5.13.023 10.3.694 15.127 2.033 11.526-7.813 16.59-6.19 16.59-6.19 3.287 8.317 1.22 14.46.593 15.98 3.872 4.23 6.215 9.617 6.215 16.21 0 23.194-14.127 28.3-27.574 29.796 2.167 1.874 4.097 5.55 4.097 11.183 0 8.08-.07 14.583-.07 16.572 0 1.607 1.088 3.49 4.148 2.897 23.98-7.994 41.263-30.622 41.263-57.294C124.388 32.14 97.35 5.104 64 5.104z"/>`,
  linkedin: `<path fill-rule="evenodd" d="M116 3H12a8.9 8.9 0 0 0-9 8.8v104.42a8.9 8.9 0 0 0 9 8.78h104a8.9 8.9 0 0 0 9-8.81V11.77A8.9 8.9 0 0 0 116 3zM21.06 48.73h18.11V107H21.06zm9.06-29a10.5 10.5 0 1 1-10.5 10.49 10.5 10.5 0 0 1 10.5-10.49M50.53 48.73h17.36v8h.24c2.42-4.58 8.32-9.41 17.13-9.41C103.6 47.28 107 59.35 107 75v32H88.89V78.65c0-6.75-.12-15.44-9.41-15.44s-10.87 7.36-10.87 15V107H50.53z"/>`,
  email: `<path d="M14 30h100v68H14zM16 34l48 36 48-36" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="round"/>`,
};
const linkIcon = (label: string) => {
  const glyph = linkIcons[label.toLowerCase()];
  return glyph ? `<svg viewBox="0 0 128 128" aria-hidden="true" fill="currentColor">${glyph}</svg>` : "";
};
const arcAngle = { identity: 225, about: 135, skills: 315, experience: 45 } as const;
// Optional facts for the status bar; left empty, it shows the console's own readings instead.
const status = profile.status ?? {};
const localTime = (now: Date) => {
  try { return new Intl.DateTimeFormat("en-GB", { timeZone: status.timeZone || undefined, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now); }
  catch { return now.toTimeString().slice(0, 8); }
};
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
  private scrollQueued = false;
  private needle = 0;
  private statusTimer = 0;
  private openedAt = 0;
  // Stacked layout: the orb sticks under the header and panels scroll to just below it, so both heights are measured.
  private chrome = new ResizeObserver(() => {
    const header = this.root.querySelector<HTMLElement>(".pp-bar"), orb = this.root.querySelector<HTMLElement>(".profile-orb-study");
    if (!header || !orb) return;
    this.root.style.setProperty("--pc-header", `${header.offsetHeight}px`);
    this.root.style.setProperty("--pc-reading-top", `${header.offsetHeight + orb.offsetHeight + 8}px`);
  });
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
    this.chrome.disconnect();
    for (const node of this.root.querySelectorAll(".pp-bar, .profile-orb-study")) this.chrome.observe(node);
    clearInterval(this.statusTimer);
    this.tickStatus();
    this.statusTimer = window.setInterval(() => this.tickStatus(), 1000);
    const reduced = Boolean(options.instant) || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startOrb = () => {
      if (!this.isOpen) return;
      this.orb = new ProfileOrb(this.root.querySelector('.profile-particle-canvas')!, this.root,
        matchMedia('(prefers-reduced-motion: reduce)').matches || Boolean(options.instant && options.push !== false));
      this.orb.select(this.active);
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
    clearInterval(this.statusTimer);
    this.chrome.disconnect();
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
    for (const node of this.root.querySelectorAll<HTMLElement>("[data-section]")) node.classList.toggle("active", node.dataset.section === chapter);
    for (const node of this.root.querySelectorAll<SVGElement>("[data-arc]")) node.classList.toggle("active", node.dataset.arc === chapter);
    for (const button of this.root.querySelectorAll<HTMLElement>("[data-chapter]")) {
      if (button.dataset.chapter === chapter) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    }
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
    if (local) local.textContent = localTime(now);
  }

  private preview(chapter?: Chapter) {
    for (const node of this.root.querySelectorAll<HTMLElement | SVGElement>(".pc-panel, [data-arc]"))
      node.classList.toggle("preview", chapter !== undefined && (node.dataset.section ?? node.dataset.arc) === chapter);
  }

  /** Stacked layout: the panel under a line a third of the way down the reading area (below the sticky orb) is current;
   *  at the end of the page the last panel is, since a short one may never reach the line. */
  private readScroll() {
    const panels = [...this.root.querySelectorAll<HTMLElement>(".pc-panel")];
    const top = this.root.querySelector(".profile-orb-study")!.getBoundingClientRect().bottom, line = top + (this.root.getBoundingClientRect().bottom - top) / 3;
    const atEnd = this.root.scrollTop + this.root.clientHeight >= this.root.scrollHeight - 2;
    const current = atEnd ? panels.at(-1) : panels.filter(panel => panel.getBoundingClientRect().top <= line).at(-1) ?? panels[0];
    if (current) this.select(current.dataset.section as Chapter);
  }


  private render() {
    const p = profile;
    const links = [...p.contact, ...(p.resume ? [{ label: "Résumé", url: p.resume }] : [])];
    const tools = p.skills.reduce((sum, s) => sum + s.items.length, 0);
    const panel = (chapter: Chapter, index: number, meta: string, body: string) => `
        <section class="pc-panel" data-section="${chapter}" data-side="${index < 2 ? "left" : "right"}" style="--i:${index}" tabindex="-1" aria-labelledby="pc-${chapter}">
          <i class="pc-lead" aria-hidden="true"></i>
          <header class="pc-head"><span class="pc-light" aria-hidden="true"></span><span class="pc-index">0${index + 1}</span><h2 id="pc-${chapter}">${sections[index][1]}</h2>${meta ? `<span class="pc-meta">${e(meta)}</span>` : ""}</header>
          ${body}
        </section>`;
    this.root.innerHTML = `
      <header class="pp-bar">
        <button type="button" data-profile="back">← <span>Back to works</span><small>ESC</small></button>
        <span class="pp-brand">About me</span>
        <nav class="pp-chapters" aria-label="Profile sections">
          ${sections.map(([id, label], i) => `<button type="button" data-chapter="${id}"><small>0${i + 1}</small>${label}</button>`).join("")}
        </nav>
      </header>
      <article class="pp-body profile-console">
        ${panel("identity", 0, p.roleEn, `
          <div class="pc-content profile-introduction">
            <h1 id="profile-title" tabindex="-1">${e(p.name)}</h1>
            <div class="pc-links">${links.map((link) => `<a href="${asset(link.url)}"${link.url.startsWith("mailto:") ? "" : ' target="_blank" rel="noopener noreferrer"'}>${linkIcon(link.label)}<span>${e(link.label)}</span></a>`).join("")}</div>
          </div>`)}
        ${panel("about", 1, "", `<div class="pc-content profile-bio">${p.bio.map((paragraph) => `<p>${e(paragraph)}</p>`).join("")}</div>`)}
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
        </figure>
        ${panel("skills", 2, `${tools} tools`, `<div class="pc-content profile-skills">${p.skills.map((s, index) => `<div data-skill-group="${index}"><h3>${e(s.group)}</h3><p>${s.items.length ? s.items.map(e).join(" / ") : "—"}</p></div>`).join("")}</div>`)}
        ${panel("experience", 3, `${p.experience.length} entries`, `<ol class="pc-content profile-timeline">${p.experience.map((x) => `<li${x.upcoming ? ' class="upcoming"' : ""}><span>${e(x.time)}</span><div><strong>${e(x.title)}</strong>${x.detail ? `<p>${e(x.detail)}</p>` : ""}</div></li>`).join("")}</ol>`)}
      </article>
      <footer class="pp-body pc-status">
        <span aria-hidden="true"><i class="pc-light"></i>${e(status.availability || "Online")}</span>
        ${status.location ? `<span>Based in <b>${e(status.location)}</b></span>` : `<span aria-hidden="true">Input <b data-status="input">Standby</b></span>
        <span aria-hidden="true">Session <b data-status="uptime">00:00:00</b></span>`}
        <span aria-hidden="true">${status.timeZone ? "Local time" : "Local"} <b data-status="clock">--:--:--</b></span>
      </footer>`;
  }
}

import "./project-page.css";
import { escapeHtml as e } from "./html";
import { profile } from "./profile";
import { PageChapters } from "./page-chapters";
import { ProfileOrb } from "./profile-orb";
import { ProfileEntry } from "./profile-entry";
import { prepareIdentity } from "./profile-particles";
import "./profile-workspace.css";

const isWeb = (value: string) => /^(https?:|mailto:)/i.test(value);
const asset = (value: string) => e(isWeb(value) ? value : `${import.meta.env.BASE_URL}${value.replace(/^\//, "")}`);
export const PROFILE_HASH = "#/about";

/** Full-screen "player profile": who made the works on the shelf. */
export class ProfilePage {
  readonly root = document.createElement("div");
  private state: "closed" | "open" | "closing" = "closed";
  private timer = 0;
  private pushed = false;
  private returnFocus: HTMLElement | null = null;
  private chapters = new PageChapters(this.root);
  private orb?: ProfileOrb;
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
      if ((event.target as Element).closest("[data-profile='back']")) this.onClose();
    });
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
    this.chapters.sync();
    const reduced = Boolean(options.instant) || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startOrb = () => { if(this.isOpen) this.orb = new ProfileOrb(this.root.querySelector('.profile-orb-study canvas')!, reduced); };
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

  private render() {
    const p = profile;
    const links = [...p.contact, ...(p.resume ? [{ label: "简历", url: p.resume }] : [])];
    this.root.innerHTML = `
      <header class="pp-bar">
        <button type="button" data-profile="back">← <span>返回作品</span><small>ESC</small></button>
        <span class="pp-brand">关于我</span>
        <span class="pp-count" aria-hidden="true"></span>
      </header>
      <nav class="pp-chapters" aria-label="个人档案章节">
        ${[["identity", "介绍"], ["about", "关于"], ["skills", "技能"], ["experience", "经历"]].map(([id, label]) => `<button type="button" data-chapter="${id}">${label}</button>`).join("")}
      </nav>
      <article class="pp-body">
        <section class="profile-hero" data-section="identity" tabindex="-1" aria-label="身份">
          <div class="profile-introduction">
            <div class="pp-kicker">${e(p.role)}</div>
            <h1 id="profile-title" tabindex="-1">${e(p.name)}</h1>
            <p class="pp-abstract">${e(p.tagline)}</p>
            <div class="pp-links">${links.map((link) => `<a href="${asset(link.url)}" target="_blank" rel="noopener noreferrer">${e(link.label)} <span>↗</span></a>`).join("")}</div>
          </div>
          <figure class="profile-orb-study"><canvas aria-label="可随鼠标扰动的粒子小球"></canvas><figcaption>移动鼠标，扰动粒子</figcaption></figure>
          <div class="profile-signature"><span>向下了解更多 ↓</span></div>
        </section>
        <section class="pp-section pp-highlights" data-section="about" tabindex="-1" aria-label="关于我">
          <div class="pp-label">关于我</div>
          <div class="profile-bio">${p.bio.map((paragraph) => `<p>${e(paragraph)}</p>`).join("")}</div>
        </section>
        <section class="pp-section pp-highlights" data-section="skills" tabindex="-1" aria-label="技能">
          <div class="pp-label">技能</div>
          <div class="profile-skills">${p.skills.map(s => `<div><div><h3>${e(s.group)}</h3><p>${s.items.map(e).join(" / ")}</p></div></div>`).join("")}</div>
        </section>
        <section class="pp-section pp-highlights" data-section="experience" tabindex="-1" aria-label="经历">
          <div class="pp-label">经历</div>
          <ol>${p.experience.map((x) => `<li><span>${e(x.time)}</span><div><strong>${e(x.title)}</strong><br>${e(x.detail)}</div></li>`).join("")}</ol>
        </section>
      </article>
      <footer class="profile-model-credit"><a href="${import.meta.env.BASE_URL}model-credits.html" target="_blank" rel="noopener noreferrer">模型来源与署名 ↗</a></footer>`;
  }
}

import "./project-page.css";
import { escapeHtml as e } from "./html";
import { profile } from "./profile";

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

  constructor(private onClose: () => void) {
    this.root.className = "project-page profile-page";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-labelledby", "profile-title");
    this.root.hidden = true;
    document.body.append(this.root);
    this.root.addEventListener("click", (event) => {
      if ((event.target as Element).closest("[data-profile='back']")) this.onClose();
    });
  }

  get isOpen() { return this.state === "open"; }
  get covering() { return this.state === "open"; }

  open(options: { instant?: boolean; push?: boolean } = {}) {
    if (this.isOpen) return;
    this.render();
    if (options.push !== false && location.hash !== PROFILE_HASH) {
      history.pushState({ profile: true }, "", PROFILE_HASH);
      this.pushed = true;
    }
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    clearTimeout(this.timer);
    this.root.hidden = false;
    this.root.classList.toggle("instant", Boolean(options.instant));
    this.state = "open";
    void this.root.offsetWidth;
    this.root.classList.add("visible");
    this.root.scrollTop = 0;
    this.root.querySelector<HTMLElement>("#profile-title")?.focus({ preventScroll: true });
  }

  close(options: { syncHistory?: boolean } = {}) {
    if (!this.isOpen) return false;
    this.state = "closing";
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
    const avatar = p.avatar
      ? `<img src="${asset(p.avatar)}" alt="${e(p.name)}">`
      : `<span>${e(p.alias.slice(0, 1).toUpperCase())}</span>`;
    const links = [...p.contact, ...(p.resume ? [{ label: "简历", url: p.resume }] : [])];
    this.root.innerHTML = `
      <header class="pp-bar">
        <button type="button" data-profile="back">← <span>返回作品</span><small>ESC</small></button>
        <span class="pp-brand" aria-hidden="true">LAPPAS</span>
        <span class="pp-count">PLAYER PROFILE</span>
      </header>
      <article class="pp-body">
        <section class="profile-hero">
          <div class="profile-avatar">${avatar}</div>
          <div>
            <div class="pp-kicker"><i></i>${e(p.roleEn)} <span>·</span> ${e(p.role)}</div>
            <h1 id="profile-title" tabindex="-1">${e(p.name)}</h1>
            <div class="pp-en">${e(p.alias)}</div>
            <p class="pp-abstract">${e(p.tagline)}</p>
            <div class="pp-links">${links.map((link) => `<a href="${asset(link.url)}" target="_blank" rel="noopener noreferrer">${e(link.label)} <span>↗</span></a>`).join("")}</div>
          </div>
        </section>
        <section class="pp-section pp-highlights">
          <div class="pp-label">ABOUT / 关于我</div>
          <div class="profile-bio">${p.bio.map((paragraph) => `<p>${e(paragraph)}</p>`).join("")}</div>
        </section>
        <section class="pp-section pp-highlights">
          <div class="pp-label">SKILLS / 技能</div>
          <div class="profile-skills">${p.skills.map((s) => `<div><div class="pp-label">${e(s.group)}</div><ul class="pp-tags">${s.items.map((item) => `<li>${e(item)}</li>`).join("")}</ul></div>`).join("")}</div>
        </section>
        <section class="pp-section pp-highlights">
          <div class="pp-label">EXPERIENCE / 经历</div>
          <ol>${p.experience.map((x) => `<li><span>${e(x.time)}</span><div><strong>${e(x.title)}</strong><br>${e(x.detail)}</div></li>`).join("")}</ol>
        </section>
      </article>`;
  }
}

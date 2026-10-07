/** In-page navigation inside the scrollable archive dialogs. */
export class PageChapters {
  private queued = false;
  constructor(private root: HTMLElement) {
    root.addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLElement>("[data-chapter]");
      if (!button) return;
      const section = root.querySelector<HTMLElement>(`[data-section="${button.dataset.chapter}"]`);
      if (!section) return;
      section.scrollIntoView({ behavior: root.classList.contains("instant") || matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
      section.focus({ preventScroll: true });
    });
    root.addEventListener("scroll", () => {
      if (this.queued) return;
      this.queued = true;
      requestAnimationFrame(() => { this.queued = false; this.sync(); });
    }, { passive: true });
  }
  sync() {
    const sections = [...this.root.querySelectorAll<HTMLElement>("[data-section]")];
    const edge = this.root.getBoundingClientRect().top + 170;
    const current = sections.filter(section => section.getBoundingClientRect().top <= edge).at(-1) ?? sections[0];
    for (const button of this.root.querySelectorAll<HTMLElement>("[data-chapter]")) {
      if (button.dataset.chapter === current?.dataset.section) button.setAttribute("aria-current", "location");
      else button.removeAttribute("aria-current");
    }
  }
}

type EntryOptions = {
  root: HTMLElement;
  unlock: () => Promise<boolean>;
  cancel: () => void;
  start: (silent: boolean) => void;
};

/** Owns the entry gesture, including keyboard focus and failed audio startup. */
export class StartupGate {
  private state: "loading" | "waiting" | "starting" | "error" | "started" = "loading";
  private request = 0;
  private button: HTMLButtonElement;
  private silent: HTMLButtonElement;
  private status: HTMLElement;
  constructor(private options: EntryOptions) {
    const { root } = options;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "开机");
    root.classList.add("power-gate");
    root.insertAdjacentHTML("beforeend", '<div class="entry-controls"><button class="entry-start" disabled aria-label="开机"><svg class="power-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M16 13a15 15 0 1 0 16 0" /><path d="M24 6v17" /></svg><span>正在准备…</span></button><button class="entry-silent" hidden>关闭声音并进入</button><p class="entry-status" role="status">资源就绪后即可进入</p></div>');
    this.button = root.querySelector<HTMLButtonElement>(".entry-start")!;
    this.silent = root.querySelector<HTMLButtonElement>(".entry-silent")!;
    this.status = root.querySelector<HTMLElement>(".entry-status")!;
    root.addEventListener("click", event => {
      event.stopPropagation();
      if ((event.target as Element).closest(".entry-silent")) {
        this.request++;
        options.cancel();
        this.finish(true);
      } else if (this.state === "waiting" || this.state === "error") void this.enter();
    });
    root.addEventListener("keydown", event => {
      event.stopPropagation();
      if (event.key === "Tab") {
        const buttons = [this.button, this.silent].filter(button => !button.disabled && !button.hidden);
        if (!buttons.length) { event.preventDefault(); return; }
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();
        buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length].focus();
      }
      // Like a console's power button: any key turns it on.
      else if (event.key !== "Shift" && (this.state === "waiting" || this.state === "error") && !(event.target as Element).closest(".entry-silent")) {
        event.preventDefault();
        void this.enter();
      }
    });
  }
  get phase() { return this.state; }
  private label(text: string) { this.button.querySelector("span")!.textContent = text; }
  ready() {
    this.state = "waiting";
    this.options.root.dataset.entry = "waiting";
    this.button.disabled = false;
    this.label("按任意键开机");
    this.status.textContent = "";
    this.button.focus({ preventScroll: true });
  }
  private async enter() {
    const request = ++this.request;
    this.state = "starting";
    this.options.root.dataset.entry = "starting";
    // aria-disabled preserves keyboard focus while repeated input is ignored.
    this.button.setAttribute("aria-disabled", "true");
    this.label("正在开机…");
    this.status.textContent = "准备完成后开始播放";
    this.silent.hidden = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const unlocked = await Promise.race([
        this.options.unlock(),
        new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 20000); }),
      ]);
      if (request !== this.request) return;
      if (unlocked && !document.hidden) this.finish(false);
      else {
        this.options.cancel();
        this.state = "error";
        this.options.root.dataset.entry = "error";
        this.button.removeAttribute("aria-disabled");
        this.label("再试一次");
        this.status.textContent = "声音暂未就绪，请重试或无声进入";
      }
    } catch {
      if (request !== this.request) return;
      this.options.cancel();
      this.state = "error";
      this.options.root.dataset.entry = "error";
      this.button.removeAttribute("aria-disabled");
      this.label("再试一次");
      this.status.textContent = "声音暂未就绪，请重试或无声进入";
    } finally { clearTimeout(timer); }
  }
  private finish(silent: boolean) {
    if (this.state === "started") return;
    this.state = "started";
    this.options.start(silent);
  }
}

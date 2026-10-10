/**
 * Keyboard and gamepad input, mirrored on the desk controller and used to drive the
 * site. A connected gamepad browses with the stick or d-pad, confirms with the bottom
 * face button and goes back with the right one.
 */
export interface PadState { lx: number; ly: number; rx: number; ry: number; dx: number; dy: number; a: number; b: number; x: number; y: number; home: number }
interface PadActions {
  /** Show the state on the desk controller. */
  show(state: Partial<PadState>): void;
  step(key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"): void;
  confirm(): void;
  back(): void;
  connected(name: string): void;
  cheat(): void;
}
const CHEAT = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
const DIRECTIONS: Record<string, [number, number]> = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

export function attachPadInput(actions: PadActions) {
  // Keyboard: arrows lean the left stick and the d-pad, Enter and Escape press A and B.
  // A tap stays visible for a moment even when the key is released at once.
  const held = new Set<string>(), release = new Map<string, number>();
  const showKeys = () => {
    let x = 0, y = 0;
    for (const key of held) if (DIRECTIONS[key]) { x += DIRECTIONS[key][0]; y += DIRECTIONS[key][1]; }
    actions.show({ lx: x, ly: y, dx: x, dy: y, a: Number(held.has("Enter") || held.has(" ")), b: Number(held.has("Escape")) });
  };
  let recent: string[] = [];
  const cheatStep = (key: string) => {
    recent = [...recent, key.length === 1 ? key.toLowerCase() : key].slice(-CHEAT.length);
    if (recent.length !== CHEAT.length || !recent.every((value, index) => value === CHEAT[index])) return false;
    recent = [];
    actions.cheat();
    return true;
  };
  addEventListener("keydown", (event) => {
    if (!event.isTrusted || event.repeat) return;
    cheatStep(event.key);
    if (!DIRECTIONS[event.key] && !["Enter", " ", "Escape"].includes(event.key)) return;
    clearTimeout(release.get(event.key));
    held.add(event.key);
    showKeys();
  }, true);
  addEventListener("keyup", (event) => {
    if (!held.has(event.key)) return;
    release.set(event.key, window.setTimeout(() => { held.delete(event.key); showKeys(); }, 130));
  }, true);
  addEventListener("blur", () => { held.clear(); showKeys(); });

  // Gamepad: polled only while one is connected.
  let polling = 0;
  const pressed: Record<string, { since: number; next: number }> = {};
  const edge = (name: string, down: boolean, now: number, repeat: boolean) => {
    const state = pressed[name];
    if (!down) { delete pressed[name]; return false; }
    if (!state) { pressed[name] = { since: now, next: now + 380 }; return true; }
    if (repeat && now >= state.next) { state.next = now + 150; return true; }
    return false;
  };
  const poll = () => {
    const pad = [...navigator.getGamepads()].find((candidate) => candidate?.connected && candidate.mapping === "standard") ?? [...navigator.getGamepads()].find((candidate) => candidate?.connected);
    if (!pad) { polling = 0; actions.show({ home: 0, rx: 0, ry: 0 }); return; }
    polling = requestAnimationFrame(poll);
    const dead = (value = 0) => (Math.abs(value) < .16 ? 0 : value), button = (index: number) => pad.buttons[index]?.value ?? 0;
    const dx = button(15) - button(14), dy = button(12) - button(13);
    const lx = dead(pad.axes[0]), ly = -dead(pad.axes[1]);
    if (!held.size) actions.show({ lx, ly, dx, dy, a: button(0), b: button(1) });
    actions.show({ rx: dead(pad.axes[2]), ry: -dead(pad.axes[3]), x: button(2), y: button(3), home: 1 });
    if (document.hidden) return;
    const now = performance.now(), x = dx || (Math.abs(lx) > .6 ? Math.sign(lx) : 0), y = dy || (Math.abs(ly) > .6 ? Math.sign(ly) : 0);
    for (const [key, down] of [["ArrowUp", y > 0], ["ArrowDown", y < 0], ["ArrowLeft", x < 0], ["ArrowRight", x > 0]] as const) {
      if (edge(key, down, now, true)) { cheatStep(key); actions.step(key); }
    }
    if (edge("a", button(0) > .5, now, false) && !cheatStep("a")) actions.confirm();
    if (edge("b", button(1) > .5, now, false)) { cheatStep("b"); actions.back(); }
  };
  addEventListener("gamepadconnected", (event) => {
    actions.connected(event.gamepad.id);
    if (!polling) polling = requestAnimationFrame(poll);
  });
}

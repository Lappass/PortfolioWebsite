import "./intro.css";
import { logo } from "./brand";
import { escapeHtml as e } from "./html";
import { profile } from "./profile";
import { records, featuredFiles } from "./data";
import { CASE_SPINE, CASE_W, insertCanvas } from "./case-art";

/**
 * Console-style opening, in four beats (seconds from power-on):
 * 1. a cold blue nebula gathers and swirls at the centre;
 * 2. the two halves of the mark slide in and snap together; the snap blows the
 *    nebula apart into warm dust under a top light;
 * 3. the name settles in, then lifts away while a game case appears in the light;
 * 4. a ring around the case asks for any key; the case sinks, the dust rushes past
 *    and the archive rises underneath.
 */
const T = { gather: 0.1, slide: 0.55, snap: 1.05, symbols: 1.12, cone: 1.15, name: 1.45, role: 1.85, lift: 3.0, caseIn: 3.15, prompt: 4.1, auto: 7.2, exit: 1.7 };
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const outExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const inExpo = (x: number) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10));
const outCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const inOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const outBack = (x: number, s = 1.7) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
const inQuart = (x: number) => x * x * x * x;

interface Mote { x: number; y: number; vx: number; vy: number; r: number; depth: number; phase: number; big: boolean; orbit: number; angle: number; spin: number }
type Rect = { left: number; top: number; right: number; bottom: number };
type Cue = "seed" | "snap" | "burst" | "mark" | "exit";

const sprites = new Map<string, HTMLCanvasElement>();
function sprite(warm: boolean, soft: number) {
  const key = `${warm}|${soft}`;
  let canvas = sprites.get(key);
  if (!canvas) {
    canvas = Object.assign(document.createElement("canvas"), { width: 64, height: 64 });
    const c = canvas.getContext("2d")!;
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    const [core, mid, edge] = warm ? ["255, 236, 205", "240, 180, 110", "230, 160, 90"] : ["210, 228, 255", "90, 140, 255", "60, 100, 230"];
    g.addColorStop(0, `rgba(${core}, 1)`);
    g.addColorStop(soft, `rgba(${mid}, ${0.85 - soft * 0.5})`);
    g.addColorStop(1, `rgba(${edge}, 0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    sprites.set(key, canvas);
  }
  return canvas;
}

/** The front cover of a work, cropped from its printed insert. */
function frontCover(index: number) {
  const r = records[index];
  const full = insertCanvas(r, index + 1, 1400);
  const from = ((CASE_W + CASE_SPINE) / (CASE_W * 2 + CASE_SPINE)) * full.width;
  const front = Object.assign(document.createElement("canvas"), { width: Math.round(full.width - from), height: full.height });
  front.getContext("2d")!.drawImage(full, from, 0, front.width, front.height, 0, 0, front.width, front.height);
  return { url: front.toDataURL("image/jpeg", 0.88), record: r };
}

export class Intro {
  private root = document.createElement("div");
  private canvas = document.createElement("canvas");
  private c = this.canvas.getContext("2d")!;
  private halves: HTMLElement[] = [];
  private symbols?: SVGPathElement;
  private letters: HTMLElement[] = [];
  private head: HTMLElement;
  private roleEl: HTMLElement;
  private stage: HTMLElement;
  private box: HTMLElement;
  private ring: HTMLElement;
  private prompt: HTMLElement;
  private motes: Mote[] = [];
  private w = 0;
  private h = 0;
  private ratio = 1;
  private t0 = 0;
  private last = 0;
  private exitAt = -1;
  private raf = 0;
  private cues = new Set<Cue>();
  private pointer = { x: 0, y: 0 };
  private burstAt = -1;
  /** Where the case starts its flight on exit, in viewport pixels. */
  private from: { x: number; y: number; h: number } | null = null;

  constructor(private sound: (cue: Cue) => void, private onExitStart: () => void, private target: () => Rect | null, private onDone: () => void) {
    const name = profile.name;
    const index = featuredFiles.find((i) => i >= 0) ?? 0;
    const cover = frontCover(index);
    this.root.className = "intro";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", `${name} · ${profile.roleEn}`);
    this.root.innerHTML = `
      <div class="intro-cone"></div>
      <div class="intro-head">
        <div class="intro-mark"><div class="intro-half left">${logo}</div><div class="intro-half right">${logo}</div><div class="intro-half intro-symbols">${logo}</div></div>
        <div class="intro-name" aria-hidden="true">${[...name].map((ch) => `<span>${ch === " " ? "&nbsp;" : e(ch)}</span>`).join("")}</div>
        <div class="intro-role">${e(profile.roleEn)}</div>
      </div>
      <div class="intro-stage">
        <div class="intro-ring"></div>
        <div class="intro-box" aria-hidden="true">
          <div class="intro-face front" style="background-image:url(${cover.url})"><i class="intro-sheen"></i></div>
          <div class="intro-face spine"><span>${e(cover.record.title)}</span></div>
        </div>
      </div>
      <button class="intro-prompt" type="button"><i></i>${e(profile.boot.ready)}<small>Press any key to start</small></button>`;
    this.root.prepend(this.canvas);
    this.halves = [...this.root.querySelectorAll<HTMLElement>(".intro-half.left, .intro-half.right")];
    this.root.querySelector<HTMLElement>(".intro-symbols")!.style.opacity = "1";
    // The prompt symbols live in a third, unclipped copy that pops in after the snap.
    for (const half of this.halves) half.querySelectorAll("path")[1]?.remove();
    this.symbols = this.root.querySelectorAll<SVGPathElement>(".intro-symbols path")[1];
    this.letters = [...this.root.querySelectorAll<HTMLElement>(".intro-name span")];
    this.head = this.root.querySelector(".intro-head")!;
    this.roleEl = this.root.querySelector(".intro-role")!;
    this.stage = this.root.querySelector(".intro-stage")!;
    this.box = this.root.querySelector(".intro-box")!;
    this.ring = this.root.querySelector(".intro-ring")!;
    this.prompt = this.root.querySelector(".intro-prompt")!;
    this.root.addEventListener("pointermove", (event) => {
      this.pointer.x = event.clientX / innerWidth - 0.5;
      this.pointer.y = event.clientY / innerHeight - 0.5;
    });
    this.root.addEventListener("click", () => this.leave());
    this.onKey = this.onKey.bind(this);
  }

  private onKey(event: KeyboardEvent) {
    if (event.key === "Tab") return;
    event.preventDefault();
    event.stopPropagation();
    this.leave();
  }

  start() {
    document.body.append(this.root);
    addEventListener("keydown", this.onKey, true);
    this.resize();
    this.gather();
    this.t0 = performance.now() / 1000;
    this.prompt.focus({ preventScroll: true });
    const loop = () => { this.raf = requestAnimationFrame(loop); this.frame(); };
    loop();
  }

  /** Leave now: any key, a click, or the automatic hand-off. */
  leave() {
    if (this.exitAt >= 0) return;
    this.exitAt = this.now();
    const box = this.box.getBoundingClientRect();
    this.from = { x: box.left + box.width / 2, y: box.top + box.height / 2, h: box.height };
    if (this.burstAt < 0) this.blowApart();
    this.sound("exit");
    this.onExitStart();
  }

  private now() { return performance.now() / 1000 - this.t0; }

  private resize() {
    this.ratio = Math.min(devicePixelRatio, 2);
    this.w = innerWidth;
    this.h = innerHeight;
    this.canvas.width = this.w * this.ratio;
    this.canvas.height = this.h * this.ratio;
  }

  /** The cold nebula: motes on tilted orbits around the centre. */
  private gather() {
    const scale = Math.sqrt((this.w * this.h) / (1600 * 900));
    const count = Math.round(170 * scale * scale + 50);
    this.motes = Array.from({ length: count }, (_, i) => {
      const big = i % 11 === 0, depth = big ? 0.9 + Math.random() * 0.1 : 0.2 + Math.random() * 0.7;
      return {
        x: this.w / 2, y: this.h * 0.46, vx: 0, vy: 0, depth, big, phase: Math.random() * Math.PI * 2,
        r: (big ? 16 + Math.random() * 20 : 1.4 + Math.random() * 6.5 * depth) * (0.75 + scale * 0.25),
        orbit: (14 + 150 * Math.pow(Math.random(), 1.6)) * scale, angle: Math.random() * Math.PI * 2,
        spin: (0.6 + Math.random() * 1.2) * (Math.random() < 0.5 ? -1 : 1),
      };
    });
  }

  /** The snap: every mote leaves its orbit along its tangent and outwards. */
  private blowApart() {
    this.burstAt = this.now();
    const scale = Math.sqrt((this.w * this.h) / (1600 * 900));
    for (const m of this.motes) {
      const dx = m.x - this.w / 2, dy = m.y - this.h * 0.46, d = Math.hypot(dx, dy) || 1;
      const speed = (240 + 1500 * Math.pow(Math.random(), 1.5)) * (0.6 + m.depth * 0.6) * scale;
      m.vx = (dx / d) * speed - (dy / d) * m.spin * 120;
      m.vy = ((dy / d) * speed + (dx / d) * m.spin * 120) * 0.62;
    }
  }

  private cue(name: Cue, at: number, t: number) {
    if (t >= at && !this.cues.has(name)) { this.cues.add(name); this.sound(name); }
  }

  private frame() {
    if (innerWidth !== this.w || innerHeight !== this.h) this.resize();
    const t = this.now(), dt = Math.min(0.05, t - this.last || 0);
    this.last = t;
    const x = this.exitAt < 0 ? 0 : clamp((t - this.exitAt) / T.exit);
    this.cue("seed", T.gather, t);
    this.cue("snap", T.snap, t);
    this.cue("burst", T.snap + 0.02, t);
    this.cue("mark", T.caseIn + 0.2, t);
    if (t >= T.snap && this.burstAt < 0) this.blowApart();
    if (this.exitAt < 0 && t >= T.auto) this.leave();

    // Beat 2: the halves race in with an exponential ease and lock with a tiny overshoot.
    const slide = span(t, T.slide, T.snap);
    // outBack overshoots past 1 just before the end: the halves meet, press in, settle.
    const travel = (1 - outBack(slide, 0.8)) * innerWidth * 0.42;
    const settle = span(t, T.snap, T.snap + 0.16);
    const kick = Math.sin(settle * Math.PI) * 5 * (1 - settle);
    this.halves[0].style.transform = `translateX(${(-travel - kick).toFixed(1)}px)`;
    this.halves[1].style.transform = `translateX(${(travel + kick).toFixed(1)}px)`;
    const shown = slide > 0 ? 1 : 0;
    this.halves.forEach((half) => { half.style.opacity = String(shown); });
    // Once locked, the clip seam closes so the frame reads as one piece.
    this.root.style.setProperty("--seam", t >= T.snap + 0.05 ? "-20%" : "50%");
    const flash = t >= T.snap ? Math.exp(-(t - T.snap) * 7) : 0;
    this.root.style.setProperty("--flash", flash.toFixed(3));
    const pop = span(t, T.symbols, T.symbols + 0.4);
    if (this.symbols) {
      this.symbols.style.opacity = pop > 0 ? "1" : "0";
      this.symbols.style.transformOrigin = "162px 72px";
      this.symbols.style.transform = `scale(${(0.4 + 0.6 * outBack(pop, 2.2)).toFixed(3)})`;
    }
    this.root.style.setProperty("--cone", (0.95 * inOutCubic(span(t, T.cone, T.cone + 1.4)) * (1 - x)).toFixed(3));

    // Beat 3: the name, letter by letter from blur; the role's tracking tightens.
    this.letters.forEach((letter, i) => {
      const p = outExpo(span(t, T.name + i * 0.04, T.name + i * 0.04 + 0.65));
      letter.style.opacity = p.toFixed(3);
      letter.style.filter = `blur(${((1 - p) * 10).toFixed(2)}px)`;
      letter.style.transform = `translateY(${((1 - p) * 16).toFixed(2)}px)`;
    });
    const role = outExpo(span(t, T.role, T.role + 1));
    this.roleEl.style.opacity = role.toFixed(3);
    this.roleEl.style.letterSpacing = `${(0.42 + (1 - role) * 0.5).toFixed(3)}em`;
    // The heading lifts to the top while the case comes up in the light.
    const lift = inOutCubic(span(t, T.lift, T.lift + 1.1));
    this.head.style.transform = `translate(-50%, calc(-50% - ${(lift * 31).toFixed(2)}vh)) scale(${(1 - 0.36 * lift).toFixed(3)})`;

    // Beat 3b: the case surfaces from darkness and turns slowly in the cone.
    const rise = outCubic(span(t, T.caseIn, T.caseIn + 1.3));
    const sway = Math.sin((t - T.caseIn) * 0.7) * 6;
    // Exit: the case flies onto the selected case of the archive, matching its size,
    // and hands over to the real 3D case in the last third.
    // The case itself is the real 3D model behind this overlay; the 2D stage stays hidden.
    this.root.style.setProperty("--sheen", ((t * 0.18) % 1.6 - 0.3).toFixed(3));

    // Beat 4: a ring of light around the case asks for input.
    const ask = span(t, T.prompt, T.prompt + 0.7);
    const pulse = 0.5 + 0.5 * Math.sin((t - T.prompt) * 3.1);
    this.prompt.style.opacity = (outCubic(ask) * (1 - outExpo(x))).toFixed(3);
    this.prompt.style.transform = `translate(-50%, ${((1 - outCubic(ask)) * 10).toFixed(1)}px)`;

    // Exit: the heading dissolves upward, the overlay fades as the dust rushes past.
    this.head.style.opacity = (1 - outExpo(span(x, 0, 0.5))).toFixed(3);
    this.head.style.filter = `blur(${(8 * inQuart(x)).toFixed(2)}px)`;
    // The black backdrop clears first so the archive appears behind the flying case.
    // The black opens onto the 3D scene when the case is revealed; only the top light stays.
    this.root.style.setProperty("--backdrop", (1 - inOutCubic(span(t, T.caseIn - 0.2, T.caseIn + 1.3))).toFixed(3));
    this.root.style.opacity = (1 - inOutCubic(span(x, 0.25, 0.9))).toFixed(3);
    this.root.style.setProperty("--cone", (0.95 * inOutCubic(span(t, T.cone, T.cone + 1.4)) * (1 - inOutCubic(span(x, 0, 0.6)))).toFixed(3));
    this.drawDust(t, dt, x);
    if (x >= 1) this.finish();
  }

  private drawDust(t: number, dt: number, x: number) {
    const c = this.c, cx = this.w / 2, cy = this.h * 0.46;
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    c.globalCompositeOperation = "lighter";
    const gathered = outCubic(span(t, T.gather, T.gather + 0.9));
    // Cold to warm over 0.45 s after the snap.
    const warm = this.burstAt < 0 ? 0 : inOutCubic(span(t, this.burstAt, this.burstAt + 0.45));
    const rush = inQuart(x);
    for (const m of this.motes) {
      if (this.burstAt < 0) {
        // Orbiting, tightening slightly as the halves close in.
        m.angle += m.spin * dt * (1.2 + 1.6 * span(t, T.slide, T.snap));
        const radius = m.orbit * (0.6 + 0.4 * gathered) * (1 - 0.25 * span(t, T.slide, T.snap));
        m.x = cx + Math.cos(m.angle) * radius;
        m.y = cy + Math.sin(m.angle) * radius * 0.42;
      } else {
        const drag = Math.exp(-dt * 1.7);
        m.vx *= drag;
        m.vy = m.vy * drag - dt * 6 * m.depth;
        // On exit the dust eases outward and thins; the archive's own dust takes over.
        if (x > 0) {
          m.vx += (m.x - cx) * dt * 1.6 * m.depth;
          m.vy += (m.y - cy) * dt * 1.6 * m.depth;
        }
        m.x += m.vx * dt;
        m.y += m.vy * dt;
      }
      const twinkle = 0.55 + 0.45 * Math.sin(t * 1.4 + m.phase);
      const r = m.r * (1 + rush * 0.6 * m.depth) * (this.burstAt < 0 ? 0.7 : 1);
      const alpha = (m.big ? 0.09 : 0.25 + 0.5 * twinkle * m.depth) * gathered * (1 - inOutCubic(span(x, 0.1, 0.7)));
      const px = m.x + this.pointer.x * 18 * m.depth, py = m.y + this.pointer.y * 12 * m.depth;
      const soft = m.big ? 0.55 : 0.2;
      if (warm < 1) {
        c.globalAlpha = alpha * (1 - warm);
        c.drawImage(sprite(false, soft), px - r, py - r, r * 2, r * 2);
      }
      if (warm > 0) {
        c.globalAlpha = alpha * warm;
        c.drawImage(sprite(true, soft), px - r, py - r, r * 2, r * 2);
      }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
  }

  private finish() {
    cancelAnimationFrame(this.raf);
    removeEventListener("keydown", this.onKey, true);
    this.root.remove();
    this.onDone();
  }
}

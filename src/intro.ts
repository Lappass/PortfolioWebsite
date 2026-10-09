import "./intro.css";
import { logo } from "./brand";
import { escapeHtml as e } from "./html";
import { profile } from "./profile";

/**
 * Console-style opening: a seed of light bursts into warm dust, the mark draws
 * itself, the name settles in, then the dust rushes past into the archive.
 * Every beat has its own easing; times are in seconds from start.
 */
const T = { seed: 0.25, burst: 1.0, cone: 1.1, draw: 1.55, drawEnd: 2.75, symbols: 2.55, name: 2.7, role: 3.15, start: 3.9, auto: 6.6, exit: 1.15 };
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const outExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const inOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const outBack = (x: number) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
const inQuart = (x: number) => x * x * x * x;

interface Mote { x: number; y: number; vx: number; vy: number; r: number; depth: number; phase: number; big: boolean }

const sprites = new Map<number, HTMLCanvasElement>();
function sprite(soft: number) {
  let canvas = sprites.get(soft);
  if (!canvas) {
    canvas = Object.assign(document.createElement("canvas"), { width: 64, height: 64 });
    const c = canvas.getContext("2d")!;
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255, 236, 205, 1)");
    g.addColorStop(soft, `rgba(240, 180, 110, ${0.85 - soft * 0.5})`);
    g.addColorStop(1, "rgba(230, 160, 90, 0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    sprites.set(soft, canvas);
  }
  return canvas;
}

export class Intro {
  private root = document.createElement("div");
  private canvas = document.createElement("canvas");
  private c = this.canvas.getContext("2d")!;
  private paths: SVGPathElement[] = [];
  private letters: HTMLElement[] = [];
  private roleEl: HTMLElement;
  private startEl: HTMLElement;
  private markEl: HTMLElement;
  private motes: Mote[] = [];
  private w = 0;
  private h = 0;
  private ratio = 1;
  private t0 = 0;
  private last = 0;
  private exitAt = -1;
  private raf = 0;
  private cues = new Set<string>();
  private pointer = { x: 0, y: 0 };

  constructor(private sound: (cue: "seed" | "burst" | "mark" | "exit") => void, private onExitStart: () => void, private onDone: () => void) {
    const name = profile.name;
    this.root.className = "intro";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", `${name} · ${profile.roleEn}`);
    this.root.innerHTML = `
      <div class="intro-cone"></div>
      <div class="intro-content">
        <div class="intro-mark">${logo}</div>
        <div class="intro-name" aria-hidden="true">${[...name].map((ch) => `<span>${ch === " " ? "&nbsp;" : e(ch)}</span>`).join("")}</div>
        <div class="intro-role">${e(profile.roleEn)} <i></i> ${e(profile.role)}</div>
      </div>
      <button class="intro-start" type="button">${e(profile.boot.ready)}</button>`;
    this.root.prepend(this.canvas);
    this.markEl = this.root.querySelector(".intro-mark")!;
    this.paths = [...this.markEl.querySelectorAll<SVGPathElement>("path")];
    for (const path of this.paths) {
      path.setAttribute("pathLength", "1");
      path.style.strokeDasharray = "1 1";
      path.style.strokeDashoffset = "1";
    }
    this.letters = [...this.root.querySelectorAll<HTMLElement>(".intro-name span")];
    this.roleEl = this.root.querySelector(".intro-role")!;
    this.startEl = this.root.querySelector(".intro-start")!;
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
    this.t0 = performance.now() / 1000;
    this.startEl.focus({ preventScroll: true });
    const loop = () => { this.raf = requestAnimationFrame(loop); this.frame(); };
    loop();
  }

  /** Leave now (click, key, or the automatic hand-off). */
  leave() {
    if (this.exitAt >= 0) return;
    this.exitAt = this.now();
    // Make sure the dust exists even if the visitor skipped the burst.
    if (!this.motes.length) this.burst();
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

  private burst() {
    const scale = Math.sqrt((this.w * this.h) / (1600 * 900));
    const count = Math.round(170 * scale * scale + 50);
    this.motes = Array.from({ length: count }, (_, i) => {
      const big = i % 11 === 0, depth = big ? 0.9 + Math.random() * 0.1 : 0.2 + Math.random() * 0.7;
      // Log-distributed speeds: most dust stays near, a few streaks fly wide.
      const angle = Math.random() * Math.PI * 2, speed = (240 + 1500 * Math.pow(Math.random(), 1.5)) * (0.6 + depth * 0.6) * scale;
      return {
        x: this.w / 2, y: this.h * 0.46, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * 0.62,
        r: (big ? 16 + Math.random() * 20 : 1.4 + Math.random() * 6.5 * depth) * (0.75 + scale * 0.25),
        depth, phase: Math.random() * Math.PI * 2, big,
      };
    });
  }

  private cue(name: "seed" | "burst" | "mark", at: number, t: number) {
    if (t >= at && !this.cues.has(name)) { this.cues.add(name); this.sound(name); }
  }

  private frame() {
    if (innerWidth !== this.w || innerHeight !== this.h) this.resize();
    const t = this.now(), dt = Math.min(0.05, t - this.last || 0);
    this.last = t;
    const x = this.exitAt < 0 ? 0 : clamp((t - this.exitAt) / T.exit);
    this.cue("seed", T.seed, t);
    this.cue("burst", T.burst, t);
    this.cue("mark", T.draw + 0.15, t);
    if (t >= T.burst && !this.motes.length) this.burst();
    if (this.exitAt < 0 && t >= T.auto) this.leave();

    // Light cone from the upper left, rising after the burst.
    this.root.style.setProperty("--cone", (0.9 * inOutCubic(span(t, T.cone, T.cone + 1.6)) * (1 - x)).toFixed(3));
    // The mark draws along its own contour; the prompt symbols pop in after.
    const draw = inOutCubic(span(t, T.draw, T.drawEnd));
    if (this.paths[0]) this.paths[0].style.strokeDashoffset = String(1 - draw);
    const pop = span(t, T.symbols, T.symbols + 0.35);
    if (this.paths[1]) {
      this.paths[1].style.strokeDashoffset = String(1 - outExpo(pop));
      this.paths[1].style.opacity = String(pop > 0 ? 1 : 0);
    }
    this.markEl.style.transform = `translateY(${(1 - outExpo(span(t, T.draw - 0.2, T.drawEnd))) * 14}px) scale(${0.96 + 0.04 * outBack(span(t, T.symbols, T.symbols + 0.5))})`;
    // Name: each letter from blur and a slight drop, staggered left to right.
    this.letters.forEach((letter, i) => {
      const p = outExpo(span(t, T.name + i * 0.045, T.name + i * 0.045 + 0.7));
      letter.style.opacity = p.toFixed(3);
      letter.style.filter = `blur(${((1 - p) * 10).toFixed(2)}px)`;
      letter.style.transform = `translateY(${((1 - p) * 18).toFixed(2)}px)`;
    });
    // Role: tracking tightens as it fades in.
    const role = outExpo(span(t, T.role, T.role + 1.1));
    this.roleEl.style.opacity = role.toFixed(3);
    this.roleEl.style.letterSpacing = `${(0.42 + (1 - role) * 0.5).toFixed(3)}em`;
    const ready = span(t, T.start, T.start + 0.8);
    this.startEl.style.opacity = (ready * (0.55 + 0.45 * Math.sin((t - T.start) * 2.6)) * (1 - x)).toFixed(3);
    // Exit: the content lifts away, the dust rushes outwards past the viewer.
    const away = inQuart(x);
    const content = this.root.querySelector<HTMLElement>(".intro-content")!;
    content.style.opacity = (1 - outExpo(span(x, 0, 0.55))).toFixed(3);
    content.style.transform = `translateY(${-30 * outExpo(x)}px) scale(${1 + 0.06 * x})`;
    content.style.filter = `blur(${(8 * away).toFixed(2)}px)`;
    this.root.style.opacity = (1 - inOutCubic(span(x, 0.35, 1))).toFixed(3);
    this.drawDust(t, dt, x);
    if (x >= 1) this.finish();
  }

  private drawDust(t: number, dt: number, x: number) {
    const c = this.c;
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    c.globalCompositeOperation = "lighter";
    // The seed: a point that swells before it bursts.
    const seed = outExpo(span(t, T.seed, T.burst)) * (1 - span(t, T.burst, T.burst + 0.25));
    if (seed > 0) {
      const r = 3 + 26 * seed + Math.sin(t * 9) * 1.5 * seed;
      c.globalAlpha = 0.9 * seed;
      c.drawImage(sprite(0.15), this.w / 2 - r, this.h * 0.46 - r, r * 2, r * 2);
    }
    // A thin shock ring at the burst.
    const ring = span(t, T.burst, T.burst + 1.1);
    if (ring > 0 && ring < 1) {
      c.globalAlpha = 0.5 * (1 - ring) ** 2;
      c.strokeStyle = "rgba(255, 220, 180, 1)";
      c.lineWidth = 1.5;
      c.beginPath();
      c.ellipse(this.w / 2, this.h * 0.46, outExpo(ring) * this.w * 0.42, outExpo(ring) * this.w * 0.26, 0, 0, Math.PI * 2);
      c.stroke();
    }
    const cx = this.w / 2, cy = this.h * 0.46;
    const rush = inQuart(x);
    for (const m of this.motes) {
      // Burst velocity decays into a slow upward drift.
      const drag = Math.exp(-dt * 1.7);
      m.vx *= drag;
      m.vy = m.vy * drag - dt * 6 * m.depth;
      // On exit, every mote accelerates away from the centre, nearer ones faster.
      if (x > 0) {
        m.vx += (m.x - cx) * dt * 26 * (0.15 + rush) * m.depth;
        m.vy += (m.y - cy) * dt * 26 * (0.15 + rush) * m.depth;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const twinkle = 0.55 + 0.45 * Math.sin(t * 1.4 + m.phase);
      const fresh = outExpo(span(t, T.burst, T.burst + 0.4));
      const grow = 1 + rush * 2.2 * m.depth;
      const r = m.r * grow;
      c.globalAlpha = (m.big ? 0.09 : 0.25 + 0.5 * twinkle * m.depth) * fresh;
      const px = m.x + this.pointer.x * 18 * m.depth, py = m.y + this.pointer.y * 12 * m.depth;
      c.drawImage(sprite(m.big ? 0.55 : 0.2), px - r, py - r, r * 2, r * 2);
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

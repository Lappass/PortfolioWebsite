/** Warm bokeh dust above the archive; it parts around the pointer. */
interface Mote { x: number; y: number; ox: number; oy: number; vx: number; vy: number; r: number; depth: number; phase: number; hue: number; glow: boolean }

const sprites = new Map<string, HTMLCanvasElement>();
/** One pre-rendered soft disc per tint, so each mote is a single drawImage. */
function sprite(hue: number, soft: number) {
  const key = `${hue}|${soft}`;
  let canvas = sprites.get(key);
  if (!canvas) {
    canvas = Object.assign(document.createElement("canvas"), { width: 64, height: 64 });
    const c = canvas.getContext("2d")!;
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, `hsla(${hue}, 85%, 82%, 1)`);
    g.addColorStop(soft, `hsla(${hue}, 80%, 66%, ${0.85 - soft * 0.5})`);
    g.addColorStop(1, `hsla(${hue}, 75%, 55%, 0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    sprites.set(key, canvas);
  }
  return canvas;
}

export class ParticleField {
  readonly canvas = document.createElement("canvas");
  private context = this.canvas.getContext("2d")!;
  private motes: Mote[] = [];
  private pointer = { x: -1e4, y: -1e4 };
  private width = 0;
  private height = 0;
  private ratio = 1;
  private last = 0;
  private opacity = 0;

  constructor(host: HTMLElement) {
    this.canvas.className = "particle-field";
    this.canvas.setAttribute("aria-hidden", "true");
    host.append(this.canvas);
    window.addEventListener("pointermove", (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = (event.clientX - rect.left) * (this.width / Math.max(1, rect.width));
      this.pointer.y = (event.clientY - rect.top) * (this.height / Math.max(1, rect.height));
    }, { passive: true });
    window.addEventListener("pointerleave", () => { this.pointer.x = this.pointer.y = -1e4; });
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio, 2);
    if (Math.round(rect.width) === this.width && Math.round(rect.height) === this.height && ratio === this.ratio) return;
    this.width = Math.round(rect.width);
    this.height = Math.round(rect.height);
    this.ratio = ratio;
    this.canvas.width = Math.max(1, this.width * ratio);
    this.canvas.height = Math.max(1, this.height * ratio);
    const scale = Math.sqrt((this.width * this.height) / (1600 * 900));
    const count = Math.round(Math.min(520, 420 * scale * scale + 90));
    this.motes = Array.from({ length: count }, (_, i) => {
      // A few large out-of-focus discs in front, many small sharp points behind.
      const near = i % 7 === 0, depth = near ? 0.85 + Math.random() * 0.15 : 0.25 + Math.random() * 0.6;
      // Dust gathers in the lower and middle bands, thinning towards the top.
      const x = Math.random() * this.width, y = this.height * (0.12 + 0.88 * Math.pow(Math.random(), 0.65));
      return {
        x, y, ox: x, oy: y, vx: 0, vy: 0, depth, phase: Math.random() * Math.PI * 2,
        r: (near ? 14 + Math.random() * 24 : 2 + Math.random() * 9 * depth) * (0.7 + scale * 0.3),
        hue: 30 + Math.random() * 18, glow: !near && Math.random() < 0.18,
      };
    });
  }

  /** `visible` fades the layer. Light themes get a dark, faint dust instead. */
  update(timeMs: number, visible: boolean, reduced: boolean, dark: boolean) {
    const dt = Math.min(0.05, this.last ? (timeMs - this.last) / 1000 : 0);
    this.last = timeMs;
    this.opacity += ((visible && !reduced ? 1 : 0) - this.opacity) * Math.min(1, dt * 4);
    this.canvas.style.opacity = this.opacity.toFixed(3);
    if (this.opacity < 0.01) return;
    this.resize();
    const c = this.context, t = timeMs / 1000;
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    c.clearRect(0, 0, this.width, this.height);
    c.globalCompositeOperation = dark ? "lighter" : "source-over";
    const reach = 150;
    for (const m of this.motes) {
      m.oy -= dt * 7 * m.depth;
      m.ox += Math.sin(t * 0.25 + m.phase) * dt * 5 * m.depth;
      if (m.oy < -40) { m.oy += this.height + 80; m.y = m.oy; }
      if (m.ox < -40) m.ox += this.width + 80;
      if (m.ox > this.width + 40) m.ox -= this.width + 80;
      const dx = m.x - this.pointer.x, dy = m.y - this.pointer.y, d = Math.hypot(dx, dy);
      if (d < reach && d > 0.01) {
        const push = (1 - d / reach) ** 2 * 800 * m.depth;
        m.vx += (dx / d) * push * dt;
        m.vy += (dy / d) * push * dt;
      }
      m.vx += (m.ox - m.x) * 5 * dt;
      m.vy += (m.oy - m.y) * 5 * dt;
      m.vx *= Math.exp(-dt * 4.5);
      m.vy *= Math.exp(-dt * 4.5);
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const twinkle = 0.5 + 0.5 * Math.sin(t * (m.glow ? 1.8 : 0.9) + m.phase);
      const big = m.r > 12;
      // Big discs stay faint and soft; small points flicker brighter.
      c.globalAlpha = (big ? 0.1 + 0.07 * twinkle : (m.glow ? 0.7 + 0.3 * twinkle : 0.3 + 0.45 * twinkle * m.depth)) * (dark ? 1 : 0.55);
      const tint = dark ? m.hue : 28;
      c.drawImage(sprite(tint, big ? 0.55 : 0.2), m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
  }
}

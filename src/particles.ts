/** Floating dust above the archive that parts around the pointer. */
interface Mote { x: number; y: number; ox: number; oy: number; vx: number; vy: number; r: number; depth: number; phase: number }

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
    const count = Math.round(Math.min(160, (this.width * this.height) / 9000));
    this.motes = Array.from({ length: count }, () => {
      const x = Math.random() * this.width, y = Math.random() * this.height, depth = 0.35 + Math.random() * 0.65;
      return { x, y, ox: x, oy: y, vx: 0, vy: 0, r: 0.6 + depth * 1.6, depth, phase: Math.random() * Math.PI * 2 };
    });
  }

  /** `visible` fades the layer; `color` is "r, g, b" from the current theme. */
  update(timeMs: number, visible: boolean, reduced: boolean, color: string) {
    const dt = Math.min(0.05, this.last ? (timeMs - this.last) / 1000 : 0);
    this.last = timeMs;
    this.opacity += ((visible && !reduced ? 1 : 0) - this.opacity) * Math.min(1, dt * 4);
    this.canvas.style.opacity = this.opacity.toFixed(3);
    if (this.opacity < 0.01) return;
    this.resize();
    const c = this.context, t = timeMs / 1000;
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    c.clearRect(0, 0, this.width, this.height);
    const reach = 140;
    for (const m of this.motes) {
      // Slow upward drift with a lateral sway; nearer motes move faster.
      m.oy -= dt * 9 * m.depth;
      m.ox += Math.sin(t * 0.3 + m.phase) * dt * 4 * m.depth;
      if (m.oy < -10) { m.oy += this.height + 20; m.y = m.oy; }
      if (m.ox < -10) m.ox += this.width + 20;
      if (m.ox > this.width + 10) m.ox -= this.width + 20;
      const dx = m.x - this.pointer.x, dy = m.y - this.pointer.y, d = Math.hypot(dx, dy);
      if (d < reach && d > 0.01) {
        const push = (1 - d / reach) ** 2 * 900 * m.depth;
        m.vx += (dx / d) * push * dt;
        m.vy += (dy / d) * push * dt;
      }
      // Spring back to the drifting rest point.
      m.vx += (m.ox - m.x) * 6 * dt;
      m.vy += (m.oy - m.y) * 6 * dt;
      m.vx *= Math.exp(-dt * 5);
      m.vy *= Math.exp(-dt * 5);
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const twinkle = 0.45 + 0.35 * Math.sin(t * 1.3 + m.phase);
      c.fillStyle = `rgba(${color}, ${(twinkle * m.depth * 0.7).toFixed(3)})`;
      c.beginPath();
      c.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      c.fill();
    }
  }
}

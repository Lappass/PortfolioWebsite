/** Particle sphere settles into the creator's name. */
import { drawIdentity, particleEase, prepareIdentity } from './profile-particles';
export class ProfileOrb {
  private frame = 0;
  private observer: ResizeObserver;
  private intersection: IntersectionObserver;
  private inView = true;
  private disposed = false;
  private pointer: { x: number; y: number } | null = null;
  private started = performance.now();
  private width = 0;
  private height = 0;
  constructor(private canvas: HTMLCanvasElement, private reduced: boolean, name: string) {
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas);
    this.intersection = new IntersectionObserver(entries => {
      this.inView = entries[0].isIntersecting; cancelAnimationFrame(this.frame);
      if (this.inView && !document.hidden) this.tick();
    });
    this.intersection.observe(canvas);
    document.addEventListener('visibilitychange', this.visibility);
    canvas.addEventListener('pointermove', this.move); canvas.addEventListener('pointerleave', this.leave);
    void prepareIdentity(name).then(() => { if (!this.disposed) this.resize(); });
    this.resize();
  }
  private move = (e: PointerEvent) => { const r = this.canvas.getBoundingClientRect(); this.pointer = { x: e.clientX-r.left, y: e.clientY-r.top }; };
  private leave = () => { this.pointer = null; };
  private visibility = () => { cancelAnimationFrame(this.frame); if (!document.hidden && this.inView) this.tick(); };
  private resize() {
    const r = this.canvas.getBoundingClientRect(); this.width = r.width; this.height = r.height;
    const dpr = Math.min(devicePixelRatio, 2); this.canvas.width = Math.round(r.width*dpr); this.canvas.height = Math.round(r.height*dpr);
    cancelAnimationFrame(this.frame); this.tick();
  }
  private tick = () => {
    if (this.disposed) return;
    const c = this.canvas.getContext('2d')!, w = this.width, h = this.height;
    const t = this.reduced ? 0 : (performance.now()-this.started)/1000 % 18;
    const morph = t < 12 ? 1-particleEase(10,12,t) : particleEase(15,18,t);
    const style = getComputedStyle(this.canvas), dpr = Math.min(devicePixelRatio,2);
    c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,w,h);
    drawIdentity(c, { x:w/2, y:h/2, size:Math.min(w*.94,h*.98), morph,
      angle:t*.15, ink:style.color, accent:style.getPropertyValue('--pp-accent').trim() || '#9b7247', pointer:this.reduced ? null : this.pointer });
    if (!this.reduced && this.inView && !document.hidden) this.frame = requestAnimationFrame(this.tick);
  };
  dispose() { this.disposed=true; cancelAnimationFrame(this.frame);this.observer.disconnect();this.intersection.disconnect();document.removeEventListener('visibilitychange',this.visibility);this.canvas.removeEventListener('pointermove',this.move);this.canvas.removeEventListener('pointerleave',this.leave); }
}

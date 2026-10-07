/** Native canvas study inspired by the user's supplied particle morph example. */
export class ProfileOrb {
  private frame = 0;
  private observer: ResizeObserver;
  private intersection: IntersectionObserver;
  private inView = true;
  private pointer: { x: number; y: number } | null = null;
  private started = performance.now();
  private points = Array.from({ length: 720 }, (_, i) => ({ x: 0, y: 0, phase: i * 2.399963 }));
  private texts: { x: number; y: number }[][] = [];
  private width = 0;
  private height = 0;
  constructor(private canvas: HTMLCanvasElement, private reduced: boolean, private name: string) {
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.intersection = new IntersectionObserver(entries => {
      this.inView = entries[0].isIntersecting;
      cancelAnimationFrame(this.frame);
      if (this.inView && !document.hidden) this.tick();
    });
    this.intersection.observe(canvas);
    document.addEventListener('visibilitychange', this.visibility);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerleave', this.leave);
    this.resize();
  }
  private move = (e: PointerEvent) => { const r = this.canvas.getBoundingClientRect(); this.pointer = { x: e.clientX-r.left, y: e.clientY-r.top }; };
  private leave = () => { this.pointer = null; };
  private visibility = () => { cancelAnimationFrame(this.frame); if (!document.hidden && this.inView) this.tick(); };
  private resize() {
    const r = this.canvas.getBoundingClientRect();
    this.width=r.width; this.height=r.height;
    const dpr=Math.min(devicePixelRatio, 2);
    this.canvas.width=Math.round(r.width*dpr); this.canvas.height=Math.round(r.height*dpr);
    this.texts=['HELLO',this.name.toUpperCase()].map(text => {
      const mask=document.createElement('canvas'); mask.width=400; mask.height=180;
      const c=mask.getContext('2d')!; c.font=`700 ${text.length>7?43:72}px system-ui`; c.textAlign='center'; c.textBaseline='middle'; c.fillText(text,200,90);
      const pixels=c.getImageData(0,0,400,180).data, pts=[];
      for(let y=0;y<180;y+=3) for(let x=0;x<400;x+=3) if(pixels[(y*400+x)*4+3]>100) pts.push({x:(x-200)/400,y:(y-90)/400});
      return pts;
    });
    this.points.forEach(p=>{p.x=r.width/2;p.y=r.height/2;});
    cancelAnimationFrame(this.frame); this.tick();
  }
  private tick = () => {
    const c=this.canvas.getContext('2d')!, w=this.width,h=this.height;
    const t=this.reduced?0:(performance.now()-this.started)/1000;
    const cycle=Math.floor(t/6)%4, phase=t%6;
    const scatter=!this.reduced && phase>4.5?Math.sin((phase-4.5)/1.5*Math.PI):0;
    const style=getComputedStyle(this.canvas), ink=style.color, accent=style.getPropertyValue('--pp-accent').trim()||'#b79a63';
    const dpr=Math.min(devicePixelRatio,2); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,w,h);
    const radius=Math.min(w*.36,h*.36), follow=this.reduced?1:.065;
    for(let i=0;i<this.points.length;i++) {
      const p=this.points[i], z=1-2*(i+.5)/this.points.length, a=p.phase+t*.18;
      const r=Math.sqrt(1-z*z), depth=r*Math.sin(a), perspective=1/(1-depth*.18);
      let x=r*Math.cos(a)*radius*perspective,y=z*radius*perspective;
      if(cycle===1) {x=Math.cos(p.phase+t*.15)*radius;y=Math.sin(p.phase+t*.15)*radius*.52+z*radius*.12;}
      if(cycle>=2) {const pts=this.texts[cycle-2],pt=pts[i%pts.length];x=pt.x*w*.92;y=pt.y*w*.92;}
      x+=w/2+Math.cos(p.phase)*scatter*radius*.8; y+=h/2+Math.sin(p.phase)*scatter*radius*.8;
      if(this.pointer&&!this.reduced) {const dx=x-this.pointer.x,dy=y-this.pointer.y,d=Math.hypot(dx,dy);if(d<64&&d>0){x+=dx/d*(64-d)*.6;y+=dy/d*(64-d)*.6;}}
      p.x+=(x-p.x)*follow; p.y+=(y-p.y)*follow;
      c.globalAlpha=.3+(depth+1)*.3; c.fillStyle=i%7===0?accent:ink;
      c.beginPath();c.arc(p.x,p.y,depth>0?1.35:.85,0,Math.PI*2);c.fill();
    }
    c.globalAlpha=1;
    if(!this.reduced && this.inView && !document.hidden) this.frame=requestAnimationFrame(this.tick);
  };
  dispose() {cancelAnimationFrame(this.frame);this.observer.disconnect();this.intersection.disconnect();document.removeEventListener('visibilitychange',this.visibility);this.canvas.removeEventListener('pointermove',this.move);this.canvas.removeEventListener('pointerleave',this.leave);}
}

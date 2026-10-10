import { drawIdentity, particleEase } from './profile-particles';
type ScreenRect = { left:number; right:number; top:number; bottom:number };
/** Continue the physical display's particle field, then settle into the page. */
export class ProfileEntry {
  private canvas = document.createElement('canvas');
  private frame = 0;
  private started = performance.now();
  private resize = () => {
    const dpr = Math.min(devicePixelRatio,2);
    this.canvas.width = Math.round(innerWidth*dpr); this.canvas.height = Math.round(innerHeight*dpr);
  };
  constructor(private root:HTMLElement, private from:ScreenRect|null, private complete:()=>void) {
    this.canvas.className = 'profile-entry-field'; this.canvas.setAttribute('aria-hidden','true');
    root.append(this.canvas);root.classList.add('entering');this.resize();
    window.addEventListener('resize',this.resize); this.tick();
  }
  private tick = () => {
    const t = (performance.now()-this.started)/1000;
    const target = this.root.querySelector<HTMLCanvasElement>('.profile-particle-canvas')!;
    const rect = target.getBoundingClientRect(), w = innerWidth, h = innerHeight;
    const move = particleEase(.6,2.65,t), reveal = particleEase(1.85,2.65,t);
    const source = this.from || {left:0,right:w,top:0,bottom:h};
    const sourceHeight = source.bottom-source.top;
    const initialX = (source.left+source.right)/2, initialY = source.top+sourceHeight*.46;
    const x = initialX+(rect.left+rect.width/2-initialX)*move;
    const y = initialY+(rect.top+rect.height/2-initialY)*move;
    const size = Math.min(sourceHeight*.8,w*.8)*(1-move)+Math.min(rect.width*.96,rect.height*.96)*move;
    const c=this.canvas.getContext('2d')!,dpr=Math.min(devicePixelRatio,2);
    c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
    c.fillStyle=`rgba(7,9,12,${1-reveal})`;c.fillRect(0,0,w,h);
    const ink = getComputedStyle(target).color;
    // Match the final page's ink in either theme as the paper fades in.
    const match = ink.match(/[\d.]+/g), rgb = match?.slice(0,3).map(Number) || [8,10,8];
    const color = `rgb(${[232,228,220].map((v,i)=>Math.round(v+(rgb[i]-v)*reveal)).join(',')})`;
    // The physical sphere travels into the reading field and resolves into the brand.
    const morph = particleEase(.6,2.65,t);
    drawIdentity(c,{x,y,size,morph,shape:'logo',ink:color,accent:color});
    this.root.style.setProperty('--profile-reveal',String(reveal));
    this.root.style.setProperty('--profile-heading',String(reveal));
    if(t<2.68)this.frame=requestAnimationFrame(this.tick);
    else { this.dispose();this.complete(); }
  };
  dispose() {
    cancelAnimationFrame(this.frame);window.removeEventListener('resize',this.resize);this.canvas.remove();
    this.root.classList.remove('entering');this.root.style.removeProperty('--profile-reveal');this.root.style.removeProperty('--profile-heading');
  }
}

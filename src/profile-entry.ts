/** One continuous particle field becomes the real profile heading. */
export class ProfileEntry {
  private canvas = document.createElement('canvas');
  private frame = 0;
  private started = performance.now();
  private sampleKey = '';
  private samples: {x:number;y:number}[] = [];
  private resize = () => {
    const dpr = Math.min(devicePixelRatio, 2);
    this.canvas.width = Math.round(innerWidth * dpr);
    this.canvas.height = Math.round(innerHeight * dpr);
  };
  constructor(private root: HTMLElement, private complete: () => void) {
    this.canvas.className = 'profile-entry-field';
    this.canvas.setAttribute('aria-hidden', 'true');
    root.append(this.canvas);
    root.classList.add('entering');
    this.resize();
    window.addEventListener('resize', this.resize);
    this.tick();
  }
  private smooth(a: number, b: number, t: number) { const p=Math.max(0,Math.min(1,(t-a)/(b-a))); return p*p*(3-2*p); }
  private tick = () => {
    const t=(performance.now()-this.started)/1000;
    const heading=this.root.querySelector<HTMLElement>('#profile-title')!;
    const rect=heading.getBoundingClientRect(), style=getComputedStyle(heading);
    const w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio,2);
    const c=this.canvas.getContext('2d')!;
    c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,w,h);
    // Sample the actual heading, preserving its font, case and line wrapping.
    const key=`${rect.width}|${rect.height}|${style.fontWeight}|${style.fontSize}|${style.fontFamily}|${heading.textContent}`;
    if(key!==this.sampleKey) {
    this.sampleKey=key;
    const mask=document.createElement('canvas');
    mask.width=Math.ceil(rect.width); mask.height=Math.ceil(rect.height);
    const m=mask.getContext('2d')!; m.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    m.letterSpacing=style.letterSpacing;
    m.textBaseline='middle';
    const words=(heading.textContent||'').split(' '), lines: string[]=[];
    let line='';
    for(const word of words) { const next=line?line+' '+word:word; if(line&&m.measureText(next).width>rect.width){lines.push(line);line=word;}else line=next; }
    lines.push(line);
    const lineHeight=parseFloat(style.lineHeight);
    lines.forEach((text,i)=>m.fillText(text,0,lineHeight*(i+.5)));
    const pixels=m.getImageData(0,0,mask.width,mask.height).data, pts: {x:number;y:number}[]=[];
    for(let y=0;y<mask.height;y+=3)for(let x=0;x<mask.width;x+=3)if(pixels[(y*mask.width+x)*4+3]>100)pts.push({x,y});
    this.samples=pts;
    }
    const pts=this.samples;
    const morph=this.smooth(.3,.68,t), move=this.smooth(.95,1.32,t);
    const scale=Math.min(1,w*.82/rect.width);
    const cx=w/2+(rect.left+rect.width/2-w/2)*move;
    const cy=h/2+(rect.top+rect.height/2-h/2)*move;
    const textScale=scale+(1-scale)*move;
    const radius=Math.min(w,h)*.18;
    const alpha=1-this.smooth(1.15,1.48,t);
    const accent=getComputedStyle(this.root).getPropertyValue('--pp-accent').trim();
    const count=Math.min(1800,Math.max(720,pts.length));
    for(let i=0;i<count;i++) {
      const z=1-2*(i+.5)/count,a=i*2.399963+t*.45,r=Math.sqrt(1-z*z);
      const sphereX=w/2+Math.cos(a)*r*radius,sphereY=h/2+z*radius;
      const point=pts[Math.floor(i/count*pts.length)];
      if(!point)continue;
      const textX=cx+(point.x-rect.width/2)*textScale,textY=cy+(point.y-rect.height/2)*textScale;
      const burst=Math.sin(morph*Math.PI)*radius*.32;
      const x=sphereX+(textX-sphereX)*morph+Math.cos(a)*burst;
      const y=sphereY+(textY-sphereY)*morph+Math.sin(a)*burst;
      c.globalAlpha=alpha*(.55+.45*morph); c.fillStyle=i%11===0&&morph<.9?accent:style.color;
      c.fillRect(x,y,1.7,1.7);
    }
    c.globalAlpha=1;
    this.root.style.setProperty('--profile-reveal',String(this.smooth(.95,1.45,t)));
    this.root.style.setProperty('--profile-heading',String(this.smooth(1.15,1.48,t)));
    if(t>=1.5){this.dispose();this.complete();}else this.frame=requestAnimationFrame(this.tick);
  };
  dispose() {cancelAnimationFrame(this.frame);window.removeEventListener('resize',this.resize);this.canvas.remove();this.root.classList.remove('entering');this.root.style.removeProperty('--profile-reveal');this.root.style.removeProperty('--profile-heading');}
}

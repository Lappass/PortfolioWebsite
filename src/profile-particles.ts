import { MARK_PATH } from './brand';
/** Shared deterministic particle field for the physical screen and profile. */
export const PARTICLE_COUNT = 3600;
export const particleEase = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
type Target = { x: number; y: number; strength: number };
let lettering: Target[] = [];
let preparedName = '';
const logoTargets: Target[] = [];

function prepareLogo() {
  if (logoTargets.length) return;
  const mask = document.createElement('canvas');
  mask.width = 210; mask.height = 330;
  const c = mask.getContext('2d')!;
  c.scale(.25, .25);
  c.fill(new Path2D(MARK_PATH), 'evenodd');
  const pixels = c.getImageData(0, 0, 210, 330).data;
  for (let y = 0; y < 330; y += 2) for (let x = 0; x < 210; x += 2) {
    if (pixels[(y * 210 + x) * 4 + 3] > 100)
      logoTargets.push({ x: (x - 105) / 420, y: (y - 165) / 420, strength: .85 });
  }
}

export function prepareIdentity(name: string): Promise<void> {
  prepareLogo();
  if (preparedName === name) return Promise.resolve();
  preparedName = name; lettering = [];
  const mask = document.createElement('canvas'); mask.width = 600; mask.height = 100;
  const c = mask.getContext('2d')!;
  c.font = '600 70px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(name, 300, 50, 570);
  const text = c.getImageData(0, 0, 600, 100).data;
  for (let y = 0; y < 100; y += 2) for (let x = 0; x < 600; x += 2) {
    if (text[(y * 600 + x) * 4 + 3] > 100) lettering.push({ x: (x - 300) / 650, y: (y - 50) / 650, strength: .95 });
  }
  return Promise.resolve();
}

/** The same sampled brand path is used by the screen entrance and reading field. */
export function logoTarget(i: number): Target {
  prepareLogo();
  return logoTargets[(i * 197) % logoTargets.length] ?? { x: 0, y: 0, strength: 0 };
}

export function identityTarget(i: number) {
  if (!lettering.length) return { x:0, y:0, strength:0 };
  return lettering[(i * 197) % lettering.length];
}

export function spherePoint(i: number, angle = 0, count = PARTICLE_COUNT) {
  const z = 1 - 2 * (i + .5) / count;
  const a = i * 2.399963 + angle, r = Math.sqrt(1 - z * z);
  const depth = r * Math.sin(a), perspective = 1 / (1 - depth * .18);
  return { x:r * Math.cos(a) * perspective, y:z * perspective, depth };
}

export function drawIdentity(c: CanvasRenderingContext2D, options: {
  x:number; y:number; size:number; morph:number; angle?:number;
  shape?:'name'|'logo'; ink?:string; accent?:string; pointer?:{ x:number; y:number } | null;
}) {
  const { x,y,size,morph,angle=0,ink='#e8e4dc',accent='#c9aa7a',pointer,shape='name' } = options;
  const opacity = c.globalAlpha;
  for (let i=0; i<PARTICLE_COUNT; i++) {
    const sphere=spherePoint(i,angle), target=shape === 'logo' ? logoTarget(i) : identityTarget(i);
    const amount=particleEase(0,1,morph);
    let px=x+(sphere.x*.30*(1-amount)+target.x*amount)*size;
    let py=y+(sphere.y*.30*(1-amount)+target.y*amount)*size;
    if(pointer) {
      const dx=px-pointer.x,dy=py-pointer.y,distance=Math.hypot(dx,dy);
      if(distance>0 && distance<45) { const push=(45-distance)*.45;px+=dx/distance*push;py+=dy/distance*push; }
    }
    c.globalAlpha=opacity*((.20+(sphere.depth+1)*.26)*(1-amount)+target.strength*amount);
    c.fillStyle=i%13===0?accent:ink;
    const radius=Math.max(.48,size/470*.72);
    c.beginPath();c.arc(px,py,radius,0,Math.PI*2);c.fill();
  }
  c.globalAlpha=opacity;
}

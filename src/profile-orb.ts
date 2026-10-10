import * as THREE from 'three';
import { logoTarget, particleEase } from './profile-particles';
import { profile } from './profile';

type Chapter = 'identity' | 'about' | 'skills' | 'experience';
const chapters: Chapter[] = ['identity', 'about', 'skills', 'experience'];
const COUNT = 30000;
const groups = profile.skills.map((skill, sourceIndex) => ({ ...skill, sourceIndex })).filter(skill => skill.items.length);
const captions = ['A mark of my own.', 'The person behind the work.', 'Different tools. Connected ideas.', 'One step leads to the next.'];
const skillIcons: Record<string, string> = { Unity: 'unity', UE: 'unrealengine', 'C#': 'csharp', Java: 'java', 'C++': 'cplusplus' };
const fract = (n: number) => n - Math.floor(n);
const noise = (i: number) => fract(Math.sin(i * 127.1 + 311.7) * 43758.5453);
const skillCenter = (i: number, count: number) => {
  if (count === 1) return { x: 0, y: 0 };
  if (count === 2) return { x: i === 0 ? -.23 : .23, y: 0 };
  const a = -Math.PI / 2 + i * Math.PI * 2 / count;
  return { x: Math.cos(a) * .25, y: Math.sin(a) * .25 };
};
const pathCenter = (i: number, count: number) => ({ x: -.27 + .54 * i / Math.max(1, count - 1), y: .22 - .44 * i / Math.max(1, count - 1) });
const rgb = (css: string) => css.startsWith('#') ? [1, 3, 5].map(i => parseInt(css.slice(i, i + 2), 16) / 255) : (css.match(/[\d.]+/g) ?? ['242', '236', '228']).slice(0, 3).map(n => Number(n) / 255);
let portraitData: Promise<Float32Array> | undefined;
const loadPortrait = () => portraitData ??= fetch(`${import.meta.env.BASE_URL}assets/portrait-particles.bin`).then(async response => {
  if (!response.ok) throw new Error('Portrait particles unavailable');
  const data = new Float32Array(await response.arrayBuffer());
  if (data.length !== COUNT * 9) throw new Error('Invalid portrait particle count');
  return data;
}).catch(error => { portraitData = undefined; throw error; });

// All points morph, rotate, respond to the pointer and scatter in one GPU draw.
const vertexShader = `
  attribute vec2 aLogo;
  attribute vec4 aSkill;
  attribute vec3 aExperience;
  attribute vec3 aPortrait;
  attribute vec3 aPortraitColor;
  attribute vec3 aPortraitNormal;
  attribute vec2 aSeed;
  attribute vec3 aInfo;
  uniform vec4 uWeights;
  uniform vec2 uViewport;
  uniform vec2 uPointer;
  uniform vec3 uInk;
  uniform vec3 uAccent;
  uniform float uPointerStrength;
  uniform float uPointerRadius;
  uniform float uPointSize;
  uniform float uTime;
  uniform float uRotation;
  uniform float uPortraitMorph;
  uniform float uBurst;
  uniform float uHoverGroup;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float a = uTime * .10;
    vec3 s = vec3(position.x*cos(a)+position.z*sin(a), position.y, -position.x*sin(a)+position.z*cos(a));
    vec2 sphereXY = s.xy / (1.0 - s.z*.18);
    float yaw = uRotation + sin(uTime*.45)*.025;
    vec3 p = vec3(aPortrait.x*cos(yaw)+aPortrait.z*sin(yaw), -aPortrait.y, -aPortrait.x*sin(yaw)+aPortrait.z*cos(yaw));
    vec2 portraitXY = p.xy / (1.0 - p.z*.65) + aSeed * uBurst * .26;
    vec2 aboutXY = mix(sphereXY*.30, portraitXY, uPortraitMorph);
    vec2 skillsXY = aSkill.xy + sphereXY*aSkill.z;
    vec2 xy = aLogo*uWeights.x + aboutXY*uWeights.y + skillsXY*uWeights.z + aExperience.xy*uWeights.w;
    float radius = length(sphereXY);
    float skillAlpha = aSkill.w * (.08 + pow(min(radius,1.0),3.0)*.48);
    if (uHoverGroup >= 0.0 && abs(aInfo.x-uHoverGroup)>.1) skillAlpha *= .3;
    float portraitAmount = uWeights.y*uPortraitMorph;
    vAlpha = .38*uWeights.x + mix(.16+(s.z+1.0)*.10,1.0,uPortraitMorph)*uWeights.y + skillAlpha*uWeights.z + aInfo.y*uWeights.w;
    vec3 ink = mix(uInk,uAccent,aInfo.z);
    vec3 normal = vec3(aPortraitNormal.x*cos(yaw)+aPortraitNormal.z*sin(yaw), aPortraitNormal.y, -aPortraitNormal.x*sin(yaw)+aPortraitNormal.z*cos(yaw));
    float light = max(0.0,dot(normal,normalize(vec3(-.4,.65,.8))));
    vec3 textureColor = aPortraitColor/255.0;
    float darkness = 1.0-dot(textureColor,vec3(.2126,.7152,.0722));
    vec3 portraitColor = textureColor*(.88+.12*light)+vec3(.06+darkness*.14*light);
    vColor = mix(ink,portraitColor,portraitAmount);
    vec2 diff = xy-uPointer;
    float distance = length(diff);
    if (distance > .0001 && distance < uPointerRadius) {
      float push = pow(1.0-distance/uPointerRadius,2.0)*uPointerRadius*mix(.45,.12,portraitAmount)*uPointerStrength;
      xy += diff/distance*push;
    }
    float depth = mix(s.z*.30,p.z,uPortraitMorph)*uWeights.y;
    gl_Position = vec4(xy.x*2.0/uViewport.x,-xy.y*2.0/uViewport.y,-depth,1.0);
    gl_PointSize = uPointSize*mix(.65,1.0,portraitAmount);
  }
`;
const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord-vec2(.5));
    if (r>.5) discard;
    gl_FragColor = vec4(vColor,vAlpha*(1.0-smoothstep(.34,.50,r)));
  }
`;

export class ProfileOrb {
  private renderer?: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private geometry = new THREE.BufferGeometry();
  private material: THREE.ShaderMaterial;
  private frame = 0;
  private disposed = false;
  private width = 0;
  private height = 0;
  private size = 1;
  private chapter: Chapter = 'identity';
  private weights = new THREE.Vector4(1, 0, 0, 0);
  private pointer: { x: number; y: number } | null = null;
  private hoverStrength = 0;
  private hoveredGroup = -1;
  private rotation = 0;
  private velocity = 0;
  private burst = 0;
  private drag: { id: number; x: number; startX: number; startY: number; moved: boolean } | null = null;
  private previous = 0;
  private elapsed = 0;
  private aboutStart = 0;
  private portraitReady = false;
  private observer: ResizeObserver;
  private figure: HTMLElement;
  private labels: HTMLElement;
  private icons: HTMLElement;

  constructor(private canvas: HTMLCanvasElement, private root: HTMLElement, private reduced: boolean) {
    this.figure = canvas.closest('figure')!;
    this.labels = this.figure.querySelector('.profile-orb-labels')!;
    this.icons = document.createElement('div'); this.icons.className = 'profile-orb-icons';
    this.icons.setAttribute('aria-hidden', 'true'); canvas.parentElement!.append(this.icons);
    this.material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, transparent: true, depthTest: false, depthWrite: false,
      uniforms: {
        uWeights: { value: this.weights }, uViewport: { value: new THREE.Vector2(1, 1) },
        uPointer: { value: new THREE.Vector2(3, 3) }, uInk: { value: new THREE.Vector3(.95, .92, .90) },
        uAccent: { value: new THREE.Vector3(.88, .72, .47) }, uPointerStrength: { value: 0 },
        uPointerRadius: { value: .12 }, uPointSize: { value: 1.5 }, uTime: { value: 0 },
        uRotation: { value: 0 }, uPortraitMorph: { value: 0 }, uBurst: { value: 0 }, uHoverGroup: { value: -1 },
      } });
    this.prepareGeometry();
    const field = new THREE.Points(this.geometry, this.material); field.frustumCulled = false; this.scene.add(field);
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
      this.renderer.setClearColor(0, 0); this.figure.dataset.renderer = 'gpu';
    } catch {
      this.figure.dataset.renderer = 'unavailable';
      this.figure.querySelector('.profile-orb-caption')!.textContent = 'Particle display unavailable.';
    }
    root.addEventListener('scroll', this.read, { passive: true });
    root.addEventListener('pointermove', this.move, { passive: true }); root.addEventListener('pointerleave', this.leave);
    canvas.addEventListener('pointerdown', this.down); canvas.addEventListener('pointermove', this.rotate);
    canvas.addEventListener('pointerup', this.up); canvas.addEventListener('pointercancel', this.cancel);
    canvas.addEventListener('lostpointercapture', this.cancel); canvas.addEventListener('keydown', this.key);
    document.addEventListener('visibilitychange', this.visibility);
    this.observer = new ResizeObserver(this.resize); this.observer.observe(canvas);
    this.read(); this.resize();
    this.figure.dataset.portrait = 'loading';
    void loadPortrait().then(data => {
      if (this.disposed) return;
      const buffer = new THREE.InterleavedBuffer(data, 9);
      this.geometry.setAttribute('aPortrait', new THREE.InterleavedBufferAttribute(buffer, 3, 0));
      this.geometry.setAttribute('aPortraitColor', new THREE.InterleavedBufferAttribute(buffer, 3, 6));
      this.geometry.setAttribute('aPortraitNormal', new THREE.InterleavedBufferAttribute(buffer, 3, 3));
      this.portraitReady = true; this.aboutStart = this.elapsed; this.figure.dataset.portrait = 'ready';
      if (this.reduced) this.draw(1, 0);
    }).catch(() => { if (!this.disposed) { this.figure.dataset.portrait = 'error'; this.updateLabels(); } });
  }

  private prepareGeometry() {
    const sphere = new Float32Array(COUNT * 3), logo = new Float32Array(COUNT * 2), skills = new Float32Array(COUNT * 4);
    const experience = new Float32Array(COUNT * 3), seed = new Float32Array(COUNT * 2), info = new Float32Array(COUNT * 3);
    const count = Math.max(1, groups.length), events = Math.max(1, profile.experience.length);
    for (let i = 0; i < COUNT; i++) {
      const y = 1 - 2 * (i + .5) / COUNT, a = i * 2.399963, r = Math.sqrt(1 - y * y);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      sphere.set([x, y, z], i * 3);
      const mark = logoTarget(i); logo.set([mark.x, mark.y], i * 2);
      const group = i % count, center = skillCenter(group, count);
      if (i % 12 === 0 && count > 1) {
        const from = skillCenter(Math.floor(i / 12) % count, count), to = skillCenter((Math.floor(i / 12) + 1) % count, count), t = noise(i);
        skills.set([from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, 0, .45], i * 4);
      } else skills.set([center.x, center.y, .16, 1], i * 4);
      if (i % 5 === 0 || events === 1) {
        const center = pathCenter(Math.floor(i / 5) % events, events);
        experience.set([center.x + x * .043, center.y + y * .043, z * .043], i * 3); info[i * 3 + 1] = .32;
      } else {
        const t = i / COUNT;
        experience.set([-.27 + .54 * t + (noise(i) - .5) * .013, .22 - .44 * t + Math.sin(t * Math.PI * (events - 1)) * .018 + (noise(i + 8) - .5) * .013, 0], i * 3);
        info[i * 3 + 1] = .12;
      }
      seed.set([noise(i + 32) - .5, noise(i + 91) - .5], i * 2);
      info[i * 3] = groups[group]?.sourceIndex ?? -1; info[i * 3 + 2] = i % 17 === 0 ? 1 : 0;
    }
    this.geometry.setAttribute('position', new THREE.BufferAttribute(sphere, 3));
    this.geometry.setAttribute('aLogo', new THREE.BufferAttribute(logo, 2));
    this.geometry.setAttribute('aSkill', new THREE.BufferAttribute(skills, 4));
    this.geometry.setAttribute('aExperience', new THREE.BufferAttribute(experience, 3));
    this.geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
    this.geometry.setAttribute('aInfo', new THREE.BufferAttribute(info, 3));
    this.geometry.setAttribute('aPortrait', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    this.geometry.setAttribute('aPortraitColor', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    this.geometry.setAttribute('aPortraitNormal', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  }

  private read = () => {
    const edge = this.root.getBoundingClientRect().top + (parseFloat(getComputedStyle(this.root).getPropertyValue('--chapter-edge')) || 200);
    const sections = [...this.root.querySelectorAll<HTMLElement>('[data-section]')];
    const next = (sections.filter(el => el.getBoundingClientRect().top <= edge).at(-1) ?? sections[0])?.dataset.section as Chapter;
    if (!chapters.includes(next)) return;
    if (next !== this.chapter || !this.labels.dataset.chapter) {
      this.chapter = next; if (next === 'about') this.aboutStart = this.elapsed;
      this.burst = 0; this.drag = null; this.updateLabels();
    }
    if (this.reduced) this.draw(1, 0);
  };
  private updateLabels() {
    const index = chapters.indexOf(this.chapter); this.figure.dataset.shape = this.chapter;
    this.labels.dataset.chapter = this.chapter;
    this.figure.querySelector('.profile-orb-index')!.textContent = `0${index + 1} / ${this.chapter.toUpperCase()}`;
    this.figure.querySelector('.profile-orb-caption')!.textContent = this.chapter === 'about' && this.figure.dataset.portrait === 'error' ? 'Portrait unavailable. Explore the particle sphere.' : captions[index];
    this.figure.querySelector('figcaption small')!.textContent = this.chapter === 'about' ? 'Drag to rotate · Click to scatter · Move to interact' : 'Scroll to explore · Move to interact';
    this.labels.replaceChildren(); this.icons.replaceChildren();
    if (this.chapter === 'skills') groups.forEach((skill, group) => {
      const center = skillCenter(group, groups.length), items = skill.items.filter(item => skillIcons[item]);
      items.forEach((item, index) => {
        const icon = document.createElement('img'); icon.src = `${import.meta.env.BASE_URL}assets/skill-logos/${skillIcons[item]}.svg`;
        icon.alt = item; icon.title = item; if (item === 'Unity' || item === 'UE') icon.classList.add('monochrome');
        const x = items.length === 1 ? 0 : items.length === 2 ? (index - .5) * .13 : index === 2 ? 0 : (index - .5) * .12;
        const y = items.length > 2 ? (index === 2 ? .064 : -.048) : 0;
        icon.dataset.x = String(center.x + x); icon.dataset.y = String(center.y + y); icon.dataset.group = String(skill.sourceIndex);
        this.icons.append(icon);
      });
    });
    const names = this.chapter === 'skills' ? groups.map(s => s.group) : this.chapter === 'experience' ? profile.experience.map(s => s.time) : [];
    names.forEach((name, i) => {
      const node = document.createElement('span'); node.textContent = name;
      const center = this.chapter === 'skills' ? skillCenter(i, names.length) : pathCenter(i, names.length);
      node.dataset.node = String(i); node.dataset.x = String(center.x); node.dataset.y = String(center.y); this.labels.append(node);
    });
    this.layoutLabels();
  }
  private layoutLabels() {
    for (const node of this.labels.children as HTMLCollectionOf<HTMLElement>) {
      node.style.left = `${this.width / 2 + Number(node.dataset.x) * this.size}px`;
      node.style.top = `${this.height / 2 + Number(node.dataset.y) * this.size + this.size * (this.chapter === 'skills' ? .19 : .06)}px`;
      node.classList.toggle('active', this.chapter === 'skills' && groups[Number(node.dataset.node)]?.sourceIndex === this.hoveredGroup);
    }
    for (const icon of this.icons.children as HTMLCollectionOf<HTMLElement>) {
      icon.style.left = `${this.width / 2 + Number(icon.dataset.x) * this.size}px`;
      icon.style.top = `${this.height / 2 + Number(icon.dataset.y) * this.size}px`;
      icon.style.width = `${this.size * .087}px`; icon.style.height = `${this.size * .087}px`;
      icon.classList.toggle('muted', this.hoveredGroup >= 0 && Number(icon.dataset.group) !== this.hoveredGroup);
    }
  }
  private move = (event: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : null;
    const group = (event.target as Element).closest<HTMLElement>('[data-skill-group]'), next = group ? Number(group.dataset.skillGroup) : -1;
    if (this.hoveredGroup !== next) { this.hoveredGroup = next; this.layoutLabels(); }
  };
  private leave = () => { this.pointer = null; this.hoveredGroup = -1; this.layoutLabels(); };
  private down = (event: PointerEvent) => {
    if (this.chapter !== 'about' || event.button !== 0) return;
    event.preventDefault(); this.canvas.focus({ preventScroll: true });
    this.drag = { id: event.pointerId, x: event.clientX, startX: event.clientX, startY: event.clientY, moved: false };
    this.velocity = 0; this.canvas.setPointerCapture(event.pointerId);
  };
  private rotate = (event: PointerEvent) => {
    if (!this.drag || this.drag.id !== event.pointerId) return;
    const delta = event.clientX - this.drag.x; this.rotation += delta * .012; this.velocity = delta * .09;
    this.drag.x = event.clientX; this.drag.moved ||= Math.hypot(event.clientX - this.drag.startX, event.clientY - this.drag.startY) > 5;
    if (this.reduced) this.draw(1, 0);
  };
  private up = (event: PointerEvent) => {
    if (!this.drag || this.drag.id !== event.pointerId) return;
    if (!this.drag.moved && !this.reduced) this.burst = 1;
    this.drag = null; if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
  };
  private cancel = () => { if (this.drag) this.velocity = 0; this.drag = null; this.pointer = null; };
  private key = (event: KeyboardEvent) => {
    if (this.chapter !== 'about' || !['ArrowLeft', 'ArrowRight', ' ', 'Home'].includes(event.key)) return;
    event.preventDefault(); this.velocity = 0;
    if (event.key === 'Home') this.rotation = 0;
    else if (event.key === ' ') { if (!this.reduced) this.burst = 1; }
    else this.rotation += event.key === 'ArrowLeft' ? -.25 : .25;
    if (this.reduced) this.draw(1, 0);
  };
  private visibility = () => {
    cancelAnimationFrame(this.frame); this.previous = 0;
    if (!document.hidden && !this.disposed && !this.reduced) this.frame = requestAnimationFrame(this.tick);
  };
  private resize = () => {
    const rect = this.canvas.getBoundingClientRect(); this.width = rect.width; this.height = rect.height;
    this.size = Math.max(1, Math.min(this.width * .96, this.height * .96));
    const dpr = Math.min(devicePixelRatio, 1.75), style = getComputedStyle(this.canvas);
    this.renderer?.setPixelRatio(dpr); this.renderer?.setSize(this.width, this.height, false);
    const u = this.material.uniforms;
    u.uViewport.value.set(this.width / this.size, this.height / this.size);
    u.uInk.value.fromArray(rgb(style.color)); u.uAccent.value.fromArray(rgb(style.getPropertyValue('--pp-accent').trim() || '#e0b878'));
    u.uPointSize.value = Math.max(1.8, this.size / 620 * 2.5) * dpr;
    u.uPointerRadius.value = Math.min(.13, 65 / this.size);
    this.layoutLabels(); cancelAnimationFrame(this.frame); this.previous = 0; this.read(); this.draw(this.reduced ? 1 : 0, 0);
    if (!this.reduced && !document.hidden && this.renderer) this.frame = requestAnimationFrame(this.tick);
  };
  private tick = (now: number) => {
    if (this.disposed || document.hidden) return;
    const dt = this.previous ? Math.min((now - this.previous) / 1000, .05) : 1 / 60;
    this.previous = now; this.elapsed += dt;
    if (!this.drag && this.chapter === 'about') { this.rotation += this.velocity * dt; this.velocity *= Math.exp(-dt * 4); }
    this.burst *= Math.exp(-dt * 2.5);
    this.draw(1 - Math.exp(-dt * 4.5), dt); this.frame = requestAnimationFrame(this.tick);
  };
  private draw(blend: number, dt: number) {
    if (!this.renderer || !this.width || !this.height) return;
    const chapter = chapters.indexOf(this.chapter), u = this.material.uniforms;
    for (let i = 0; i < 4; i++) this.weights.setComponent(i, this.weights.getComponent(i) + ((i === chapter ? 1 : 0) - this.weights.getComponent(i)) * blend);
    this.hoverStrength += ((this.pointer && !this.reduced && !this.drag ? 1 : 0) - this.hoverStrength) * (this.reduced ? 1 : 1 - Math.exp(-dt * 8));
    if (this.pointer) u.uPointer.value.lerp(new THREE.Vector2((this.pointer.x - this.width / 2) / this.size, (this.pointer.y - this.height / 2) / this.size), 1 - Math.exp(-dt * 12));
    u.uPointerStrength.value = this.hoverStrength; u.uTime.value = this.reduced ? 0 : this.elapsed;
    u.uRotation.value = this.rotation; u.uBurst.value = this.burst; u.uHoverGroup.value = this.hoveredGroup;
    u.uPortraitMorph.value = this.portraitReady ? this.reduced ? 1 : particleEase(.15, 1.8, this.elapsed - this.aboutStart) : 0;
    const depth = this.weights.y > .98 && u.uPortraitMorph.value > .98;
    this.material.depthTest = depth; this.material.depthWrite = depth;
    this.renderer.render(this.scene, this.camera);
    const stage = this.chapter !== 'about' ? this.chapter : depth ? 'formed' : 'assembling';
    if (this.figure.dataset.portraitStage !== stage) this.figure.dataset.portraitStage = stage;
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frame); this.observer.disconnect(); this.icons.remove();
    this.root.removeEventListener('scroll', this.read); this.root.removeEventListener('pointermove', this.move); this.root.removeEventListener('pointerleave', this.leave);
    this.canvas.removeEventListener('pointerdown', this.down); this.canvas.removeEventListener('pointermove', this.rotate);
    this.canvas.removeEventListener('pointerup', this.up); this.canvas.removeEventListener('pointercancel', this.cancel);
    this.canvas.removeEventListener('lostpointercapture', this.cancel); this.canvas.removeEventListener('keydown', this.key);
    document.removeEventListener('visibilitychange', this.visibility); this.geometry.dispose(); this.material.dispose(); this.renderer?.dispose();
  }
}

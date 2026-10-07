import * as THREE from "three";

/**
 * Warm bokeh dust drawn inside the 3D scene: above the floor, below every case.
 * Positions live in CSS pixels and are placed on screen by the vertex shader,
 * so the dust ignores the camera and parts around the pointer.
 */
interface Mote { x: number; y: number; ox: number; oy: number; vx: number; vy: number; r: number; depth: number; phase: number; glow: boolean; big: boolean }

const vertex = /* glsl */ `
  uniform vec2 resolution;
  uniform float scale;
  attribute float size;
  attribute float alpha;
  attribute float soft;
  varying float vAlpha;
  varying float vSoft;
  void main() {
    gl_Position = vec4(position.x / resolution.x * 2.0 - 1.0, 1.0 - position.y / resolution.y * 2.0, 0.0, 1.0);
    gl_PointSize = size * 2.0 * scale;
    vAlpha = alpha;
    vSoft = soft;
  }
`;
const fragment = /* glsl */ `
  uniform float dark;
  varying float vAlpha;
  varying float vSoft;
  void main() {
    float d = length(gl_PointCoord * 2.0 - 1.0);
    if (d > 1.0) discard;
    float core = 1.0 - d;
    float shape = mix(pow(core, 1.8), core * 0.85, vSoft);
    vec3 warm = mix(vec3(0.95, 0.66, 0.36), vec3(1.0, 0.9, 0.74), pow(core, 3.0));
    vec3 ink = vec3(0.32, 0.22, 0.12);
    gl_FragColor = vec4(mix(ink, warm, dark), shape * vAlpha);
  }
`;

export class ParticleField {
  readonly points: THREE.Points;
  private material: THREE.ShaderMaterial;
  private geometry = new THREE.BufferGeometry();
  private motes: Mote[] = [];
  private pointer = { x: -1e4, y: -1e4 };
  private width = 0;
  private height = 0;
  private last = -1;
  private opacity = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { resolution: { value: new THREE.Vector2(1, 1) }, scale: { value: 1 }, dark: { value: 1 } },
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      // Opaque list + renderOrder: after the floor, before the cases.
      transparent: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.renderOrder = -5;
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.points.userData.excludeFromAO = true;
    window.addEventListener("pointermove", (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = (event.clientX - rect.left) * (this.width / Math.max(1, rect.width));
      this.pointer.y = (event.clientY - rect.top) * (this.height / Math.max(1, rect.height));
    }, { passive: true });
    window.addEventListener("pointerleave", () => { this.pointer.x = this.pointer.y = -1e4; });
  }

  /** True while the layer is on screen and moving. */
  get active() { return this.points.visible; }

  private resize() {
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    const scale = Math.sqrt((width * height) / (1600 * 900));
    const count = Math.round(Math.min(220, 130 * scale * scale + 30));
    this.motes = Array.from({ length: count }, (_, i) => {
      // A few large out-of-focus discs, many small glints; denser low in the frame.
      const big = i % 12 === 0, depth = big ? 0.9 + Math.random() * 0.1 : 0.25 + Math.random() * 0.6;
      const x = Math.random() * width, y = height * (0.1 + 0.9 * Math.pow(Math.random(), 0.7));
      return {
        x, y, ox: x, oy: y, vx: 0, vy: 0, depth, phase: Math.random() * Math.PI * 2, big,
        r: (big ? 18 + Math.random() * 22 : 1.8 + Math.random() * 7 * depth) * (0.7 + scale * 0.3),
        glow: !big && Math.random() < 0.15,
      };
    });
    const n = this.motes.length;
    this.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("size", new THREE.BufferAttribute(Float32Array.from(this.motes, (m) => m.r), 1));
    this.geometry.setAttribute("soft", new THREE.BufferAttribute(Float32Array.from(this.motes, (m) => (m.big ? 1 : 0)), 1));
    this.geometry.setDrawRange(0, n);
    this.material.uniforms.resolution.value.set(width, height);
  }

  /** `time` in seconds; `pixelRatio` is drawing-buffer pixels per CSS pixel. */
  update(time: number, visible: boolean, reduced: boolean, dark: boolean, pixelRatio: number) {
    const dt = Math.min(0.05, this.last < 0 ? 0 : time - this.last);
    this.last = time;
    this.opacity += ((visible && !reduced ? 1 : 0) - this.opacity) * Math.min(1, dt * 4);
    this.points.visible = this.opacity > 0.01;
    if (!this.points.visible) return;
    this.resize();
    this.material.uniforms.scale.value = pixelRatio;
    this.material.uniforms.dark.value = dark ? 1 : 0;
    this.material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    const positions = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    const alphas = this.geometry.getAttribute("alpha") as THREE.BufferAttribute;
    const reach = 150;
    this.motes.forEach((m, i) => {
      m.oy -= dt * 7 * m.depth;
      m.ox += Math.sin(time * 0.25 + m.phase) * dt * 5 * m.depth;
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
      const twinkle = 0.5 + 0.5 * Math.sin(time * (m.glow ? 1.8 : 0.9) + m.phase);
      positions.setXYZ(i, m.x, m.y, 0);
      alphas.setX(i, (m.big ? 0.07 + 0.05 * twinkle : m.glow ? 0.55 + 0.4 * twinkle : 0.2 + 0.32 * twinkle * m.depth) * this.opacity * (dark ? 1 : 0.5));
    });
    positions.needsUpdate = true;
    alphas.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

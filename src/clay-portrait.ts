import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** User-supplied textured portrait, framed inside the about section's particle shell. */
export class ClayPortrait {
  private renderer?: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, .1, 50);
  private model?: THREE.Group;
  private frame = 0;
  private disposed = false;
  private visible = true;
  private dragging = false;
  private lastX = 0;
  private rotation = -.08;
  private observer: ResizeObserver;
  private intersection: IntersectionObserver;
  private chapterObserver: MutationObserver;
  private started = performance.now();
  constructor(private canvas: HTMLCanvasElement, private reduced: boolean) {
    this.observer = new ResizeObserver(() => this.resize());
    this.intersection = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting; this.restart();
    });
    this.chapterObserver = new MutationObserver(this.restart);
    this.chapterObserver.observe(canvas.closest('figure')!, { attributes: true, attributeFilter: ['data-shape'] });
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1;
      this.camera.position.set(0, 0, 8.8); this.camera.lookAt(0, 0, 0);
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x81899a, 2));
      const key = new THREE.DirectionalLight(0xfff4e7, 2.5); key.position.set(-3, 6, 5); this.scene.add(key);
      const rim = new THREE.DirectionalLight(0xd6e8ff, 1.2); rim.position.set(4, 4, -3); this.scene.add(rim);
      this.observer.observe(canvas); this.intersection.observe(canvas);
      document.addEventListener('visibilitychange', this.restart);
      canvas.addEventListener('pointerdown', this.down); canvas.addEventListener('pointermove', this.move);
      canvas.addEventListener('pointerup', this.up); canvas.addEventListener('pointercancel', this.up);
      canvas.addEventListener('keydown', this.key);
      new GLTFLoader().load(`${import.meta.env.BASE_URL}assets/self-portrait.glb`, gltf => {
        if (this.disposed) { this.release(gltf.scene); return; }
        const bounds = new THREE.Box3().setFromObject(gltf.scene);
        const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
        const scale = 4 / Math.max(size.y, .001);
        gltf.scene.position.copy(center).multiplyScalar(-scale); gltf.scene.scale.setScalar(scale);
        this.model = new THREE.Group(); this.model.add(gltf.scene); this.scene.add(this.model);
        canvas.closest('figure')?.classList.add('portrait-ready'); this.restart();
      }, undefined, () => this.fallback());
      this.resize();
    } catch { this.fallback(); }
  }
  private fallback() { this.canvas.hidden = true; this.canvas.closest('figure')?.classList.add('portrait-fallback'); }
  private down = (e: PointerEvent) => { this.dragging = true; this.lastX = e.clientX; this.canvas.setPointerCapture(e.pointerId); };
  private move = (e: PointerEvent) => { if (!this.dragging) return; this.rotation += (e.clientX - this.lastX) * .012; this.lastX = e.clientX; this.restart(); };
  private up = () => { this.dragging = false; };
  private key = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault(); this.rotation += e.key === 'ArrowLeft' ? -.25 : .25; this.restart();
  };
  private resize() {
    if (!this.renderer) return;
    const { width, height } = this.canvas.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height, false); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.restart();
  }
  private restart = () => { cancelAnimationFrame(this.frame); if (!this.disposed && this.visible && !document.hidden && this.canvas.closest('figure')?.dataset.shape === 'about') this.tick(); };
  private tick = () => {
    if (!this.renderer || this.disposed) return;
    const t = (performance.now() - this.started) / 1000;
    if (this.model) {
      this.model.rotation.y = this.rotation + (this.reduced || this.dragging ? 0 : Math.sin(t * .45) * .07);
      this.model.position.y = this.reduced ? 0 : Math.sin(t * 1.3) * .015;
    }
    this.renderer.render(this.scene, this.camera);
    if (!this.reduced && this.visible && !document.hidden) this.frame = requestAnimationFrame(this.tick);
  };
  private release(root: THREE.Object3D) {
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const m of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) value.dispose();
        m.dispose();
      }
    });
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frame); this.observer.disconnect(); this.intersection.disconnect(); this.chapterObserver.disconnect();
    document.removeEventListener('visibilitychange', this.restart);
    this.canvas.removeEventListener('pointerdown', this.down); this.canvas.removeEventListener('pointermove', this.move);
    this.canvas.removeEventListener('pointerup', this.up); this.canvas.removeEventListener('pointercancel', this.up); this.canvas.removeEventListener('keydown', this.key);
    this.release(this.scene); this.renderer?.dispose();
  }
}

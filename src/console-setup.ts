import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * Where the stand sits relative to the selected case (case-local units): far
 * enough right to stay out of frame, clear of the detail text, until the camera moves.
 */
const SETUP_ORIGIN = new THREE.Vector3(9, 0, -0.6);

/**
 * The console and monitor beside the open case (art/console_setup.py). The disc
 * goes into the console slot, then the camera travels to the monitor, whose
 * screen shows the loading progress.
 */
export class ConsoleSetup {
  readonly group = new THREE.Group();
  /** Slot mouth and screen centre, in case-local units. */
  readonly slotLocal = new THREE.Vector3(8.75, 0.475, 0.7);
  readonly screenLocal = new THREE.Vector3(16.4, 3.05, -0.69);
  screenHeight = 4.6;
  private monitor = new THREE.Group();
  private screenGeometry?: THREE.BufferGeometry;
  /** Monitor foot centre in setup units (art/console_setup.py: MX, foot y). */
  private monitorPivot = new THREE.Vector3(7.4, 0, -0.2);
  private light?: THREE.MeshStandardMaterial;
  private canvas = Object.assign(document.createElement("canvas"), { width: 1280, height: 720 });
  private texture = new THREE.CanvasTexture(this.canvas);
  private drawn = "";
  loaded = false;

  constructor() {
    this.group.matrixAutoUpdate = false;
    this.group.visible = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    // glTF UVs run top-down.
    this.texture.flipY = false;
    this.monitor.position.copy(this.monitorPivot);
    this.group.add(this.monitor);
  }

  async load(url: string) {
    const gltf = await new GLTFLoader().loadAsync(url);
    gltf.scene.updateMatrixWorld(true);
    const slot = gltf.scene.getObjectByName("Console_Slot");
    if (slot) this.slotLocal.copy(slot.getWorldPosition(new THREE.Vector3())).add(SETUP_ORIGIN);
    gltf.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const source = o.material as THREE.MeshStandardMaterial;
      let material: THREE.Material;
      if (o.name === "Monitor_Screen") {
        material = new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false });
        this.screenGeometry = o.geometry;
        const box = new THREE.Box3().setFromObject(o);
        this.screenLocal.copy(box.getCenter(new THREE.Vector3())).add(SETUP_ORIGIN);
        this.screenHeight = box.max.y - box.min.y;
      } else {
        const standard = new THREE.MeshStandardMaterial({ color: source.color, roughness: source.roughness, metalness: source.metalness });
        if (o.name === "Slot_Light") {
          standard.emissive.set("#ffd9a0");
          this.light = standard;
        }
        material = standard;
      }
      const mesh = new THREE.Mesh(o.geometry, material);
      mesh.applyMatrix4(o.matrixWorld);
      mesh.castShadow = o.name !== "Stand" && o.name !== "Monitor_Screen";
      mesh.receiveShadow = true;
      if (o.name.startsWith("Monitor_")) {
        // The monitor turns on its foot; keep its pieces relative to that pivot.
        mesh.position.sub(this.monitorPivot);
        this.monitor.add(mesh);
      } else this.group.add(mesh);
    });
    this.draw(0, "");
    this.loaded = true;
  }

  /** Follow the case; `insert` drives the slot light and the loading screen. */
  update(caseMatrix: THREE.Matrix4, camera: THREE.Vector3, visible: boolean, insert: number, time: number, title: string) {
    this.group.visible = visible && this.loaded;
    if (!this.group.visible) return;
    this.group.matrix.copy(caseMatrix).multiply(new THREE.Matrix4().makeTranslation(SETUP_ORIGIN));
    this.group.matrixWorldNeedsUpdate = true;
    // Angle the monitor towards the viewer, as one would a TV.
    this.group.updateMatrixWorld(true);
    const eye = this.group.worldToLocal(camera.clone());
    this.monitor.rotation.y = THREE.MathUtils.clamp(Math.atan2(eye.x - this.monitorPivot.x, eye.z - this.monitorPivot.z), -0.9, 0.9);
    const reading = THREE.MathUtils.smoothstep(insert, 0.5, 0.58) * (1 - THREE.MathUtils.smoothstep(insert, 0.95, 1));
    if (this.light) this.light.emissiveIntensity = 0.6 + reading * (1.5 + 1.2 * Math.sin(time * 16));
    this.draw(THREE.MathUtils.smoothstep(insert, 0.55, 0.97), title);
  }

  /** World-space corners of the screen, for handing over to the page. */
  screenCorners() {
    const screen = this.monitor.children.find((child) => (child as THREE.Mesh).geometry === this.screenGeometry);
    if (!screen || !this.screenGeometry) return [];
    screen.updateWorldMatrix(true, false);
    const position = this.screenGeometry.getAttribute("position");
    return Array.from({ length: position.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(screen.matrixWorld));
  }

  private draw(progress: number, title: string) {
    const key = `${progress.toFixed(3)}|${title}`;
    if (key === this.drawn) return;
    this.drawn = key;
    const c = this.canvas.getContext("2d")!, w = this.canvas.width, h = this.canvas.height;
    const bg = c.createRadialGradient(w * 0.5, h * 0.35, 40, w * 0.5, h * 0.5, w * 0.75);
    bg.addColorStop(0, "#2a2620");
    bg.addColorStop(1, "#07080b");
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#eef3ff";
    c.textAlign = "center";
    c.font = "700 64px MiSans, sans-serif";
    c.fillText("LAPPAS", w / 2, h * 0.42);
    if (progress > 0) {
      c.font = "500 34px MiSans, sans-serif";
      c.fillStyle = "rgba(238, 243, 255, 0.85)";
      c.fillText(title, w / 2, h * 0.53);
      c.fillStyle = "rgba(238, 243, 255, 0.18)";
      c.fillRect(w * 0.3, h * 0.62, w * 0.4, 4);
      c.fillStyle = "#e0b878";
      c.fillRect(w * 0.3, h * 0.62, w * 0.4 * progress, 4);
      c.font = "500 22px MiSans, sans-serif";
      c.fillStyle = "rgba(238, 243, 255, 0.55)";
      c.fillText(progress < 1 ? "正在读取光盘…" : "准备就绪", w / 2, h * 0.7);
    }
    c.textAlign = "left";
    this.texture.needsUpdate = true;
  }
}

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { profile } from "./profile";
import { drawIdentity, prepareIdentity } from "./profile-particles";

/**
 * Shared terminal: open case at left, monitor at centre, upright drive at right,
 * with a continuous base beneath the assembly.
 */
const SETUP_ORIGIN = new THREE.Vector3(4.2, 0, -1);
/** Shared cue: the pickup completes, then light and camera wake together. */
export const PLAYER_WAKE_START = .38;

/**
 * The console and monitor beside the open case (art/console_setup.py). The disc
 * goes into the console slot, then the camera travels to the monitor, whose
 * screen shows the loading progress.
 */
export class ConsoleSetup {
  readonly group = new THREE.Group();
  /** Slot mouth and screen centre, in case-local units. */
  readonly slotLocal = new THREE.Vector3(8.675, 2.4, 0.05);
  readonly screenLocal = new THREE.Vector3(4.2, 2.75, -3.035);
  screenHeight = 3.6;
  private monitor = new THREE.Group();
  private controller = new THREE.Group();
  private controllerPivot = new THREE.Vector3(-.2, .36, .75);
  private playerLights: THREE.MeshStandardMaterial[] = [];
  get playerLightIntensity() { return this.playerLights[0]?.emissiveIntensity ?? 0; }
  private lamp = new THREE.PointLight("#ffe2bd", 0, 24, 0);
  private screenGeometry?: THREE.BufferGeometry;
  /** Monitor foot centre in setup units (art/console_setup.py: MX, foot y). */
  private monitorPivot = new THREE.Vector3(0, 0, -2.35);
  private light?: THREE.MeshStandardMaterial;
  private surfaces: THREE.Material[] = [];
  private canvas = Object.assign(document.createElement("canvas"), { width: 1280, height: 720 });
  private texture = new THREE.CanvasTexture(this.canvas);
  private drawn = "";
  loaded = false;

  constructor() {
    void prepareIdentity(profile.name);
    this.group.matrixAutoUpdate = false;
    this.group.visible = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    // glTF UVs run top-down.
    this.texture.flipY = false;
    this.monitor.position.copy(this.monitorPivot);
    this.group.add(this.monitor);
    this.controller.position.copy(this.controllerPivot);
    this.group.add(this.controller);
    // A local warm key light, lit only while the camera is at the console (decay 0, range 24).
    this.lamp.position.set(-2, 6.5, 5);
    this.group.add(this.lamp);
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
        const standard = o.name.startsWith('Controller_') ? source.clone() : new THREE.MeshStandardMaterial({ color: source.color, roughness: source.roughness, metalness: source.metalness });
        if (o.name === "Slot_Light") {
          standard.emissive.set("#ffd9a0");
          this.light = standard;
        }
        if (o.name.startsWith("Controller_Player_Light")) {
          standard.emissive.set("#ffb43b");
          standard.toneMapped = false;
          standard.emissiveIntensity = 0;
          this.playerLights.push(standard);
        }
        material = standard;
      }
      const mesh = new THREE.Mesh(o.geometry, material);
      // Hashed coverage keeps depth ordering correct while the whole assembly
      // fades in; transparent shells would expose parts through each other.
      material.alphaHash = true;
      this.surfaces.push(material);
      mesh.applyMatrix4(o.matrixWorld);
      mesh.castShadow = o.name !== "Stand" && o.name !== "Monitor_Screen";
      mesh.receiveShadow = true;
      if (o.name.startsWith("Monitor_")) {
        // The monitor turns on its foot; keep its pieces relative to that pivot.
        mesh.position.sub(this.monitorPivot);
        this.monitor.add(mesh);
      } else if (o.name.startsWith("Controller_")) {
        mesh.position.sub(this.controllerPivot);
        this.controller.add(mesh);
      } else this.group.add(mesh);
    });
    this.draw(0, "");
    this.loaded = true;
  }

  /** Follow the case; `insert` drives the slot light and the loading screen. */
  update(caseMatrix: THREE.Matrix4, camera: THREE.Vector3, visible: boolean, insert: number, time: number, title: string, workspace = 0, viewportAspect = 16 / 9) {
    const presence = Math.max(THREE.MathUtils.smoothstep(insert, 0.18, 0.28), THREE.MathUtils.smoothstep(workspace, .02, .18));
    this.group.visible = visible && this.loaded && presence > 0;
    if (!this.group.visible) return;
    for (const surface of this.surfaces) {
      surface.opacity = presence;
    }
    this.group.matrix.copy(caseMatrix).multiply(new THREE.Matrix4().makeTranslation(SETUP_ORIGIN));
    this.group.matrixWorldNeedsUpdate = true;
    // One assembled terminal: screen and drive share a fixed forward direction.
    this.monitor.rotation.y = 0;
    const lift = THREE.MathUtils.smoothstep(workspace, .18, .36);
    this.controller.position.copy(this.controllerPivot);
    this.controller.position.y += lift * .78;
    this.controller.position.z += lift * .30;
    this.controller.rotation.x = lift * .95;
    // One acknowledgement pulse after the controller is fully lifted.
    for (const light of this.playerLights) light.emissiveIntensity = 4 * THREE.MathUtils.smoothstep(workspace, PLAYER_WAKE_START, PLAYER_WAKE_START + .03) * (1 - THREE.MathUtils.smoothstep(workspace, .48, .53));
    const power = THREE.MathUtils.smoothstep(insert, 0.06, 0.18);
    const reading = THREE.MathUtils.smoothstep(insert, 0.46, 0.55) * (1 - THREE.MathUtils.smoothstep(insert, 0.94, 0.99));
    if (this.light) this.light.emissiveIntensity = power * (0.7 + reading * (1.5 + 1.2 * Math.sin(insert * 110)));
    this.lamp.intensity = Math.max(2.4 * THREE.MathUtils.smoothstep(insert, 0.02, 0.2) * (1 - THREE.MathUtils.smoothstep(insert, 0.85, 1)), 1.6 * presence * lift);
    if (workspace > .001) this.drawPlayer(workspace, viewportAspect);
    else this.draw(insert, title);
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
    // Every visual follows the insertion timeline, including interrupted ejection.
    // Quantise uploads to ~30 fps during the six-second sequence; idle screens reuse pixels.
    progress = Math.round(progress * 180) / 180;
    const key = `${progress}|${title}`;
    if (key === this.drawn) return;
    this.drawn = key;
    const c = this.canvas.getContext("2d")!, w = this.canvas.width, h = this.canvas.height;
    c.fillStyle = "#020305";
    c.fillRect(0, 0, w, h);
    const ease = THREE.MathUtils.smoothstep;
    const wake = ease(progress, 0.54, 0.62);
    if (!wake) {
      this.texture.needsUpdate = true;
      return;
    }
    c.save();
    c.globalAlpha = wake;
    const bg = c.createRadialGradient(w / 2, h * 0.43, 0, w / 2, h / 2, w * 0.65);
    bg.addColorStop(0, "#26231e");
    bg.addColorStop(1, "#07080b");
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    // A narrow backlight line opens into the screen before the logo resolves.
    const flash = ease(progress, 0.54, 0.57) * (1 - ease(progress, 0.58, 0.64));
    c.fillStyle = `rgba(255,232,192,${flash * 0.8})`;
    c.fillRect(w * 0.18, h / 2 - 1, w * 0.64, 2);

    const logo = ease(progress, 0.63, 0.75);
    c.save();
    c.globalAlpha *= logo;
    const scale = 0.91 + 0.09 * logo;
    c.translate(w / 2, h * 0.42 + (1 - logo) * 18);
    c.scale(scale, scale);
    c.fillStyle = "#eef3ff";
    c.textAlign = "center";
    c.font = "700 82px MiSans, sans-serif";
    c.fillText("LAPPAS", 0, 0);
    c.font = "500 18px MiSans, sans-serif";
    c.fillStyle = "#cbb797";
    c.fillText("W O R K S   /   C O N S O L E", 0, 42);
    c.restore();

    if (progress >= 0.75) {
      const system = ease(progress, 0.75, 0.83);
      const read = ease(progress, 0.85, 0.98);
      c.globalAlpha *= system;
      c.textAlign = "center";
      c.font = "500 34px MiSans, sans-serif";
      c.fillStyle = "rgba(238, 243, 255, 0.85)";
      c.fillText(progress < 0.85 ? "系统启动中" : title, w / 2, h * 0.57);
      c.fillStyle = "rgba(238, 243, 255, 0.18)";
      c.fillRect(w * 0.3, h * 0.65, w * 0.4, 4);
      c.fillStyle = "#e0b878";
      c.fillRect(w * 0.3, h * 0.65, w * 0.4 * (progress < 0.85 ? system * 0.12 : 0.12 + read * 0.88), 4);
      c.font = "500 22px MiSans, sans-serif";
      c.fillStyle = "rgba(238, 243, 255, 0.55)";
      c.fillText(progress < 0.85 ? "BOOT / 初始化系统…" : progress < 0.98 ? "DISC / 正在读取作品…" : "READY / 准备就绪", w / 2, h * 0.73);
    }
    c.restore();
    this.texture.needsUpdate = true;
  }

  private drawPlayer(progress: number, viewportAspect: number) {
    progress = Math.round(progress * 120) / 120;
    const key = `player|${progress}|${profile.name}|${viewportAspect}`;
    if (key === this.drawn) return;
    this.drawn = key;
    const c = this.canvas.getContext("2d")!, w = this.canvas.width, h = this.canvas.height;
    c.fillStyle = "#07090c";
    c.fillRect(0, 0, w, h);
    c.save();
    c.globalAlpha = THREE.MathUtils.smoothstep(progress, PLAYER_WAKE_START, .50);
    const wake = c.globalAlpha;
    drawIdentity(c, { x:w/2, y:h*.46, size:h*.8*Math.min(1, viewportAspect*.88), morph:0 });
    // drawIdentity resets alpha; retain screen wake and fade labels before entering.
    c.globalAlpha = wake * (1 - THREE.MathUtils.smoothstep(progress,.67,.80));
    c.textAlign = "center";
    c.fillStyle = "#dac39b"; c.font = "500 20px MiSans, sans-serif";
    c.fillStyle = "#edeae4"; c.font = "600 34px MiSans, sans-serif";
    c.fillText(profile.name, w / 2, h * .82);
    c.fillStyle = "#95958e"; c.font = "400 20px MiSans, sans-serif";
    c.fillText("已连接", w / 2, h * .89);
    c.restore();
    this.texture.needsUpdate = true;
  }
}

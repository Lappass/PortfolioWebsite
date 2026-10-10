import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { disposeThreeTree } from "./three-resources";

export type FigureClip = "idle" | "sit" | "jump" | "look" | "cheer" | "wave";
const CLIPS: FigureClip[] = ["idle", "sit", "jump", "look", "cheer", "wave"];
/** Height on the shelf, in scene units: a third of a game case. */
const HEIGHT = 1.25;

export interface FigurePose {
  position: THREE.Vector3;
  /** Body facing; 0 looks along +Z. */
  yaw: number;
  /** Where the head would like to look, as a world yaw, and how far it tips up (+) or down (−). */
  lookYaw: number;
  lookUp: number;
  opacity: number;
  /** The looping clip for this spot. */
  clip: FigureClip;
  /** 0..1 while hopping between two spots: scrubs the jump clip instead of playing a loop. */
  hop?: number;
  /** Orientation of whatever it is sitting on; the body yaw is applied on top. */
  lean?: THREE.Quaternion;
}

/**
 * The small rigged figure that keeps the visitor company (art/figure_rig.py): seated on
 * the shelf at home, at the foot of the open case, and on the desk once the disc goes in.
 * The scene decides where it is and what it attends to; the figure blends its clips,
 * turns its head and plays the occasional gesture.
 */
export class Figure {
  readonly group = new THREE.Group();
  /** `asleep` while the shelf cycles on its own; `still` under reduced motion. */
  readonly state = { asleep: false, still: false };
  private surfaces: THREE.Material[] = [];
  private mixer?: THREE.AnimationMixer;
  private actions = new Map<FigureClip, THREE.AnimationAction>();
  private current?: FigureClip;
  private gesture?: { clip: FigureClip; until: number };
  private nextFidget = 0;
  private head?: THREE.Object3D;
  private shown = { yaw: 0, headYaw: 0, headPitch: 0 };
  private last = 0;
  private disposed = false;
  loaded = false;

  constructor() {
    this.group.name = "Figure";
    this.group.visible = false;
  }

  async load(url: string) {
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
    if (this.disposed) { disposeThreeTree(gltf.scene); return; }
    const bounds = new THREE.Box3().setFromObject(gltf.scene), height = bounds.max.y - bounds.min.y;
    // Rest pose is 1.66 m tall; fall back to that if the skinned bounds are unusable.
    gltf.scene.scale.multiplyScalar(HEIGHT / (height > 1 && height < 3 ? height : 1.66));
    gltf.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      // Skinned bounds follow the bind pose, not the animation.
      object.frustumCulled = false;
      object.castShadow = object.receiveShadow = true;
      for (const material of [object.material].flat()) {
        material.alphaHash = true;
        // Meshy exports the texture as its own light; here the scene lights the figure.
        if (material instanceof THREE.MeshStandardMaterial) {
          material.emissive.set(0);
          material.emissiveMap = null;
          material.roughness = .85;
        }
        this.surfaces.push(material);
      }
    });
    this.head = gltf.scene.getObjectByName("mixamorigHead");
    const hips = gltf.scene.getObjectByName("mixamorigHips");
    this.mixer = new THREE.AnimationMixer(gltf.scene);
    for (const clip of gltf.animations) {
      const name = clip.name as FigureClip;
      if (!CLIPS.includes(name) || this.actions.has(name)) continue;
      if (hips) this.anchor(clip, hips.position, name === "jump");
      const action = this.mixer.clipAction(clip);
      action.enabled = true;
      action.setEffectiveWeight(0);
      action.play();
      this.actions.set(name, action);
    }
    this.group.add(gltf.scene);
    this.loaded = true;
  }

  /**
   * The clips carry their own travel (a chair off to one side, a leap forwards). The scene
   * moves the figure, so keep each clip over the rest position; the jump keeps only its
   * landing crouch.
   */
  private anchor(clip: THREE.AnimationClip, rest: THREE.Vector3, leap: boolean) {
    const track = clip.tracks.find((candidate) => candidate.name.endsWith("Hips.position"));
    if (!track) return;
    const values = track.values, dx = values[0] - rest.x, dz = values[2] - rest.z;
    let landing = 0;
    for (let i = 0; i < values.length; i += 3) if (values[i + 1] < values[landing + 1]) landing = i;
    for (let i = 0; i < values.length; i += 3) {
      values[i] = leap ? rest.x : values[i] - dx;
      values[i + 2] = leap ? rest.z : values[i + 2] - dz;
      if (leap && i < landing) values[i + 1] = rest.y;
    }
  }

  dispose() { this.disposed = true; }

  /** Play a clip once over whatever the figure is doing. */
  gestureOnce(clip: FigureClip) {
    const action = this.actions.get(clip);
    if (!action || this.state.still) return;
    action.time = 0;
    this.gesture = { clip, until: this.last + action.getClip().duration - .35 };
  }

  update(time: number, pose: FigurePose) {
    const dt = THREE.MathUtils.clamp(time - this.last, 0, .1);
    this.last = time;
    this.group.visible = this.loaded && pose.opacity > 0;
    if (!this.group.visible || !this.mixer) return;
    for (const surface of this.surfaces) surface.opacity = pose.opacity;
    const state = this.state, look = this.shown;
    if (this.gesture && (time > this.gesture.until || pose.hop !== undefined)) this.gesture = undefined;
    // Standing about, it looks around now and then.
    if (pose.clip === "idle" && pose.hop === undefined && !this.gesture && !state.still && time > this.nextFidget) {
      if (this.nextFidget) this.gestureOnce("look");
      this.nextFidget = time + 14 + Math.random() * 10;
    }
    const wanted = pose.hop !== undefined ? "jump" : this.gesture?.clip ?? pose.clip;
    if (wanted !== this.current) {
      const next = this.actions.get(wanted);
      if (next && wanted !== "jump" && !this.gesture) next.time = 0;
      this.current = wanted;
    }
    for (const [name, action] of this.actions) {
      const target = name === this.current ? 1 : 0;
      action.setEffectiveWeight(action.getEffectiveWeight() + (target - action.getEffectiveWeight()) * (1 - Math.exp(-dt * 9)));
    }
    const jump = this.actions.get("jump");
    if (jump && pose.hop !== undefined) {
      // Take-off to landing crouch, scrubbed by how far along the hop is.
      jump.time = THREE.MathUtils.lerp(.15, .82, pose.hop) * jump.getClip().duration;
      jump.timeScale = 0;
    } else if (jump) jump.timeScale = 1;
    this.mixer.update(state.still ? 0 : dt);

    this.group.position.copy(pose.position);
    look.yaw += Math.atan2(Math.sin(pose.yaw - look.yaw), Math.cos(pose.yaw - look.yaw)) * (1 - Math.exp(-dt * 6));
    this.group.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), look.yaw);
    if (pose.lean) this.group.quaternion.premultiply(pose.lean);
    // The head leads: it turns to what it attends to, within what a neck allows.
    const turn = Math.atan2(Math.sin(pose.lookYaw - look.yaw), Math.cos(pose.lookYaw - look.yaw));
    const asleep = state.asleep && pose.clip === "sit";
    look.headYaw += ((asleep ? 0 : THREE.MathUtils.clamp(turn, -.85, .85)) - look.headYaw) * (1 - Math.exp(-dt * 7));
    look.headPitch += ((asleep ? -.62 + .05 * Math.sin(time * 1.2) : THREE.MathUtils.clamp(pose.lookUp, -1, 1) * .5) - look.headPitch) * (1 - Math.exp(-dt * (asleep ? 1.4 : 6)));
    if (this.head && this.current !== "cheer") {
      this.head.quaternion.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-look.headPitch, look.headYaw, 0, "YXZ")));
    }
  }
}

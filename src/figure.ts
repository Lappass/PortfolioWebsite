import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { disposeThreeTree } from "./three-resources";

export type FigureClip = "idle" | "sit" | "jump" | "look" | "cheer" | "wave" | "run";
const CLIPS: FigureClip[] = ["idle", "sit", "jump", "look", "cheer", "wave", "run"];
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
  /**
   * Both arms held out of whatever the clip is doing: `amount` 0..1 towards the direction
   * (x, y, z) in the figure's own frame, x mirrored for the right arm. `stretch` lengthens
   * the arms to reach past the head.
   */
  arms?: { amount: number; x: number; y: number; z: number; stretch?: number };
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
  private headEnvelope: THREE.Vector3[] = [];
  private headSurface: THREE.Vector3[] = [];
  private back?: THREE.Object3D;
  private arms: THREE.Object3D[] = [];
  private armsShown = { amount: 0, x: 0, y: 1, z: 0, stretch: 0 };
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
    this.back = gltf.scene.getObjectByName("mixamorigSpine2");
    gltf.scene.updateMatrixWorld(true);
    if (this.head) {
      // A conservative envelope of the actual head/hair geometry, in head-bone space.
      // Bone centres alone miss the oversized hair and glasses on this character.
      const bounds = new THREE.Box3(), vertex = new THREE.Vector3();
      gltf.scene.traverse((mesh) => {
        if (!(mesh instanceof THREE.SkinnedMesh)) return;
        const indices = mesh.geometry.getAttribute("skinIndex"), weights = mesh.geometry.getAttribute("skinWeight");
        for (let i = 0; i < indices.count; i++) {
          let onHead = false;
          for (let j = 0; j < 4; j++) {
            if (weights.getComponent(i, j) > .1 && mesh.skeleton.bones[indices.getComponent(i, j)]?.name.includes("Head")) onHead = true;
          }
          if (onHead) {
            const point = this.head!.worldToLocal(mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld));
            bounds.expandByPoint(point);
            this.headSurface.push(point.clone());
          }
        }
      });
      if (!bounds.isEmpty()) for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        this.headEnvelope.push(new THREE.Vector3(x, y, z));
      }
    }
    // Shoulder to wrist, each side in order, for the pushing pose.
    this.arms = ["LeftArm", "LeftForeArm", "RightArm", "RightForeArm"].flatMap((name) => gltf.scene.getObjectByName(`mixamorig${name}`) ?? []);
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

  /** Carry the actual disc on the animated back; keep its label's spin about its normal. */
  carryDisc(parts: THREE.Object3D[], amount: number, grip: number, radius: number) {
    if (!this.loaded || !this.back || amount <= 0 || !parts.length) return;
    this.group.updateMatrixWorld(true);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.getWorldQuaternion(new THREE.Quaternion()));
    const frame = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(forward.x, forward.z));
    // Lean with the carrier, about the back's contact point rather than the disc centre.
    // Keep the running clip's torso twist out of this large, rigid load.
    frame.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), .3));
    const centre = this.back.getWorldPosition(new THREE.Vector3())
      .add(new THREE.Vector3(0, 1.04, -.28).applyQuaternion(frame));
    const first = parts[0], parent = first.parent;
    if (!parent) return;
    const rotation = frame.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), first.rotation.z));
    const localRotation = parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation);
    const localCentre = parent.worldToLocal(centre.clone());
    for (const part of parts) {
      part.position.lerp(localCentre, amount);
      part.quaternion.slerp(localRotation, amount);
      part.updateMatrixWorld(true);
    }
    const actualCentre = first.getWorldPosition(new THREE.Vector3());
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(first.getWorldQuaternion(new THREE.Quaternion()));
    let clearance = Infinity, overlaps = false;
    for (const corner of this.headEnvelope) {
      const offset = this.head!.localToWorld(corner.clone()).sub(actualCentre);
      const distance = offset.dot(normal);
      if (offset.clone().addScaledVector(normal, -distance).length() < radius + .08) overlaps = true;
    }
    if (overlaps && this.head) {
      // Support of the head surface along the disc normal, without transforming every
      // vertex each frame. Box corners alone overestimate the round hair and separate
      // the disc so far from the back that the short hands cannot reach it.
      const m = this.head.matrixWorld.elements;
      const axis = new THREE.Vector3(m[0] * normal.x + m[1] * normal.y + m[2] * normal.z,
        m[4] * normal.x + m[5] * normal.y + m[6] * normal.z,
        m[8] * normal.x + m[9] * normal.y + m[10] * normal.z);
      const offset = new THREE.Vector3(m[12], m[13], m[14]).sub(actualCentre).dot(normal);
      for (const point of this.headSurface) clearance = Math.min(clearance, point.dot(axis) + offset);
    }
    if (overlaps && clearance < .045) {
      actualCentre.addScaledVector(normal, clearance - .045);
      const safeCentre = parent.worldToLocal(actualCentre.clone());
      for (const part of parts) { part.position.copy(safeCentre); part.updateMatrixWorld(true); }
    }
    // Grip the lower rim in the carrier's frame, independent of the printed label's spin.
    // The two-bone solve bends elbows towards real contact points instead of holding both
    // segments in the same direction. Fixed lengths keep the short arms believable.
    for (const [side, sign] of [["Left", 1], ["Right", -1]] as const) {
      const arm = this.arms.find((bone) => bone.name === `mixamorig${side}Arm`);
      const elbow = this.arms.find((bone) => bone.name === `mixamorig${side}ForeArm`);
      const hand = elbow?.children.find((bone) => bone.name === `mixamorig${side}Hand`);
      if (!arm || !elbow || !hand) continue;
      // Solve for the wrist slightly in front of the rim; the palm and fingers extend
      // beyond the hand bone, so placing the wrist on the surface buries the fingers.
      const target = actualCentre.clone().add(new THREE.Vector3(sign * .22, -Math.sqrt(radius * radius - .27 * .27) + .12, .08).applyQuaternion(frame));
      const initial = [arm.quaternion.clone(), elbow.quaternion.clone()];
      for (let i = 0; i < 6; i++) for (const bone of [elbow, arm]) {
        const origin = bone.getWorldPosition(new THREE.Vector3());
        const from = hand.getWorldPosition(new THREE.Vector3()).sub(origin).normalize();
        const to = target.clone().sub(origin).normalize();
        const turn = new THREE.Quaternion().setFromUnitVectors(from, to);
        const parentRotation = bone.parent!.getWorldQuaternion(new THREE.Quaternion());
        bone.quaternion.premultiply(parentRotation.clone().invert().multiply(turn).multiply(parentRotation));
        bone.updateMatrixWorld(true);
      }
      for (const [i, bone] of [arm, elbow].entries()) {
        bone.quaternion.copy(initial[i].slerp(bone.quaternion.clone(), grip));
        bone.updateMatrixWorld(true);
      }
    }
  }

  /** Hold both arms towards a direction, over whatever the clip is doing with them. */
  private reach() {
    const { amount, x, y, z, stretch } = this.armsShown;
    for (const bone of this.arms) {
      const next = bone.children[0];
      if (!next || bone.name.includes("Fore")) continue;
      const axis = next.position.clone().normalize(), longer = stretch * amount;
      bone.scale.set(1 + longer * Math.abs(axis.x), 1 + longer * Math.abs(axis.y), 1 + longer * Math.abs(axis.z));
    }
    if (amount < .01) return;
    this.group.updateMatrixWorld(true);
    const facing = this.group.getWorldQuaternion(new THREE.Quaternion());
    const from = new THREE.Vector3(), to = new THREE.Vector3(), parent = new THREE.Quaternion();
    for (const bone of this.arms) {
      const next = bone.children[0];
      if (!next || !bone.parent) continue;
      const side = bone.name.includes("Left") ? 1 : -1;
      to.subVectors(next.getWorldPosition(to), bone.getWorldPosition(from)).normalize();
      const goal = new THREE.Vector3(side * x, y, z).normalize().applyQuaternion(facing);
      const turn = new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(to, goal), amount);
      bone.parent.getWorldQuaternion(parent);
      bone.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));
      bone.updateMatrixWorld(true);
    }
  }

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
    const held = this.armsShown, aim = pose.arms, ease = 1 - Math.exp(-dt * 9);
    held.amount += ((aim?.amount ?? 0) - held.amount) * ease;
    if (aim) {
      held.x += (aim.x - held.x) * ease; held.y += (aim.y - held.y) * ease; held.z += (aim.z - held.z) * ease;
      held.stretch += ((aim.stretch ?? 0) - held.stretch) * ease;
    }
    this.reach();
    if (this.head && this.current !== "cheer") {
      this.head.quaternion.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-look.headPitch, look.headYaw, 0, "YXZ")));
    }
  }
}

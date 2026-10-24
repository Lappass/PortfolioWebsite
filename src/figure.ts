import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { disposeThreeTree } from "./three-resources";

export type FigureClip = "idle" | "sit" | "jump" | "look" | "cheer" | "wave" | "run";
const CLIPS: FigureClip[] = ["idle", "sit", "jump", "look", "cheer", "wave", "run"];
/** Height on the shelf, in scene units: a third of a game case. */
const HEIGHT = 1.25;
/** Ground the run clip covers in a second at this height; faster travel speeds the stride up. */
const RUN_SPEED = 2.65;
/** Extra bend under a load on the back, in radians: spread down the spine, and the head bowed. */
const STOOP = { spine: .8, neck: .4 };

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
  /** 0..1: bent forward under a load on its back. */
  stoop?: number;
  /** Busy with the disc: no idle glances or gestures. */
  busy?: boolean;
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
  private back?: THREE.Object3D;
  private spine: THREE.Object3D[] = [];
  private neck?: THREE.Object3D;
  /** Skinned vertices along the body's centre plane (head, neck, trunk, shoulders): what a disc carried in that plane can touch. */
  private midline: { mesh: THREE.SkinnedMesh; index: number }[] = [];
  private arms: THREE.Object3D[] = [];
  /** Shoulder to wrist, each side. */
  private chains: Partial<Record<"Left" | "Right", { arm: THREE.Object3D; elbow: THREE.Object3D; hand: THREE.Object3D }>> = {};
  private armLength = .3;
  private armsShown = { amount: 0, x: 0, y: 1, z: 0, stretch: 0 };
  private shown = { yaw: 0, headYaw: 0, headPitch: 0, stoop: 0 };
  /** The bend added to the spine this frame, taken back before the next. */
  private stooped = 0;
  private busy = false;
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
    this.spine = ["Spine", "Spine1", "Spine2"].flatMap((name) => gltf.scene.getObjectByName(`mixamorig${name}`) ?? []);
    this.neck = gltf.scene.getObjectByName("mixamorigNeck");
    const hips = gltf.scene.getObjectByName("mixamorigHips");
    gltf.scene.updateMatrixWorld(true);
    // The head, neck, trunk and shoulders along the body's centre plane, the oversized hair and
    // glasses included: bone centres alone miss them. The rest pose faces +Z, so the plane is
    // at the hips' x. Thinned to about a thousand vertices.
    const middle = hips?.getWorldPosition(new THREE.Vector3()).x ?? 0, vertex = new THREE.Vector3();
    const midline: { mesh: THREE.SkinnedMesh; index: number }[] = [];
    gltf.scene.traverse((mesh) => {
      if (!(mesh instanceof THREE.SkinnedMesh)) return;
      const indices = mesh.geometry.getAttribute("skinIndex"), weights = mesh.geometry.getAttribute("skinWeight");
      for (let i = 0; i < indices.count; i++) {
        let bone = "", most = 0;
        for (let j = 0; j < 4; j++) {
          if (weights.getComponent(i, j) <= most) continue;
          most = weights.getComponent(i, j);
          bone = mesh.skeleton.bones[indices.getComponent(i, j)]?.name ?? "";
        }
        if (/Hips|Spine|Neck|Head|Shoulder/.test(bone) && Math.abs(mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld).x - middle) < .1) {
          midline.push({ mesh, index: i });
        }
      }
    });
    const thin = Math.max(1, Math.ceil(midline.length / 1000));
    this.midline = midline.filter((_, i) => i % thin === 0);
    // Shoulder to wrist, each side in order, for the reaching and gripping poses.
    this.arms = ["LeftArm", "LeftForeArm", "RightArm", "RightForeArm"].flatMap((name) => gltf.scene.getObjectByName(`mixamorig${name}`) ?? []);
    for (const side of ["Left", "Right"] as const) {
      const arm = gltf.scene.getObjectByName(`mixamorig${side}Arm`), elbow = gltf.scene.getObjectByName(`mixamorig${side}ForeArm`);
      const hand = elbow?.children.find((bone) => bone.name === `mixamorig${side}Hand`);
      if (arm && elbow && hand) this.chains[side] = { arm, elbow, hand };
    }
    if (this.chains.Left) {
      const [shoulder, elbow, wrist] = Object.values(this.chains.Left).map((bone) => bone.getWorldPosition(new THREE.Vector3()));
      this.armLength = shoulder.distanceTo(elbow) + elbow.distanceTo(wrist);
    }
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

  /**
   * Rest the actual disc (its meshes) on the animated back, blended in by `amount`. From the
   * upper spine the disc goes out `angle` above the backward horizontal, just far enough that
   * its rim clears the head, neck and trunk, so it lies against whichever of them sticks out.
   * The disc keeps the orientation its case gives it; it is carried in the figure's own plane.
   */
  carry(parts: THREE.Object3D[], amount: number, radius: number, angle: number) {
    const first = parts[0], parent = first?.parent;
    if (!this.loaded || !this.back || !parent || amount <= 0) return;
    this.group.updateMatrixWorld(true);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(first.getWorldQuaternion(new THREE.Quaternion()));
    const along = new THREE.Vector3(0, 0, -Math.cos(angle)).applyQuaternion(this.group.getWorldQuaternion(new THREE.Quaternion()));
    along.y += Math.sin(angle);
    along.addScaledVector(normal, -along.dot(normal)).normalize();
    const from = this.back.getWorldPosition(new THREE.Vector3());
    // Circle against points: each vertex rules out a stretch of the line, so go past the
    // furthest. Vertices off to the side of the disc's plane cannot touch it.
    const clear = radius + .015, point = new THREE.Vector3();
    let out = 0;
    for (const { mesh, index } of this.midline) {
      mesh.getVertexPosition(index, point).applyMatrix4(mesh.matrixWorld).sub(from);
      const side = point.dot(normal);
      if (Math.abs(side) > .055) continue;
      point.addScaledVector(normal, -side);
      const onLine = point.dot(along), room = onLine * onLine - point.lengthSq() + clear * clear;
      if (room > 0) out = Math.max(out, onLine + Math.sqrt(room));
    }
    const centre = parent.worldToLocal(from.addScaledVector(along, out));
    for (const part of parts) {
      part.position.lerp(centre, amount);
      part.updateMatrixWorld(true);
    }
  }

  /**
   * Each hand to the rim nearest its shoulder, by weight, wherever the disc is. The two-bone
   * solve bends the elbows towards real contact points; a rim out of reach stretches the
   * short arm a little and then only straightens it towards the disc.
   */
  grip(parts: THREE.Object3D[], radius: number, left: number, right: number) {
    const first = parts[0];
    if (!this.loaded || !first || (left <= 0 && right <= 0)) return;
    this.group.updateMatrixWorld(true);
    const centre = first.getWorldPosition(new THREE.Vector3());
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(first.getWorldQuaternion(new THREE.Quaternion()));
    for (const [side, weight] of [["Left", left], ["Right", right]] as const) {
      const chain = this.chains[side];
      if (!chain || weight <= 0) continue;
      const { arm, elbow, hand } = chain;
      const shoulder = arm.getWorldPosition(new THREE.Vector3());
      const out = shoulder.clone().sub(centre), across = out.dot(normal);
      out.addScaledVector(normal, -across);
      if (out.lengthSq() < 1e-6) continue;
      out.normalize();
      // The wrist just inside the rim, beside the disc on the shoulder's side: the palm and
      // fingers reach past the hand bone onto the edge without going into the disc.
      const target = centre.clone().addScaledVector(out, radius - .08).addScaledVector(normal, (Math.sign(across) || 1) * .055);
      const longer = THREE.MathUtils.clamp(shoulder.distanceTo(target) / this.armLength - 1, 0, .3) * weight;
      this.stretch(arm, Math.max(longer, this.armsShown.stretch * this.armsShown.amount));
      arm.updateMatrixWorld(true);
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
        bone.quaternion.copy(initial[i].slerp(bone.quaternion.clone(), weight));
        bone.updateMatrixWorld(true);
      }
    }
  }

  /** Bend forward down the spine and bow the head by `stoop` of STOOP (negative to take it back). */
  private bend(stoop: number) {
    if (!stoop) return;
    for (const bone of this.spine) bone.rotateX(STOOP.spine / this.spine.length * stoop);
    this.neck?.rotateX(STOOP.neck * stoop);
  }

  /** Lengthen an upper arm, and so the whole arm, along its own length. */
  private stretch(bone: THREE.Object3D, longer: number) {
    const next = bone.children[0];
    if (!next) return;
    const axis = next.position.clone().normalize();
    bone.scale.set(1 + longer * Math.abs(axis.x), 1 + longer * Math.abs(axis.y), 1 + longer * Math.abs(axis.z));
  }

  /** Hold both arms towards a direction, over whatever the clip is doing with them. */
  private reach() {
    const { amount, x, y, z, stretch } = this.armsShown;
    for (const bone of this.arms) if (!bone.name.includes("Fore")) this.stretch(bone, stretch * amount);
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
    if (!action || this.state.still || this.busy) return;
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
    this.busy = Boolean(pose.busy);
    if (this.gesture && (time > this.gesture.until || pose.hop !== undefined || this.busy)) this.gesture = undefined;
    if (this.busy) this.nextFidget = Math.max(this.nextFidget, time + 6);
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
    // The stride keeps up with the ground covered instead of skating.
    const run = this.actions.get("run");
    if (run && dt > 0) {
      const speed = Math.hypot(pose.position.x - this.group.position.x, pose.position.z - this.group.position.z) / dt;
      run.timeScale += (THREE.MathUtils.clamp(speed / RUN_SPEED, .6, 1.7) - run.timeScale) * (1 - Math.exp(-dt * 8));
    }
    // The mixer only writes a bone when its animated value changes, so last frame's bend comes
    // off first; where a clip holds still it would otherwise add up.
    this.bend(-this.stooped);
    this.mixer.update(state.still ? 0 : dt);
    // Bent under a load: spread down the spine, the head bowed.
    look.stoop += ((pose.stoop ?? 0) - look.stoop) * (1 - Math.exp(-dt * 8));
    this.stooped = look.stoop > .001 ? look.stoop : 0;
    this.bend(this.stooped);

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

import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { records } from "./data";
import { CASE_H, INSERT_ASPECT, discLabelCanvas, insertCanvas, paintInsert } from "./case-art";

/** Archive units: the case stands 3.7 tall on y = 0, front cover towards +Z. */
const SCALE = 3.7 / CASE_H;
const ATLAS_COLUMNS = 5;
const SURFACE: Record<string, string> = {
  Case_Tray: "Case_Shell", Case_Lid: "Case_Shell",
  Insert_Front: "Insert_Print", Insert_Spine: "Insert_Print", Insert_Back: "Insert_Print",
  Disc: "Disc_Surface", Disc_Label: "Disc_Label", Disc_Hub: "Hub_Plastic",
};
// The array draws only the closed exterior; the inside appears on the selected case.
const EXTERIOR = ["Case_Tray", "Case_Lid", "Insert_Front", "Insert_Spine", "Insert_Back"];
const PART: Record<string, "lid" | "disc"> = { Case_Lid: "lid", Insert_Front: "lid", Disc: "disc", Disc_Label: "disc" };

export const isCaseSurface = (name: string) => /^(Case_|Insert_|Disc|Hub_)/.test(name);

function materials() {
  const shell = new THREE.MeshPhysicalMaterial({ name: "Case_Shell", color: "#171a1d", roughness: 0.43, clearcoat: 0.35, clearcoatRoughness: 0.25 });
  const print = new THREE.MeshPhysicalMaterial({ name: "Insert_Print", color: "#ffffff", roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.06 });
  const disc = new THREE.MeshPhysicalMaterial({ name: "Disc_Surface", color: "#d9d9d6", metalness: 1, roughness: 0.2 });
  const label = new THREE.MeshPhysicalMaterial({ name: "Disc_Label", color: "#ffffff", roughness: 0.4 });
  const hub = new THREE.MeshPhysicalMaterial({ name: "Hub_Plastic", color: "#1d2226", roughness: 0.5 });
  return { Case_Shell: shell, Insert_Print: print, Disc_Surface: disc, Disc_Label: label, Hub_Plastic: hub } as Record<string, THREE.MeshPhysicalMaterial>;
}

function texture(canvas: HTMLCanvasElement, anisotropy: number, flipY = false) {
  const map = new THREE.CanvasTexture(canvas);
  map.flipY = flipY;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = anisotropy;
  return map;
}
/** The disc label's planar UVs run bottom-up and mirrored, unlike the insert. */
function labelTexture(canvas: HTMLCanvasElement, anisotropy: number) {
  const map = texture(canvas, anisotropy, true);
  map.wrapS = THREE.RepeatWrapping;
  map.repeat.x = -1;
  return map;
}

let cover: { map: THREE.CanvasTexture; rows: number } | undefined;
function coverAtlas(anisotropy: number) {
  const rows = Math.ceil(records.length / ATLAS_COLUMNS);
  const tile = Math.floor(4096 / ATLAS_COLUMNS), tileH = Math.floor(tile / INSERT_ASPECT);
  const canvas = Object.assign(document.createElement("canvas"), { width: tile * ATLAS_COLUMNS, height: tileH * rows });
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#14181b";
  c.fillRect(0, 0, canvas.width, canvas.height);
  records.forEach((record, i) => paintInsert(c, record, i + 1, (i % ATLAS_COLUMNS) * tile + 2, Math.floor(i / ATLAS_COLUMNS) * tileH + 1, tile - 4));
  const map = texture(canvas, anisotropy);
  map.userData.shared = true;
  return { map, rows };
}

export interface GameCase {
  selected: THREE.Mesh[];
  instanced: { geometry: THREE.BufferGeometry; material: THREE.MeshPhysicalMaterial; castShadow: boolean }[];
  palettes: [string, THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial | undefined][];
  coverAttribute: THREE.InstancedBufferAttribute;
}

export function buildGameCase(gltf: GLTF, capacity: number, anisotropy: number, arrayVisibility = { value: 1 }): GameCase {
  gltf.scene.updateMatrixWorld(true);
  const base = new THREE.Matrix4().makeScale(SCALE, SCALE, SCALE).multiply(new THREE.Matrix4().makeTranslation(0, CASE_H / 2, 0));
  const pivot = {
    lid: gltf.scene.getObjectByName("Case_Lid")!.getWorldPosition(new THREE.Vector3()).applyMatrix4(base),
    disc: gltf.scene.getObjectByName("Disc")!.getWorldPosition(new THREE.Vector3()).applyMatrix4(base),
  };
  const high = materials();
  const coverAttribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
  cover = coverAtlas(anisotropy);
  const { map: atlas, rows } = cover;
  const low: Record<string, THREE.MeshPhysicalMaterial> = {
    Case_Shell: high.Case_Shell.clone(),
    Insert_Print: high.Insert_Print.clone(),
  };
  low.Insert_Print.map = atlas;
  low.Insert_Print.clearcoat = 0.6;
  low.Insert_Print.onBeforeCompile = (shader) => {
    shader.vertexShader = "attribute float archiveCover;\n" + shader.vertexShader.replace(
      "#include <uv_vertex>",
      `#include <uv_vertex>\nvMapUv = (vec2(mod(archiveCover, ${ATLAS_COLUMNS}.0), floor((archiveCover + 0.5) / ${ATLAS_COLUMNS}.0)) + vMapUv) / vec2(${ATLAS_COLUMNS}.0, ${rows}.0);`,
    );
  };
  low.Insert_Print.customProgramCacheKey = () => "archive-cover-atlas";
  for (const mat of Object.values(low)) {
    const compile = mat.onBeforeCompile.bind(mat);
    const cacheKey = mat.customProgramCacheKey.bind(mat);
    mat.onBeforeCompile = (shader, renderer) => {
      compile(shader, renderer);
      shader.uniforms.terminalArrayVisibility = arrayVisibility;
      shader.fragmentShader = "uniform float terminalArrayVisibility;\n" + shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
        float terminalNoise = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898,78.233))) * 43758.5453);
        if (terminalArrayVisibility <= terminalNoise) discard;`,
      );
    };
    const key = cacheKey();
    mat.customProgramCacheKey = () => key + "-terminal-fade";
  }

  const selected: THREE.Mesh[] = [];
  const instanced: GameCase["instanced"] = [];
  const meshes: THREE.Mesh[] = [];
  gltf.scene.traverse((o) => { if (o instanceof THREE.Mesh && SURFACE[o.name]) meshes.push(o); });
  // The tray must be the first instanced batch: picking and shadows use it.
  meshes.sort((a, b) => Number(b.name === "Case_Tray") - Number(a.name === "Case_Tray"));
  for (const source of meshes) {
    const surface = SURFACE[source.name];
    const geometry = source.geometry.clone().applyMatrix4(base.clone().multiply(source.matrixWorld));
    if (EXTERIOR.includes(source.name)) {
      const arrayGeometry = geometry.clone();
      if (surface === "Insert_Print") arrayGeometry.setAttribute("archiveCover", coverAttribute);
      instanced.push({ geometry: arrayGeometry, material: low[surface], castShadow: source.name === "Case_Tray" });
    }
    const part = PART[source.name];
    if (part) geometry.translate(-pivot[part].x, -pivot[part].y, -pivot[part].z);
    const mesh = new THREE.Mesh(geometry, high[surface]);
    mesh.name = source.name;
    mesh.userData.surface = surface;
    mesh.userData.casePart = part;
    if (part) mesh.position.copy(pivot[part]);
    mesh.userData.caseBase = mesh.position.toArray();
    mesh.castShadow = source.name === "Case_Tray" || source.name === "Case_Lid" || part === "disc";
    mesh.receiveShadow = true;
    selected.push(mesh);
  }
  const palettes: GameCase["palettes"] = Object.entries(high).map(([name, mat]) => [name, mat, low[name]]);
  return { selected, instanced, palettes, coverAttribute };
}

const DISC_RADIUS = 0.6 * SCALE;
const DEFAULT_SLOT = new THREE.Vector3(8.675, 2.4, 0.05);

/**
 * Lid swings open on the spine hinge, then the disc rises and spins. `insert`
 * turns the disc upright in front of the console slot (`slotTop`, case-local) and
 * pushes it in, where the console body hides it.
 */
export function poseCase(group: THREE.Object3D, open: number, time: number, insert = 0, slotTop?: THREE.Vector3) {
  const lid = THREE.MathUtils.smoothstep(open, 0, 0.7);
  const lift = THREE.MathUtils.smoothstep(open, 0.45, 1);
  const travel = THREE.MathUtils.smoothstep(insert, 0.24, 0.43);
  const push = THREE.MathUtils.smoothstep(insert, 0.44, 0.58);
  const slot = slotTop ?? DEFAULT_SLOT;
  for (const child of group.children) {
    const part = child.userData.casePart;
    if (!part) continue;
    const [x, y, z] = child.userData.caseBase as number[];
    // Half-open like a door, so the cover art stays readable beside the disc.
    if (part === "lid") child.rotation.y = -1.25 * lid;
    else {
      const outX = x + 1.35 * lift, outY = y + 0.2 * lift, outZ = z + 0.55 * lift;
      child.position.set(
        THREE.MathUtils.lerp(outX, slot.x, travel),
        THREE.MathUtils.lerp(outY, slot.y, travel),
        THREE.MathUtils.lerp(outZ, slot.z + DISC_RADIUS + 0.2, travel) - push * (2 * DISC_RADIUS + 0.5),
      );
      child.rotation.y = Math.PI / 2 * travel;
      child.rotation.z = time * 1.4 * lift + insert * 4;
    }
  }
}
export const isSharedMap = (map: THREE.Texture | null | undefined) => Boolean(map?.userData.shared);

function setMap(mat: THREE.MeshPhysicalMaterial, map: THREE.Texture | null) {
  if (mat.map === map) return;
  // Only the presence of a map changes the shader program.
  if (Boolean(mat.map) !== Boolean(map)) mat.needsUpdate = true;
  if (!isSharedMap(mat.map)) mat.map?.dispose();
  mat.map = map;
}

/** Point an insert's UVs at one atlas tile, or back at a full print (tile = null). */
function setTile(mesh: THREE.Mesh, index: number | null) {
  const uv = mesh.geometry.getAttribute("uv") as THREE.BufferAttribute;
  mesh.userData.baseUv ??= Array.from(uv.array as Float32Array);
  const base = mesh.userData.baseUv as number[];
  const rows = cover!.rows;
  for (let i = 0; i < uv.count; i++) {
    const u = base[i * 2], v = base[i * 2 + 1];
    if (index === null) uv.setXY(i, u, v);
    else uv.setXY(i, ((index % ATLAS_COLUMNS) + u) / ATLAS_COLUMNS, (Math.floor(index / ATLAS_COLUMNS) + v) / rows);
  }
  uv.needsUpdate = true;
}

/**
 * Print one record on a prepared case. While browsing, the cover reuses the
 * array atlas (no painting or upload); `detail` paints the full-resolution
 * insert and disc label once the selection settles.
 */
export function printCase(group: THREE.Object3D, index: number, anisotropy: number, detail: boolean) {
  const record = records[index];
  const insert = detail ? texture(insertCanvas(record, index + 1, 1536), anisotropy) : cover!.map;
  const label = detail ? labelTexture(discLabelCanvas(record), anisotropy) : null;
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh)) continue;
    const mat = child.material as THREE.MeshPhysicalMaterial;
    if (child.userData.surface === "Insert_Print") {
      setTile(child, detail ? null : index);
      setMap(mat, insert);
    }
    if (child.userData.surface === "Disc_Label") setMap(mat, label);
  }
}

/** Hand the printed textures of `from` to a prepared copy, without repainting. */
export function transferPrint(from: THREE.Object3D, to: THREE.Object3D) {
  for (const target of to.children) {
    const source = from.getObjectByName(target.name);
    if (!(target instanceof THREE.Mesh) || !(source instanceof THREE.Mesh)) continue;
    if (target.userData.surface !== "Insert_Print" && target.userData.surface !== "Disc_Label") continue;
    // The copy keeps the UVs it was printed with; the selected case rewrites its own.
    if (target.userData.surface === "Insert_Print") {
      target.geometry = source.geometry.clone();
      target.userData.ownGeometry = true;
    }
    const sourceMat = source.material as THREE.MeshPhysicalMaterial;
    const targetMat = target.material as THREE.MeshPhysicalMaterial;
    targetMat.map = sourceMat.map;
    targetMat.needsUpdate = true;
    sourceMat.map = null;
    sourceMat.needsUpdate = true;
  }
}

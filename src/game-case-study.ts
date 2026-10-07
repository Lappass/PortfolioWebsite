import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import "./fonts.css";
import { records, type ArchiveRecord } from "./data";
import { CASE_H, CASE_SPINE, discLabelCanvas, insertCanvas } from "./case-art";

const H = CASE_H, D = 0.13;
const PITCH = CASE_SPINE + 0.035;

document.body.innerHTML = `
<style>
  html, body { margin: 0; height: 100%; background: #101315; color: #e0e3dc; font-family: MiSans, system-ui, sans-serif; overflow: hidden; }
  canvas { display: block; }
  .hud { position: fixed; left: 48px; right: 48px; pointer-events: none; display: flex; justify-content: space-between; align-items: flex-end; }
  .top { top: 40px; align-items: flex-start; }
  .bottom { bottom: 40px; }
  .brand b { display: block; font-size: 34px; letter-spacing: .04em; }
  .brand span, .hint, .kicker { font-size: 11px; letter-spacing: .16em; color: #8c979a; }
  .info { max-width: 420px; text-align: right; }
  .info h1 { margin: 8px 0 6px; font-size: 30px; }
  .info p { margin: 0; color: #b4bcbd; line-height: 1.7; font-size: 14px; }
  .actions { margin-top: 18px; display: flex; gap: 8px; justify-content: flex-end; pointer-events: auto; }
  button { font: inherit; font-size: 13px; letter-spacing: .1em; padding: 12px 18px; border: 1px solid #e0e3dc; background: none; color: inherit; cursor: pointer; }
  button.primary { background: #e0e3dc; color: #101315; }
  button:hover { border-color: #c5a16b; }
</style>
<div class="hud top"><div class="brand"><b>LAPPAS</b><span>GAME CASE STUDY · 试验页</span></div><div class="hint">← → 选择 · ENTER 打开 / 合上 · ESC 放回 · 拖动旋转</div></div>
<div class="hud bottom"><div class="hint" id="count"></div><div class="info"><div class="kicker" id="kicker"></div><h1 id="title"></h1><p id="summary"></p>
<div class="actions"><button id="toggle" class="primary">打开盒子</button><button id="details">查看详细信息 →</button></div></div></div>`;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#101315");
scene.fog = new THREE.Fog("#101315", 6, 13);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
const key = new THREE.DirectionalLight("#fff4e6", 2.2);
key.position.set(-3, 5, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -6, right: 6, top: 4, bottom: -3 });
key.shadow.bias = -0.0004;
scene.add(key, new THREE.HemisphereLight("#9fb3c8", "#0b0d0e", 0.6));
const shelf = new THREE.Mesh(new THREE.BoxGeometry(40, 0.08, 2.4), new THREE.MeshStandardMaterial({ color: "#1a1f22", roughness: 0.55 }));
shelf.position.set(0, -H / 2 - 0.04, -0.2);
shelf.receiveShadow = true;
scene.add(shelf);

// ---------- printed artwork ----------
function canvasTexture(canvas: HTMLCanvasElement, flip: boolean) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = flip;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}
const insertTexture = (r: ArchiveRecord, index: number) => canvasTexture(insertCanvas(r, index + 1), false);
function labelTexture(r: ArchiveRecord) {
  // The disc label's planar UVs run bottom-up and mirrored, unlike the insert.
  const texture = canvasTexture(discLabelCanvas(r), true);
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.x = -1;
  return texture;
}

// ---------- cases ----------
interface Case { root: THREE.Group; lid: THREE.Object3D; disc: THREE.Group; discBase: THREE.Vector3; record: ArchiveRecord; out: number; open: number; spin: number; turn: number }
const cases: Case[] = [];
const items = records.slice(0, 16);
let selected = 0, opened = false, dragTurn = 0;

const gltf = await new GLTFLoader().loadAsync("/assets/game-case.glb");
await document.fonts.load("700 40px MiSans", "LAPPAS 作品三维档案集");
const template = gltf.scene;
const shell = new THREE.MeshPhysicalMaterial({ color: "#0f1316", roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 });
const discMat = new THREE.MeshPhysicalMaterial({ color: "#d9dde0", metalness: 1, roughness: 0.12, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 620] });
const hubMat = new THREE.MeshStandardMaterial({ color: "#1d2226", roughness: 0.5 });

items.forEach((record, i) => {
  const root = template.clone(true);
  const art = insertTexture(record, records.indexOf(record));
  const print = new THREE.MeshPhysicalMaterial({ map: art, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.06 });
  const label = new THREE.MeshStandardMaterial({ map: labelTexture(record), roughness: 0.4 });
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.castShadow = o.receiveShadow = true;
    const name = o.name;
    o.material = name.startsWith("Insert_") ? print : name === "Disc_Label" ? label : name === "Disc" ? discMat : name === "Disc_Hub" ? hubMat : shell;
  });
  const lid = root.getObjectByName("Case_Lid")!;
  const discMesh = root.getObjectByName("Disc")!;
  // Spin the disc about its own centre, facing the lid.
  const disc = new THREE.Group();
  discMesh.updateWorldMatrix(true, false);
  disc.position.copy(discMesh.getWorldPosition(new THREE.Vector3()));
  root.add(disc);
  disc.attach(discMesh);
  const group = new THREE.Group();
  group.add(root);
  scene.add(group);
  cases.push({ root: group, lid, disc, discBase: disc.position.clone(), record, out: 0, open: 0, spin: 0, turn: 0 });
});

// ---------- interaction ----------
const $ = (id: string) => document.getElementById(id)!;
function select(index: number) {
  if (opened) setOpen(false);
  selected = (index + cases.length) % cases.length;
  dragTurn = 0;
  const r = cases[selected].record;
  $("kicker").textContent = `${r.category} · ${r.id}`;
  $("title").textContent = r.title;
  $("summary").textContent = r.abstract;
  $("count").textContent = `${String(selected + 1).padStart(2, "0")} / ${String(cases.length).padStart(2, "0")}`;
}
function setOpen(value: boolean) {
  opened = value;
  $("toggle").textContent = opened ? "合上盒子" : "打开盒子";
}
$("toggle").onclick = () => setOpen(!opened);
$("details").onclick = () => { location.href = `/#/work/${cases[selected].record.id.toLowerCase()}`; };
addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") select(selected + 1);
  if (e.key === "ArrowLeft") select(selected - 1);
  if (e.key === "Enter") setOpen(!opened);
  if (e.key === "Escape") setOpen(false);
});
const pointer = new THREE.Vector2(), ray = new THREE.Raycaster();
let drag: { x: number; turn: number } | null = null, moved = false;
renderer.domElement.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, turn: dragTurn }; moved = false; });
addEventListener("pointermove", (e) => {
  if (!drag) return;
  if (Math.abs(e.clientX - drag.x) > 4) moved = true;
  dragTurn = THREE.MathUtils.clamp(drag.turn + (e.clientX - drag.x) * 0.008, -2.6, 2.6);
});
addEventListener("pointerup", (e) => {
  if (drag && !moved) {
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(cases.map((c) => c.root), true)[0];
    const index = hit ? cases.findIndex((c) => c.root.getObjectById(hit.object.id) || c.root === hit.object) : -1;
    if (index === selected) setOpen(!opened);
    else if (index >= 0) select(index);
  }
  drag = null;
});

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
select(0);

// ---------- animation ----------
const damp = (from: number, to: number, rate: number, dt: number) => THREE.MathUtils.damp(from, to, rate, dt);
const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  cases.forEach((c, i) => {
    const active = i === selected;
    c.out = damp(c.out, active ? 1 : 0, 6, dt);
    c.open = damp(c.open, active && opened ? 1 : 0, opened ? 4 : 7, dt);
    c.turn = damp(c.turn, active ? dragTurn : 0, 8, dt);
    // Neighbours part to make room for the case being pulled out.
    const part = i === selected ? 0 : Math.sign(i - selected) * 0.5 * cases[selected].out;
    // On the shelf the spine faces the camera; pulled out, the front cover does.
    c.root.position.set((i - selected) * PITCH + part, 0.06 * c.out + 0.15 * c.open, 1.35 * c.out);
    c.root.rotation.y = Math.PI / 2 * (1 - c.out) + c.turn + 0.28 * c.open;
    c.lid.rotation.y = -1.95 * c.open;
    // The disc rises out of the tray once the lid has cleared it.
    const lift = THREE.MathUtils.smoothstep(c.open, 0.45, 1);
    c.disc.position.set(c.discBase.x, c.discBase.y + 0.22 * lift, c.discBase.z + 0.6 * lift);
    c.spin += dt * (0.4 + 7 * lift);
    c.disc.rotation.z = c.spin * lift;
  });
  camTarget.set(0, 0.05, 0.9);
  camera.position.set(0.25, 0.55, 6.1);
  camera.lookAt(camTarget);
  renderer.render(scene, camera);
});

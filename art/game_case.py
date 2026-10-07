"""Generic game case: open-front tray, hinged lid, wraparound insert and disc.

Run: blender --background --factory-startup --python art/game_case.py
Outputs art/game-case.blend, art/game-case-studio.png and public/assets/game-case.glb.
Blender Z-up: width X, height Z, front faces -Y (glTF +Z). Units are decimetres.
"""
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
W, H, D = 1.35, 1.70, 0.13   # tray, closed lid adds L
L = 0.018                    # lid plate
T = 0.016                    # tray wall
BEVEL = 0.045
INSET = 0.012                # insert margin under the clear sleeve
SPINE = D + L
U_TOTAL = W + SPINE + W      # [back][spine][front], viewed from outside

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"


def material(name, color, roughness, metallic=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if alpha < 1:
        bsdf.inputs["Alpha"].default_value = alpha
    return mat


MAT = {
    "shell": material("Case_Shell", (0.035, 0.04, 0.046), 0.32),
    "lid": material("Case_Lid", (0.035, 0.04, 0.046), 0.28),
    "print": material("Insert_Print", (0.92, 0.92, 0.9), 0.4),
    "disc": material("Disc_Surface", (0.78, 0.8, 0.82), 0.12, metallic=1.0),
    "label": material("Disc_Label", (0.92, 0.92, 0.9), 0.45),
    "hub": material("Hub_Plastic", (0.06, 0.065, 0.07), 0.5),
}


def box(name, size, location, mat, bevel=BEVEL):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = obj.data.name = name
    obj.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = obj.modifiers.new("Rounded", "BEVEL")
        mod.width, mod.segments, mod.limit_method = bevel, 4, "ANGLE"
    obj.data.materials.append(mat)
    return obj


def cut(target, cutter):
    mod = target.modifiers.new(f"Cut_{cutter.name}", "BOOLEAN")
    mod.operation, mod.object, mod.solver = "DIFFERENCE", cutter, "EXACT"
    cutter.hide_render = cutter.hide_viewport = True
    cutter.hide_set(True)


def panel(name, corners, uvs, normal, mat):
    """One printed quad with explicit UVs, wound to face `normal`."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = [bm.verts.new(c) for c in corners]
    face = bm.faces.new(verts)
    uv_layer = bm.loops.layers.uv.new("UVMap")
    for loop, uv in zip(face.loops, uvs):
        loop[uv_layer].uv = uv
    bm.normal_update()
    if face.normal.dot(Vector(normal)) < 0:
        face.normal_flip()
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def u(x):
    return x / U_TOTAL


# Tray: full depth on the spine side so the spine print never splits.
tray = box("Case_Tray", (W, D, H), (0, 0, 0), MAT["shell"])
inner = box("Tray_Cavity", (W - 2 * T, D + 0.2, H - 2 * T), (0, -0.1 - T / 2, 0), MAT["shell"], bevel=0.02)
cut(tray, inner)

# Lid hinges on the spine edge (x = -W/2) at the tray's front face.
lid = box("Case_Lid", (W, L, H), (0, -D / 2 - L / 2, 0), MAT["lid"], bevel=0.03)
scene.cursor.location = (-W / 2, -D / 2, 0)
bpy.context.view_layer.objects.active = lid
lid.select_set(True)
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
lid.select_set(False)

x0, x1 = -W / 2 + INSET, W / 2 - INSET
z0, z1 = -H / 2 + INSET, H / 2 - INSET
v0, v1 = INSET / H, 1 - INSET / H
front_y = -D / 2 - L - 0.0015
front = panel("Insert_Front", [(x0, front_y, z0), (x1, front_y, z0), (x1, front_y, z1), (x0, front_y, z1)],
              [(u(W + SPINE + INSET), v0), (u(U_TOTAL - INSET), v0), (u(U_TOTAL - INSET), v1), (u(W + SPINE + INSET), v1)],
              (0, -1, 0), MAT["print"])
front.parent = lid
front.matrix_parent_inverse = lid.matrix_world.inverted()

sx = -W / 2 - 0.0015
spine = panel("Insert_Spine", [(sx, D / 2 - INSET / 2, z0), (sx, -D / 2 - L + INSET / 2, z0), (sx, -D / 2 - L + INSET / 2, z1), (sx, D / 2 - INSET / 2, z1)],
              [(u(W), v0), (u(W + SPINE), v0), (u(W + SPINE), v1), (u(W), v1)],
              (-1, 0, 0), MAT["print"])
by = D / 2 + 0.0015
back = panel("Insert_Back", [(x1, by, z0), (x0, by, z0), (x0, by, z1), (x1, by, z1)],
             [(u(INSET), v0), (u(W - INSET), v0), (u(W - INSET), v1), (u(INSET), v1)],
             (0, 1, 0), MAT["print"])

# Disc rests on a hub near the tray floor.
floor_y = D / 2 - T
disc_y = floor_y - 0.035
bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=0.6, depth=0.012, location=(0.03, disc_y, 0), rotation=(math.pi / 2, 0, 0))
disc = bpy.context.object
disc.name = disc.data.name = "Disc"
disc.data.materials.append(MAT["disc"])
bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.075, depth=0.1, location=(0.03, disc_y, 0), rotation=(math.pi / 2, 0, 0))
cut(disc, bpy.context.object)
bpy.context.object.name = "Disc_Hole"

mesh = bpy.data.meshes.new("Disc_Label")
bm = bmesh.new()
bmesh.ops.create_circle(bm, cap_ends=False, segments=128, radius=0.585)
outer = list(bm.verts)
bmesh.ops.create_circle(bm, cap_ends=False, segments=128, radius=0.21)
inner_ring = [v for v in bm.verts if v not in outer]
uv_layer = bm.loops.layers.uv.new("UVMap")
for i in range(128):
    j = (i + 1) % 128
    face = bm.faces.new((inner_ring[i], inner_ring[j], outer[j], outer[i]))
    for loop in face.loops:
        co = loop.vert.co
        loop[uv_layer].uv = (0.5 + co.x / 1.17, 0.5 + co.y / 1.17)
bm.normal_update()
for face in bm.faces:
    if face.normal.z < 0:
        face.normal_flip()
bm.to_mesh(mesh)
bm.free()
label = bpy.data.objects.new("Disc_Label", mesh)
scene.collection.objects.link(label)
label.data.materials.append(MAT["label"])
# The disc's local +Z faces the lid (-Y); the label rides just above that face.
label.parent = disc
label.matrix_parent_inverse.identity()
label.location = (0, 0, 0.0065)

bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.1, depth=floor_y - disc_y + 0.02, location=(0.03, (floor_y + disc_y) / 2, 0), rotation=(math.pi / 2, 0, 0))
hub = bpy.context.object
hub.name = hub.data.name = "Disc_Hub"
hub.data.materials.append(MAT["hub"])

# Studio for review renders.
bpy.ops.object.camera_add(location=(2.6, -3.4, 1.4))
cam = bpy.context.object
cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.lens = 50
scene.camera = cam
for name, loc, power in [("Key", (-3, -4, 4), 900), ("Rim", (4, 3, 3), 700), ("Fill", (3, -4, -1), 250)]:
    bpy.ops.object.light_add(type="AREA", location=loc)
    light = bpy.context.object
    light.name, light.data.energy, light.data.size = name, power, 4
    light.rotation_euler = (Vector((0, 0, 0)) - light.location).to_track_quat("-Z", "Y").to_euler()
scene.world = bpy.data.worlds.new("Graphite")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.055, 0.06, 1)
scene.render.engine = "CYCLES"
scene.cycles.samples = 64
scene.render.resolution_x, scene.render.resolution_y = 1000, 1000
scene.render.filepath = str(ROOT / "art/game-case-studio.png")

lid.rotation_euler = (0, 0, math.radians(-35))
bpy.ops.render.render(write_still=True)
lid.rotation_euler = (0, 0, 0)

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "art/game-case.blend"))
for obj in scene.objects:
    obj.select_set(obj.type == "MESH" and not obj.hide_render)
bpy.ops.export_scene.gltf(
    filepath=str(ROOT / "public/assets/game-case.glb"),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_materials="EXPORT",
)
print("game case exported")

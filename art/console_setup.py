"""Generic living-room setup: a low stand, a horizontal console with a front
disc slot, and a 16:9 monitor. No brand marks.

Run: blender --background --factory-startup --python art/console_setup.py
Outputs art/console-setup.blend, art/console-setup-studio.png and public/assets/console-setup.glb.
Blender Z-up; the front faces -Y (glTF +Z). Units match the archive scene (case height 3.7).
Origin: centre of the console's footprint on the stand top (z = 0).
Named nodes used by the site: Console_Slot (slot centre), Slot_Light, Monitor_Screen.
"""
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
CW, CH, CD = 3.9, 0.95, 2.6        # console
SW, SH, SD = 17.0, 1.3, 3.0        # stand (top at z = 0)
MW, MH = 8.2, 4.6                  # monitor screen
MX, MZ = 7.4, 0.75                 # monitor centre x, screen bottom height

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def material(name, color, roughness, metallic=0.0, emission=None, strength=4.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    return mat


SHELL = material("Console_Shell", (0.9, 0.91, 0.92), 0.35)
CORE = material("Console_Core", (0.02, 0.022, 0.026), 0.3)
LIGHT = material("Slot_Light", (0.5, 0.7, 1.0), 0.3, emission=(0.35, 0.6, 1.0))
STAND = material("Stand_Wood", (0.045, 0.05, 0.06), 0.55)
BEZEL = material("Monitor_Bezel", (0.015, 0.016, 0.018), 0.25, metallic=0.4)
SCREEN = material("Monitor_Screen", (0.01, 0.015, 0.03), 0.15, emission=(0.02, 0.05, 0.12), strength=1.0)


def box(name, size, location, mat, bevel=0.03, segments=3):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = obj.data.name = name
    obj.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = obj.modifiers.new("Rounded", "BEVEL")
        mod.width, mod.segments, mod.limit_method = bevel, segments, "ANGLE"
    obj.data.materials.append(mat)
    return obj


# Stand under everything, its top at z = 0, slightly behind the console front.
box("Stand", (SW, SD, SH), (MX / 2, 0.1, -SH / 2), STAND, bevel=0.04)

# Console lying flat: black core band between two white shells that flare out.
box("Console_Core", (CW - 0.2, CD - 0.1, CH * 0.42), (0, 0, CH * 0.5), CORE, bevel=0.03)
box("Console_Shell_Lower", (CW, CD, CH * 0.32), (0, 0, CH * 0.16), SHELL, bevel=0.12, segments=6)
box("Console_Shell_Upper", (CW + 0.12, CD + 0.08, CH * 0.3), (0, 0, CH * 0.85), SHELL, bevel=0.12, segments=6)
# Front: a horizontal disc slot in the black band, a light strip and a power button.
slot_z = CH * 0.5
box("Console_Slot_Recess", (2.9, 0.06, 0.07), (-0.25, -CD / 2 + 0.02, slot_z), material("Slot_Shadow", (0, 0, 0), 0.9), bevel=0)
box("Slot_Light", (CW - 0.5, 0.03, 0.025), (0, -CD / 2 - 0.035, CH * 0.33), LIGHT, bevel=0)
box("Console_Button", (0.18, 0.05, 0.08), (1.55, -CD / 2 + 0.01, slot_z), SHELL, bevel=0.02)
# Marker at the slot mouth; the site sends the disc here.
bpy.ops.object.empty_add(location=(-0.25, -CD / 2, slot_z))
bpy.context.object.name = "Console_Slot"

# Monitor on a short foot, screen facing front.
box("Monitor_Foot", (2.4, 1.2, 0.06), (MX, 0.2, 0.03), BEZEL, bevel=0.02)
box("Monitor_Neck", (0.3, 0.2, MZ + 0.2), (MX, 0.35, (MZ + 0.2) / 2), BEZEL, bevel=0.02)
box("Monitor_Frame", (MW + 0.24, 0.22, MH + 0.24), (MX, 0.2, MZ + MH / 2), BEZEL, bevel=0.04)
# The screen is a plain quad with 0..1 UVs so the site can draw on it.
mesh = bpy.data.meshes.new("Monitor_Screen")
bm = bmesh.new()
y = 0.2 - 0.115
corners = [(MX - MW / 2, y, MZ), (MX + MW / 2, y, MZ), (MX + MW / 2, y, MZ + MH), (MX - MW / 2, y, MZ + MH)]
verts = [bm.verts.new(c) for c in corners]
face = bm.faces.new(verts)
uv = bm.loops.layers.uv.new("UVMap")
for loop, coord in zip(face.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
    loop[uv].uv = coord
bm.normal_update()
if face.normal.y > 0:
    face.normal_flip()
bm.to_mesh(mesh)
bm.free()
screen = bpy.data.objects.new("Monitor_Screen", mesh)
scene.collection.objects.link(screen)
screen.data.materials.append(SCREEN)

bpy.ops.object.camera_add(location=(4, -26, 7))
cam = bpy.context.object
cam.rotation_euler = (Vector((3.6, 0, 2)) - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.lens = 50
scene.camera = cam
for name, loc, power in [("Key", (-6, -10, 10), 4000), ("Rim", (12, 6, 8), 3000), ("Fill", (8, -12, 2), 1200)]:
    bpy.ops.object.light_add(type="AREA", location=loc)
    light = bpy.context.object
    light.name, light.data.energy, light.data.size = name, power, 8
    light.rotation_euler = (Vector((3, 0, 1)) - light.location).to_track_quat("-Z", "Y").to_euler()
scene.world = bpy.data.worlds.new("Night_Blue")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.02, 0.04, 0.09, 1)
scene.render.engine = "CYCLES"
scene.cycles.samples = 64
scene.render.resolution_x, scene.render.resolution_y = 1400, 800
scene.render.filepath = str(ROOT / "art/console-setup-studio.png")
bpy.ops.render.render(write_still=True)

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "art/console-setup.blend"))
for obj in scene.objects:
    obj.select_set(obj.type in {"MESH", "EMPTY"})
bpy.ops.export_scene.gltf(
    filepath=str(ROOT / "public/assets/console-setup.glb"),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
)
print("setup exported")

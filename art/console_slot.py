"""Generic slot-loading console: the disc sinks edge-first into a slit on its top.

Run: blender --background --factory-startup --python art/console_slot.py
Outputs art/console-slot.blend, art/console-slot-studio.png and public/assets/console-slot.glb.
Blender Z-up; the front faces -Y (glTF +Z). Units match the archive scene (case height 3.7).
The front plate is taller than the disc, so a sinking disc is hidden by real geometry.
"""
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
W, H, D = 3.4, 2.9, 0.9      # console width, height, depth
CAP = 0.14                  # white end caps

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def material(name, color, roughness, metallic=0.0, emission=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = 4
    return mat


CORE = material("Slot_Core", (0.02, 0.022, 0.025), 0.35)
SHELL = material("Slot_Shell", (0.86, 0.87, 0.86), 0.42)
LIGHT = material("Slot_Light", (0.6, 0.75, 1.0), 0.3, emission=(0.45, 0.65, 1.0))


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


box("Slot_Body", (W, D, H), (0, 0, H / 2), CORE, bevel=0.05)
for side, name in ((-1, "Slot_Cap_Left"), (1, "Slot_Cap_Right")):
    box(name, (CAP, D + 0.06, H + 0.06), (side * (W / 2 + CAP / 2), 0, H / 2), SHELL, bevel=0.05, segments=5)
# The slit sits on top, slightly toward the front; the light strip runs along the front edge.
box("Slot_Slit", (2.9, 0.05, 0.02), (0, -0.08, H + 0.004), material("Slot_Shadow", (0, 0, 0), 0.9), bevel=0)
box("Slot_Light", (2.9, 0.02, 0.025), (0, -D / 2 - 0.006, H - 0.12), LIGHT, bevel=0)

bpy.ops.object.camera_add(location=(4.5, -9, 4.5))
cam = bpy.context.object
cam.rotation_euler = (Vector((0, 0, 1.4)) - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.lens = 50
scene.camera = cam
for name, loc, power in [("Key", (-4, -6, 6), 1200), ("Rim", (5, 4, 5), 900), ("Fill", (5, -6, 1), 300)]:
    bpy.ops.object.light_add(type="AREA", location=loc)
    light = bpy.context.object
    light.name, light.data.energy, light.data.size = name, power, 5
    light.rotation_euler = (Vector((0, 0, 0.2)) - light.location).to_track_quat("-Z", "Y").to_euler()
scene.world = bpy.data.worlds.new("Graphite")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.055, 0.06, 1)
scene.render.engine = "CYCLES"
scene.cycles.samples = 64
scene.render.resolution_x, scene.render.resolution_y = 1000, 900
scene.render.filepath = str(ROOT / "art/console-slot-studio.png")
bpy.ops.render.render(write_still=True)

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "art/console-slot.blend"))
for obj in scene.objects:
    obj.select_set(obj.type == "MESH")
bpy.ops.export_scene.gltf(
    filepath=str(ROOT / "public/assets/console-slot.glb"),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
)
print("console exported")

"""The animated figure: one skinned mesh with every clip, arms corrected for its proportions.

Run: blender --background --factory-startup --python art/figure_rig.py [-- preview-dir]
Reads the Meshy exports in Rigged/ (one GLB per clip, same skeleton) and writes
art/figure-rig.blend and art/figure-rig.glb; `npm run compress:figure` then writes the
compressed public/assets/figure.glb the site loads.

Why the arms need correcting: the clips were made for a slim, long-armed biped whose arms
hang beside its hips. This figure has short arms and a wide body, so the same joint angles
put the arms inside the hoodie and the hands through the trousers. Each frame the upper arms
are swung outwards just far enough for the hands to clear the body; raised arms are left alone.
"""
from pathlib import Path
from math import atan2, radians, sin, cos
import sys

import bpy
from mathutils import Quaternion, Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Rigged/Meshy_AI_chibi_doll_rigged_v2_biped"
PREFIX = "Meshy_AI_chibi_doll_rigged_v2_biped_Animation_"
# Site name -> Meshy clip. The first one supplies the mesh.
CLIPS = {
    "idle": "Idle_12", "sit": "Chair_Sit_Idle_M", "doze": "Sit_and_Doze_Off", "jump": "Jumping_Down",
    "look": "Look_Around_Dumbfounded", "cheer": "Victory_Cheer", "wave": "Wave_One_Hand",
    "walk": "Walking", "run": "Running",
}
# Hanging arms keep at least this angle from the body, measured shoulder to hand.
CLEARANCE = radians(34)


def load(clip):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE / f"{PREFIX}{clip}_withSkin.glb"))
    added = [o for o in bpy.data.objects if o not in before]
    armature = next(o for o in added if o.type == "ARMATURE")
    return armature, added


def clear_arms(armature):
    """Swing the upper arms out of the body on every frame of the armature's action."""
    scene = bpy.context.scene
    action = armature.animation_data.action
    first, last = (int(round(v)) for v in action.frame_range)
    bones = armature.pose.bones
    fixes = {}
    for frame in range(first, last + 1):
        scene.frame_set(frame)
        for side, sign in (("Left", 1), ("Right", -1)):
            arm, hand = bones[f"mixamorig:{side}Arm"], bones[f"mixamorig:{side}Hand"]
            reach = hand.head - arm.head                      # armature space, Z up, +X is the left side
            out, down = reach.x * sign, -reach.z
            # Only hanging arms: fade the correction out as the hand comes up to shoulder height.
            hanging = min(1, max(0, down / reach.length / .55))
            lift = max(0, CLEARANCE - atan2(out, max(down, 1e-6))) * hanging
            if lift < 1e-4:
                continue
            # Rotate about the front-to-back axis, expressed in the bone's own posed frame.
            world = Quaternion(Vector((0, 1, 0)), -sign * lift)
            parent = arm.parent.matrix.to_quaternion() @ (arm.parent.bone.matrix_local.to_quaternion().inverted() @ arm.bone.matrix_local.to_quaternion())
            fixes[(frame, arm.name)] = (parent.inverted() @ world @ parent) @ arm.rotation_quaternion
    for (frame, name), rotation in fixes.items():
        bone = bones[name]
        bone.rotation_quaternion = rotation
        bone.keyframe_insert("rotation_quaternion", frame=frame)
    return len(fixes)


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    figure = None
    for name, clip in CLIPS.items():
        armature, added = load(clip)
        action = armature.animation_data.action
        action.name = name
        print(f"{name}: {clear_arms(armature)} arm keys corrected over {int(action.frame_range[1])} frames")
        if figure is None:
            figure = armature
            # Meshy leaves a helper sphere in the file.
            for obj in added:
                if obj.type == "MESH" and not obj.modifiers:
                    bpy.data.objects.remove(obj, do_unlink=True)
        else:
            for obj in added:
                bpy.data.objects.remove(obj, do_unlink=True)
        # Park every clip on its own NLA track so the exporter writes them all.
        figure.animation_data.action = None
        track = figure.animation_data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, 0, action)
        if hasattr(strip, "action_slot") and action.slots:
            strip.action_slot = action.slots[0]
        track.mute = True
    return figure


def preview(figure, folder):
    """Front renders of a few frames per clip, for checking the arms."""
    scene = bpy.context.scene
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    scene.camera = camera
    camera.data.type, camera.data.ortho_scale = "ORTHO", 2.4
    camera.location = Vector((2.1, -6, 1.75))
    camera.rotation_euler = (Vector((0, 0, .85)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.world = bpy.data.worlds.new("Preview")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.75, .75, .75, 1)
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light, scene.display.shading.color_type = "STUDIO", "TEXTURE"
    scene.render.resolution_x, scene.render.resolution_y = 300, 400
    for track in figure.animation_data.nla_tracks:
        action = track.strips[0].action
        figure.animation_data.action = action
        if hasattr(figure.animation_data, "action_slot") and action.slots:
            figure.animation_data.action_slot = action.slots[0]
        last = int(action.frame_range[1])
        for index in range(5):
            scene.frame_set(round(last * index / 5))
            scene.render.filepath = str(Path(folder) / f"{track.name}-{index}.png")
            bpy.ops.render.render(write_still=True)
    figure.animation_data.action = None
    bpy.data.objects.remove(camera, do_unlink=True)


if __name__ == "__main__":
    figure = build()
    if "--" in sys.argv and sys.argv[-1] != "--":
        preview(figure, sys.argv[-1])
    # Each import brought its own copy of the mesh and textures; keep only the figure's.
    bpy.data.orphans_purge(do_recursive=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "art/figure-rig.blend"))
    bpy.ops.export_scene.gltf(
        filepath=str(ROOT / "art/figure-rig.glb"), export_format="GLB",
        export_animations=True, export_animation_mode="NLA_TRACKS", export_force_sampling=True,
        export_skins=True, export_yup=True,
    )
    print("figure exported")

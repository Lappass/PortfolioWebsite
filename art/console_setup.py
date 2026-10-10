"""Shared terminal: a low stand, an upright console with a vertical disc slot,
a 16:9 monitor, and Shuhang's own controller (see art/vendor/gamepad).

Run: blender --background --factory-startup --python art/console_setup.py
Outputs art/console-setup.blend, art/console-setup-studio.png and public/assets/console-setup.glb.
Blender Z-up; the front faces -Y (glTF +Z). Units match the archive scene (case height 3.7).
Origin: centre of the console's footprint on the stand top (z = 0).
Named nodes used by the site: Console_Slot (slot centre), Slot_Light, Monitor_Screen.
After exporting, run `npm run compress:console` (meshopt + WebP, keeps marker nodes).
"""
from pathlib import Path
from math import pi, sin, cos

import bmesh
import bpy
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
CW, CH, CD = 3.9, 0.95, 2.6        # console
SW, SH, SD = 12.0, 0.24, 6.0       # shared terminal base (top at z = 0)
MW, MH = 6.4, 3.6                  # monitor screen
MX, MZ, MY = 0.0, 0.95, 2.15       # compact stem; console stands beside the display

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


SHELL = material("Console_Shell", (0.68, 0.70, 0.69), 0.43)
CORE = material("Console_Core", (0.02, 0.022, 0.026), 0.3)
LIGHT = material("Slot_Light", (0.8, 0.57, 0.27), 0.3, emission=(1.0, 0.66, 0.27))
STAND = material("Stand_Surface", (0.19, 0.21, 0.22), 0.72)
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
box("Stand", (SW, SD, SH), (-0.1, 0.65, -SH / 2), STAND, bevel=0.08)
box("Stand_Underframe", (SW-.32, SD-.32, .12), (-.1, .65, -.28), BEZEL, bevel=.065)

# Moulded enclosure with a recessed graphite chassis, floating top and rubber feet.
# A real open mouth between the upper/lower chassis rails receives the animated disc.
RUBBER = material("Rubber", (0.009, 0.012, 0.014), 0.86)
METAL = material("Port_Metal", (0.25, 0.28, 0.30), 0.28, metallic=0.8)
INK = material("Printed_Legends", (0.32, 0.35, 0.36), 0.6)
SHADOW = material("Recess_Shadow", (0.004, 0.006, 0.008), 0.8)

# Recessed metal sled feet and a soft equipment pad, rather than a floating slab.
for x in [-4.65, 4.65]:
    box("Stand_Support", (.16, 3.8, .65), (x, .7, -.6), BEZEL, .04)
    box("Stand_Foot", (.65, 4.1, .10), (x, .7, -.95), BEZEL, .045)
box("Stand_Controller_Pad", (3.8, 2.4, .035), (-.2, -.75, .02), RUBBER, .14, 6)
box("Stand_Front_Inlay", (SW-.4, .016, .014), (-.1, -2.354, -.12), METAL, .004)

# Controller; all controls face +Z on the desk.
CP = Vector((-.2, -.75, .36))
bpy.ops.object.empty_add(location=CP)
bpy.context.object.name = "Controller_Pivot"

# Shuhang's own controller, generated with Meshy from art/controller-design.svg.
# Source and modifications: art/vendor/gamepad/NOTES.md.
import numpy as np
before=set(scene.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'art/vendor/gamepad/source.glb'))
body=next(o for o in scene.objects if o not in before and o.type=='MESH')
# The source faces -Y after glTF import. Lay its front face upward on the desk,
# normalise the width and float it just above the soft pad.
body.parent=None
body.matrix_world=Matrix.Rotation(-pi/2,4,'X') @ body.matrix_world
world=[body.matrix_world @ Vector(corner) for corner in body.bound_box]
low=Vector(tuple(min(v[i] for v in world) for i in range(3)))
high=Vector(tuple(max(v[i] for v in world) for i in range(3)))
factor=3.1/(high.x-low.x)
centre=(low+high)/2
body.matrix_world=Matrix.Translation(Vector((CP.x,CP.y,.055))-Vector((centre.x,centre.y,low.z))*factor) @ Matrix.Scale(factor,4) @ body.matrix_world
body.name='Controller_Body'
# Moving parts, measured on the source: centre and radius as fractions of the width,
# and the height (in desk units above the pad) below which the shell is left alone.
# The site tilts the sticks and d-pad, presses the buttons and lights the home button.
MID=.055+(high.z-low.z)*factor*.5
PARTS=[('Controller_Stick_L',(-.2796,.1524),.068,1.120),('Controller_Stick_R',(.1387,.0032),.068,1.186),
       ('Controller_Dpad',(-.1282,.0105),.072,MID),('Controller_Button_X',(.2796,.1913),.039,MID),
       ('Controller_Button_Y',(.2218,.1303),.039,MID),('Controller_Button_B',(.3458,.1335),.039,MID),
       ('Controller_Button_A',(.2848,.0704),.039,MID),('Controller_Player_Light_Home',(-.002,.170),.047,MID)]
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
bpy.context.view_layer.objects.active=body
for name,(nx,ny),radius,floor in PARTS:
    mesh=body.data
    centres=np.empty(len(mesh.polygons)*3,dtype=np.float32)
    mesh.polygons.foreach_get('center',centres)
    c=centres.reshape(-1,3) @ np.array(body.matrix_world.to_3x3()).T + np.array(body.matrix_world.translation)
    inside=(np.hypot((c[:,0]-CP.x)/3.1-nx,(c[:,1]-CP.y)/3.1-ny)<radius) & (c[:,2]>floor)
    known=set(scene.objects)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_mode(type='FACE')
    bpy.ops.mesh.select_all(action='DESELECT')
    edit=bmesh.from_edit_mesh(mesh)
    edit.faces.ensure_lookup_table()
    for index in np.flatnonzero(inside): edit.faces[index].select_set(True)
    bmesh.update_edit_mesh(mesh)
    bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')
    part=next(o for o in scene.objects if o not in known)
    part.name=part.data.name=name
    part.select_set(False)
    print(name,int(inside.sum()),'faces')
# The generated mesh is far denser than the web needs; UVs survive the collapse.
# Splitting first keeps the seams between the parts fine.
for obj in [o for o in scene.objects if o not in before and o.type=='MESH']:
    tris=sum(len(p.vertices)-2 for p in obj.data.polygons)
    reduce=obj.modifiers.new('Web budget','DECIMATE')
    reduce.ratio=min(1,(56000 if obj is body else 1400)/max(1,tris))
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=reduce.name)
bpy.ops.object.select_all(action='DESELECT')
for obj in list(scene.objects):
    if obj not in before and obj.type=='EMPTY': bpy.data.objects.remove(obj,do_unlink=True)

def shell(name, levels):
    # Rounded perimeter rings, with tapered side walls rather than stacked cubes.
    verts, faces = [], []
    count = 36
    for z, width, depth, radius in levels:
        for cx, cy, start in [(width/2-radius, depth/2-radius, 0),
                               (-width/2+radius, depth/2-radius, pi/2),
                               (-width/2+radius, -depth/2+radius, pi),
                               (width/2-radius, -depth/2+radius, 3*pi/2)]:
            for i in range(9):
                a = start + i*pi/16
                verts.append((cx+radius*cos(a), cy+radius*sin(a), z))
    faces.append(tuple(reversed(range(count))))
    for ring in range(len(levels)-1):
        for i in range(count):
            a, b = ring*count+i, ring*count+(i+1)%count
            faces.append((a, b, b+count, a+count))
    faces.append(tuple(range((len(levels)-1)*count, len(levels)*count)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    mesh.materials.append(SHELL)
    bevel = obj.modifiers.new("Moulded edge highlights", "BEVEL")
    bevel.width, bevel.segments = 0.012, 2
    obj.modifiers.new("Panel normals", "WEIGHTED_NORMAL")
    return obj

shell("Console_Shell_Lower", [(0.09, 3.55, 2.36, .17), (.15, 3.90, 2.62, .20),
                              (.29, 3.92, 2.64, .20), (.32, 3.84, 2.56, .18)])
shell("Console_Shell_Upper", [(.66, 3.82, 2.54, .16), (.73, 4.02, 2.68, .20),
                              (.88, 3.96, 2.64, .21), (.95, 3.78, 2.48, .23)])
for x in [-1.42, 1.42]:
    for y in [-.88, .88]:
        box("Console_Rubber_Foot", (.44, .36, .09), (x, y, .045), RUBBER, .035)
box("Console_Chassis_Floor", (3.65, 2.38, .12), (0, 0, .36), CORE, .025)
box("Console_Chassis_Ceiling", (3.65, 2.38, .13), (0, 0, .60), CORE, .025)
box("Console_Drive_Interior", (3.4, .1, .17), (-.12, 1.10, .475), SHADOW, .01)
for x in [-1.77, 1.77]:
    box("Console_Side_Vent_Recess", (.08, 2.2, .25), (x, 0, .49), SHADOW, .02)
    for i in range(27):
        box("Console_Side_Louvre", (.12, .028, .23), (x, -1.03+i*.079, .49), CORE, .006, 2)

slot_z = CH * 0.5
# Front fascia surrounds a 2.9 x .09 clear opening, centred on the original marker.
for z in [.3775, .5875]:
    box("Console_Fascia_Rail", (3.65, .14, .105), (0, -1.23, z), CORE, .014)
box("Console_Fascia_Left", (.125, .14, .12), (-1.7625, -1.23, .475), CORE, .012)
box("Console_Control_Panel", (.375, .14, .12), (1.6375, -1.23, .475), CORE, .012)
for z in [.425, .525]:
    box("Console_Drive_Lip", (2.91, .05, .012), (-.25, -1.301, z), RUBBER, .005, 2)
box("Slot_Light", (1.10, .018, .012), (-1.08, -1.323, .685), LIGHT, .005, 3)

def front_text(name, text, location, size, mat):
    bpy.ops.object.select_all(action="DESELECT")
    curve = bpy.data.curves.new(name, "FONT")
    curve.body, curve.size, curve.extrude = text, size, 0
    obj = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler.x = pi/2
    curve.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)

# USB-C and USB-A sockets: metal rims, recessed dark cavities, central tongues.
for name, x, w, h in [("USB_C", .87, .16, .052), ("USB_A", 1.15, .22, .072)]:
    box("Console_"+name+"_Rim", (w, .018, h), (x, -1.308, .587), METAL, .015, 4)
    box("Console_"+name+"_Cavity", (w-.018, .012, h-.014), (x, -1.320, .587), SHADOW, .01, 3)
    box("Console_"+name+"_Tongue", (w*.64, .008, .011), (x, -1.328, .582), CORE, .002, 2)
box("Console_Power_Button", (.12, .02, .065), (1.63, -1.31, .48), METAL, .025, 5)
front_text("Console_Power_Legend", "I", (1.618, -1.324, .46), .052, SHELL)
front_text("Console_Eject_Legend", "EJECT", (1.47, -1.305, .36), .04, INK)
front_text("Console_Drive_Legend", "DISC / 01", (-1.59, -1.307, .362), .045, INK)

# Split top service panel and ventilation grille set into the aft edge.
box("Console_Top_Seam", (.012, 2.20, .003), (.98, 0, .953), SHADOW, .001, 1)
for i in range(32):
    box("Console_Top_Intake", (.045, .32, .006), (-1.48+i*.076, .89, .954), SHADOW, .016, 3)
front_text("Console_Serial", "L A P P A S  /  0 1", (-1.50, -1.307, .205), .062, INK)

# Back I/O panel with distinct power, HDMI and network sockets.
box("Console_Rear_Panel", (3.4, .05, .25), (0, 1.20, .49), CORE, .015)
for x, w in [(-1.23, .26), (-.61, .29), (.04, .24)]:
    box("Console_Rear_Port_Rim", (w, .018, .13), (x, 1.231, .48), METAL, .018)
    box("Console_Rear_Port_Recess", (w-.03, .014, .10), (x, 1.244, .48), SHADOW, .012)
for i in range(13):
    box("Console_Rear_Exhaust", (.028, .015, .17), (.48+i*.077, 1.235, .49), SHADOW, .008, 2)
# Marker at the slot mouth; the site sends the disc here.
bpy.ops.object.empty_add(location=(-0.25, -CD / 2, slot_z))
bpy.context.object.name = "Console_Slot"

# Upright twin-panel enclosure beside the display, inspired by the PS5 silhouette.
# Keep the manufactured drive, ports and ventilation, rotating the entire chassis
# so its genuine open drive mouth becomes vertical. A dedicated foot supports it.
upright = Matrix.Translation(Vector((4.0, .25, 2.15))) @ Matrix.Rotation(pi/2, 4, 'Y')
for obj in list(scene.objects):
    if obj.name.startswith('Console_') or obj.name == 'Slot_Light':
        if obj.name.startswith('Console_Rubber_Foot'):
            bpy.data.objects.remove(obj, do_unlink=True)
        else:
            obj.matrix_world = upright @ obj.matrix_world
box('Console_Vertical_Base', (1.65, 2.8, .16), (4.48, .25, .08), BEZEL, .07)

# Monitor on a short foot, screen facing front.
box("Monitor_Foot", (2.3, 1.05, 0.07), (MX, MY+.2, .035), BEZEL, bevel=.04)
box("Monitor_Neck", (.34, .22, MZ+.2), (MX, MY+.35, (MZ+.2)/2), BEZEL, bevel=.035)
box("Monitor_Rear", (MW+.16, .19, MH+.16), (MX, MY+.08, MZ+MH/2), SHELL, bevel=.065)
box("Monitor_Frame", (MW+.24, .22, MH+.24), (MX, MY, MZ+MH/2), BEZEL, bevel=.045)
box("Monitor_Chin", (MW+.12, .035, .12), (MX, MY-.125, MZ-.065), CORE, bevel=.015)
front_text("Monitor_Name", "L A P P A S  /  T E R M I N A L", (-.72, MY-.146, MZ-.084), .048, SHELL)
# The screen is a plain quad with 0..1 UVs so the site can draw on it.
mesh = bpy.data.meshes.new("Monitor_Screen")
bm = bmesh.new()
y = MY - 0.115
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

# Physical assembly checks: the stand is behind the enclosure and the screen
# has a visibly exposed stem, rather than a chin apparently buried in the shell.
assert MX + (MW + .24) / 2 < 4.0
assert MX + 2.3 / 2 < 4.48 - 1.65 / 2
print(f"monitor / console lateral gap: {4.0 - MX - (MW + .24) / 2:.3f}")

bpy.ops.object.camera_add(location=(4, -26, 7))
cam = bpy.context.object
cam.location = (8, -15, 8)
cam.rotation_euler = (Vector((-.5, .4, 1.7)) - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.lens = 38
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

# Close-up for checking manufactured edges and the physical slot opening.
cam.location = (8, -7.5, 4.8)
cam.rotation_euler = (Vector((4.48, .25, 2.15)) - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.lens = 58
scene.render.filepath = str(ROOT / "art/console-detail.png")
bpy.ops.render.render(write_still=True)

# Batch static details by material; keep the animated light and screen independent.
# This retains editable part names in the .blend and avoids hundreds of web draw calls.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "art/console-setup.blend"))
for prefix in ["Console_"]:
    for mat in list(bpy.data.materials):
        pieces = [o for o in scene.objects if o.type == "MESH" and o.name.startswith(prefix) and not o.name.startswith("Controller_Player_Light")
                  and o.data.materials and o.data.materials[0] == mat]
        if len(pieces) < 2:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in pieces:
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            for modifier in list(obj.modifiers):
                bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.context.view_layer.objects.active = pieces[0]
        bpy.ops.object.join()
        pieces[0].name = prefix + "Batch_" + mat.name
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
